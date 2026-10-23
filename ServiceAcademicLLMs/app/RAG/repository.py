import json
import hashlib
import struct
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis

from app.config import settings
from app.services.activities import activity_statement, remediation, score_activity, _is_seed_format


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# rag -> texto desde redis
def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode()
    return str(value)


def _decode_hash(values: dict[bytes, bytes]) -> dict[str, str]:
    return {key.decode(): value.decode() for key, value in values.items()}


class RAGRepository:
    prefix = "shalom:rag"
    content_stream = "shalom:rag:queue:content"
    profile_stream = "shalom:rag:queue:student-profile"
    index_prefix = "shalom_knowledge_v4_idx"
    knowledge_prefix = "shalom:knowledge:v4"
    content_group = "rag-content-workers"
    profile_group = "rag-profile-workers"
    branches = {
        "students": "Hitos y perfil pedagógico aislados por estudiante y contenido; el perfil se actualiza cada cuatro pruebas.",
    }

    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        self._vector_dimension: int | None = None
        self._index_name: str | None = None
        self._embedding_namespace = hashlib.sha256(settings.ollama_embedding_model.encode()).hexdigest()[:10]
        self._vector_key_prefix = f"{self.knowledge_prefix}:vector:{self._embedding_namespace}:"

    @staticmethod
    def now() -> str:
        return utcnow()

    async def close(self) -> None:
        await self._redis.aclose()

    async def ping(self) -> bool:
        return bool(await self._redis.ping())

    async def vector_search_available(self) -> bool:
        try:
            await self._redis.execute_command("FT._LIST")
            return True
        except Exception as exc:
            if "unknown command" in str(exc).casefold() or "unknown subcommand" in str(exc).casefold():
                return False
            raise

    async def is_initialized(self) -> bool:
        return bool(await self._redis.exists(f"{self.prefix}:meta"))

    async def structure_overview(self) -> dict[str, Any]:
        raw = await self._redis.get(f"{self.prefix}:structure")
        structure = json.loads(raw) if raw else {"name": "Shalom Academic Knowledge Base", "version": "3", "levels": []}
        counts = {"grado": 0, "curso": 0, "materia": 0, "tema": 0, "vectores": 0}
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=f"{self.knowledge_prefix}:*", count=500)
            for raw_key in keys:
                key = raw_key.decode() if isinstance(raw_key, bytes) else str(raw_key)
                parts = key.split(":")
                if ":vector:" in key:
                    counts["vectores"] += 1
                elif len(parts) == 5:
                    counts["grado"] += 1
                elif len(parts) == 7:
                    counts["curso"] += 1
                elif len(parts) == 9:
                    counts["materia"] += 1
                elif len(parts) == 11:
                    counts["tema"] += 1
            if cursor == 0:
                break
        structure["records"] = counts
        return structure

    # rag -> estructura educativa basada en materiales fuente
    async def initialize(self) -> None:
        now = utcnow()
        meta_key = f"{self.prefix}:meta"
        migration_key = f"{self.prefix}:migration:knowledge-v3"
        if not await self._redis.exists(migration_key):
            for pattern in (f"{self.prefix}:vector:*", f"{self.prefix}:branch:knowledge:record:*",
                            f"{self.prefix}:branch:knowledge:entity:*", f"{self.prefix}:branch:subjects:record:*",
                            f"{self.prefix}:branch:subjects:entity:*", f"{self.prefix}:branch:topics:record:*",
                            f"{self.prefix}:branch:topics:entity:*", f"{self.prefix}:branch:methodology:record:*",
                            f"{self.prefix}:branch:methodology:entity:*", f"{self.prefix}:framework:indexed:*"):
                cursor = 0
                legacy_keys = []
                while True:
                    cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=500)
                    legacy_keys.extend(keys)
                    if cursor == 0:
                        break
                for offset in range(0, len(legacy_keys), 500):
                    await self._redis.unlink(*legacy_keys[offset:offset + 500])
            try:
                for raw_index in await self._redis.execute_command("FT._LIST"):
                    index = raw_index.decode() if isinstance(raw_index, bytes) else str(raw_index)
                    if index.startswith("shalom_rag_idx_"):
                        await self._redis.execute_command("FT.DROPINDEX", index, "DD")
            except Exception:
                pass
            await self._redis.unlink(*(f"{self.prefix}:branch:{branch}" for branch in ("knowledge", "subjects", "topics", "methodology")))
            await self._redis.set(migration_key, now)
        methodology_migration = f"{self.prefix}:migration:remove-methodology-v1"
        if not await self._redis.exists(methodology_migration):
            cursor = 0
            legacy_vectors = []
            while True:
                cursor, keys = await self._redis.scan(cursor=cursor, match=f"{self.knowledge_prefix}:vector:*", count=500)
                for key in keys:
                    if await self._redis.hget(key, "record_type") in {b"learning_framework", "learning_framework"}:
                        legacy_vectors.append(key)
                if cursor == 0:
                    break
            if legacy_vectors:
                await self._redis.unlink(*legacy_vectors)
            stale_keys = []
            for pattern in (f"{self.prefix}:framework:*", f"{self.prefix}:branch:methodology*"):
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=500)
                    stale_keys.extend(keys)
                    if cursor == 0:
                        break
            for offset in range(0, len(stale_keys), 500):
                await self._redis.unlink(*stale_keys[offset:offset + 500])
            await self._redis.hdel(f"{self.prefix}:meta:prompts", "microlearning", "inquiry_based_learning")
            await self._redis.set(methodology_migration, now)
        await self._redis.hset(meta_key, mapping={
            "schema_version": "4",
            "vector_index_prefix": self.index_prefix,
            "student_profile_policy": "actualizar cada 4 cuestionarios completados",
            "profile_isolation": "student_id + content_id",
        })
        await self._redis.set(f"{self.prefix}:structure", json.dumps({
            "name": "Shalom Educational Content RAG",
            "version": "4",
            "levels": ["grado", "curso", "materia", "unidad", "material", "fragmento_fuente", "conceptos", "actividades", "progreso_estudiante"],
            "flow": ["material docente", "fragmentos y referencias", "conceptos y objetivos", "microlearning e indagacion generados desde la evidencia", "actividades", "progreso privado por estudiante"],
            "knowledge_policy": "El material indexado conserva su contenido fuente y procedencia; los marcos pedagogicos genericos no se indexan como conocimiento academico.",
            "sharing_scope": "La evidencia docente se filtra por material, materia y grado; el progreso se aisla por estudiante y contenido.",
            "privacy": "El progreso se consulta siempre con student_id y content_id; no almacena datos de identidad.",
        }, ensure_ascii=False))
        for branch, description in self.branches.items():
            await self._redis.hset(f"{self.prefix}:branch:{branch}", mapping={
                "branch_id": branch, "description": description, "status": "active", "updated_at": now,
            })
        await self._redis.hsetnx(meta_key, "initialized_at", now)
    async def enqueue_content(self, content_id: str, job: dict[str, Any]) -> bool:
        script = """
        local state = redis.call('GET', KEYS[1])
        if state and state ~= 'failed' then return 0 end
        redis.call('SET', KEYS[1], 'queued')
        redis.call('HSET', KEYS[2], 'status', 'PENDING', 'attempts', '0', 'updated_at', ARGV[2], 'event', ARGV[1])
        redis.call('XADD', KEYS[3], '*', 'content_id', ARGV[3])
        return 1
        """
        return bool(await self._redis.eval(
            script, 3,
            f"{self.prefix}:content:{content_id}:state",
            f"{self.prefix}:job:{content_id}", self.content_stream,
            json.dumps(job, ensure_ascii=False), utcnow(), content_id,
        ))

    async def job_status(self, content_id: str) -> dict[str, str] | None:
        result = await self._redis.hgetall(f"{self.prefix}:job:{content_id}")
        return _decode_hash(result) if result else None

    async def update_job(self, content_id: str, **values: str) -> None:
        values["updated_at"] = utcnow()
        await self._redis.hset(f"{self.prefix}:job:{content_id}", mapping=values)

    async def mark_content_state(self, content_id: str, state: str) -> None:
        await self._redis.set(f"{self.prefix}:content:{content_id}:state", state)

    async def get_cache(self, key: str) -> bytes | None:
        return await self._redis.get(key)

    async def set_cache(self, key: str, value: str, ttl: int) -> None:
        await self._redis.set(key, value, ex=ttl)

    async def ensure_consumer_group(self, stream: str, group: str) -> None:
        try:
            await self._redis.xgroup_create(stream, group, id="0", mkstream=True)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def read_messages(self, stream: str, group: str, consumer: str, block_ms: int = 1500):
        batches = await self._redis.xreadgroup(group, consumer, {stream: ">"}, count=1, block=block_ms)
        if batches:
            return batches[0][1]
        # rag -> reclamo de mensajes tras reiniciar el contenedor
        claimed = await self._redis.xautoclaim(stream, group, consumer, 60_000, start_id="0-0", count=1)
        return claimed[1] if len(claimed) > 1 else []

    async def acknowledge(self, stream: str, group: str, message_id: bytes | str) -> None:
        await self._redis.xack(stream, group, message_id)

    async def retry_content(self, content_id: str) -> None:
        await self._redis.xadd(self.content_stream, {"content_id": content_id})

    async def retry_profile(self, student_id: str, content_id: str, batch_number: int) -> None:
        await self._redis.xadd(self.profile_stream, {"student_id": student_id, "content_id": content_id, "batch_number": batch_number})

    async def increment_profile_job_attempts(self, student_id: str, content_id: str, batch_number: int) -> int:
        return int(await self._redis.incr(f"{self.prefix}:student:{student_id}:content:{content_id}:profile-batch:{batch_number}:attempts"))

    async def set_profile_job_status(self, student_id: str, content_id: str, batch_number: int, status: str, error: str = "") -> None:
        await self._redis.hset(
            f"{self.prefix}:student:{student_id}:content:{content_id}:profile-batch:{batch_number}:status",
            mapping={"status": status, "error": error, "updated_at": utcnow()},
        )

    async def ensure_vector_index(self, dimension: int) -> str:
        index_name = f"{self.index_prefix}_{self._embedding_namespace}_{dimension}"
        if self._vector_dimension == dimension and self._index_name == index_name:
            return index_name
        try:
            await self._redis.execute_command("FT.INFO", index_name)
        except Exception:
            await self._redis.execute_command(
                "FT.CREATE", index_name, "ON", "HASH", "PREFIX", "1", self._vector_key_prefix,
                "SCHEMA", "branch", "TAG", "content_id", "TAG", "student_id", "TAG", "subject_id", "TAG",
                "topic_id", "TAG", "grade", "TAG", "record_type", "TAG", "source", "TAG", "text", "TEXT",
                "embedding", "VECTOR", "HNSW", "6", "TYPE", "FLOAT32", "DIM", dimension,
                "DISTANCE_METRIC", "COSINE",
            )
        self._vector_dimension, self._index_name = dimension, index_name
        return index_name

    async def save_vector(self, content_id: str, chunk_id: str, text: str, embedding: list[float], metadata: dict[str, Any]) -> None:
        await self.ensure_vector_index(len(embedding))
        student_id = str(metadata.get("student_id") or "")
        if student_id:
            identity = f"student:{student_id}:{content_id}:{chunk_id}"
        else:
            scope = "|".join([content_id, *(str(metadata.get(field) or "") for field in ("grade", "subject_id", "topic_id", "record_type"))])
            slot = str(metadata.get("record_slot") or hashlib.sha256(text.encode("utf-8")).hexdigest())
            identity = f"{scope}|{slot}"
        key = f"{self._vector_key_prefix}{hashlib.sha256(identity.encode('utf-8')).hexdigest()}"
        fields = {key: str(value) for key, value in metadata.items() if value is not None and value != ""}
        fields.update({"content_id": content_id, "chunk_id": chunk_id, "text": text, "embedding": struct.pack(f"{len(embedding)}f", *embedding)})
        await self._redis.hset(key, mapping=fields)

    # rag -> mini-contextos rastreables por materia y tema
    async def save_branch_context(self, branch: str, entity_id: str, content_id: str, text: str,
                                  embedding: list[float], metadata: dict[str, Any]) -> None:
        safe_entity = f"{metadata.get('grade', 'general')}-{entity_id}".replace(":", "_")
        await self._redis.hset(
            f"{self.prefix}:branch:{branch}:entity:{safe_entity}:content:{content_id}",
            mapping={"branch": branch, "entity_id": entity_id, "content_id": content_id,
                     "context": text, "updated_at": utcnow(), **{k: str(v) for k, v in metadata.items() if v is not None}},
        )
        await self.save_vector(content_id, f"{branch}-{safe_entity}-{content_id}", text, embedding,
                               {**metadata, "branch": branch, "record_type": f"{branch[:-1]}_context"})

    async def save_hierarchy_node(self, branch: str, entity_id: str, content_id: str, context: str,
                                  metadata: dict[str, Any]) -> None:
        hash_id = lambda value: hashlib.sha256(str(value or "general").encode("utf-8")).hexdigest()[:20]
        grade_id = hash_id(metadata.get("grade"))
        course_id = hash_id(metadata.get("course") or metadata.get("grade"))
        subject_id = hash_id(metadata.get("subject_id") or entity_id)
        base = f"{self.knowledge_prefix}:grade:{grade_id}:course:{course_id}"
        timestamp = utcnow()
        await self._redis.set(f"{self.knowledge_prefix}:grade:{grade_id}", json.dumps({
            "level": "grado", "grade": metadata.get("grade", ""), "updated_at": timestamp,
        }, ensure_ascii=False))
        await self._redis.set(base, json.dumps({
            "level": "curso", "grade": metadata.get("grade", ""), "course": metadata.get("course", ""),
            "updated_at": timestamp,
        }, ensure_ascii=False))
        if branch == "subjects":
            await self._redis.set(f"{base}:subject:{subject_id}", json.dumps({
                "level": "materia", "grade": metadata.get("grade", ""), "course": metadata.get("course", ""),
                "subject_id": metadata.get("subject_id") or entity_id, "subject": metadata.get("subject", ""),
                "updated_at": timestamp,
            }, ensure_ascii=False))
        elif branch == "topics":
            topic_id = hash_id(metadata.get("topic_id") or entity_id)
            await self._redis.set(f"{base}:subject:{subject_id}:topic:{topic_id}", json.dumps({
                "level": "tema", "grade": metadata.get("grade", ""), "course": metadata.get("course", ""),
                "subject_id": metadata.get("subject_id", ""), "subject": metadata.get("subject", ""),
                "topic_id": metadata.get("topic_id") or entity_id, "content_id": content_id,
                "data": json.loads(context), "updated_at": timestamp,
            }, ensure_ascii=False))

    async def save_validated_content(self, content_id: str, data: dict[str, Any]) -> None:
        document_id = str(data.get("document_id") or data.get("source_document_id") or "").strip()
        if not document_id:
            base, _, suffix = content_id.rpartition("-")
            if base.isdigit() and suffix:
                document_id = base
        if document_id:
            data["document_id"] = document_id
        await self._redis.set(f"{self.prefix}:content:{content_id}:validated", json.dumps(data, ensure_ascii=False))
        await self._redis.set(f"{self.prefix}:content:{content_id}:activities", json.dumps(data.get("activities", []), ensure_ascii=False))
        if document_id:
            await self._redis.set(f"{self.prefix}:document:{document_id}:latest_content", content_id)
        await self.mark_content_state(content_id, "processed")

    async def get_validated_content(self, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:content:{content_id}:validated")
        return json.loads(value) if value else None

    # rag -> localizar contenido por documento
    async def _content_id_from_scan(self, match: str, document_id: str | None = None) -> str:
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=match, count=50)
            for key in keys:
                key_text = _text(key)
                if ":content:" not in key_text or not key_text.endswith(":validated"):
                    continue
                found = key_text.split(":content:", 1)[1].rsplit(":validated", 1)[0]
                if not document_id:
                    return found
                raw = await self._redis.get(key)
                candidate = json.loads(raw) if raw else {}
                ids = {str(candidate.get("document_id") or ""), str(candidate.get("source_document_id") or "")}
                if document_id in ids or found == document_id or found.startswith(f"{document_id}-"):
                    return found
            if cursor == 0:
                return ""

    async def get_document_learning_content(self, document_id: str) -> dict[str, Any] | None:
        document_id = str(document_id or "").strip()
        if not document_id:
            return None
        content_id = _text(await self._redis.get(f"{self.prefix}:document:{document_id}:latest_content"))
        if content_id and not await self.get_validated_content(content_id):
            content_id = ""
        if not content_id:
            direct = await self.get_validated_content(document_id)
            if direct:
                content_id = document_id
        if not content_id:
            content_id = await self._content_id_from_scan(f"{self.prefix}:content:{document_id}-*:validated")
        if not content_id:
            content_id = await self._content_id_from_scan(f"{self.prefix}:content:{document_id}:validated")
        if not content_id:
            content_id = await self._content_id_from_scan(f"{self.prefix}:content:*:validated", document_id)
        if not content_id:
            return None
        content = await self.get_validated_content(content_id)
        if not content:
            return None
        await self._redis.set(f"{self.prefix}:document:{document_id}:latest_content", content_id)
        return {"content_id": content_id, "content": content}

    # rag -> banco de actividades validadas del contenido
    async def get_activity_bank(self, content_id: str) -> list[dict[str, Any]]:
        value = await self._redis.get(f"{self.prefix}:content:{content_id}:activities")
        return json.loads(value) if value else []

    # rag -> reutilizar reactivos validados del mismo tema
    async def get_reusable_exercises(self, topic_id: str, limit: int = 40) -> list[dict[str, Any]]:
        if not topic_id:
            return []
        cursor = 0
        encontrados: list[dict[str, Any]] = []
        patron = f"{self._vector_key_prefix}*"
        while len(encontrados) < limit:
            cursor, keys = await self._redis.scan(cursor=cursor, match=patron, count=200)
            for key in keys:
                campos = await self._redis.hmget(key, "topic_id", "record_type", "text")
                if _text(campos[0]) != topic_id or _text(campos[1]) != "learning_exercise":
                    continue
                try:
                    ejercicio = json.loads(_text(campos[2]))
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(ejercicio, dict):
                    encontrados.append(ejercicio)
                    if len(encontrados) >= limit:
                        break
            if cursor == 0:
                break
        return encontrados

    # resumen -> cache de formatos avanzados por contenido
    async def get_summary_cache(self, content_id: str, formato: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:content:{content_id}:summary:v3:{formato}")
        return json.loads(value) if value else None

    async def set_summary_cache(self, content_id: str, formato: str, data: dict[str, Any]) -> None:
        await self._redis.set(f"{self.prefix}:content:{content_id}:summary:v3:{formato}", json.dumps(data, ensure_ascii=False))

    # quiz -> retroalimentacion asincrona del reto (Mistral) por intento
    def _feedback_key(self, student_id: str, content_id: str, attempt_id: str) -> str:
        return f"{self.prefix}:student:{student_id}:content:{content_id}:attempt:{attempt_id}:feedback"

    async def set_quiz_feedback(self, student_id: str, content_id: str, attempt_id: str, feedback: dict[str, Any]) -> None:
        await self._redis.set(self._feedback_key(student_id, content_id, attempt_id), json.dumps(feedback, ensure_ascii=False))

    async def get_quiz_feedback(self, student_id: str, content_id: str, attempt_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(self._feedback_key(student_id, content_id, attempt_id))
        return json.loads(value) if value else None

    async def student_used_questions(self, student_id: str, content_id: str) -> tuple[set[str], list[str]]:
        base = f"{self.prefix}:student:{student_id}:content:{content_id}:used-questions"
        ids = await self._redis.smembers(f"{base}:ids")
        statements = await self._redis.hvals(f"{base}:statements")
        return {item.decode() for item in ids}, [item.decode() for item in statements]

    # quiz -> emision de actividades sin repeticiones por estudiante
    async def save_quiz(self, student_id: str, content_id: str, quiz_id: str, activities: list[dict[str, Any]]) -> bool:
        base = f"{self.prefix}:student:{student_id}:content:{content_id}:used-questions"
        script = """
        local count = tonumber(ARGV[2])
        local batch_fingerprints = {}
        for i = 1, count do
          local activity_id = ARGV[2 + (i - 1) * 3 + 1]
          local fingerprint = ARGV[2 + (i - 1) * 3 + 2]
          if batch_fingerprints[fingerprint] then return 0 end
          batch_fingerprints[fingerprint] = true
        end
        redis.call('SET', KEYS[3], ARGV[1], 'EX', 2592000)
        for i = 1, count do
          local activity_id = ARGV[2 + (i - 1) * 3 + 1]
          local fingerprint = ARGV[2 + (i - 1) * 3 + 2]
          local statement = ARGV[2 + (i - 1) * 3 + 3]
          redis.call('SADD', KEYS[1], activity_id)
          redis.call('HSET', KEYS[2], fingerprint, statement)
        end
        return 1
        """
        args: list[Any] = [json.dumps({"quiz_id": quiz_id, "student_id": student_id, "content_id": content_id, "activities": activities}, ensure_ascii=False), len(activities)]
        for activity in activities:
            args.extend([activity["activity_id"], activity["fingerprint"], activity_statement(activity)])
        result = await self._redis.eval(
            script, 3, f"{base}:ids", f"{base}:statements",
            f"{self.prefix}:student:{student_id}:content:{content_id}:quiz:{quiz_id}", *args,
        )
        return bool(result)

    async def get_quiz(self, student_id: str, content_id: str, quiz_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:quiz:{quiz_id}")
        return json.loads(value) if value else None

    # quiz -> valida un emparejamiento (LEGACY: solo formato CONECTAR_FRASES)
    async def check_match_pair(self, student_id: str, content_id: str, quiz_id: str, activity_id: str, left: str, right: str) -> dict[str, Any]:
        quiz = await self.get_quiz(student_id, content_id, quiz_id)
        if not quiz:
            raise LookupError("No existe este reto para el estudiante")
        activity = next((item for item in quiz.get("activities", []) if item.get("activity_id") == activity_id), None)
        if not activity:
            raise ValueError("Actividad no encontrada")
        if _is_seed_format(activity):
            raise ValueError("El formato de reactivo unificado no soporta emparejamiento interactivo")
        if activity.get("tipo") != "CONECTAR_FRASES":
            raise ValueError("La actividad no es un emparejamiento valido")
        pairs = activity.get("pairs", [])
        expected = next((item.get("right", "") for item in pairs if item.get("left", "").strip().casefold() == left.strip().casefold()), None)
        if expected is None:
            raise ValueError("El concepto no pertenece a esta actividad")
        correct = expected.strip().casefold() == right.strip().casefold()
        return {"correct": correct, "feedback": remediation(activity, correct), "expected": "" if correct else expected}

    async def vector_search(self, query_vector: list[float], limit: int = 5, filters: dict[str, str] | None = None) -> list[dict[str, str]]:
        index_name = await self.ensure_vector_index(len(query_vector))
        vector = struct.pack(f"{len(query_vector)}f", *query_vector)
        query = "*"
        if filters:
            clauses = []
            for key, value in filters.items():
                escaped = str(value).replace("\\", "\\\\").replace("-", "\\-").replace(" ", "\\ ")
                clauses.append(f"@{key}:{{{escaped}}}")
            query = " ".join(clauses)
        result = await self._redis.execute_command(
            "FT.SEARCH", index_name, f"({query})=>[KNN {limit} @embedding $vector AS score]",
            "PARAMS", "2", "vector", vector, "SORTBY", "score", "RETURN", "9",
            "content_id", "chunk_id", "text", "subject_id", "topic_id", "grade", "student_id", "record_type", "branch", "DIALECT", "2",
        )
        found = []
        if isinstance(result, dict):
            rows = result.get(b"results", result.get("results", []))
            for row in rows:
                if not isinstance(row, dict):
                    continue
                fields = row.get(b"extra_attributes", row.get("extra_attributes", {}))
                if isinstance(fields, dict):
                    found.append({_text(key): _text(value) for key, value in fields.items()})
                elif isinstance(fields, list):
                    found.append({_text(fields[i]): _text(fields[i + 1]) for i in range(0, len(fields) - 1, 2)})
            return found
        for i in range(1, len(result), 2):
            fields = result[i + 1]
            found.append({fields[j].decode(): fields[j + 1].decode(errors="ignore") for j in range(0, len(fields), 2)})
        return found

    # quiz -> corrige la entrega segun el tipo de cada actividad
    async def record_quiz_attempt(self, student_id: str, content_id: str, attempt_id: str, answers: list[dict[str, str]], elapsed_ms: int = 0) -> dict[str, Any]:
        quiz = await self.get_quiz(student_id, content_id, attempt_id)
        if not quiz:
            raise LookupError("No existe un cuestionario emitido para este estudiante y contenido")
        activities = {str(item["activity_id"]): item for item in quiz.get("activities", [])}
        if len(answers) != len(activities):
            raise ValueError("Debe responder todas las actividades de la prueba")
        activity_ids = [answer["activity_id"] for answer in answers]
        if len(activity_ids) != len(set(activity_ids)):
            raise ValueError("La prueba no puede repetir actividades")
        if any(answer["activity_id"] not in activities for answer in answers):
            raise ValueError("La prueba contiene actividades ajenas al contenido")
        if set(activity_ids) != set(activities):
            raise ValueError("Debe responder exactamente las actividades emitidas")
        evaluation = []
        for answer in answers:
            activity = activities[answer["activity_id"]]
            correct = score_activity(activity, answer["response"])
            tipo_visible = activity.get("tipo") or ("CUESTIONARIO" if activity.get("type") in ("THEORETICAL", "PRACTICAL") else "")
            evaluation.append({"activity_id": answer["activity_id"], "tipo": tipo_visible, "correct": correct,
                               "concept": activity.get("learning_objective", ""),
                               "difficulty": activity.get("difficulty", "inicial"),
                               "feedback": remediation(activity, correct)})
        correct_count = sum(1 for answer in evaluation if answer["correct"])
        attempt = {"attempt_id": attempt_id, "student_id": student_id, "content_id": content_id,
                   "score": correct_count / len(evaluation), "correct": correct_count, "total": len(evaluation),
                   "answers": evaluation, "elapsed_ms": elapsed_ms, "completed_at": utcnow()}
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        script = """
        if redis.call('SADD', KEYS[1], ARGV[1]) == 0 then return {-1, 0} end
        redis.call('RPUSH', KEYS[2], ARGV[2])
        local total = redis.call('LLEN', KEYS[2])
        if total % 4 == 0 then
          local batch = total / 4
          redis.call('XADD', KEYS[3], '*', 'student_id', ARGV[3], 'content_id', ARGV[4], 'batch_number', batch)
          redis.call('HSET', ARGV[5] .. batch .. ':status', 'status', 'PENDING', 'updated_at', ARGV[6])
          redis.call('SET', ARGV[5] .. batch .. ':attempts', '0')
          return {total, batch}
        end
        return {total, 0}
        """
        attempt_count, batch_number = await self._redis.eval(
            script, 3, f"{key}:ids", key, self.profile_stream,
            attempt_id, json.dumps(attempt, ensure_ascii=False), student_id, content_id,
            f"{self.prefix}:student:{student_id}:content:{content_id}:profile-batch:", utcnow(),
        )
        if int(attempt_count) < 0:
            return {**attempt, "duplicate": True, "attempt_count": int(await self._redis.llen(key)), "profile_queued": False}
        
        # Calcular tiempo promedio de otros estudiantes para gamificación
        avg_time_others = await self.get_average_time_others(content_id, student_id)
        time_comparison = "faster" if elapsed_ms > 0 and avg_time_others > 0 and elapsed_ms < avg_time_others else "slower"
        time_ratio = round(elapsed_ms / avg_time_others, 2) if avg_time_others > 0 and elapsed_ms > 0 else 1.0
        
        return {
            **attempt, 
            "duplicate": False, 
            "attempt_count": int(attempt_count), 
            "profile_queued": bool(batch_number),
            "avg_time_others_ms": round(avg_time_others),
            "time_comparison": time_comparison,
            "time_ratio": time_ratio,
        }

    async def profile_attempt_batch(self, student_id: str, content_id: str, batch_number: int) -> list[dict[str, Any]]:
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        end = batch_number * 4
        values = await self._redis.lrange(key, end - 4, end - 1)
        return [json.loads(value) for value in values]

    async def profile_attempt_summary(self, student_id: str, content_id: str) -> tuple[int, float, float]:
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        values = await self._redis.lrange(key, 0, -1)
        attempts = [json.loads(value) for value in values]
        average = sum(float(item["score"]) for item in attempts) / len(attempts) if attempts else 0.0
        average_elapsed_ms = sum(float(item.get("elapsed_ms", 0)) for item in attempts) / len(attempts) if attempts else 0.0
        return len(attempts), average, average_elapsed_ms

    # quiz -> tiempo promedio de otros estudiantes para comparativa (gamificación)
    async def get_average_time_others(self, content_id: str, exclude_student_id: str | None = None) -> float:
        pattern = f"{self.prefix}:student:*:content:{content_id}:attempts"
        cursor = 0
        total_time = 0.0
        total_attempts = 0
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=50)
            for key in keys:
                key_str = _text(key)
                student_id = key_str.split(":student:", 1)[1].split(":content:", 1)[0]
                if exclude_student_id and student_id == exclude_student_id:
                    continue
                values = await self._redis.lrange(key_str, 0, -1)
                for value in values:
                    attempt = json.loads(value)
                    total_time += float(attempt.get("elapsed_ms", 0))
                    total_attempts += 1
            if cursor == 0:
                break
        return total_time / total_attempts if total_attempts > 0 else 0.0

    async def get_student_profile(self, student_id: str, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:profile")
        return json.loads(value) if value else None

    async def get_student_learning_overview(self, student_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:learning-overview")
        return json.loads(value) if value else None

    async def save_student_learning_overview(self, student_id: str, profile: dict[str, Any]) -> None:
        await self._redis.set(
            f"{self.prefix}:student:{student_id}:learning-overview",
            json.dumps(profile, ensure_ascii=False),
        )

    async def save_student_profile(self, student_id: str, content_id: str, profile: dict[str, Any]) -> None:
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:profile"
        history = f"{self.prefix}:student:{student_id}:content:{content_id}:profile-history"
        encoded = json.dumps(profile, ensure_ascii=False)
        batch = int(profile["batch_number"])
        script = """
        local previous = tonumber(redis.call('HGET', KEYS[2], 'batch_number') or '0')
        if tonumber(ARGV[2]) <= previous then return 0 end
        redis.call('SET', KEYS[1], ARGV[1])
        redis.call('RPUSH', KEYS[3], ARGV[1])
        redis.call('HSET', KEYS[2], 'batch_number', ARGV[2])
        return 1
        """
        await self._redis.eval(script, 3, key, f"{key}:version", history, encoded, batch)
        await self._redis.hset(f"{self.prefix}:branch:students:record:{student_id}:{content_id}", mapping={
            "branch": "students", "student_id": student_id, "content_id": content_id,
            "batch_number": batch, "updated_at": profile.get("updated_at", utcnow()),
        })
        await self.set_profile_job_status(student_id, content_id, batch, "COMPLETED")

    async def personalize_cache_get(self, student_id: str, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:personalized")
        return json.loads(value) if value else None

    async def personalize_cache_set(self, student_id: str, content_id: str, data: dict[str, Any]) -> None:
        await self._redis.set(f"{self.prefix}:student:{student_id}:content:{content_id}:personalized", json.dumps(data, ensure_ascii=False))

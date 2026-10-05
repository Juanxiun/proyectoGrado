import json
import hashlib
import struct
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis

from app.config import settings


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decode_hash(values: dict[bytes, bytes]) -> dict[str, str]:
    return {key.decode(): value.decode() for key, value in values.items()}


class RAGRepository:
    prefix = "shalom:rag"
    content_stream = "shalom:rag:queue:content"
    profile_stream = "shalom:rag:queue:student-profile"
    index_prefix = "shalom_rag_idx_v2"
    content_group = "rag-content-workers"
    profile_group = "rag-profile-workers"
    branches = {
        "knowledge": "Conocimiento académico validado por materia, tema, documento y fragmento.",
        "subjects": "Mini-contexto por materia, construido únicamente desde materiales docentes validados.",
        "topics": "Conceptos, objetivos y evidencia agrupados por tema académico.",
        "students": "Perfil pedagógico aislado por estudiante y contenido; se actualiza cada cuatro pruebas.",
        "methodology": "Marcos generales de microlearning e indagación; no son evidencia académica.",
    }

    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        self._vector_dimension: int | None = None
        self._index_name: str | None = None
        self._embedding_namespace = hashlib.sha256(settings.ollama_embedding_model.encode()).hexdigest()[:10]
        self._vector_key_prefix = f"{self.prefix}:vector:{self._embedding_namespace}:"

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
        structure = json.loads(raw) if raw else {"name": "Shalom Academic RAG", "version": "1", "branches": []}
        for branch in structure.get("branches", []):
            cursor = 0
            count = 0
            pattern = f"{self.prefix}:branch:{branch['id']}:record:*"
            while True:
                cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=200)
                count += len(keys)
                if cursor == 0:
                    break
            branch["records"] = count
        return structure

    async def initialize(self, prompt_documents: dict[str, str]) -> None:
        """Crea la metadata base y versiona marcos pedagógicos/prompt en Redis."""
        now = utcnow()
        meta_key = f"{self.prefix}:meta"
        await self._redis.hset(meta_key, mapping={
            "schema_version": "1",
            "vector_index_prefix": self.index_prefix,
            "student_profile_policy": "actualizar cada 4 cuestionarios completados",
            "profile_isolation": "student_id + content_id",
        })
        await self._redis.set(f"{self.prefix}:structure", json.dumps({
            "name": "Shalom Academic RAG",
            "version": "1",
            "branches": [{"id": key, "purpose": description} for key, description in self.branches.items()],
            "flow": ["documento docente", "validacion LLM", "fragmentos y contexto", "perfil tras cuatro pruebas", "recuperacion personalizada"],
            "privacy": "Los perfiles se consultan siempre con student_id y content_id; no contienen datos personales de identidad.",
        }, ensure_ascii=False))
        for branch, description in self.branches.items():
            await self._redis.hset(f"{self.prefix}:branch:{branch}", mapping={
                "branch_id": branch, "description": description, "status": "active", "updated_at": now,
            })
        await self._redis.hsetnx(meta_key, "initialized_at", now)
        for name, document in prompt_documents.items():
            await self._redis.set(f"{self.prefix}:framework:{name}", document)
            await self._redis.hset(f"{self.prefix}:meta:prompts", name, "v1")

    async def bootstrap_frameworks(self, prompt_documents: dict[str, str], embed) -> bool:
        """Indexa los principios generales como conocimiento metodológico, sin inventar contenido de materias."""
        if not prompt_documents:
            return True
        try:
            if not await self.vector_search_available():
                return False
            for name, document in prompt_documents.items():
                digest = hashlib.sha256(document.encode("utf-8")).hexdigest()
                marker = f"{self.prefix}:framework:indexed:{name}"
                if await self._redis.get(marker) == digest.encode():
                    continue
                vector = await embed(document)
                await self.save_vector(
                    content_id="__metodologia__",
                    chunk_id=name,
                    text=document,
                    embedding=vector,
                    metadata={"record_type": "learning_framework", "source": "prompt_framework", "subject_id": "general", "branch": "methodology"},
                )
                await self._redis.set(marker, digest)
            return True
        except Exception:
            # El esqueleto RAG se conserva y el bootstrap vectorial se reintenta luego.
            return False

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
        # Reclama mensajes pendientes después de reiniciar el contenedor.
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
                "topic_id", "TAG", "record_type", "TAG", "source", "TAG", "text", "TEXT",
                "embedding", "VECTOR", "HNSW", "6", "TYPE", "FLOAT32", "DIM", dimension,
                "DISTANCE_METRIC", "COSINE",
            )
        self._vector_dimension, self._index_name = dimension, index_name
        return index_name

    async def save_vector(self, content_id: str, chunk_id: str, text: str, embedding: list[float], metadata: dict[str, Any]) -> None:
        await self.ensure_vector_index(len(embedding))
        safe_content = content_id.replace(":", "_")
        safe_chunk = chunk_id.replace(":", "_")
        key = f"{self._vector_key_prefix}{safe_content}:{safe_chunk}"
        fields = {key: str(value) for key, value in metadata.items() if value is not None and value != ""}
        fields.update({"content_id": content_id, "chunk_id": chunk_id, "text": text, "embedding": struct.pack(f"{len(embedding)}f", *embedding)})
        await self._redis.hset(key, mapping=fields)
        branch = metadata.get("branch")
        if branch:
            await self._redis.hset(f"{self.prefix}:branch:{branch}:record:{safe_content}:{safe_chunk}", mapping={
                "branch": str(branch), "content_id": content_id, "chunk_id": chunk_id,
                "record_type": str(metadata.get("record_type", "")),
            })

    async def save_branch_context(self, branch: str, entity_id: str, content_id: str, text: str,
                                  embedding: list[float], metadata: dict[str, Any]) -> None:
        """Guarda mini-contextos rastreables dentro de una rama semántica explícita."""
        safe_entity = entity_id.replace(":", "_")
        await self._redis.hset(
            f"{self.prefix}:branch:{branch}:entity:{safe_entity}:content:{content_id}",
            mapping={"branch": branch, "entity_id": entity_id, "content_id": content_id,
                     "context": text, "updated_at": utcnow(), **{k: str(v) for k, v in metadata.items() if v is not None}},
        )
        await self.save_vector(content_id, f"{branch}-{safe_entity}-{content_id}", text, embedding,
                               {**metadata, "branch": branch, "record_type": f"{branch[:-1]}_context"})

    async def save_validated_content(self, content_id: str, data: dict[str, Any]) -> None:
        await self._redis.set(f"{self.prefix}:content:{content_id}:validated", json.dumps(data, ensure_ascii=False))
        await self._redis.set(f"{self.prefix}:content:{content_id}:questions", json.dumps(data.get("questions", []), ensure_ascii=False))
        await self.mark_content_state(content_id, "processed")

    async def get_validated_content(self, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:content:{content_id}:validated")
        return json.loads(value) if value else None

    async def get_question_bank(self, content_id: str) -> list[dict[str, Any]]:
        value = await self._redis.get(f"{self.prefix}:content:{content_id}:questions")
        return json.loads(value) if value else []

    async def student_used_questions(self, student_id: str, content_id: str) -> tuple[set[str], list[str]]:
        base = f"{self.prefix}:student:{student_id}:content:{content_id}:used-questions"
        ids = await self._redis.smembers(f"{base}:ids")
        statements = await self._redis.hvals(f"{base}:statements")
        return {item.decode() for item in ids}, [item.decode() for item in statements]

    async def save_quiz(self, student_id: str, content_id: str, quiz_id: str, questions: list[dict[str, Any]]) -> bool:
        base = f"{self.prefix}:student:{student_id}:content:{content_id}:used-questions"
        script = """
        local count = tonumber(ARGV[2])
        local batch_fingerprints = {}
        for i = 1, count do
          local question_id = ARGV[2 + (i - 1) * 3 + 1]
          local fingerprint = ARGV[2 + (i - 1) * 3 + 2]
          if batch_fingerprints[fingerprint] or redis.call('SISMEMBER', KEYS[1], question_id) == 1 or redis.call('HEXISTS', KEYS[2], fingerprint) == 1 then return 0 end
          batch_fingerprints[fingerprint] = true
        end
        redis.call('SET', KEYS[3], ARGV[1], 'EX', 2592000)
        for i = 1, count do
          local question_id = ARGV[2 + (i - 1) * 3 + 1]
          local fingerprint = ARGV[2 + (i - 1) * 3 + 2]
          local question_text = ARGV[2 + (i - 1) * 3 + 3]
          redis.call('SADD', KEYS[1], question_id)
          redis.call('HSET', KEYS[2], fingerprint, question_text)
        end
        return 1
        """
        args: list[Any] = [json.dumps({"quiz_id": quiz_id, "student_id": student_id, "content_id": content_id, "questions": questions}, ensure_ascii=False), len(questions)]
        for question in questions:
            args.extend([question["question_id"], question["fingerprint"], question["question"]])
        result = await self._redis.eval(
            script, 3, f"{base}:ids", f"{base}:statements",
            f"{self.prefix}:student:{student_id}:content:{content_id}:quiz:{quiz_id}", *args,
        )
        return bool(result)

    async def get_quiz(self, student_id: str, content_id: str, quiz_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:quiz:{quiz_id}")
        return json.loads(value) if value else None

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
            "PARAMS", "2", "vector", vector, "SORTBY", "score", "RETURN", "8",
            "content_id", "chunk_id", "text", "subject_id", "topic_id", "student_id", "record_type", "branch", "DIALECT", "2",
        )
        found = []
        for i in range(1, len(result), 2):
            fields = result[i + 1]
            found.append({fields[j].decode(): fields[j + 1].decode(errors="ignore") for j in range(0, len(fields), 2)})
        return found

    async def record_quiz_attempt(self, student_id: str, content_id: str, attempt_id: str, answers: list[dict[str, str]]) -> dict[str, Any]:
        quiz = await self.get_quiz(student_id, content_id, attempt_id)
        if not quiz:
            raise LookupError("No existe un cuestionario emitido para este estudiante y contenido")
        questions = {str(q["question_id"]): q for q in quiz["questions"]}
        if len(answers) != len(questions):
            raise ValueError("Debe responder todas las preguntas del cuestionario")
        question_ids = [answer["question_id"] for answer in answers]
        if len(question_ids) != len(set(question_ids)):
            raise ValueError("La prueba no puede repetir preguntas")
        if any(answer["question_id"] not in questions for answer in answers):
            raise ValueError("La prueba contiene preguntas ajenas al contenido")
        if set(question_ids) != set(questions):
            raise ValueError("Debe responder exactamente las preguntas emitidas")
        evaluation = []
        for answer in answers:
            question = questions[answer["question_id"]]
            options = [str(option).strip().casefold() for option in question.get("options", [])]
            if answer["response"].strip().casefold() not in options:
                raise ValueError("Una respuesta no coincide con las opciones de su pregunta")
            correct = answer["response"].strip().casefold() == str(question["correct_answer"]).strip().casefold()
            evaluation.append({"question_id": answer["question_id"], "correct": correct, "concept": question.get("learning_objective", ""), "difficulty": question.get("difficulty", "inicial")})
        correct_count = sum(1 for answer in evaluation if answer["correct"])
        attempt = {"attempt_id": attempt_id, "student_id": student_id, "content_id": content_id,
                   "score": correct_count / len(evaluation), "correct": correct_count, "total": len(evaluation),
                   "answers": evaluation, "completed_at": utcnow()}
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
        return {**attempt, "duplicate": False, "attempt_count": int(attempt_count), "profile_queued": bool(batch_number)}

    async def profile_attempt_batch(self, student_id: str, content_id: str, batch_number: int) -> list[dict[str, Any]]:
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        end = batch_number * 4
        values = await self._redis.lrange(key, end - 4, end - 1)
        return [json.loads(value) for value in values]

    async def profile_attempt_summary(self, student_id: str, content_id: str) -> tuple[int, float]:
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        values = await self._redis.lrange(key, 0, -1)
        attempts = [json.loads(value) for value in values]
        average = sum(float(item["score"]) for item in attempts) / len(attempts) if attempts else 0.0
        return len(attempts), average

    async def get_student_profile(self, student_id: str, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:profile")
        return json.loads(value) if value else None

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

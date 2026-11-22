import json
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any) -> str:
    if value is None:
        return ""
    return value.decode() if isinstance(value, bytes) else str(value)


# RAG -> persistencia jerarquica de examenes trimestrales en key examn
class ExamRagMixin:
    prefix: str
    _redis: Any

    @staticmethod
    def _normalize_exam_nivel(nivel: str) -> str:
        raw = str(nivel or "").strip().casefold()
        if "sec" in raw:
            return "sec"
        if "prim" in raw:
            return "prim"
        if "ini" in raw:
            return "ini"
        if "bach" in raw:
            return "bach"
        cleaned = "".join(ch if ch.isalnum() else "_" for ch in raw).strip("_")
        return cleaned or "sec"

    @staticmethod
    def _normalize_exam_grado(grado: str, curso: str = "") -> str:
        source = f"{grado or ''} {curso or ''}".strip().casefold()
        digits = {"1": "1ro", "2": "2do", "3": "3ro", "4": "4to", "5": "5to", "6": "6to"}
        for digit, label in digits.items():
            if digit in source:
                return label
        words = {
            "primero": "1ro", "segundo": "2do", "tercero": "3ro",
            "cuarto": "4to", "quinto": "5to", "sexto": "6to",
        }
        for word, label in words.items():
            if word in source:
                return label
        cleaned = "".join(ch if ch.isalnum() else "_" for ch in str(grado or "").strip().casefold()).strip("_")
        return cleaned or "1ro"

    @staticmethod
    def _normalize_exam_trimestre(trimestre_numero: int) -> str:
        num = int(trimestre_numero or 1)
        return {1: "1er_trimestre", 2: "2do_trimestre", 3: "3er_trimestre"}.get(num, f"{num}_trimestre")

    @staticmethod
    def _normalize_exam_dificultad(dificultad: str) -> str:
        raw = str(dificultad or "medio").strip().casefold()
        if "alt" in raw:
            return "alto"
        if "mod" in raw:
            return "moderado"
        if "med" in raw:
            return "medio"
        cleaned = "".join(ch if ch.isalnum() else "_" for ch in raw).strip("_")
        return cleaned or "medio"

    def build_trimester_exam_key(
        self,
        nivel: str,
        grado: str,
        trimestre_numero: int,
        dificultad: str,
        exam_id: str,
        curso: str = "",
    ) -> str:
        nivel_slug = self._normalize_exam_nivel(nivel)
        grado_slug = self._normalize_exam_grado(grado, curso)
        trim_slug = self._normalize_exam_trimestre(trimestre_numero)
        dif_slug = self._normalize_exam_dificultad(dificultad)
        safe_id = str(exam_id or "sin_id").strip().replace(":", "_")
        return f"{self.prefix}:examn:{nivel_slug}:{grado_slug}:{trim_slug}:{dif_slug}:{safe_id}"

    async def save_trimester_exam(
        self,
        exam_id: str,
        nivel: str,
        grado: str,
        trimestre_numero: int,
        dificultad: str,
        payload: dict[str, Any],
        curso: str = "",
    ) -> str:
        safe_id = str(exam_id or "sin_id").strip().replace(":", "_")
        key = self.build_trimester_exam_key(
            nivel=nivel,
            grado=grado,
            trimestre_numero=trimestre_numero,
            dificultad=dificultad,
            exam_id=safe_id,
            curso=curso,
        )
        now = _utcnow()
        record = {
            **payload,
            "exam_id": str(exam_id),
            "rag_key": key,
            "nivel_slug": self._normalize_exam_nivel(nivel),
            "grado_slug": self._normalize_exam_grado(grado, curso),
            "trimestre_slug": self._normalize_exam_trimestre(trimestre_numero),
            "dificultad_slug": self._normalize_exam_dificultad(dificultad),
            "updated_at": now,
        }
        record.setdefault("created_at", now)
        await self._redis.set(key, json.dumps(record, ensure_ascii=False))
        await self._redis.set(f"{self.prefix}:examn:by_id:{safe_id}", key)
        return key

    async def get_trimester_exam_by_id(self, exam_id: str) -> dict[str, Any] | None:
        safe_id = str(exam_id or "").strip().replace(":", "_")
        if not safe_id:
            return None
        key = _text(await self._redis.get(f"{self.prefix}:examn:by_id:{safe_id}"))
        if key:
            raw = await self._redis.get(key)
            if raw:
                try:
                    return json.loads(raw)
                except Exception:
                    pass
        cursor = 0
        pattern = f"{self.prefix}:examn:*:*:*:*:{safe_id}"
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=200)
            for found_key in keys:
                raw = await self._redis.get(found_key)
                if raw:
                    try:
                        return json.loads(raw)
                    except Exception:
                        continue
            if cursor == 0:
                break
        return None

    async def list_trimester_exams(
        self,
        nivel: str | None = None,
        grado: str | None = None,
        trimestre_numero: int | None = None,
        dificultad: str | None = None,
    ) -> list[dict[str, Any]]:
        n_part = self._normalize_exam_nivel(nivel) if nivel else "*"
        g_part = self._normalize_exam_grado(grado) if grado else "*"
        t_part = self._normalize_exam_trimestre(trimestre_numero) if trimestre_numero else "*"
        d_part = self._normalize_exam_dificultad(dificultad) if dificultad else "*"
        pattern = f"{self.prefix}:examn:{n_part}:{g_part}:{t_part}:{d_part}:*"
        items: list[dict[str, Any]] = []
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=200)
            for key in keys:
                raw = await self._redis.get(key)
                if raw:
                    try:
                        items.append(json.loads(raw))
                    except Exception:
                        continue
            if cursor == 0:
                break
        return items

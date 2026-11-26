import json
from datetime import datetime, timezone
from typing import Any

from app.services.activities import remediation, score_activity


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any) -> str:
    if value is None:
        return ""
    return value.decode() if isinstance(value, bytes) else str(value)


# RAG -> progreso, intentos y perfiles de aprendizaje por estudiante
class StudentRagMixin:
    prefix: str
    profile_stream: str
    _redis: Any

    async def record_quiz_attempt(
        self,
        student_id: str,
        content_id: str,
        attempt_id: str,
        answers: list[dict[str, str]],
        elapsed_ms: int = 0,
        topic_id: str | None = None,
        material_id: str | None = None,
    ) -> dict[str, Any]:
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
            evaluation.append({
                "activity_id": answer["activity_id"],
                "tipo": tipo_visible,
                "correct": correct,
                "response": answer["response"][:500],
                "concept": activity.get("learning_objective", ""),
                "difficulty": activity.get("difficulty", "inicial"),
                "feedback": remediation(activity, correct),
            })

        correct_count = sum(1 for answer in evaluation if answer["correct"])
        attempt = {
            "attempt_id": attempt_id,
            "student_id": student_id,
            "content_id": content_id,
            "material_id": material_id,
            "topic_id": topic_id,
            "score": correct_count / len(evaluation),
            "correct": correct_count,
            "total": len(evaluation),
            "answers": evaluation,
            "elapsed_ms": elapsed_ms,
            "completed_at": _utcnow(),
        }
        key = f"{self.prefix}:student:{student_id}:content:{content_id}:attempts"
        recent_key = f"{self.prefix}:student:{student_id}:topic:{topic_id}:attempts:recent" if topic_id else f"{key}:recent"
        script = """
        if redis.call('SADD', KEYS[1], ARGV[1]) == 0 then return {-1, 0} end
        redis.call('RPUSH', KEYS[2], ARGV[2])
        redis.call('RPUSH', KEYS[4], ARGV[2])
        redis.call('LTRIM', KEYS[4], -5, -1)
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
            script, 4, f"{key}:ids", key, self.profile_stream, recent_key,
            attempt_id, json.dumps(attempt, ensure_ascii=False), student_id, content_id,
            f"{self.prefix}:student:{student_id}:content:{content_id}:profile-batch:", _utcnow(),
        )
        if int(attempt_count) < 0:
            return {**attempt, "duplicate": True, "attempt_count": int(await self._redis.llen(key)), "profile_queued": False}

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

    async def recent_quiz_attempts(self, student_id: str, content_id: str, topic_id: str | None = None) -> list[dict[str, Any]]:
        key = f"{self.prefix}:student:{student_id}:topic:{topic_id}:attempts:recent" if topic_id else f"{self.prefix}:student:{student_id}:content:{content_id}:attempts:recent"
        values = await self._redis.lrange(key, 0, 4)
        return [json.loads(value) for value in values]

    async def record_topic_study_event(self, student_id: str, event: dict[str, Any]) -> bool:
        topic_id = str(event["topic_id"])
        base = f"{self.prefix}:student:{student_id}:topic:{topic_id}:sessions"
        script = """
        if redis.call('SADD', KEYS[2], ARGV[1]) == 0 then return 0 end
        redis.call('LPUSH', KEYS[1], ARGV[2])
        redis.call('LTRIM', KEYS[1], 0, 4)
        return 1
        """
        saved = await self._redis.eval(
            script, 2, base, f"{base}:ids", str(event["session_id"]),
            json.dumps(event, ensure_ascii=False),
        )
        return bool(saved)

    async def recent_topic_study_events(self, student_id: str, topic_id: str) -> list[dict[str, Any]]:
        values = await self._redis.lrange(f"{self.prefix}:student:{student_id}:topic:{topic_id}:sessions", 0, 4)
        return [json.loads(value) for value in values]

    async def profile_attempt_batch(self, student_id: str, content_id: str, batch_number: int) -> list[dict[str, Any]]:
        end = batch_number * 4
        values = await self._redis.lrange(f"{self.prefix}:student:{student_id}:content:{content_id}:attempts", end - 4, end - 1)
        return [json.loads(value) for value in values]

    async def profile_attempt_summary(self, student_id: str, content_id: str) -> tuple[int, float, float]:
        values = await self._redis.lrange(f"{self.prefix}:student:{student_id}:content:{content_id}:attempts", 0, -1)
        attempts = [json.loads(value) for value in values]
        average = sum(float(item["score"]) for item in attempts) / len(attempts) if attempts else 0.0
        average_elapsed_ms = sum(float(item.get("elapsed_ms", 0)) for item in attempts) / len(attempts) if attempts else 0.0
        return len(attempts), average, average_elapsed_ms

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
                for value in await self._redis.lrange(key_str, 0, -1):
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
            "batch_number": batch, "updated_at": profile.get("updated_at", _utcnow()),
        })
        await self.set_profile_job_status(student_id, content_id, batch, "COMPLETED")

    async def personalize_cache_get(self, student_id: str, content_id: str) -> dict[str, Any] | None:
        value = await self._redis.get(f"{self.prefix}:student:{student_id}:content:{content_id}:personalized")
        return json.loads(value) if value else None

    async def personalize_cache_set(self, student_id: str, content_id: str, data: dict[str, Any]) -> None:
        await self._redis.set(
            f"{self.prefix}:student:{student_id}:content:{content_id}:personalized",
            json.dumps(data, ensure_ascii=False),
        )

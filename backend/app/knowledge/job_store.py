"""异步入库任务状态（Redis）。"""

import json
import uuid

from app.core.logging import get_logger
from app.core.redis_client import get_redis

logger = get_logger(__name__)

_PREFIX = "tcm:ingest_job:"
_TTL_SEC = 60 * 60 * 24 * 7  # 7 天


def _key(job_id: str) -> str:
    return f"{_PREFIX}{job_id}"


async def job_create() -> str:
    jid = str(uuid.uuid4())
    r = get_redis()
    await r.set(_key(jid), json.dumps({"status": "pending", "job_id": jid}), ex=_TTL_SEC)
    return jid


async def job_update(job_id: str, **fields) -> None:
    r = get_redis()
    raw = await r.get(_key(job_id))
    base = json.loads(raw) if raw else {"job_id": job_id}
    base.update(fields)
    await r.set(_key(job_id), json.dumps(base), ex=_TTL_SEC)


async def job_get(job_id: str) -> dict | None:
    r = get_redis()
    raw = await r.get(_key(job_id))
    if not raw:
        return None
    return json.loads(raw)


async def run_ingest_background(
    job_id: str,
    kb_id: str,
    filename: str,
    content: bytes,
) -> None:
    from app.core.database import async_session_factory
    from app.knowledge.service import KnowledgeService

    try:
        await job_update(job_id, status="running")
        async with async_session_factory() as session:
            svc = KnowledgeService(session)
            result = await svc.ingest_file(kb_id, filename, content)
            await session.commit()
        await job_update(
            job_id,
            status="completed",
            result=result.model_dump(),
        )
    except Exception as exc:
        logger.exception("ingest job %s failed", job_id)
        await job_update(job_id, status="failed", error=str(exc))

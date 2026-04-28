"""Celery 任务定义。"""

from celery.signals import worker_process_init
from celery_app import celery_app


@worker_process_init.connect
def reset_connections_after_fork(**kwargs) -> None:
    """Celery prefork 子进程初始化后重置所有连接池，避免继承父进程已失效的 socket。"""
    # 清除 Redis lru_cache，强制子进程重新建立连接
    from app.core.redis_client import get_redis_for_url

    get_redis_for_url.cache_clear()

    # 释放 SQLAlchemy 连接池中从父进程继承的连接
    try:
        from app.core.database import engine

        engine.sync_engine.dispose(close=False)
    except Exception:
        pass


@celery_app.task(name="knowledge.ingest_document", bind=True)
def ingest_document_task(
    self,
    job_id: str,
    kb_id: str,
    filename: str,
) -> None:
    """从 Redis/磁盘暂存读取文件并执行知识库入库；内置有限次重试与超时（见 celery_app 配置）。"""
    from app.knowledge.job_store import run_ingest_from_stash_with_retries

    run_ingest_from_stash_with_retries(job_id, kb_id, filename)

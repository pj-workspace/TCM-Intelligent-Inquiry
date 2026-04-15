"""知识库管理路由。"""

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.knowledge.schemas import (
    IngestResponse,
    KnowledgeBaseCreateRequest,
    KnowledgeBaseListResponse,
    KnowledgeBaseResponse,
    SearchRequest,
    SearchResponse,
)
from app.knowledge.service import KnowledgeService

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _svc(session: AsyncSession = Depends(get_session)) -> KnowledgeService:
    return KnowledgeService(session)


@router.get("", response_model=KnowledgeBaseListResponse, summary="列出所有知识库")
async def list_kbs(svc: KnowledgeService = Depends(_svc)):
    return await svc.list_kbs()


@router.post("", response_model=KnowledgeBaseResponse, summary="创建知识库")
async def create_kb(req: KnowledgeBaseCreateRequest, svc: KnowledgeService = Depends(_svc)):
    return await svc.create_kb(req)


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse, summary="获取知识库详情")
async def get_kb(kb_id: str, svc: KnowledgeService = Depends(_svc)):
    return await svc.get_kb(kb_id)


@router.delete("/{kb_id}", status_code=204, summary="删除知识库")
async def remove_kb(kb_id: str, svc: KnowledgeService = Depends(_svc)):
    await svc.delete_kb(kb_id)


@router.post("/{kb_id}/ingest", response_model=IngestResponse, summary="上传文档入库")
async def ingest(
    kb_id: str,
    file: UploadFile,
    svc: KnowledgeService = Depends(_svc),
):
    content = await file.read()
    return await svc.ingest_file(kb_id, file.filename or "unknown", content)


@router.post("/{kb_id}/search", response_model=SearchResponse, summary="知识库语义检索")
async def search(
    kb_id: str,
    req: SearchRequest,
    svc: KnowledgeService = Depends(_svc),
):
    return await svc.search(kb_id, req)

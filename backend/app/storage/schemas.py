from pydantic import BaseModel, Field


class OssChatImageUploadResponse(BaseModel):
    object_key: str = Field(..., description="OSS 对象键")
    url: str = Field(..., description="带签名的临时 GET URL，可传给多模态模型 image_url")
    content_type: str = Field(..., description="实际写入的 Content-Type")
    expires_in_seconds: int = Field(..., description="签名 URL 有效秒数")

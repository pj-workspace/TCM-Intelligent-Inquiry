"""追问、附图话术等非主 SSE 的模型侧建议生成。"""

from app.chat.suggestions.attachments import generate_attachment_suggestions
from app.chat.suggestions.follow_up import generate_follow_up_suggestions

__all__ = [
    "generate_attachment_suggestions",
    "generate_follow_up_suggestions",
]

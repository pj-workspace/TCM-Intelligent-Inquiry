from dataclasses import dataclass
from typing import Protocol


@dataclass
class OAuthUserProfile:
    external_id: str
    login: str | None
    nickname: str | None
    avatar_url: str | None
    primary_email: str | None
    primary_email_verified: bool


class OAuthProviderProto(Protocol):
    provider: str

    def authorize_url(self, *, state: str, redirect_uri: str) -> str: ...

    async def exchange_and_profile(self, *, code: str, redirect_uri: str) -> OAuthUserProfile: ...

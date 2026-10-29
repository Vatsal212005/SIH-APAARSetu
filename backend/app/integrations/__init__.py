"""Provider boundary. No external identity confirmation is available by default."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class IdentityEvidence:
    state: str
    provider: str
    reference: str | None
    message: str


class IdentityProvider(Protocol):
    def verify(self, identifier: str) -> IdentityEvidence: ...


class UnavailableApaarProvider:
    def verify(self, identifier: str) -> IdentityEvidence:
        return IdentityEvidence(
            "external_verification_pending",
            "unconfigured",
            None,
            "Official APAAR verification unavailable — demonstration mode.",
        )

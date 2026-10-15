"""Direct-TLS qualification ingress primitives; deliberately not an ASGI server.

The reviewed server must provide actual scheme/client socket metadata, with proxy
header rewriting disabled. A trusted ECS observer supplies PeerLease; constructing
one does not prove ECS ownership. No caller headers supply task/run/fence identity.
"""
import asyncio
from dataclasses import dataclass
import hashlib
import hmac
import ipaddress
import math
import time

from ..state.admission import GrantAdmission
from ..state.grants import RunBinding, identifier
from ..state.pricing import StateDenied

PEER_LEASE_SECONDS = 30.0
STATE_TIMEOUT_SECONDS = 5.0
POLL_SECONDS = 5.0
# Closed inference route contract. The pinned Claude Code CLI 2.1.295, which the
# Agent SDK drives, sends exactly POST /v1/messages?beta=true (receipt
# docs/qualification/candidates/fable-resume-20261015/rehearsal/
# standin-probes-20261015.json, probe C1b). Exactly that one query is admitted:
# an empty query (the unobserved, ambiguous non-beta form), another parameter,
# value, case, order, repetition, separator or percent-encoding is refused.
INFERENCE_PATH = "/v1/messages"
INFERENCE_QUERY = b"beta=true"
_PRIVATE = tuple(ipaddress.ip_network(x) for x in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))


@dataclass(frozen=True)
class PeerLease:
    ipv4: str
    observed_at: float
    binding: RunBinding
    grant_id: str

    def __post_init__(self):
        if type(self.binding) is not RunBinding:
            raise StateDenied("TYPED_BINDING_REQUIRED")
        identifier(self.grant_id)
        try:
            address = ipaddress.IPv4Address(self.ipv4)
        except (ValueError, TypeError):
            raise StateDenied("INVALID_PRIVATE_PEER") from None
        if type(self.ipv4) is not str or str(address) != self.ipv4 or not any(address in n for n in _PRIVATE):
            raise StateDenied("INVALID_PRIVATE_PEER")
        if type(self.observed_at) is not float or not math.isfinite(self.observed_at):
            raise StateDenied("INVALID_PEER_OBSERVATION")

    def check(self):
        age = time.monotonic() - self.observed_at
        if not 0 <= age < PEER_LEASE_SECONDS:
            raise StateDenied("PEER_OBSERVATION_EXPIRED")


class IngressAdmission:
    def __init__(self, authority, peer):
        if type(authority) is not GrantAdmission or type(peer) is not PeerLease:
            raise StateDenied("TRUSTED_ADMISSION_REQUIRED")
        if peer.binding != authority.binding or peer.grant_id != authority.grant_id:
            raise StateDenied("PEER_BINDING_MISMATCH")
        self.authority = authority
        self.peer = peer

    def validate_scope(self, scope):
        """Validate only routing/credential metadata, before upstream body parsing."""
        if (type(scope) is not dict or scope.get("type") != "http"
            or scope.get("scheme") != "https" or scope.get("method") != "POST"
            or scope.get("path") != INFERENCE_PATH
            or type(scope.get("raw_path")) is not bytes
            or scope.get("raw_path") != INFERENCE_PATH.encode()
            or type(scope.get("query_string")) is not bytes
            or scope.get("query_string") != INFERENCE_QUERY):
            raise StateDenied("INFERENCE_ROUTE_REQUIRED")
        client = scope.get("client")
        if (type(client) not in (tuple, list) or len(client) != 2
            or type(client[0]) is not str or client[0] != self.peer.ipv4
            or type(client[1]) is not int or not 1 <= client[1] <= 65535):
            raise StateDenied("PEER_MISMATCH")
        self.peer.check()
        headers = scope.get("headers")
        if type(headers) is not list or len(headers) > 64:
            raise StateDenied("INVALID_HEADERS")
        seen = {}
        total = 0
        for item in headers:
            if (type(item) not in (tuple, list) or len(item) != 2
                or type(item[0]) is not bytes or type(item[1]) is not bytes):
                raise StateDenied("INVALID_HEADERS")
            name, value = item
            total += len(name) + len(value)
            if (not name or any(c not in b"abcdefghijklmnopqrstuvwxyz0123456789-" for c in name)
                or name in seen or any(c < 32 or c > 126 for c in value) or total > 16384):
                raise StateDenied("INVALID_HEADERS")
            if (name in (b"forwarded", b"x-api-key", b"proxy-authorization")
                or name.startswith((b"x-forwarded-", b"x-meri-", b"x-litellm-"))):
                raise StateDenied("AUTHORITY_HEADER_DENIED")
            seen[name] = value
        value = seen.get(b"authorization", b"")
        token = value[7:] if value.startswith(b"Bearer ") else b""
        if not 32 <= len(token) <= 256 or any(c <= 32 or c > 126 for c in token):
            raise StateDenied("OPAQUE_KEY_REQUIRED")
        if not hmac.compare_digest(hashlib.sha256(token).hexdigest(), self.authority.capability_sha256):
            raise StateDenied("OPAQUE_KEY_DENIED")

    async def recheck(self):
        self.peer.check()
        try:
            await asyncio.wait_for(asyncio.to_thread(self.authority.check), STATE_TIMEOUT_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception:
            raise StateDenied("FRESH_STATE_DENIED") from None
        self.peer.check()

    async def authorize(self, scope):
        self.validate_scope(scope)
        await self.recheck()

    async def stream(self, scope, source):
        """Recheck even during silence and before every yielded item.

        This owns the supplied async iterator; cancellation closes it. It neither
        refunds UNKNOWN nor settles
        usage. Scheduler/DB/thread/transport shutdown need real runtime qualification.
        """
        iterator = aiter(source)
        pending = None
        try:
            await self.authorize(scope)
            pending = asyncio.create_task(anext(iterator))
            while True:
                done, _ = await asyncio.wait({pending}, timeout=POLL_SECONDS)
                await self.recheck()
                if done:
                    try:
                        item = pending.result()
                    except StopAsyncIteration:
                        return
                    pending = None
                    yield item
                    # Downstream may suspend us past revocation or peer-lease expiry.
                    # Authorize again before any further provider iterator side effect.
                    await self.recheck()
                    pending = asyncio.create_task(anext(iterator))
        finally:
            if pending is not None:
                pending.cancel()
                try:
                    await asyncio.wait_for(pending, 1.0)
                except (Exception, asyncio.CancelledError):
                    pass
            closer = getattr(iterator, "aclose", None)
            if closer is not None:
                try:
                    await asyncio.wait_for(closer(), 1.0)
                except (Exception, asyncio.CancelledError):
                    pass

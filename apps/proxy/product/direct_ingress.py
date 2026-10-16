"""Original request and peer evidence from the admitted direct-TLS lifetime."""
import time

from ..qualification.runtime.lifetime import _request_lifetime
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_PROXY_INGRESS_REFUSED")


def create_direct_ingress_observer(binding):
    """Read the already authenticated ASGI lifetime, not worker attributes.

    The direct-socket ECS observer and GrantAdmission are refreshed once more
    after native counting and before any authoritative reservation. The full
    product binding comes from trusted run configuration and is compared with
    the direct peer's qualification run/fence before export to the bridge.
    """
    if (type(binding) is not dict or set(binding) != {
            "tenantId", "actorId", "conversationId", "runId", "attemptId",
            "workerId", "writerFence"}):
        _deny()
    fixed = binding.copy()

    async def observe():
        life = _request_lifetime.get()
        if life is None or life.original_body is None or life.proxy_credential is None:
            _deny()
        await life.refresh()
        life.check()
        peer = life.peer
        if (fixed["runId"] != peer.binding.run_id
                or fixed["writerFence"] != peer.binding.fence):
            _deny()
        try:
            credential = life.proxy_credential.decode("ascii", "strict")
        except UnicodeError:
            _deny()
        return {"peer": {"binding": fixed.copy(), "taskArn": peer.binding.worker_arn,
                         "grantId": life.admission.authority.grant_id,
                         "observedAtMs": time.time_ns() // 1_000_000},
                "proxyCredential": credential,
                "rawRequestBody": life.original_body}

    return observe

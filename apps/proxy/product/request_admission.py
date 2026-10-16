"""Product send-guard adapter for the canonical JavaScript reservation owner.

This does not open a listener or use the old Python PostgresLedger. The runtime
must inject an authenticated bridge and a direct-socket ingress observer; absent
either, construction fails. The bridge must bind the returned receipt to the
same request and must not treat this Python envelope as unauthenticated JSON.
"""
import hashlib

import httpx

from ..qualification.runtime.bedrock_body import NativeBody
from ..qualification.runtime.bedrock_transport import CountObservation, HoldReceipt
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_PROXY_BRIDGE_REFUSED")


class ProductReservationAdapter:
    """Forward the one guarded HTTPX send to a trusted JS budget owner.

    `observe_ingress` is a private host function that must independently return
    the direct peer, actual bearer and complete original request bytes from the
    current InferenceApp lifetime. It is never constructed from a worker field.
    `bridge` is an authenticated cross-process owner, not an arbitrary URL.
    """

    def __init__(self, bridge, observe_ingress, *, binding, deadline_ms):
        if (not callable(getattr(bridge, "reserve", None)) or not callable(observe_ingress)
                or type(binding) is not dict or type(deadline_ms) is not int
                or not 0 < deadline_ms <= 9007199254740991):
            _deny()
        self._bridge = bridge
        self._observe_ingress = observe_ingress
        self._binding = binding
        self._deadline_ms = deadline_ms
        self._entered = False
        self.reserved_raw_request_sha256 = None

    async def reserve_final_native_once(self, request_id, request, body, count):
        if self._entered:
            _deny()
        self._entered = True
        if (type(request_id) is not str or not 1 <= len(request_id) <= 128
                or not isinstance(request, httpx.Request)
                or type(body) is not NativeBody or type(count) is not CountObservation
                or count.origin != "aws-counttokens"):
            _deny()
        try:
            actual = request.content
        except httpx.RequestNotRead:
            _deny()
        if (actual != body.raw or hashlib.sha256(actual).hexdigest() != body.sha256
                or count.native_body_sha256 != body.sha256):
            _deny()
        source = await self._observe_ingress()
        if (type(source) is not dict or set(source) != {
                "peer", "proxyCredential", "rawRequestBody"}
                or type(source["rawRequestBody"]) is not bytes
                or not 1 <= len(source["rawRequestBody"]) <= 4 * 1024 * 1024):
            _deny()
        raw_headers = request.headers.raw
        if len(raw_headers) > 64:
            _deny()
        try:
            headers = [(name.decode("ascii"), value.decode("ascii")) for name, value in raw_headers]
        except UnicodeError:
            _deny()
        native = {"method": request.method, "url": str(request.url),
                  "host": request.headers.get("host"),
                  "contentType": request.headers.get("content-type"),
                  "body": actual, "headers": headers}
        observation = {"requestId": request_id, **source,
                       "nativeRequest": native,
                       "count": {"inputTokens": count.input_tokens,
                                 "nativeBodySha256": count.native_body_sha256,
                                 "modelId": count.model_id, "origin": count.origin}}
        try:
            receipt = await self._bridge.reserve({"requestId": request_id,
                                                  "binding": self._binding,
                                                  "deadlineMs": self._deadline_ms},
                                                 observation)
        except Exception:
            # A lost COMMIT acknowledgement leaves UNKNOWN in the canonical
            # ledger. Never infer no dispatch or issue a second request.
            _deny()
        if (type(receipt) is not dict or set(receipt) != {"requestId", "nativeBodySha256", "state"}
                or receipt["requestId"] != request_id or receipt["nativeBodySha256"] != body.sha256
                or receipt["state"] != "UNKNOWN"):
            _deny()
        self.reserved_raw_request_sha256 = hashlib.sha256(source["rawRequestBody"]).hexdigest()
        return HoldReceipt(request_id, body.sha256, "UNKNOWN")

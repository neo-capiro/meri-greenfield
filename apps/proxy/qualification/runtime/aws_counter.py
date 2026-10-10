"""Trusted, injected CountTokens client. No client/credential discovery or retries."""
import asyncio
import hashlib
import math
import time

import botocore
from botocore.client import BaseClient

from .bedrock_body import (AdmissionDenied, BodyLimits, COUNT_MODEL_ID,
                          INVOKE_URLS, RUNTIME_HOST, inspect_native_request)
from .bedrock_transport import CountObservation

BOTOCORE_VERSION = "1.43.111"


class AwsNativeCounter:
    """One count operation per instance, bound to the original monotonic deadline.

    Cancellation stops waiting and denies admission. Python cannot kill a running
    synchronous SDK thread; it may finish CountTokens, never model inference.
    Socket timeouts are not a universal wall-clock/DNS/credential-provider bound.
    The caller owns the trusted client, credentials, clean environment and hooks.
    """
    def __init__(self, client, *, deadline, limits=BodyLimits(), clock=time.monotonic):
        if (type(deadline) not in (int, float) or not math.isfinite(deadline)
                or type(limits) is not BodyLimits or not callable(clock)):
            raise AdmissionDenied("INVALID_COUNT_CONFIGURATION")
        self.client, self.deadline, self.limits, self.clock = client, deadline, limits, clock
        self._entered = False
        self._validate_client()

    def _remaining(self):
        value = self.deadline - self.clock()
        if not math.isfinite(value) or value <= 0:
            raise AdmissionDenied("COUNT_DEADLINE_EXPIRED")
        return min(value, 30.0)

    def _validate_client(self):
        if botocore.__version__ != BOTOCORE_VERSION or not isinstance(self.client, BaseClient):
            raise AdmissionDenied("UNQUALIFIED_COUNT_CLIENT")
        meta = self.client.meta
        config = meta.config
        if (meta.service_model.service_name != "bedrock-runtime"
                or meta.service_model.api_version != "2023-09-30"
                or meta.region_name != "us-east-1"
                or meta.endpoint_url != "https://" + RUNTIME_HOST
                or config.signature_version != "v4"
                or config.proxies != {} or config.proxies_config not in (None, {})
                or config.retries != {"mode": "standard", "total_max_attempts": 1}
                or config.use_fips_endpoint not in (None, False)
                or config.use_dualstack_endpoint not in (None, False)):
            raise AdmissionDenied("UNQUALIFIED_COUNT_CLIENT")
        # Pinned botocore consumes ignore_configured_endpoint_urls at creation
        # and omits it from final meta.config. Inspect effective resolver state,
        # rather than pretending the original flag survives on the client.
        resolver = self.client._ruleset_resolver
        if (self.client._endpoint.host != "https://" + RUNTIME_HOST
                or resolver is None or resolver._use_ssl is not True
                or "SDK::Endpoint" not in resolver._builtins
                or resolver._builtins["SDK::Endpoint"] is not None
                or resolver._builtins.get("AWS::Region") != "us-east-1"):
            raise AdmissionDenied("UNQUALIFIED_COUNT_ENDPOINT")
        # Exact pinned botocore private fields: public Config lacks verify.
        session = self.client._endpoint.http_session
        if session._verify is not True or session._proxy_config._proxies != {}:
            raise AdmissionDenied("UNQUALIFIED_COUNT_TLS_OR_PROXY")
        values = (config.connect_timeout, config.read_timeout)
        if (any(type(x) not in (int, float) or not math.isfinite(x) or x <= 0 for x in values)
                or sum(values) > self._remaining()):
            raise AdmissionDenied("UNBOUNDED_COUNT_TIMEOUT")
        timeout = session._timeout
        if (getattr(timeout, "connect_timeout", None) != values[0]
                or getattr(timeout, "read_timeout", None) != values[1]
                or session._manager.connection_pool_kw.get("timeout") is not timeout):
            raise AdmissionDenied("COUNT_SOCKET_TIMEOUT_DRIFT")

    async def count(self, parameters):
        if self._entered:
            raise AdmissionDenied("SECOND_COUNT_DENIED")
        self._entered = True
        self._validate_client()
        if (type(parameters) is not dict or set(parameters) != {"modelId", "input"}
                or parameters["modelId"] != COUNT_MODEL_ID):
            raise AdmissionDenied("INVALID_COUNT_PARAMETERS")
        value = parameters["input"]
        if (type(value) is not dict or set(value) != {"invokeModel"}
                or type(value["invokeModel"]) is not dict
                or set(value["invokeModel"]) != {"body"}):
            raise AdmissionDenied("INVALID_COUNT_PARAMETERS")
        raw = value["invokeModel"]["body"]
        body = inspect_native_request("POST", sorted(INVOKE_URLS)[0], raw, self.limits)
        # Rebuild only the wrapper. The immutable final bytes are never decoded /
        # reserialized for CountTokens. The caller's mutable dict cannot drift it.
        exact = {"modelId": COUNT_MODEL_ID, "input": {"invokeModel": {"body": body.raw}}}
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(self.client.count_tokens, **exact), timeout=self._remaining())
        except asyncio.CancelledError:
            raise
        except Exception:
            raise AdmissionDenied("AWS_COUNT_FAILED") from None
        self._remaining()
        if type(response) is not dict or set(response) != {"inputTokens", "ResponseMetadata"}:
            raise AdmissionDenied("INVALID_COUNT_RESPONSE")
        tokens = response["inputTokens"]
        metadata = response["ResponseMetadata"]
        if (type(tokens) is not int or not 1 <= tokens <= self.limits.max_input_tokens
                or type(metadata) is not dict
                or set(metadata) != {"RequestId", "HTTPStatusCode", "HTTPHeaders", "RetryAttempts"}
                or type(metadata["HTTPStatusCode"]) is not int or metadata["HTTPStatusCode"] != 200
                or type(metadata["RetryAttempts"]) is not int or metadata["RetryAttempts"] != 0
                or type(metadata["RequestId"]) is not str or not 1 <= len(metadata["RequestId"]) <= 256
                or type(metadata["HTTPHeaders"]) is not dict or len(metadata["HTTPHeaders"]) > 64
                or any(type(k) is not str or type(v) is not str or len(k) > 256 or len(v) > 8192
                       for k, v in metadata["HTTPHeaders"].items())):
            raise AdmissionDenied("INVALID_COUNT_RESPONSE")
        return CountObservation(tokens, hashlib.sha256(body.raw).hexdigest(), COUNT_MODEL_ID, "aws-counttokens")

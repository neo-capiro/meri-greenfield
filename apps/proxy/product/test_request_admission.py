"""Offline product send-hook checks; no Postgres, AWS or LiteLLM dispatch."""
import asyncio
import hashlib
import importlib
import json
import sys
import time
import types
import unittest
from unittest.mock import patch

import httpx


def _source_modules():
    names = ["litellm", "litellm.llms", "litellm.llms.custom_httpx",
             "litellm.llms.custom_httpx.http_handler"]
    modules = {name: types.ModuleType(name) for name in names}
    modules[names[-1]].AsyncHTTPHandler = type("UnusedAsyncHTTPHandler", (), {})
    with patch.dict(sys.modules, modules):
        transport = importlib.import_module("apps.proxy.qualification.runtime.bedrock_transport")
        product = importlib.import_module("apps.proxy.product.request_admission")
    return transport, product


TRANSPORT, PRODUCT = _source_modules()
HOST = "bedrock-runtime.us-east-1.amazonaws.com"
URL = "https://" + HOST + "/model/us.anthropic.claude-sonnet-4-6/invoke"
BODY = json.dumps({"anthropic_version": "bedrock-2023-05-31", "max_tokens": 16,
                   "messages": [{"role": "user", "content": "synthetic"}]},
                  separators=(",", ":")).encode()
BINDING = {"tenantId": "tenant", "actorId": "actor", "conversationId": "conversation",
           "runId": "run", "attemptId": "attempt", "workerId": "worker", "writerFence": 1}


class Bridge:
    def __init__(self):
        self.calls = []
        self.error = None

    async def reserve(self, value, observation):
        self.calls.append((value, observation))
        if self.error:
            raise self.error
        return {"requestId": value["requestId"],
                "nativeBodySha256": hashlib.sha256(observation["nativeRequest"]["body"]).hexdigest(),
                "state": "UNKNOWN"}


class RequestAdapterTests(unittest.IsolatedAsyncioTestCase):
    def make(self):
        bridge = Bridge()
        source = {"peer": {"binding": BINDING},
                  "proxyCredential": "synthetic-product-bearer-0000000001",
                  "rawRequestBody": b'{"prompt":"synthetic"}'}
        observations = []

        async def observe():
            observations.append(1)
            return source

        adapter = PRODUCT.ProductReservationAdapter(bridge, observe,
                                                    binding=BINDING, deadline_ms=9000000000000)
        request = httpx.Request("POST", URL, content=BODY,
                                headers={"content-type": "application/json"})
        digest = hashlib.sha256(BODY).hexdigest()
        count = TRANSPORT.CountObservation(12, digest,
                                           "anthropic.claude-sonnet-4-6", "aws-counttokens")
        return bridge, observations, adapter, request, count

    async def test_actual_send_guard_counts_once_then_borrows_canonical_reservation(self):
        bridge, observations, adapter, request, _ = self.make()
        calls = []

        class Counter:
            async def count(self, parameters):
                calls.append(parameters)
                raw = parameters["input"]["invokeModel"]["body"]
                return TRANSPORT.CountObservation(12, hashlib.sha256(raw).hexdigest(),
                                                  "anthropic.claude-sonnet-4-6", "aws-counttokens")

        guard = TRANSPORT.BedrockSendGuard(request_id="request_A", counter=Counter(),
                                           ledger=adapter, deadline=time.monotonic() + 5,
                                           expected_count_origin="aws-counttokens")
        await guard.before_send(request)
        self.assertTrue(guard.armed)
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(observations), 1)
        self.assertEqual(len(bridge.calls), 1)
        value, observed = bridge.calls[0]
        self.assertEqual(value["binding"], BINDING)
        self.assertEqual(observed["nativeRequest"]["body"], BODY)
        self.assertEqual(observed["count"]["nativeBodySha256"], hashlib.sha256(BODY).hexdigest())
        self.assertEqual(adapter.reserved_raw_request_sha256,
                         hashlib.sha256(b'{"prompt":"synthetic"}').hexdigest())
        with self.assertRaises(Exception):
            await guard.before_send(request)
        self.assertEqual(len(bridge.calls), 1)

    async def test_bridge_failure_or_conflicting_receipt_never_arms_a_send(self):
        for failure in (RuntimeError("synthetic lost COMMIT ACK"), "BAD_RECEIPT"):
            bridge, _, adapter, request, count = self.make()
            if failure == "BAD_RECEIPT":
                async def bad(*args):
                    return {"requestId": "different", "nativeBodySha256": count.native_body_sha256,
                            "state": "UNKNOWN"}
                bridge.reserve = bad
            else:
                bridge.error = failure
            native = TRANSPORT.inspect_native_request("POST", URL, BODY,
                                                      TRANSPORT.BodyLimits())
            with self.assertRaises(Exception):
                await adapter.reserve_final_native_once("request_A", request, native, count)
            self.assertIsNone(adapter.reserved_raw_request_sha256)
            with self.assertRaises(Exception):
                await adapter.reserve_final_native_once("request_A", request, native, count)

    async def test_final_byte_or_count_substitution_refuses_before_bridge(self):
        bridge, _, adapter, request, count = self.make()
        native = TRANSPORT.inspect_native_request("POST", URL, BODY,
                                                  TRANSPORT.BodyLimits())
        wrong = TRANSPORT.CountObservation(12, "f" * 64, count.model_id,
                                            "aws-counttokens")
        with self.assertRaises(Exception):
            await adapter.reserve_final_native_once("request_A", request, native, wrong)
        self.assertEqual(bridge.calls, [])


if __name__ == "__main__":
    unittest.main()

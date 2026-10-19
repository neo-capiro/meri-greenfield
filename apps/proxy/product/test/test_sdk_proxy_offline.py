"""Check the local qualification boundary against the real native usage parser.

These tests do not qualify the installed SDK, product HTTPS owner transport,
PostgreSQL or provider. The separate executable harness records those boundaries.
"""
import importlib.util
from pathlib import Path
import unittest

import httpx

from apps.proxy.product.response_settlement import _ObservedResponseStream
from apps.proxy.qualification.runtime.native_usage import UsageBinding

ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("sdk_proxy_provider_stub", ROOT /
    "scripts/qualification/sdk-proxy-offline/provider_stub.py")
STUB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STUB)


class OfflineStreamBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def observe(self, mode, *, structured=False, admitted=False):
        settled = []
        async def complete(identifier, result):
            settled.append((identifier, result))
        binding = UsageBinding("offline_request", "a" * 64, "b" * 64, "c" * 64, 12, 16,
            frozenset({"StructuredOutput"}) if admitted else frozenset({"local_echo"}))
        stream = _ObservedResponseStream(STUB.RawStream(STUB.response_frames(mode, structured=structured)), 200,
            {"content-type": "application/vnd.amazon.eventstream"}, binding, complete, None)
        parts = [part async for part in stream]
        await stream.aclose()
        return settled, b"".join(parts)

    async def test_real_crc_native_parser_settles_complete_cumulative_usage(self):
        settled, raw = await self.observe("complete")
        self.assertEqual(raw, STUB.response_frames("complete"))
        self.assertEqual(len(settled), 1)
        identifier, result = settled[0]
        self.assertEqual(identifier, "offline_request")
        self.assertEqual((result.status, result.input_tokens, result.output_tokens), ("COMPLETE", 12, 3))

    async def test_truncation_cache_and_missing_usage_never_settle(self):
        for mode in ("truncated", "cached", "missing-usage"):
            with self.subTest(mode=mode):
                settled, raw = await self.observe(mode)
                self.assertTrue(raw)
                self.assertEqual(settled, [])

    async def test_structured_terminal_tool_requires_exact_admission_and_complete_usage(self):
        settled, raw = await self.observe("complete", structured=True, admitted=True)
        self.assertEqual(raw, STUB.response_frames("complete", structured=True))
        self.assertEqual(len(settled), 1)
        self.assertEqual((settled[0][1].status, settled[0][1].input_tokens,
                          settled[0][1].output_tokens), ("COMPLETE", 12, 3))
        for mode, admitted in (("complete", False), ("truncated", True), ("cached", True)):
            with self.subTest(mode=mode, admitted=admitted):
                settled, raw = await self.observe(mode, structured=True, admitted=admitted)
                self.assertTrue(raw)
                self.assertEqual(settled, [])

    async def test_stub_records_second_execution_attempt_and_refuses_it(self):
        receipt = {"providerExecutions": 0}
        stub = STUB.ProviderStub("complete", receipt)
        request = httpx.Request("POST", "https://bedrock-runtime.us-east-1.amazonaws.com/")
        response = await stub.handle_async_request(request)
        self.assertEqual(response.status_code, 200)
        await response.aclose()
        with self.assertRaisesRegex(RuntimeError, "^OFFLINE_DUPLICATE_PROVIDER_EXECUTION$"):
            await stub.handle_async_request(request)
        self.assertEqual(receipt["providerExecutions"], 2)

    def test_observation_exports_structure_and_hashes_without_content(self):
        raw = b'{"metadata":{"user_id":"{\\"session_id\\":\\"private-example\\"}"},"messages":[{"content":"private-prompt"}],"tools":[]}'
        observation = STUB.request_observation(raw)
        self.assertEqual(observation["topLevelArrayLengths"], {"messages": 1, "tools": 0})
        self.assertEqual(observation["metadataUserIdTypes"], {"session_id": "str"})
        self.assertEqual(len(observation["sha256"]), 64)
        self.assertNotIn("private-example", str(observation))
        self.assertNotIn("private-prompt", str(observation))


if __name__ == "__main__":
    unittest.main()

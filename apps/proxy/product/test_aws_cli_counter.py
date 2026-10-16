"""Offline exact-body and one-call checks for the pinned CLI preflight."""
import asyncio
import json
import sys
import types
import unittest
from unittest.mock import patch

from apps.proxy.product.aws_cli_counter import (
    cli_count_parameters, create_fixed_cli_count_callback,
)
from apps.proxy.qualification.runtime.bedrock_body import COUNT_MODEL_ID
from apps.proxy.qualification.runtime.lifetime import _request_lifetime
from apps.proxy.qualification.state.pricing import StateDenied


def request(**changes):
    value = {"messages": [{"role": "user", "content": "Hello, Meri"}],
             "tools": [], "betas": ("claude-code-20250219",)}
    value.update(changes)
    return value


class BodyTests(unittest.TestCase):
    def test_plain_request_is_exact_fixed_model_invoke_model_count(self):
        parameters = cli_count_parameters(request())
        self.assertEqual(set(parameters), {"modelId", "input"})
        self.assertEqual(parameters["modelId"], COUNT_MODEL_ID)
        self.assertEqual(set(parameters["input"]), {"invokeModel"})
        raw = parameters["input"]["invokeModel"]["body"]
        self.assertEqual(json.loads(raw), {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [{"role": "user", "content": "Hello, Meri"}],
            "max_tokens": 1, "anthropic_beta": ["claude-code-20250219"]})
        self.assertNotIn(b'"tools"', raw)
        self.assertNotIn(b'"model"', raw)

    def test_thinking_uses_pinned_2048_count_body(self):
        thinking = {"type": "enabled", "budget_tokens": 1024}
        messages = [{"role": "assistant", "content": [
            {"type": "thinking", "thinking": "Consider", "signature": "opaque"},
            {"type": "text", "text": "Answer"}]}]
        raw = cli_count_parameters(request(messages=messages, thinking=thinking,
                                           betas=()))["input"]["invokeModel"]["body"]
        self.assertEqual(json.loads(raw), {
            "anthropic_version": "bedrock-2023-05-31", "messages": messages,
            "max_tokens": 2048, "thinking": thinking})
        self.assertNotIn(b'"anthropic_beta"', raw)

    def test_configured_tool_is_preserved_and_other_tool_refused(self):
        tool = {"name": "local_echo", "input_schema": {"type": "object", "properties": {}}}
        raw = cli_count_parameters(request(tools=[tool]),
                                   allowed_tool_names=("local_echo",))["input"]["invokeModel"]["body"]
        self.assertEqual(json.loads(raw)["tools"], [tool])
        with self.assertRaises(StateDenied):
            cli_count_parameters(request(tools=[tool]))

    def test_no_body_model_or_unqualified_fields(self):
        for value in (request(model="other"), request(tools=[{"name": "web"}]),
                      request(betas=("token-counting-2024-11-01",)),
                      request(thinking={"type": "enabled", "budget_tokens": 2048}),
                      request(messages=[{"role": "system", "content": "x"}])):
            with self.subTest(value=value), self.assertRaises(StateDenied):
                cli_count_parameters(value)


class _Lifetime:
    deadline = 100000.0
    def __init__(self):
        self._cli_count_entered = False
        self.denied = False
    def check(self):
        if self.denied:
            raise StateDenied("REVOKED")


class _Checker:
    def __init__(self, client, *, deadline):
        if deadline != 100000.0 or client is None:
            raise AssertionError("INVALID_TRUSTED_DEPENDENCY")
    def _validate_client(self):
        return None
    def _remaining(self):
        return 5.0


class _Client:
    def __init__(self, response=None):
        self.calls = []
        self.response = response or {"inputTokens": 37, "ResponseMetadata": {
            "RequestId": "synthetic", "HTTPStatusCode": 200,
            "HTTPHeaders": {}, "RetryAttempts": 0}}
    def count_tokens(self, **parameters):
        self.calls.append(parameters)
        return self.response


class CallbackTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, client, value=None, life=None):
        fake = types.ModuleType("apps.proxy.qualification.runtime.aws_counter")
        fake.AwsNativeCounter = _Checker
        token = _request_lifetime.set(life)
        try:
            with patch.dict(sys.modules, {fake.__name__: fake}):
                return await create_fixed_cli_count_callback(client)(request() if value is None else value)
        finally:
            _request_lifetime.reset(token)

    async def test_one_operation_and_actual_integer_only(self):
        client, life = _Client(), _Lifetime()
        self.assertEqual(await self.invoke(client, life=life), 37)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0], cli_count_parameters(request()))
        with self.assertRaises(StateDenied):
            await self.invoke(client, life=life)
        self.assertEqual(len(client.calls), 1)

    async def test_no_lifetime_or_bad_response_cannot_succeed(self):
        client = _Client()
        with self.assertRaises(StateDenied):
            await self.invoke(client)
        self.assertEqual(client.calls, [])
        for response in ({"inputTokens": 0, "ResponseMetadata": {}},
                         {"inputTokens": 37, "ResponseMetadata": {
                             "RequestId": "synthetic", "HTTPStatusCode": 200,
                             "HTTPHeaders": {}, "RetryAttempts": 1}}):
            with self.assertRaises(StateDenied):
                await self.invoke(_Client(response), life=_Lifetime())

    async def test_revocation_after_count_denies(self):
        life = _Lifetime()
        class RevokingClient(_Client):
            def count_tokens(self, **parameters):
                life.denied = True
                return super().count_tokens(**parameters)
        with self.assertRaises(StateDenied):
            await self.invoke(RevokingClient(), life=life)


if __name__ == "__main__":
    unittest.main()

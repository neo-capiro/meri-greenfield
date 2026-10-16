"""Focused offline checks for the pinned CLI CountTokens wire shape."""
import json
import unittest

from apps.proxy.product.cli_count_tokens import (
    create_cli_count_tokens_app, parse_cli_count_request,
)
from apps.proxy.qualification.runtime.lifetime import _request_lifetime
from apps.proxy.qualification.state.pricing import StateDenied


MODEL = "meri-sonnet-qualification"


def scope():
    return {
        "type": "http", "method": "POST", "path": "/v1/messages/count_tokens",
        "raw_path": b"/v1/messages/count_tokens", "query_string": b"beta=true",
        "headers": [(b"content-type", b"application/json"),
                    (b"anthropic-version", b"2023-06-01"),
                    (b"anthropic-beta", b"claude-code-20250219,token-counting-2024-11-01")],
    }


def body(**changes):
    value = {"model": MODEL, "messages": [{"role": "user", "content": "Hello, Meri"}], "tools": []}
    value.update(changes)
    return json.dumps(value, separators=(",", ":")).encode()


class CountParserTests(unittest.TestCase):
    def test_actual_beta_route_and_body_omit_output_bound_and_model_selector(self):
        parsed = parse_cli_count_request(scope(), body(), model=MODEL)
        self.assertEqual(parsed, {"messages": [{"role": "user", "content": "Hello, Meri"}],
                                  "tools": [], "betas": ("claude-code-20250219",)})
        self.assertNotIn("model", parsed)

    def test_route_and_header_changes_refuse(self):
        for field, value in (("path", "/v1/messages"), ("raw_path", b"/v1/messages/count_tokens/"),
                             ("method", "GET"), ("query_string", b""),
                             ("query_string", b"beta=true&x=1")):
            changed = scope(); changed[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(StateDenied):
                parse_cli_count_request(changed, body(), model=MODEL)
        for header in ((b"anthropic-beta", b"token-counting-2024-11-01,unknown-2026-01-01"),
                       (b"anthropic-beta", b"claude-code-20250219"),
                       (b"anthropic-beta", b"token-counting-2024-11-01,token-counting-2024-11-01"),
                       (b"anthropic-version", b"2024-01-01"),
                       (b"content-encoding", b"gzip")):
            changed = scope()
            changed["headers"] = [(k, v) for k, v in changed["headers"] if k != header[0]] + [header]
            with self.subTest(header=header[0]), self.assertRaises(StateDenied):
                parse_cli_count_request(changed, body(), model=MODEL)

    def test_native_inference_or_arbitrary_count_payload_refuses(self):
        for raw in (body(model="other-model"), body(max_tokens=256), body(tools=[{"name": "web"}]),
                    body(messages=[]), body(messages=[{"role": "system", "content": "x"}]),
                    body(messages=[{"role": "user", "content": [{"type": "tool_use", "id": "a"}]}]),
                    b'{"model":"meri-sonnet-qualification","model":"meri-sonnet-qualification",'
                    b'"messages":[{"role":"user","content":"x"}],"tools":[]}',
                    b'{', b'"text"'):
            with self.subTest(raw=raw[:50]), self.assertRaises(StateDenied):
                parse_cli_count_request(scope(), raw, model=MODEL)

    def test_exact_cli_thinking_variant_and_bound(self):
        thinking = {"type": "enabled", "budget_tokens": 1024}
        messages = [{"role": "assistant", "content": [
            {"type": "thinking", "thinking": "Consider", "signature": "opaque"},
            {"type": "text", "text": "Answer"}]}]
        parsed = parse_cli_count_request(scope(), body(messages=messages, thinking=thinking), model=MODEL)
        self.assertEqual(parsed["thinking"], thinking)
        with self.assertRaises(StateDenied):
            parse_cli_count_request(scope(), body(messages=messages,
                thinking={"type": "enabled", "budget_tokens": 2048}), model=MODEL)

    def test_pinned_cli_count_beta_filter(self):
        changed = scope()
        changed["headers"][-1] = (b"anthropic-beta",
            b"claude-code-20250219,interleaved-thinking-2025-05-14,"
            b"context-management-2025-06-27,oauth-2025-04-20,token-counting-2024-11-01")
        self.assertEqual(parse_cli_count_request(changed, body(), model=MODEL)["betas"], (
            "claude-code-20250219", "interleaved-thinking-2025-05-14",
            "context-management-2025-06-27", "oauth-2025-04-20"))

    def test_local_tool_schema_requires_startup_allowlist(self):
        name = "mcp__meri_reads__lookup"
        tool = {"name": name, "description": "Read a selected item",
                "input_schema": {"type": "object", "properties": {"id": {"type": "string"}}}}
        messages = [{"role": "assistant", "content": [{"type": "tool_use", "id": "toolu_1",
                     "name": name, "input": {"id": "a"}}]},
                    {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_1",
                     "content": [{"type": "text", "text": "Found"}]}]}]
        raw = body(messages=messages, tools=[tool])
        with self.assertRaises(StateDenied):
            parse_cli_count_request(scope(), raw, model=MODEL)
        result = parse_cli_count_request(scope(), raw, model=MODEL, allowed_tool_names=(name,))
        self.assertEqual(result["tools"], [tool])
        for invalid in (dict(tool, name="unapproved"), dict(tool, type="web_search_20250305"),
                        dict(tool, input_schema={"type": "array"})):
            with self.subTest(invalid=invalid), self.assertRaises(StateDenied):
                parse_cli_count_request(scope(), body(messages=messages, tools=[invalid]),
                                        model=MODEL, allowed_tool_names=(name,))


class _Lifetime:
    def __init__(self):
        self.denied = False
        self.checks = 0

    def check(self):
        self.checks += 1
        if self.denied:
            raise StateDenied("SYNTHETIC_REVOKED")


class CountAppTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, app, *, raw=None, lifetime=None):
        raw = body() if raw is None else raw
        parts = [raw[:3], raw[3:]]
        events = iter([{"type": "http.request", "body": parts[0], "more_body": True},
                       {"type": "http.request", "body": parts[1], "more_body": False}])
        sent = []
        async def receive():
            return next(events)
        async def send(event):
            sent.append(event)
        token = None if lifetime is None else _request_lifetime.set(lifetime)
        try:
            await app(scope(), receive, send)
        finally:
            if token is not None:
                _request_lifetime.reset(token)
        return sent

    async def test_responds_only_from_trusted_count_callback(self):
        observed = []
        async def count(request):
            observed.append(request)
            return 137
        life = _Lifetime()
        sent = await self.invoke(create_cli_count_tokens_app(count, model=MODEL), lifetime=life)
        self.assertEqual([event["type"] for event in sent], ["http.response.start", "http.response.body"])
        self.assertEqual(sent[0]["status"], 200)
        self.assertEqual(json.loads(sent[1]["body"]), {"input_tokens": 137})
        self.assertEqual(len(observed), 1)
        self.assertNotIn("model", observed[0])
        self.assertGreater(life.checks, 3)

    async def test_direct_call_or_invalid_count_cannot_return_success(self):
        called = []
        async def count(request):
            called.append(request)
            return 0
        app = create_cli_count_tokens_app(count, model=MODEL)
        with self.assertRaises(StateDenied):
            await self.invoke(app)
        self.assertEqual(called, [])
        with self.assertRaises(StateDenied):
            await self.invoke(app, lifetime=_Lifetime())
        self.assertEqual(len(called), 1)

    async def test_revocation_after_count_prevents_reply(self):
        life = _Lifetime()
        async def count(_):
            life.denied = True
            return 12
        with self.assertRaises(StateDenied):
            await self.invoke(create_cli_count_tokens_app(count, model=MODEL), lifetime=life)


if __name__ == "__main__":
    unittest.main()

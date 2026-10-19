"""D1 envelope (64k input / 8k output) across the Python proxy checks; exact boundary admits, +1 refuses."""
from dataclasses import FrozenInstanceError
import json
import re
import unittest
from pathlib import Path

from apps.proxy.qualification.runtime import bedrock_body as bb
from apps.proxy.qualification.runtime.native_usage import UsageBinding
from apps.proxy.qualification.state import pricing

NODE = Path(__file__).resolve().parents[3] / "gateway/model-proxy/product-envelope.mjs"
HASH = "a" * 64


def usage_binding(counted, maximum):
    return UsageBinding(request_id="request_A", native_body_sha256=HASH, raw_request_sha256=HASH,
                        pricing_revision=HASH, counted_input_tokens=counted, max_output_tokens=maximum,
                        allowed_tool_names=frozenset({"local_echo"}))


class EnvelopeTests(unittest.TestCase):
    def test_values_match_the_node_owner_exactly(self):
        self.assertEqual((bb.ENVELOPE_MAX_INPUT_TOKENS, bb.ENVELOPE_MAX_OUTPUT_TOKENS), (65536, 8192))
        node = NODE.read_text()
        self.assertEqual(int(re.search(r"PRODUCT_MAX_INPUT_TOKENS=(\d+);", node).group(1)), bb.ENVELOPE_MAX_INPUT_TOKENS)
        self.assertEqual(int(re.search(r"PRODUCT_MAX_OUTPUT_TOKENS=(\d+);", node).group(1)), bb.ENVELOPE_MAX_OUTPUT_TOKENS)

    def test_body_limits_default_to_and_cap_at_the_envelope(self):
        limits = bb.BodyLimits()
        self.assertEqual((limits.max_input_tokens, limits.max_output_tokens), (65536, 8192))
        for kwargs in ({"max_input_tokens": 65537}, {"max_output_tokens": 8193}):
            with self.subTest(**kwargs), self.assertRaises(bb.AdmissionDenied):
                bb.BodyLimits(**kwargs)

    def test_usage_binding_and_reserve_liability_follow_the_envelope(self):
        usage_binding(65536, 8192)
        for counted, maximum in ((65537, 1), (1, 8193)):
            with self.subTest(counted=counted, maximum=maximum), self.assertRaises(ValueError):
                usage_binding(counted, maximum)
        # Worst-case hold for one maximal call: ceil((6600*65536 + 16500*8192) / 1000) microUSD (~$0.57).
        self.assertEqual(pricing.liability(65536, 8192, reserve=True), 567706)
        with self.assertRaises(pricing.StateDenied):
            pricing.liability(65537, 1, reserve=True)
        with self.assertRaises(pricing.StateDenied):
            pricing.liability(1, 8193, reserve=True)

    def test_structured_schema_binding_is_trusted_immutable_json(self):
        schema = {"type": "object", "properties": {"reply": {"type": "string"}},
                  "required": ["reply"], "additionalProperties": False}
        limits = bb.BodyLimits(structured_output_schema_json=json.dumps(schema))
        self.assertEqual(json.loads(limits.structured_output_schema_json), schema)
        self.assertNotIn("StructuredOutput", limits.allowed_tool_names)
        with self.assertRaises(FrozenInstanceError):
            limits.structured_output_schema_json = "{}"
        for value in (schema, b"{}", "[]", "null", '{"type":"object","type":"string"}',
                      '{"value":NaN}', '{"value":1e999}', '{', ' ' * (4 * 1024 * 1024 + 1)):
            with self.subTest(kind=type(value).__name__), self.assertRaises(bb.AdmissionDenied):
                bb.BodyLimits(structured_output_schema_json=value)


if __name__ == "__main__":
    unittest.main()

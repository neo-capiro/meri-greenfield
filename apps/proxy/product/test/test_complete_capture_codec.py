"""Bounded complete-response capture data encoding; no channel authority."""
import hashlib
import json
import unittest

from apps.proxy.product.boundary_codec import encode_complete_capture


ID = "request_A"
UUID = "11111111-1111-4111-8111-111111111111"
BINDING = {"tenantId": "tenant", "actorId": "actor",
           "conversationId": UUID, "runId": UUID, "attemptId": UUID,
           "workerId": UUID, "writerFence": 1}
RAW = b'{"prompt":"synthetic"}'
NATIVE = b'{"anthropic_version":"bedrock-2023-05-31"}'


def capture():
    native_sha = hashlib.sha256(NATIVE).hexdigest()
    raw_sha = hashlib.sha256(RAW).hexdigest()
    return {"reservation": {"requestId": ID, "nativeBodySha256": native_sha,
                            "state": "UNKNOWN"},
            "rawRequestBody": RAW, "nativeRequestBody": NATIVE,
            "completion": {"requestId": ID, "binding": BINDING,
                           "taskArn": "arn:aws:ecs:us-east-1:967807252336:task/synthetic",
                           "capabilitySha256": "a" * 64,
                           "nativeBodySha256": native_sha,
                           "rawRequestSha256": raw_sha,
                           "modelId": "anthropic.claude-sonnet-4-6",
                           "profileId": "us.anthropic.claude-sonnet-4-6",
                           "pricingRevision": "b" * 64,
                           "evidenceSha256": "e" * 64,
                           "httpStatus": 200, "complete": True, "eof": True,
                           "usage": {"inputTokens": 12, "outputTokens": 7}},
            "usageResult": {"status": "COMPLETE", "binding": {
                "request_id": ID, "native_body_sha256": native_sha,
                "raw_request_sha256": raw_sha, "pricing_revision": "b" * 64,
                "counted_input_tokens": 12, "max_output_tokens": 16,
                "allowed_tool_names": ["local_echo"]},
                "evidence_sha256": "e" * 64, "input_tokens": 12,
                "output_tokens": 7, "reason": "COMPLETE_NATIVE_MESSAGE",
                "origin": "native-usage-data"}}


class CompleteCaptureCodecTests(unittest.TestCase):
    def test_fresh_host_capture_preserves_exact_response_and_usage(self):
        frame = json.loads(encode_complete_capture(ID, capture()))
        self.assertEqual(frame[0:2], ["meri.proxy.complete-capture/1", ID])
        self.assertEqual(frame[2][2], "UNKNOWN")
        self.assertEqual(frame[5][11:13], [True, True])
        self.assertEqual(frame[5][13], [12, 7])
        self.assertEqual(frame[6][1][4:6], [12, 16])

    def test_changed_bytes_or_incomplete_response_refuse(self):
        for mutate in (
            lambda source: source.update(nativeRequestBody=b"other"),
            lambda source: source["completion"].update(rawRequestSha256="0" * 64),
            lambda source: source["completion"].update(eof=False),
            lambda source: source["usageResult"].update(output_tokens=8),
            lambda source: source["usageResult"]["binding"].update(
                allowed_tool_names=["local_echo", "local_echo"]),
        ):
            value = capture()
            mutate(value)
            with self.subTest(mutate=mutate):
                with self.assertRaises(ValueError):
                    encode_complete_capture(ID, value)


if __name__ == "__main__":
    unittest.main()

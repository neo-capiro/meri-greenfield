"""Focused inert codec checks; no host bridge, SQL, network or credentials."""
import hashlib
import json
import unittest

from .boundary_codec import _positional_frame, encode_admit, encode_operation, encode_reservation, encode_settlement
from ..qualification.runtime.native_usage import UsageBinding, UsageResult


RAW = b'\x00\xff{"prompt":"synthetic"}'
NATIVE = b'\x80{"anthropic_version":"bedrock-2023-05-31"}'
BINDING = {"tenantId": "ténant-组织", "actorId": "actor😀",
           "conversationId": "11111111-1111-4111-8111-111111111111",
           "runId": "22222222-2222-4222-8222-222222222222",
           "attemptId": "33333333-3333-4333-8333-333333333333",
           "workerId": "44444444-4444-4444-8444-444444444444",
           "writerFence": 2147483648}
SHA = lambda value: hashlib.sha256(value).hexdigest()


def reservation():
    value = {"requestId": "request_A", "binding": BINDING.copy(),
             "deadlineMs": 9000000000000}
    observation = {"requestId": "request_A",
                   "peer": {"binding": BINDING.copy(), "taskArn": "arn:aws:ecs:synthetic",
                            "grantId": "grant_A", "observedAtMs": 1234},
                   "proxyCredential": "synthetic-product-bearer-000000001",
                   "rawRequestBody": RAW,
                   "nativeRequest": {"method": "POST", "url": "https://example.test/invoke",
                                     "host": "example.test", "contentType": "application/json",
                                     "body": NATIVE,
                                     "headers": [("host", "example.test"),
                                                 ("content-type", "application/json")]},
                   "count": {"inputTokens": 12, "nativeBodySha256": SHA(NATIVE),
                             "modelId": "anthropic.claude-sonnet-4-6",
                             "origin": "aws-counttokens"}}
    return value, observation


def usage():
    binding = UsageBinding("request_A", SHA(NATIVE), SHA(RAW), "b" * 64,
                           12, 16, frozenset({"tool_B", "local_echo"}))
    return UsageResult("COMPLETE", binding, "e" * 64, 12, 7,
                       "COMPLETE_NATIVE_MESSAGE")


class CodecTests(unittest.TestCase):
    def test_admit_encodes_exact_request_and_refuses_invalid_fields(self):
        self.assertEqual(json.loads(encode_admit("request_A", "a" * 64, 9000000000000)),
                         ["meri.proxy.admit/1", "request_A", "a" * 64, 9000000000000])
        for args in (("bad slot", "a" * 64, 1), ("request_A", "bad", 1),
                     ("request_A", "a" * 64, 0), ("request_A", "a" * 64, True)):
            with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
                encode_admit(*args)

    def test_operation_v2_preserves_independent_samples_and_outcome_recovery(self):
        value, observation = reservation()
        claim = encode_reservation(value, observation)
        observation["count"]["inputTokens"] = 11
        capture = encode_reservation(value, observation)
        frame = json.loads(encode_operation("session_A", claim, capture))
        self.assertEqual(frame[0:2], ["meri.proxy.operation/2", "session_A"])
        self.assertEqual(frame[2], json.loads(claim))
        self.assertEqual(frame[3], json.loads(capture))
        self.assertNotEqual(frame[2], frame[3])
        outcome = json.dumps(["meri.proxy.outcome/1", "request_A"]).encode()
        self.assertEqual(json.loads(encode_operation("session_A", outcome, None)),
                         ["meri.proxy.operation/2", "session_A", ["meri.proxy.outcome/1", "request_A"], None])

    def test_operation_v2_refuses_missing_capture_old_frames_and_nonpositional_data(self):
        value, observation = reservation()
        claim = encode_reservation(value, observation)
        for bad_claim, bad_capture in (
                (claim, None), (claim, b'{}'),
                (b'["meri.proxy.operation/1","session_A",[]]', claim),
                (b'["meri.proxy.reservation/1",{},[]]', claim),
                (b'["meri.proxy.reservation/1",[],[1.5]]', claim),
                (b'["meri.proxy.outcome/1","request_A"]', claim),
                (b'[]', None), (b'\xff', claim)):
            with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
                encode_operation("session_A", bad_claim, bad_capture)
        value["deadlineMs"] -= 1
        with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
            encode_operation("session_A", claim, encode_reservation(value, observation))

    def test_combined_maximum_samples_fit_without_widening_body_or_wire_limits(self):
        value, observation = reservation()
        observation["rawRequestBody"] = b"a" * (4 * 1024 * 1024)
        observation["nativeRequest"]["body"] = b"b" * (4 * 1024 * 1024)
        claim = encode_reservation(value, observation)
        result = encode_operation("session_A", claim, claim)
        self.assertGreater(len(result), 12 * 1024 * 1024)
        self.assertLessEqual(len(result), 24 * 1024 * 1024)
        frame = json.loads(result)
        self.assertEqual(frame[2], frame[3])
        observation["rawRequestBody"] += b"x"
        with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
            encode_reservation(value, observation)
        with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
            _positional_frame(json.dumps(["x" * (24 * 1024 * 1024)]).encode())

    def test_reservation_preserves_distinct_non_utf8_byte_sequences(self):
        value, observation = reservation()
        wire = encode_reservation(value, observation)
        frame = json.loads(wire)
        self.assertLess(len(wire), 12 * 1024 * 1024)
        self.assertEqual(frame[0], "meri.proxy.reservation/1")
        self.assertEqual(frame[1][1][0:2], ["ténant-组织", "actor😀"])
        self.assertEqual(frame[1][1][6], 2147483648)
        self.assertEqual(frame[2][3], "AP97InByb21wdCI6InN5bnRoZXRpYyJ9")
        self.assertEqual(frame[2][4][4], "gHsiYW50aHJvcGljX3ZlcnNpb24iOiJiZWRyb2NrLTIwMjMtMDUtMzEifQ==")
        self.assertNotEqual(frame[2][3], frame[2][4][4])
        self.assertTrue(all(type(item) is not dict for item in [frame, frame[1], frame[2]]))

    def test_reservation_rejects_extra_keys_duplicate_headers_and_binding_drift(self):
        for change in (lambda v, o: v.update(extra=True),
                       lambda v, o: o["peer"]["binding"].update(writerFence=3),
                       lambda v, o: v["binding"].update(runId="not-a-uuid"),
                       lambda v, o: v["binding"].update(tenantId="\ud800"),
                       lambda v, o: o["nativeRequest"]["headers"].append(("Host", "duplicate")),
                       lambda v, o: o["nativeRequest"].update(body=b""),
                       lambda v, o: o["nativeRequest"].update(body=b"x" * (4 * 1024 * 1024 + 1))):
            value, observation = reservation()
            change(value, observation)
            with self.assertRaisesRegex(ValueError, "^PRODUCT_PROXY_CODEC_REFUSED$"):
                encode_reservation(value, observation)

    def test_settlement_flattens_frozenset_in_sorted_order(self):
        frame = json.loads(encode_settlement("request_A", usage()))
        self.assertEqual(frame[0], "meri.proxy.settlement/1")
        self.assertEqual(frame[2][1][6], ["local_echo", "tool_B"])
        self.assertEqual(frame[2][1][1:4], [SHA(NATIVE), SHA(RAW), "b" * 64])
        self.assertEqual(frame[2][3:5], [12, 7])

    def test_settlement_rejects_incomplete_or_mismatched_result(self):
        base = usage()
        for candidate in (UsageResult("UNKNOWN", base.binding, base.evidence_sha256),
                          UsageResult("COMPLETE", base.binding, base.evidence_sha256,
                                      13, 7, "COMPLETE_NATIVE_MESSAGE"),
                          {"status": "COMPLETE"}):
            with self.assertRaisesRegex(ValueError, "^PRODUCT_PROXY_CODEC_REFUSED$"):
                encode_settlement("request_A", candidate)
        with self.assertRaisesRegex(ValueError, "^PRODUCT_PROXY_CODEC_REFUSED$"):
            encode_settlement("another_request", base)

    def test_settlement_carries_billed_input_below_the_count(self):
        base = usage()
        billed = UsageResult("COMPLETE", base.binding, base.evidence_sha256, 11, 7, "COMPLETE_NATIVE_MESSAGE")
        self.assertEqual(json.loads(encode_settlement("request_A", billed))[2][3:5], [11, 7])


if __name__ == "__main__":
    unittest.main()

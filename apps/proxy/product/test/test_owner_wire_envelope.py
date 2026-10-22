"""Actual Python encoder -> Node owner decoder contract; synthetic, no network/SQL."""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from apps.proxy.product.boundary_codec import (
    encode_admit, encode_operation, encode_complete_capture, encode_reservation, encode_settlement,
)
from apps.proxy.product.test_boundary_codec import reservation
from apps.proxy.product.test.test_complete_capture_codec import ID, capture
from apps.proxy.qualification.runtime.native_usage import UsageBinding, UsageResult


ROOT = Path(__file__).resolve().parents[4]
DECODE = """
import {readFileSync} from 'node:fs';
import {parseOwnerWire,decodeReservationFrame,decodeSettlementFrame,decodeCompleteCaptureFrame}
 from './apps/proxy/product/owner-wire-codec.mjs';
import {decodeSettlementFrame as gatewaySettlement}
 from './apps/gateway/model-proxy/product-boundary-codec.mjs';
const decoders={'meri.proxy.reservation/1':decodeReservationFrame,
 'meri.proxy.settlement/1':decodeSettlementFrame,
 'meri.proxy.complete-capture/1':decodeCompleteCaptureFrame};
const results=JSON.parse(readFileSync(0,'utf8')).map(({frame,gateway=false})=>{
 try{
  const raw=Buffer.from(JSON.stringify(frame));
  const value=gateway?gatewaySettlement(raw):decoders[frame[0]](parseOwnerWire(raw));
  if(value.observation)return {input:value.observation.count.inputTokens};
  const u=value.usageResult;
  return {input:u.input_tokens,maximum:u.binding.max_output_tokens,output:u.output_tokens,
   ...(value.completion?{capture:value.completion.usage}:{})};
 }catch(error){return {error:error.message};}
});
process.stdout.write(JSON.stringify(results));
"""


def values(counted=65536, maximum=8192, output=8192):
    request, observation = reservation()
    observation["count"]["inputTokens"] = counted
    complete = capture()
    complete["completion"]["usage"] = {"inputTokens": counted, "outputTokens": output}
    usage = complete["usageResult"]
    usage["binding"].update(counted_input_tokens=counted, max_output_tokens=maximum)
    usage.update(input_tokens=counted, output_tokens=output)
    typed = UsageResult(**{**usage, "binding": UsageBinding(**{
        **usage["binding"], "allowed_tool_names": frozenset(usage["binding"]["allowed_tool_names"]),
    })})
    return request, observation, complete, typed


def frames(counted=65536, maximum=8192, output=8192):
    request, observation, complete, typed = values(counted, maximum, output)
    return [json.loads(raw) for raw in (
        encode_reservation(request, observation), encode_settlement(ID, typed),
        encode_complete_capture(ID, complete),
    )]


class OwnerWireEnvelopeTests(unittest.TestCase):
    def require_node(self):
        node = shutil.which('node')
        if node is None:
            self.skipTest('UNRUN: owner wire decoder requires Node.js')
        if not (ROOT/'node_modules').is_dir():
            self.skipTest('UNRUN: owner wire decoder requires installed workspace node_modules')
        for module in ('apps/proxy/product/owner-wire-codec.mjs',
                       'apps/gateway/model-proxy/product-boundary-codec.mjs',
                       'apps/gateway/model-proxy/product-envelope.mjs'):
            if not (ROOT/module).is_file():
                self.skipTest('UNRUN: owner wire decoder requires workspace module '+module)
        return node

    def decode(self, payload):
        node = self.require_node()
        result = subprocess.run([node, "--input-type=module", "-e", DECODE],
                                input=json.dumps(payload), text=True, capture_output=True,
                                cwd=ROOT, timeout=10, check=True)
        return json.loads(result.stdout)

    def test_combined_python_frames_cross_actual_versioned_owner_decoders(self):
        node = self.require_node()
        request, observation, complete, typed = values(12, 16, 7)
        claim = encode_reservation(request, observation)
        payload = [json.loads(frame) for frame in (
            encode_admit(ID, "a" * 64, 9000000000000),
            encode_operation("session_A", claim, encode_reservation(request, observation)),
            encode_operation("session_A", encode_settlement(ID, typed), encode_complete_capture(ID, complete)),
            encode_operation("session_A", json.dumps(["meri.proxy.outcome/1", ID]).encode(), None))]
        script = """
import {readFileSync} from 'node:fs';
import {parseOwnerWire,decodeAdmitFrame,decodeOperationFrame} from './apps/proxy/product/owner-wire-codec.mjs';
const rows=JSON.parse(readFileSync(0,'utf8')).map(frame=>{
 const parsed=parseOwnerWire(Buffer.from(JSON.stringify(frame)));
 if(frame[0]==='meri.proxy.admit/1')return decodeAdmitFrame(parsed);
 const v=decodeOperationFrame(parsed);
 return {sessionId:v.sessionId,kind:v.kind,requestId:v.submitted.request?.requestId??v.submitted.requestId,
  captured:v.captured!==null};
});
process.stdout.write(JSON.stringify(rows));
"""
        result = subprocess.run([node, "--input-type=module", "-e", script],
                                input=json.dumps(payload), text=True, capture_output=True,
                                cwd=ROOT, timeout=10, check=True)
        self.assertEqual(json.loads(result.stdout), [
            {"requestId": ID, "capabilitySha256": "a" * 64, "deadlineMs": 9000000000000},
            {"sessionId": "session_A", "kind": "reserve", "requestId": ID, "captured": True},
            {"sessionId": "session_A", "kind": "settle", "requestId": ID, "captured": True},
            {"sessionId": "session_A", "kind": "outcome", "requestId": ID, "captured": False}])

    def test_python_frames_cross_actual_owner_at_approved_and_legacy_boundaries(self):
        for counted, maximum, output in ((65536, 8192, 8192), (8193, 257, 257),
                                         (12, 8192, 16), (12, 16, 7), (1, 1, 0)):
            with self.subTest(counted=counted, maximum=maximum, output=output):
                reservation_frame, settlement, complete = frames(counted, maximum, output)
                results = self.decode([{"frame": frame} for frame in
                                       (reservation_frame, settlement, complete)] +
                                      [{"frame": settlement, "gateway": True}])
                expected = {"input": counted, "maximum": maximum, "output": output}
                self.assertEqual(results, [{"input": counted}, expected,
                                 {**expected, "capture": {"inputTokens": counted,
                                                          "outputTokens": output}}, expected])

    def test_owner_refuses_each_token_field_past_envelope(self):
        valid = frames()
        mutations = ((0, (2, 5, 0), 65537),
                     (1, (2, 1, 4), 65537), (1, (2, 1, 5), 8193),
                     (1, (2, 3), 65537), (1, (2, 4), 8193),
                     (2, (5, 13, 0), 65537), (2, (5, 13, 1), 8193),
                     (2, (6, 1, 4), 65537), (2, (6, 1, 5), 8193),
                     (2, (6, 3), 65537), (2, (6, 4), 8193))
        payload = []
        for index, path, value in mutations:
            frame = copy.deepcopy(valid[index])
            target = frame
            for part in path[:-1]:
                target = target[part]
            target[path[-1]] = value
            payload.append({"frame": frame})
        # Keep related counts equal so consistency checks cannot mask the cap.
        for counted, output in ((65537, 8192), (65536, 8193)):
            settlement, complete = copy.deepcopy(valid[1:])
            for usage in (settlement[2], complete[6]):
                usage[1][4] = usage[3] = counted
                usage[1][5] = usage[4] = output
            complete[5][13] = [counted, output]
            payload.extend([{"frame": settlement}, {"frame": complete}])
        self.assertEqual(self.decode(payload),
                         [{"error": "PRODUCT_OWNER_WIRE_REFUSED"}] * len(payload))

    def test_output_still_cannot_exceed_request_maximum(self):
        _, settlement, complete = frames(12, 16, 16)
        settlement[2][4] = 17
        complete[5][13][1] = complete[6][4] = 17
        self.assertEqual(self.decode([{"frame": settlement}, {"frame": complete}]),
                         [{"error": "PRODUCT_OWNER_WIRE_REFUSED"}] * 2)
        _, _, captured, typed = values(12, 16, 17)
        for encode in (lambda: encode_settlement(ID, typed),
                       lambda: encode_complete_capture(ID, captured)):
            with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
                encode()

    def test_python_reservation_and_capture_refuse_input_past_envelope(self):
        request, observation, complete, _ = values()
        observation["count"]["inputTokens"] = 65537
        complete["completion"]["usage"]["inputTokens"] = 65537
        for encode in (lambda: encode_reservation(request, observation),
                       lambda: encode_complete_capture(ID, complete)):
            with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_CODEC_REFUSED"):
                encode()


if __name__ == "__main__":
    unittest.main()

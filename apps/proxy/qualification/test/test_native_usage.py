"""Literal native payloads only; no provider, transport or settlement calls."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from runtime.native_usage import UsageBinding,NativeStreamUsage,parse_complete_message

BIND=UsageBinding("request-1","a"*64,"b"*64,"c"*64,7,16)
def raw(x):return json.dumps(x,separators=(",",":"),ensure_ascii=False).encode()
def message():return {"id":"msg_synthetic","type":"message","role":"assistant","model":"claude-sonnet-4-6","content":[{"type":"text","text":"synthetic"}],"stop_reason":"end_turn","stop_sequence":None,"usage":{"input_tokens":7,"output_tokens":3}}
def events():
    start=message();start.update(content=[],stop_reason=None);start["usage"]["output_tokens"]=1
    return [{"type":"message_start","message":start},{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}},
            {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"synthetic 🌿"}},
            {"type":"content_block_stop","index":0},{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":None},"usage":{"output_tokens":3}},{"type":"message_stop"}]
def parse(data,**kw):return parse_complete_message(data,BIND,http_status=kw.get("http_status",200),body_complete=kw.get("body_complete",True),content_type=kw.get("content_type","application/json"))
def stream(items,**kw):
    parser=NativeStreamUsage(BIND)
    for item in items:parser.feed_native_chunk(item if type(item) is bytes else raw(item))
    return parser.finish(transport_complete=kw.get("transport_complete",True),cancelled=kw.get("cancelled",False))


class UsageTests(unittest.TestCase):
    def test_complete_nonstream_exact_hash_and_binding(self):
        data=raw(message());result=parse(data)
        self.assertEqual((result.status,result.input_tokens,result.output_tokens),("COMPLETE",7,3))
        self.assertIs(result.binding,BIND);self.assertEqual(result.evidence_sha256,hashlib.sha256(data).hexdigest())

    def test_http_incomplete_error_cancel_remain_unknown(self):
        for kw in ({"http_status":500},{"http_status":True},{"body_complete":False},{"body_complete":1},{"content_type":"text/event-stream"}):
            self.assertEqual(parse(raw(message()),**kw).status,"UNKNOWN")
        for data in (b'{',b'null',b'\xff',b'{"type":"message","type":"message"}',b'{"x":NaN}',b' '*4194305):
            self.assertEqual(parse(data).status,"UNKNOWN")

    def test_usage_features_wrong_model_and_counts_fail_closed(self):
        for key,value in (("model","foreign"),("stop_reason",None),("stop_sequence","unrequested"),("thinking",{})):
            m=message();m[key]=value;self.assertEqual(parse(raw(m)).status,"UNKNOWN")
        for field,value in (("input_tokens",True),("input_tokens",8),("output_tokens",17),("output_tokens",-1),("cache_read_input_tokens",1),("cache_creation_input_tokens",False),("service_tier","standard")):
            m=message();m["usage"][field]=value;self.assertEqual(parse(raw(m)).status,"UNKNOWN")
        m=message();m["usage"].update(cache_read_input_tokens=0,cache_creation_input_tokens=0)
        self.assertEqual(parse(raw(m)).status,"COMPLETE")

    def test_complete_tool_and_unsupported_content(self):
        m=message();m.update(stop_reason="tool_use",content=[{"type":"tool_use","id":"tool_1","name":"local_echo","input":{"x":1}}])
        self.assertEqual(parse(raw(m)).status,"COMPLETE")
        for content in ([{"type":"thinking","thinking":"x"}],[{"type":"tool_use","id":"tool_1","name":"foreign","input":{}}],m["content"]*2):
            m["content"]=content;self.assertEqual(parse(raw(m)).status,"UNKNOWN")

    def test_stream_complete_requires_marker_and_transport_eof(self):
        self.assertEqual(stream(events()).status,"COMPLETE")
        for items in (events()[:-1],events()[1:],events()+[{"type":"ping"}],events()+[{"type":"error","error":{}}],[] ):
            self.assertEqual(stream(items).status,"UNKNOWN")
        self.assertEqual(stream(events(),transport_complete=False).status,"UNKNOWN")
        self.assertEqual(stream(events(),cancelled=True).status,"UNKNOWN")

    def test_stream_raw_byte_framed_evidence_and_single_finish(self):
        parser=NativeStreamUsage(BIND);expected=hashlib.sha256(b"meri-native-usage-stream/1\0")
        for event in events():
            data=raw(event);expected.update(len(data).to_bytes(8,"big"));expected.update(data);parser.feed_native_chunk(data)
        result=parser.finish(transport_complete=True);self.assertEqual(result.evidence_sha256,expected.hexdigest())
        with self.assertRaises(ValueError):parser.finish(transport_complete=True)
        with self.assertRaises(ValueError):parser.feed_native_chunk(b'{}')

    def test_stream_invalid_order_unknown_fields_and_error_are_sticky(self):
        cases=[events()+events(),[{"type":"message_stop"}],events()[:2]+events()[4:],events()[:3]+[events()[2]]+events()[3:]]
        # Repeated text delta itself is legal; use an explicit wrong index instead.
        cases.pop();bad=events();bad[2]["index"]=1;cases.append(bad)
        for bad in ({"type":"error","error":{"type":"synthetic"}},{"type":"future"},b'{',b'{"type":"ping","type":"ping"}'):
            cases.append(events()[:1]+[bad]+events()[1:])
        for items in cases:self.assertEqual(stream(items).status,"UNKNOWN")

    def test_stream_cumulative_usage_regression_and_bounds(self):
        for value in (True,-1,17):
            ev=events();ev[-2]["usage"]["output_tokens"]=value;self.assertEqual(stream(ev).status,"UNKNOWN")
        ev=events();delta=copy.deepcopy(ev[-2]);delta["usage"]["output_tokens"]=2;ev.insert(-1,delta)
        self.assertEqual(stream(ev).status,"UNKNOWN")
        parser=NativeStreamUsage(BIND);parser.feed_native_chunk(b' '*262145)
        for event in events():parser.feed_native_chunk(raw(event))
        self.assertEqual(parser.finish(transport_complete=True).status,"UNKNOWN")

    def test_stream_tool_atomic_json_and_identity(self):
        ev=events();ev[1]["content_block"]={"type":"tool_use","id":"tool_1","name":"local_echo","input":{}}
        ev[2]["delta"]={"type":"input_json_delta","partial_json":'{"value":"synthetic"}'};ev[-2]["delta"]["stop_reason"]="tool_use"
        self.assertEqual(stream(ev).status,"COMPLETE")
        for fragment in ('{','[]','{"x":1,"x":2}'):
            bad=copy.deepcopy(ev);bad[2]["delta"]["partial_json"]=fragment;self.assertEqual(stream(bad).status,"UNKNOWN")
        bad=copy.deepcopy(ev);bad[2]["delta"]={"type":"thinking_delta","thinking":"x"};self.assertEqual(stream(bad).status,"UNKNOWN")

    def test_binding_refuses_forged_shape(self):
        for args in (("bad.id","a"*64,"b"*64,"c"*64,7,16),("r","A"*64,"b"*64,"c"*64,7,16),("r","a"*64,"b"*64,"c"*64,True,16)):
            with self.assertRaises(ValueError):UsageBinding(*args)
        with self.assertRaises(ValueError):NativeStreamUsage(object())

if __name__=="__main__":unittest.main()

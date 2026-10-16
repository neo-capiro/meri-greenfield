import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeReservationFrame,decodeSettlementFrame} from './product-boundary-codec.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const raw=Buffer.from([0,255,...Buffer.from('{"prompt":"synthetic"}')]);
const native=Buffer.from([128,...Buffer.from('{"anthropic_version":"bedrock-2023-05-31"}')]);
const binding=['ténant-组织','actor😀',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444',2147483648];
const wire=frame=>Buffer.from(JSON.stringify(frame));
function reservation(){
 return ['meri.proxy.reservation/1',['request_A',binding,9000000000000],
  ['request_A',[[...binding],'arn:aws:ecs:synthetic','grant_A',1234],
   'synthetic-product-bearer-000000001',raw.toString('base64'),
   ['POST','https://example.test/invoke','example.test','application/json',
    native.toString('base64'),[['host','example.test'],['content-type','application/json']]],
   [12,sha(native),'anthropic.claude-sonnet-4-6','aws-counttokens']]];
}
function settlement(){
 return ['meri.proxy.settlement/1','request_A',
  ['COMPLETE',['request_A',sha(native),sha(raw),'b'.repeat(64),12,16,
   ['local_echo','tool_B']],'e'.repeat(64),12,7,'COMPLETE_NATIVE_MESSAGE','native-usage-data']];
}

test('Python reservation frame becomes the two exact bridge argument shapes',()=>{
 const {value,observation}=decodeReservationFrame(wire(reservation()));
 assert.deepEqual(value,{requestId:'request_A',binding:{tenantId:'ténant-组织',actorId:'actor😀',
  conversationId:binding[2],runId:binding[3],attemptId:binding[4],
  workerId:binding[5],writerFence:2147483648},
  deadlineMs:9000000000000});
 assert.equal(observation.requestId,value.requestId);
 assert.deepEqual(observation.peer.binding,value.binding);
 assert.ok(Buffer.isBuffer(observation.rawRequestBody));
 assert.ok(Buffer.isBuffer(observation.nativeRequest.body));
 assert.deepEqual(observation.rawRequestBody,raw);
 assert.deepEqual(observation.nativeRequest.body,native);
 assert.notDeepEqual(observation.rawRequestBody,observation.nativeRequest.body);
 assert.equal(observation.count.nativeBodySha256,sha(native));
});

test('reservation decoder refuses extra positions, duplicate headers, malformed bytes and object keys',()=>{
 const invalid=[];
 let value=reservation();value[2].push('extra');invalid.push(wire(value));
 value=reservation();value[2][4][5].push(['Host','duplicate']);invalid.push(wire(value));
 value=reservation();value[2][3]='AA=A';invalid.push(wire(value));
 value=reservation();value[2][4][4]='';invalid.push(wire(value));
 value=reservation();value[2][1][0][6]=3;invalid.push(wire(value));
 value=reservation();value[1][1][3]='not-a-uuid';invalid.push(wire(value));
 value=reservation();value[1][1][0]='\ud800';invalid.push(wire(value));
 invalid.push(Buffer.from('["meri.proxy.reservation/1",{"a":1,"a":2},[]]'));
 invalid.push(Buffer.from([0xff]));
 invalid.push(Buffer.alloc(12*1024*1024+1,0x20));
 invalid.forEach((malformed,index)=>assert.throws(()=>decodeReservationFrame(malformed),
  /^Error: PRODUCT_PROXY_CODEC_REFUSED$/u,`case ${index}`));
});

test('Python UsageResult frame becomes sorted JS settlement claim',()=>{
 const {requestId,usageResult}=decodeSettlementFrame(wire(settlement()));
 assert.equal(requestId,'request_A');
 assert.deepEqual(usageResult,{status:'COMPLETE',binding:{request_id:'request_A',
  native_body_sha256:sha(native),raw_request_sha256:sha(raw),
  pricing_revision:'b'.repeat(64),counted_input_tokens:12,max_output_tokens:16,
  allowed_tool_names:['local_echo','tool_B']},evidence_sha256:'e'.repeat(64),
  input_tokens:12,output_tokens:7,reason:'COMPLETE_NATIVE_MESSAGE',origin:'native-usage-data'});
});

test('settlement decoder refuses incomplete, changed count, duplicate tools and extra fields',()=>{
 const invalid=[];
 let value=settlement();value[2][0]='UNKNOWN';invalid.push(value);
 value=settlement();value[2][3]=11;invalid.push(value);
 value=settlement();value[2][1][6]=['local_echo','local_echo'];invalid.push(value);
 value=settlement();value[2][1][6]=['tool_B','local_echo'];invalid.push(value);
 value=settlement();value[2].push('extra');invalid.push(value);
 for(const malformed of invalid)assert.throws(()=>decodeSettlementFrame(wire(malformed)),
  /^Error: PRODUCT_PROXY_CODEC_REFUSED$/u);
});

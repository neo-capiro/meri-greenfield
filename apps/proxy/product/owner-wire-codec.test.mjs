import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {captureCallRequest,captureCompleteRequest,decodeCompleteCaptureFrame,
 decodeAdmitFrame,decodeOperationFrame,decodeReservationFrame,decodeSettlementFrame,parseOwnerWire} from './owner-wire-codec.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const id='request_A';
const uuid='11111111-1111-4111-8111-111111111111';
const binding=['tenant-α','actor-β',uuid,uuid,uuid,uuid,1];
const raw=Buffer.from('{"prompt":"synthetic"}');
const native=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}');
const credential='synthetic-product-model-bearer-000001';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const model='anthropic.claude-sonnet-4-6';
const profile='us.anthropic.claude-sonnet-4-6';
const reservation=()=>['meri.proxy.reservation/1',[id,binding,9007199254740000],
 [id,[binding,'arn:aws:ecs:us-east-1:967807252336:task/synthetic',uuid,1700000000000],
  credential,raw.toString('base64'),['POST',`https://${host}/model/${profile}/invoke`,
   host,'application/json',native.toString('base64'),[['host',host],['content-type','application/json']]],
  [12,sha(native),model,'aws-counttokens']]];
const usage=()=>['COMPLETE',[id,sha(native),sha(raw),'b'.repeat(64),12,16,['local_echo']],
 'e'.repeat(64),12,7,'COMPLETE_NATIVE_MESSAGE','native-usage-data'];
const complete=()=>['meri.proxy.complete-capture/1',id,[id,sha(native),'UNKNOWN'],
 raw.toString('base64'),native.toString('base64'),
 [id,binding,'arn:aws:ecs:us-east-1:967807252336:task/synthetic',sha(credential),
  sha(native),sha(raw),model,profile,'b'.repeat(64),'e'.repeat(64),200,true,true,[12,7]],
 usage()];
const wire=value=>Buffer.from(JSON.stringify(value));

test('ADMIT golden frame is request-bound and rejects wrong version and malformed values',()=>{
 const value=['meri.proxy.admit/1',id,sha(credential),9007199254740000];
 assert.deepEqual(decodeAdmitFrame(parseOwnerWire(wire(value))),
  {requestId:id,capabilitySha256:sha(credential),deadlineMs:9007199254740000});
 for(const change of [v=>v[0]='meri.proxy.placement-read/1',v=>v[1]='bad slot',
  v=>v[2]='not-a-digest',v=>v[3]=0,v=>v.push('extra')]){
  const bad=structuredClone(value);change(bad);
  assert.throws(()=>decodeAdmitFrame(bad),/PRODUCT_OWNER_WIRE_REFUSED/);
 }
});

test('operation v2 golden frames carry both typed samples and separate outcome recovery',()=>{
 const reserve=decodeOperationFrame(parseOwnerWire(wire(['meri.proxy.operation/2','session_A',reservation(),reservation()])));
 assert.equal(reserve.kind,'reserve');assert.equal(reserve.sessionId,'session_A');
 assert.deepEqual(reserve.submitted.request,reserve.captured.request);
 assert.deepEqual(reserve.captured.observation.rawRequestBody,raw);
 const settled=decodeOperationFrame(['meri.proxy.operation/2','session_A',['meri.proxy.settlement/1',id,usage()],complete()]);
 assert.equal(settled.kind,'settle');assert.equal(settled.submitted.usageResult.output_tokens,7);
 assert.equal(settled.captured.completion.eof,true);
 assert.deepEqual(decodeOperationFrame(['meri.proxy.operation/2','session_A',['meri.proxy.outcome/1',id],null]),
  {sessionId:'session_A',kind:'outcome',submitted:{requestId:id},captured:null});
});

test('operation v2 refuses replaced wire frames and absent or foreign capture shapes',()=>{
 for(const bad of [
  ['meri.proxy.operation/1','session_A',reservation()],
  ['meri.proxy.operation/1','session_A',reservation(),reservation()],
  ['meri.proxy.session-open/1',id,sha(credential),binding,9007199254740000],
  ['meri.proxy.capture-poll/1','session_A',id,'call'],
  ['meri.proxy.capture-reply/1','session_A',id,'call',reservation()],
  ['meri.proxy.placement-read/1',id,sha(credential),9007199254740000],
  ['meri.proxy.operation/2','session_A',reservation(),null],
  ['meri.proxy.operation/2','session_A',reservation(),complete()],
  ['meri.proxy.operation/2','session_A',['meri.proxy.settlement/1',id,usage()],reservation()],
  ['meri.proxy.operation/2','session_A',['meri.proxy.outcome/1',id],complete()],
  ['meri.proxy.operation/2','session_A',['meri.proxy.capture-call/1',id,binding,1],null],
 ])assert.throws(()=>decodeOperationFrame(bad),/PRODUCT_OWNER_WIRE_REFUSED/);
});

test('operation v2 correlates reservation request and settlement capture before returning data',()=>{
 const captured=reservation();captured[1][2]--;
 assert.throws(()=>decodeOperationFrame(['meri.proxy.operation/2','session_A',reservation(),captured]),/PRODUCT_OWNER_WIRE_REFUSED/);
 const submitted=['meri.proxy.settlement/1','other',usage()];
 submitted[2][1][0]='other';
 assert.throws(()=>decodeOperationFrame(['meri.proxy.operation/2','session_A',submitted,complete()]),/PRODUCT_OWNER_WIRE_REFUSED/);
});

test('combined maximum-size samples fit the envelope while body and wire limits remain enforced',()=>{
 const bytes=Buffer.alloc(4*1024*1024,0x61),sample=reservation();
 sample[2][3]=sample[2][4][4]=bytes.toString('base64');
 const encoded=wire(['meri.proxy.operation/2','session_A',sample,structuredClone(sample)]);
 assert.ok(encoded.length>12*1024*1024&&encoded.length<=24*1024*1024);
 const decoded=decodeOperationFrame(parseOwnerWire(encoded));
 for(const side of ['submitted','captured']){
  assert.deepEqual(decoded[side].observation.rawRequestBody,bytes);
  assert.deepEqual(decoded[side].observation.nativeRequest.body,bytes);
 }
 assert.throws(()=>parseOwnerWire(wire(['x'.repeat(24*1024*1024)])),/PRODUCT_OWNER_WIRE_REFUSED/);
 sample[2][3]=Buffer.alloc(4*1024*1024+1).toString('base64');
 assert.throws(()=>decodeOperationFrame(['meri.proxy.operation/2','session_A',sample,sample]),/PRODUCT_OWNER_WIRE_REFUSED/);
});

test('bounded Python positional claim becomes only typed data, preserving exact bytes and identity',()=>{
 const frame=parseOwnerWire(wire(reservation()));
 const {request,observation}=decodeReservationFrame(frame);
 assert.equal(request.requestId,id);
 assert.equal(request.binding.tenantId,'tenant-α');
 assert.equal(observation.proxyCredential,credential);
 assert.deepEqual(observation.rawRequestBody,raw);
 assert.deepEqual(observation.nativeRequest.body,native);
 assert.deepEqual(observation.nativeRequest.headers,[['host',host],['content-type','application/json']]);
 const result=decodeSettlementFrame(parseOwnerWire(wire(['meri.proxy.settlement/1',id,usage()])));
 assert.equal(result.usageResult.output_tokens,7);
 assert.equal(result.usageResult.binding.native_body_sha256,sha(native));
});

test('full independent host capture retains reservation, final usage and EOF evidence',()=>{
 const result=decodeCompleteCaptureFrame(parseOwnerWire(wire(complete())));
 assert.deepEqual(result.rawRequestBody,raw);
 assert.deepEqual(result.nativeRequestBody,native);
 assert.equal(result.reservation.state,'UNKNOWN');
 assert.equal(result.completion.eof,true);
 assert.equal(result.completion.usage.outputTokens,7);
 assert.deepEqual(captureCallRequest({requestId:id,binding:result.completion.binding,
  deadlineMs:9007199254740000,signal:undefined}),
  ['meri.proxy.capture-call/1',id,binding,9007199254740000]);
 assert.deepEqual(captureCompleteRequest({requestId:id,binding:result.completion.binding,
  grantId:uuid}),['meri.proxy.capture-complete/1',id,binding,uuid]);
});

test('wire parser refuses objects, malformed UTF-8, over-limit bytes and noncanonical bodies',()=>{
 assert.throws(()=>parseOwnerWire(wire({kind:'forged'})),/PRODUCT_OWNER_WIRE_REFUSED/);
 assert.throws(()=>parseOwnerWire(wire(['kind',{claimed:true}])),/PRODUCT_OWNER_WIRE_REFUSED/);
 assert.throws(()=>parseOwnerWire(Buffer.from([0x5b,0xff,0x5d])),/PRODUCT_OWNER_WIRE_REFUSED/);
 assert.throws(()=>parseOwnerWire(Buffer.alloc(24*1024*1024+1)),/PRODUCT_OWNER_WIRE_REFUSED/);
 const wrong=reservation();wrong[2][3]='c3ludGhldGlj='; // invalid Base64 padding
 assert.throws(()=>decodeReservationFrame(wrong),/PRODUCT_OWNER_WIRE_REFUSED/);
});

test('mismatched slot, extra tuple member, duplicate header and incomplete response refuse',()=>{
 const mismatched=reservation();mismatched[2][0]='other';
 assert.throws(()=>decodeReservationFrame(mismatched),/PRODUCT_OWNER_WIRE_REFUSED/);
 const surplus=reservation();surplus[1].push('extra');
 assert.throws(()=>decodeReservationFrame(surplus),/PRODUCT_OWNER_WIRE_REFUSED/);
 const duplicate=reservation();duplicate[2][4][5].push(['HOST','different']);
 assert.throws(()=>decodeReservationFrame(duplicate),/PRODUCT_OWNER_WIRE_REFUSED/);
 const absentEof=complete();absentEof[5][12]=false;
 assert.throws(()=>decodeCompleteCaptureFrame(absentEof),/PRODUCT_OWNER_WIRE_REFUSED/);
 const forgedUsage=usage();forgedUsage[4]=17;
 assert.throws(()=>decodeSettlementFrame(['meri.proxy.settlement/1',id,forgedUsage]),
  /PRODUCT_OWNER_WIRE_REFUSED/);
 const overCount=usage();overCount[3]=13;
 assert.throws(()=>decodeSettlementFrame(['meri.proxy.settlement/1',id,overCount]),
  /PRODUCT_OWNER_WIRE_REFUSED/);
});

test('billed input below the CountTokens basis is the settled usage',()=>{
 const billed=usage();billed[3]=11;
 assert.equal(decodeSettlementFrame(['meri.proxy.settlement/1',id,billed]).usageResult.input_tokens,11);
});

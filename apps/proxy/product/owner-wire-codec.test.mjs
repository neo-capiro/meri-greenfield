import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {captureCallRequest,captureCompleteRequest,decodeCompleteCaptureFrame,
 decodeReservationFrame,decodeSettlementFrame,parseOwnerWire} from './owner-wire-codec.mjs';

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
 assert.throws(()=>parseOwnerWire(Buffer.alloc(12*1024*1024+1)),/PRODUCT_OWNER_WIRE_REFUSED/);
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
});

/** Public receiver proof for the separately named bounded native-result discovery answer (contractVersion 1.0.0).
 *
 * No network, no cloud, no provider and no model is reachable here: only the receiver module is imported. The test
 * proves that a closed empty request is the only admitted request, that a well formed answer round-trips as metadata
 * only, and that malformed, foreign, duplicate, unordered or over-limit answers refuse instead of being admitted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeResultsMetadata,receiveNativeResultsRequest,receiveNativeResultsResponse,assertNativeResultsSnapshot,NATIVE_RESULTS_MAX}
 from '../document-access-application/native-results.mjs';
import {documentAccessVersion} from '../document-access-application/protocol.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=character=>character.repeat(64);
const row=(n,path,bytes=7)=>({versionId:uuid(n),path,bytes,sha256:digest('a'),executable:false});
const snapshot=rows=>({manifestId:uuid(9),capturedAt:'2026-10-28T10:00:00.000Z',results:rows,truncated:false});
const bytes=value=>Buffer.from(JSON.stringify(value));
const open=()=>receiveNativeResultsRequest(Buffer.from('{}'));

test('the receiver is an additive v1 name and does not widen the frozen document access route',()=>{
 assert.equal(nativeResultsMetadata.contractVersion,'1.0.0');
 assert.notEqual(nativeResultsMetadata.contractVersion,documentAccessVersion);
 assert.deepEqual(nativeResultsMetadata.route,{method:'POST',path:'/api/documents/results',response:'json'});
 assert.equal(nativeResultsMetadata.maxResults,NATIVE_RESULTS_MAX);
 const admitted=receiveNativeResultsResponse(200,bytes(snapshot([row(1,'analysis/output/report.md')])),open());
 assert.deepEqual(Object.keys(admitted).sort(),['capturedAt','manifestId','results','route','truncated']);
 assert.equal('admittedVersion' in (admitted.version??{}),false);
 assert.equal(Object.isFrozen(admitted.results),true);assert.equal(Object.isFrozen(admitted.results[0]),true);
});

test('only a closed empty request is admitted',()=>{
 assert.deepEqual(open(),{route:'results'});
 for(const body of ['','{','null','[]','{"scope":"conversation"}','{"limit":5}'])assert.throws(()=>receiveNativeResultsRequest(Buffer.from(body)),/INVALID_REQUEST/);
 assert.throws(()=>receiveNativeResultsRequest(new Uint8Array(70*1024)),/INVALID_REQUEST/);
 assert.throws(()=>receiveNativeResultsResponse(200,bytes(snapshot([])),{route:'inspect'}),/INVALID_REQUEST/);
});

test('malformed, foreign, duplicate, unordered and over-limit answers refuse',()=>{
 const bad={
  status:()=>receiveNativeResultsResponse(201,bytes(snapshot([])),open()),
  notJson:()=>receiveNativeResultsResponse(200,Buffer.from('nope'),open()),
  foreignRow:()=>receiveNativeResultsResponse(200,bytes(snapshot([{...row(1,'a.txt'),artifactId:uuid(3)}])),open()),
  foreignTop:()=>receiveNativeResultsResponse(200,bytes({...snapshot([]),artifactId:uuid(3)}),open()),
  noBrand:()=>receiveNativeResultsResponse(200,bytes({...snapshot([]),truncated:'no'}),open()),
  duplicatePath:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'a.txt'),row(2,'a.txt')])),open()),
  duplicateVersion:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'a.txt'),row(1,'b.txt')])),open()),
  unordered:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'b.txt'),row(2,'a.txt')])),open()),
  hostPath:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'/etc/passwd')])),open()),
  traversal:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'../secret')])),open()),
  tooMany:()=>receiveNativeResultsResponse(200,bytes(snapshot(Array.from({length:NATIVE_RESULTS_MAX+1},(_,i)=>row(i+1,`p${String(i).padStart(2,'0')}.txt`)))),open()),
  tooBig:()=>receiveNativeResultsResponse(200,bytes(snapshot([row(1,'a.txt',10485761)])),open()),
 };
 for(const [name,run] of Object.entries(bad))assert.throws(run,/NATIVE_RESULTS_|INVALID_REQUEST/,name);
 // The shared snapshot validator is the same single source the control route uses.
 assert.throws(()=>assertNativeResultsSnapshot({...snapshot([row(1,'a.txt')]),results:[{versionId:'not-a-uuid',path:'a.txt',bytes:1,sha256:digest('a'),executable:false}]}));
});

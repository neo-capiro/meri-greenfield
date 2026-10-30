/** Canonical native-processing custody projection and mode discrimination. Shape/correlation only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertBrowserHostAllocation,assertNativeProcessingAllocation}
 from '../../../worker/conversation/host/binding.mjs';
import {hostControlRequest,HOST_CONTROL_REQUEST_SCHEMA}
 from '../../../worker/conversation/host/control/protocol.mjs';
import {nativeUploadCustody,assertNativeUploadCustody,nativeUploadInspectionRequest,
 NATIVE_UPLOAD_INSPECTION_SCHEMA}
 from '../native-host-contract.mjs';

const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const tenantId=id(1),actorId=id(2);
const binding={tenantId,actorId,conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const scopes=[{tenantId,kind:'private-user',resourceId:actorId,policyRevision:'p1'}];
const owner={tenantId,actorId,conversationId:id(3),clientId:null};
const current={binding,scopes,selectedClientId:null,checkedAtMs:1700000000000,expiresAtMs:1700000600000};
const text=Buffer.from('hello upload'),sha=createHash('sha256').update(text).digest('hex');
const declaration={filename:'document.txt',mimeType:'text/plain',bytes:text.length,sha256:sha};
const record={uploadId:id(20),requestId:id(21),owner,declaration,scopes,objectId:id(22),
 object:{objectId:id(22),versionId:'NATIVE_ORIGINAL_VERSION',sha256:declaration.sha256,bytes:declaration.bytes,scopes},
 state:'stored',inspection:null,createdAtMs:1700000000000,updatedAtMs:1700000000000,revision:2};
const baseAllocation={schema:'meri-conversation-host-allocation/1',tenantId,conversationId:id(3),generation:3,
 hostId:id(9),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1700000600000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',bootId:id(8),
 conversationId:id(3),hostId:id(9)};

test('the custody projection is derived from the saved record and the current canonical scope',()=>{
 const custody=nativeUploadCustody(record,current);
 assert.deepEqual(Object.keys(custody).sort(),
  ['bytes','objectId','owner','recordSha256','revision','requestId','scopes','sha256','uploadId','versionId']
   .sort());
 assert.equal(custody.uploadId,record.uploadId);
 assert.equal(custody.requestId,record.requestId,'the saved requestId is a UUID');
 assert.equal(custody.versionId,'NATIVE_ORIGINAL_VERSION');
 assert.equal(custody.sha256,declaration.sha256);
 assert.equal(custody.recordSha256,hash(record));
 assert.equal(custody.revision,2);
 const again=assertNativeUploadCustody(custody,{binding,declaration});
 assert.equal(again.objectId,record.objectId);
});

test('a changed owner, scope or selection refuses the projection',()=>{
 assert.throws(()=>nativeUploadCustody({...record,state:'prepared'}),/NATIVE_UPLOAD_INSPECTION_REFUSED/u);
 assert.throws(()=>nativeUploadCustody(record,{...current,selectedClientId:id(30)}),
  /NATIVE_UPLOAD_INSPECTION_REFUSED/u);
 assert.throws(()=>nativeUploadCustody(record,{...current,scopes:[{...scopes[0],policyRevision:'p2'}]}),
  /NATIVE_UPLOAD_INSPECTION_REFUSED/u);
 const custody=nativeUploadCustody(record,current);
 assert.throws(()=>assertNativeUploadCustody(custody,{binding,declaration:{...declaration,bytes:13}}),
  /NATIVE_UPLOAD_INSPECTION_REFUSED/u);
 assert.throws(()=>assertNativeUploadCustody(custody,{binding,
  declaration:{...declaration,sha256:'d'.repeat(64)}}),/NATIVE_UPLOAD_INSPECTION_REFUSED/u);
});

test('native-processing is admitted by its own mode and refused by the browser authority path',()=>{
 const processing={...baseAllocation,hostMode:'native-processing'};
 assert.equal(assertNativeProcessingAllocation(processing).hostMode,'native-processing');
 assert.equal(assertHostAllocation(processing).hostMode,'native-processing');
 assert.throws(()=>assertBrowserHostAllocation(processing),/HOST_BINDING_REFUSED/u);
 // Legacy/absent stays a browser allocation and is never reinterpreted as processing.
 assert.equal(assertHostAllocation(baseAllocation).hostMode,undefined);
 assert.throws(()=>assertNativeProcessingAllocation(baseAllocation),/HOST_BINDING_REFUSED/u);
 // The real browser currentness request validator accepts its OWN valid shape and refuses processing.
 const request={schema:HOST_CONTROL_REQUEST_SCHEMA,allocation:baseAllocation,binding,hostIdentity,
  purpose:'browser',policySha256:'f'.repeat(64),nonce:'e'.repeat(64)};
 assert.ok(hostControlRequest(request));
 assert.throws(()=>hostControlRequest({...request,allocation:processing}),/HOST_CONTROL_REFUSED/u);
 // ...and the canonical native envelope over the EXACT original bytes is admitted.
 const {envelope,bytes}=nativeUploadInspectionRequest({
  schema:NATIVE_UPLOAD_INSPECTION_SCHEMA,allocation:processing,hostIdentity,binding,
  custody:nativeUploadCustody(record,current),
  request:{kind:'upload-inspection',requestId:'e'.repeat(64),imageDigest:processing.imageDigest,declaration,
   bytesBase64:text.toString('base64'),inputSha256:sha,deadlineMs:1700000500000}});
 assert.equal(envelope.schema,'meri-native-upload-inspection/1');
 assert.equal(envelope.custody.uploadId,record.uploadId);
 assert.equal(envelope.allocation.hostMode,'native-processing');
 assert.deepEqual(bytes,text,'the emitted bytes are the unchanged original inspection bytes');
});

test('the contract names are exposed',()=>{
 assert.equal(NATIVE_UPLOAD_INSPECTION_SCHEMA,'meri-native-upload-inspection/1');
});

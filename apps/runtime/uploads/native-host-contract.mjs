/** Canonical private UPLOAD-INSPECTION envelope and its custody projection.
 *
 * A native-processing host may inspect ONE saved upload. The envelope carries the pinned allocation, host
 * identity, full run binding, the closed custody projection and the UNCHANGED inspection request; the custody
 * projection is derived only from the real saved upload record and the current canonical conversation scope.
 *
 * The mode is explicit: `native-processing` is admitted here and refused by every browser/SDK/Bash surface in
 * worker/conversation/host/binding.mjs. Nothing in this module dispatches, grants or validates clocks — those
 * stay with the caller and the host.
 */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertNativeProcessingAllocation,assertHostRunBinding,assertD005HostIdentity}
 from '../../../worker/conversation/host/binding.mjs';
import {UPLOAD_INSPECTION_WIRE_BYTES,uploadInspectionRequest} from './agentcore-contract.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const REFUSED='NATIVE_UPLOAD_INSPECTION_REFUSED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HEX64=/^[0-9a-f]{64}$/u;
const SHA=/^sha256:[a-f0-9]{64}$/u;
const same=(a,b)=>canonicalSha256(data(a))===canonicalSha256(data(b));

export const NATIVE_UPLOAD_INSPECTION_PATH='/internal/upload-inspection';
export const NATIVE_UPLOAD_INSPECTION_SCHEMA='meri-native-upload-inspection/1';
export const NATIVE_UPLOAD_INSPECTION_WIRE_BYTES=UPLOAD_INSPECTION_WIRE_BYTES;

/** The closed custody projection. Derived ONLY from the saved record and the current canonical scope. */
export function nativeUploadCustody(record,current){
 const r=own(data(record),['uploadId','requestId','owner','declaration','scopes','objectId','object','state',
  'revision','createdAtMs','updatedAtMs'],['inspection'],);
 const c=data(current);
 if(r.state!=='stored'||!r.object||typeof r.object!=='object')fail(REFUSED);
 const object=own(data(r.object),['versionId','sha256','bytes'],);
 if(typeof r.uploadId!=='string'||!UUID.test(r.uploadId))fail(REFUSED);
 if(typeof r.requestId!=='string'||!HEX64.test(r.requestId))fail(REFUSED);
 if(typeof r.objectId!=='string'||!UUID.test(r.objectId))fail(REFUSED);
 if(typeof object.versionId!=='string'||object.versionId.length===0||object.versionId.length>1024)fail(REFUSED);
 if(typeof object.sha256!=='string'||!HEX64.test(object.sha256))fail(REFUSED);
 if(!Number.isSafeInteger(object.bytes)||object.bytes<1)fail(REFUSED);
 if(!Number.isSafeInteger(r.revision)||r.revision<0)fail(REFUSED);
 const owner=own(data(r.owner),['tenantId','actorId','conversationId','clientId']);
 // The CURRENT canonical scope must describe exactly the saved owner.
 if(c.binding.tenantId!==owner.tenantId||c.binding.actorId!==owner.actorId||
  c.binding.conversationId!==owner.conversationId)fail(REFUSED);
 if(c.selectedClientId!==owner.clientId)fail(REFUSED);
 if(!same(c.scopes,r.scopes))fail(REFUSED);
 return Object.freeze({uploadId:r.uploadId,requestId:r.requestId,
  owner:Object.freeze({...owner}),scopes:Object.freeze(r.scopes.map(scope=>Object.freeze(data(scope)))),
  objectId:r.objectId,versionId:object.versionId,sha256:object.sha256,bytes:object.bytes,revision:r.revision,
  recordSha256:canonicalSha256(r)});
}

/** Validate the closed projection against the envelope binding and the request's own declaration. */
export function assertNativeUploadCustody(raw,{binding,declaration}={}){
 let c;try{
  c=own(data(raw),['uploadId','requestId','owner','scopes','objectId','versionId','sha256','bytes','revision',
   'recordSha256']);
  if(typeof c.uploadId!=='string'||!UUID.test(c.uploadId))fail(REFUSED);
  if(typeof c.requestId!=='string'||!HEX64.test(c.requestId))fail(REFUSED);
  if(typeof c.objectId!=='string'||!UUID.test(c.objectId))fail(REFUSED);
  if(typeof c.versionId!=='string'||c.versionId.length===0||c.versionId.length>1024)fail(REFUSED);
  if(typeof c.sha256!=='string'||!HEX64.test(c.sha256))fail(REFUSED);
  if(typeof c.recordSha256!=='string'||!HEX64.test(c.recordSha256))fail(REFUSED);
  if(!Number.isSafeInteger(c.bytes)||c.bytes<1)fail(REFUSED);
  if(!Number.isSafeInteger(c.revision)||c.revision<0)fail(REFUSED);
  if(!Array.isArray(c.scopes)||c.scopes.length===0)fail(REFUSED);
  const owner=Object.freeze(own(data(c.owner),['tenantId','actorId','conversationId','clientId']));
  const scopes=Object.freeze(c.scopes.map(scope=>Object.freeze(data(scope))));
  if(binding!==undefined){
   const b=data(binding);
   if(owner.tenantId!==b.tenantId||owner.actorId!==b.actorId||owner.conversationId!==b.conversationId)
    fail(REFUSED);
  }
  // The projection must describe the SAME immutable object the request's declaration binds.
  if(declaration!==undefined){
   if(c.bytes!==declaration.bytes||c.sha256!==declaration.sha256)fail(REFUSED);
   if(c.versionId!==declaration.versionId&&declaration.versionId!==undefined)fail(REFUSED);
  }
  return Object.freeze({...c,owner,scopes});
 }catch{throw Object.assign(Error(REFUSED),{code:REFUSED});}
}

/** The closed outer request: {envelope,bytes}, where bytes are the EXACT validated inspection bytes. */
export function nativeUploadInspectionRequest(raw){
 let v;try{v=own(data(raw),['schema','allocation','hostIdentity','binding','custody','request']);
  const a=assertNativeProcessingAllocation(v.allocation);
  const b=assertHostRunBinding(a,v.binding);
  const i=assertD005HostIdentity(v.hostIdentity,b,a);
  if(v.schema!==NATIVE_UPLOAD_INSPECTION_SCHEMA)fail(REFUSED);
  const {request,bytes}=uploadInspectionRequest(v.request);
  // The request must describe THIS image and stay inside the allocation lease.
  if(request.imageDigest!==a.imageDigest)fail(REFUSED);
  if(request.deadlineMs>a.leaseDeadlineMs)fail(REFUSED);
  const custody=assertNativeUploadCustody(v.custody,{binding:b,declaration:request.declaration});
  const envelope=Object.freeze({schema:NATIVE_UPLOAD_INSPECTION_SCHEMA,allocation:a,hostIdentity:i,binding:b,
   custody,request});
  const encoded=Buffer.byteLength(JSON.stringify(envelope),'utf8');
  if(encoded>NATIVE_UPLOAD_INSPECTION_WIRE_BYTES)fail(REFUSED);
  return Object.freeze({envelope,bytes});
 }catch{throw Object.assign(Error(REFUSED),{code:REFUSED});}
}

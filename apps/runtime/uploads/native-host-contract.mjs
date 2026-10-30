/** Canonical private UPLOAD-INSPECTION envelope and its custody projection.
 *
 * A native-processing host may inspect ONE saved upload. The envelope pins the allocation, host identity, full
 * run binding, the closed custody projection and the UNCHANGED inspection request; the projection is derived
 * only from the real saved upload record (validated by the EXISTING uploadRecord/uploadOwner/uuid) and the
 * current canonical NativeConversationScope.
 *
 * Mode discrimination: `native-processing` is admitted here and refused at every browser/SDK/Bash AUTHORITY
 * entrypoint. Nothing here dispatches, grants or validates clocks.
 */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {uploadRecord,uploadOwner,uuid} from '../../control/uploads/custody.mjs';
import {assertHostAllocation,assertNativeProcessingAllocation,assertHostRunBinding,assertD005HostIdentity}
 from '../../worker/conversation/host/binding.mjs';
import {UPLOAD_INSPECTION_WIRE_BYTES,uploadInspectionRequest} from './agentcore-contract.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const REFUSED='NATIVE_UPLOAD_INSPECTION_REFUSED';
const HEX64=/^[0-9a-f]{64}$/u;
const same=(a,b)=>canonicalSha256(data(a))===canonicalSha256(data(b));

export const NATIVE_UPLOAD_INSPECTION_PATH='/internal/upload-inspection';
export const NATIVE_UPLOAD_INSPECTION_SCHEMA='meri-native-upload-inspection/1';
export const NATIVE_UPLOAD_INSPECTION_WIRE_BYTES=UPLOAD_INSPECTION_WIRE_BYTES;

/** Validate the closed projection against the pinned binding and the record's own declaration. */
export function assertNativeUploadCustody(raw,{binding,declaration}={}){
 let c;try{
  c=own(data(raw),['uploadId','requestId','owner','scopes','objectId','versionId','sha256','bytes','revision',
   'recordSha256']);
  uuid(c.uploadId);uuid(c.requestId);uuid(c.objectId);
  if(typeof c.versionId!=='string'||c.versionId.length===0||c.versionId.length>1024)fail(REFUSED);
  if(typeof c.sha256!=='string'||!HEX64.test(c.sha256))fail(REFUSED);
  if(typeof c.recordSha256!=='string'||!HEX64.test(c.recordSha256))fail(REFUSED);
  if(!Number.isSafeInteger(c.bytes)||c.bytes<1)fail(REFUSED);
  if(!Number.isSafeInteger(c.revision)||c.revision<0)fail(REFUSED);
  if(!Array.isArray(c.scopes)||c.scopes.length===0)fail(REFUSED);
  const owner=Object.freeze(uploadOwner(data(c.owner)));
  const scopes=Object.freeze(c.scopes.map(scope=>Object.freeze(data(scope))));
  if(binding===undefined||declaration===undefined)fail(REFUSED);
  // The envelope pins a RUN binding, not an allocation: validate the binding shape directly.
  validateShape('RunBinding',data(binding));const b=data(binding);
  // The saved owner must be THIS binding's tenant/actor/conversation, and its scopes the pinned ones.
  if(owner.tenantId!==b.tenantId||owner.actorId!==b.actorId||owner.conversationId!==b.conversationId)
   fail(REFUSED);
  // The projection must describe the SAME validated declaration and real canonical scope shapes.
  if(c.bytes!==declaration.bytes||c.sha256!==declaration.sha256)fail(REFUSED);
  assertNativeConversationScope({binding:b,scopes,selectedClientId:owner.clientId});
  return Object.freeze({uploadId:c.uploadId,requestId:c.requestId,owner,scopes,objectId:c.objectId,
   versionId:c.versionId,sha256:c.sha256,bytes:c.bytes,revision:c.revision,recordSha256:c.recordSha256});
 }catch{throw Object.assign(Error(REFUSED),{code:REFUSED});}
}

/** The custody projection for one saved record under the CURRENT canonical scope. */
export function nativeUploadCustody(record,current){
 let r,c;try{
  r=uploadRecord(data(record));
  c=data(current);assertNativeConversationScope(c);
  if(r.state!=='stored'||!r.object)fail(REFUSED);
  if(c.binding.tenantId!==r.owner.tenantId||c.binding.actorId!==r.owner.actorId||
   c.binding.conversationId!==r.owner.conversationId)fail(REFUSED);
  if(c.selectedClientId!==r.owner.clientId)fail(REFUSED);
  if(!same(c.scopes,r.scopes))fail(REFUSED);
  const projection=Object.freeze({uploadId:r.uploadId,requestId:r.requestId,owner:Object.freeze({...r.owner}),
   scopes:Object.freeze(r.scopes.map(scope=>Object.freeze(data(scope)))),objectId:r.object.objectId,
   versionId:r.object.versionId,sha256:r.object.sha256,bytes:r.object.bytes,revision:r.revision,
   recordSha256:canonicalSha256(r)});
  return assertNativeUploadCustody(projection,{binding:c.binding,declaration:r.declaration});
 }catch{throw Object.assign(Error(REFUSED),{code:REFUSED});}
}

/** The closed outer request: {envelope,bytes}, with the EXACT validated inspection bytes. */
export function nativeUploadInspectionRequest(raw){
 try{
  const v=own(data(raw),['schema','allocation','hostIdentity','binding','custody','request']);
  const a=assertNativeProcessingAllocation(v.allocation);
  const b=assertHostRunBinding(a,v.binding);
  const i=assertD005HostIdentity(v.hostIdentity,b,a);
  if(v.schema!==NATIVE_UPLOAD_INSPECTION_SCHEMA)fail(REFUSED);
  const {request,bytes}=uploadInspectionRequest(v.request);
  if(request.imageDigest!==a.imageDigest)fail(REFUSED);
  if(request.deadlineMs>a.leaseDeadlineMs)fail(REFUSED);
  const custody=assertNativeUploadCustody(v.custody,{binding:b,declaration:request.declaration});
  const envelope=Object.freeze({schema:NATIVE_UPLOAD_INSPECTION_SCHEMA,allocation:a,hostIdentity:i,binding:b,
   custody,request});
  if(Buffer.byteLength(JSON.stringify(envelope),'utf8')>NATIVE_UPLOAD_INSPECTION_WIRE_BYTES)fail(REFUSED);
  return Object.freeze({envelope,bytes});
 }catch{throw Object.assign(Error(REFUSED),{code:REFUSED});}
}

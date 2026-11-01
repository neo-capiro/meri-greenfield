/** Retained upload identity and lifecycle. Original bytes remain with the existing versioned object owner. */
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {uploadDeclaration,uploadError,uploadHash} from './policy.mjs';
import {validateUploadInspection} from './extraction.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export {hash};
export const fail=code=>{throw uploadError(code);};
export const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))fail('UPLOAD_ID');return value;};
const equal=(a,b)=>hash(a)===hash(b);
export function uploadOwner(raw){
 const o=own(data(raw),['tenantId','actorId','conversationId','clientId']);
 for(const key of ['tenantId','actorId'])if(typeof o[key]!=='string'||!o[key]||o[key].length>256)fail('UPLOAD_OWNER');
 uuid(o.conversationId);if(o.clientId!==null)uuid(o.clientId);return o;
}
export function uploadRecord(raw){
 const r=own(data(raw),['uploadId','requestId','owner','declaration','scopes','objectId','object','state','inspection','createdAtMs','updatedAtMs','revision']);
 uuid(r.uploadId);uuid(r.requestId);uuid(r.objectId);uploadOwner(r.owner);uploadDeclaration(r.declaration);
 if(!Array.isArray(r.scopes)||!r.scopes.length||r.scopes.length>100||r.scopes.some(s=>s.tenantId!==r.owner.tenantId)||
  !Number.isSafeInteger(r.createdAtMs)||r.createdAtMs<0||!Number.isSafeInteger(r.updatedAtMs)||r.updatedAtMs<r.createdAtMs||!Number.isSafeInteger(r.revision)||r.revision<0||
  !['prepared','writing','stored','removing','removed'].includes(r.state))fail('UPLOAD_STORE_CORRUPT');
 for(const s of r.scopes)validateShape('Scope',s);
 if(new Set(r.scopes.map(hash)).size!==r.scopes.length||new Set(r.scopes.map(s=>s.policyRevision)).size!==1||
  (r.owner.clientId===null?r.scopes.length!==1||r.scopes[0].kind!=='private-user'||r.scopes[0].resourceId!==r.owner.actorId:
   !r.scopes.some(s=>s.kind==='client'&&s.resourceId===r.owner.clientId)))fail('UPLOAD_STORE_CORRUPT');
 if(r.object!==null){v.object(r.object);if(r.object.objectId!==r.objectId||r.object.sha256!==r.declaration.sha256||r.object.bytes!==r.declaration.bytes||!equal(r.object.scopes,r.scopes))fail('UPLOAD_STORE_CORRUPT');}
 if(['stored','removing'].includes(r.state)&&r.object===null||['prepared','writing'].includes(r.state)&&r.object!==null||r.state==='removed'&&r.inspection!==null)fail('UPLOAD_STORE_CORRUPT');
 if(r.inspection!==null){const i=validateUploadInspection(r.inspection,r.declaration,{fromMs:r.createdAtMs,toMs:r.updatedAtMs});
  if(!equal(i,r.inspection)||r.object===null)fail('UPLOAD_STORE_CORRUPT');}
 return r;
}
export const uploadRequestHash=r=>hash({owner:r.owner,requestId:r.requestId,declaration:r.declaration});
/** A request-scoped current port is the existing authenticated/Core recheck, not caller-supplied owner fields. */
export function createUploadCustody({store,objects,inspection,current,retention,removeOriginal,now=Date.now,ids}){
 if(typeof current!=='function'||typeof removeOriginal!=='function'||typeof now!=='function'||typeof ids!=='function')fail('UPLOAD_CONFIGURATION');
 const requestRead=Object.getOwnPropertyDescriptor(store,'readByRequest')?storageMethod(store,'readByRequest'):null;
 store=Object.fromEntries(['prepare','read','transition'].map(k=>[k,storageMethod(store,k)]));
 objects=Object.fromEntries(['put','get','observePut'].map(k=>[k,storageMethod(objects,k)]));
 inspection={inspect:storageMethod(inspection,'inspect')};retention=Object.fromEntries(['assertServable','withRelease'].map(k=>[k,storageMethod(retention,k)]));
 /** `reconcile` is for pure state reads: a read that raced a concurrent publication (the server-side inspection
  * landing between its read and the guard's re-read) reports the record as it is NOW instead of UPLOAD_CHANGED,
  * since a read of state is never invalidated by that state having advanced. Every effect keeps the strict check. */
 async function operation(options,body,{reconcile=false}={}){
  const {signal,deadlineMs}=options??{};nativeSignal(signal);
  const life=createOperationLifetime({signal,deadlineMs,now,errorFactory:uploadError});let owner=null;
  async function fresh(assertServable=retention.assertServable,check=life.check){
   check();
   const began=now(),c=data(await life.run(signal=>current({signal,deadlineMs:life.deadline()})));assertNativeConversationScope(c);
   if(!Number.isSafeInteger(c.checkedAtMs)||c.checkedAtMs<began||c.checkedAtMs>now()||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now())fail('UPLOAD_ACCESS_DENIED');
   life.limitDeadline(c.expiresAtMs);const next=uploadOwner({tenantId:c.binding.tenantId,actorId:c.binding.actorId,conversationId:c.binding.conversationId,clientId:c.selectedClientId});
   if(owner&&!equal(owner,next))fail('UPLOAD_ACCESS_DENIED');owner??=next;
   await life.run(()=>assertServable(subject()));check();return c;
  }
  const subject=()=>({tenantId:owner.tenantId,kind:'conversation',subjectId:owner.conversationId});
  // Reuse the canonical shared suppression lock only for admission/publication.
  // Native work runs outside it; a durable writing/removing record blocks purge.
  async function guard(body){return life.run(signal=>retention.withRelease([subject()],async(lockedSignal,assertServable)=>{
   const check=()=>{life.check();if(lockedSignal?.aborted)throw lockedSignal.reason??uploadError('UPLOAD_CANCELLED');};
   await fresh(assertServable,check);const result=await body(check);check();return result;
  },{signal,deadlineMs:life.deadline()}));}
  async function read(id){const r=await life.run(()=>store.read(owner,uuid(id),life.check));if(r===null)fail('UPLOAD_NOT_FOUND');const record=uploadRecord(r);if(!equal(record.owner,owner))fail('UPLOAD_ACCESS_DENIED');return record;}
  async function readByRequest(id){if(!requestRead)fail('UPLOAD_CONFIGURATION');const r=await life.run(()=>requestRead(owner,uuid(id),life.check));
   if(r===null)fail('UPLOAD_NOT_FOUND');const record=uploadRecord(r);if(!equal(record.owner,owner))fail('UPLOAD_ACCESS_DENIED');if(record.requestId!==id)fail('UPLOAD_STORE_CORRUPT');return record;}
  async function move(r,patch,check=life.check){check();const next=uploadRecord({...r,...patch,revision:r.revision+1,updatedAtMs:now()});return uploadRecord(await life.run(()=>store.transition(r,next,check)));}
  try{const context=await fresh();const result=await body({life,owner,context,fresh,read,readByRequest,move,guard});
   return await guard(async check=>{const r=result.record??result,again=await read(r.uploadId);check();if(equal(r,again))return result;if(!reconcile)fail('UPLOAD_CHANGED');return again;});
  }finally{life.close();}
 }
 function status(id,byRequest,options){return operation(options,async({read,readByRequest,move,life})=>{let r=await (byRequest?readByRequest:read)(id);
   if(r.state==='writing'){
    const object=await life.run(signal=>objects.observePut({objectId:r.objectId,scopes:r.scopes,sha256:r.declaration.sha256,bytes:r.declaration.bytes,requestSha256:uploadRequestHash(r)},signal));
    if(object!==null)r=await move(r,{state:'stored',object}); // Missing is still UNKNOWN, not permission to retry.
   }return r;},{reconcile:true});}

 const owner={
  initiate(raw,options){const call=own(data(raw),['requestId','declaration']);uuid(call.requestId);uploadDeclaration(call.declaration);
   return operation(options,async({owner,context,life,guard})=>{const at=now(),r=uploadRecord({uploadId:uuid(ids()),objectId:uuid(ids()),requestId:call.requestId,owner,
    declaration:call.declaration,scopes:context.scopes,object:null,state:'prepared',inspection:null,createdAtMs:at,updatedAtMs:at,revision:0});
    const saved=uploadRecord(await guard(check=>life.run(()=>store.prepare(r,check))));if(!equal(saved.owner,owner)||saved.requestId!==call.requestId||!equal(saved.declaration,call.declaration))fail('UPLOAD_REQUEST_CONFLICT');return saved;});},
  put(uploadId,bytes,options){return operation(options,async({read,move,life,guard})=>{
   let r=await read(uploadId);
   if(!Buffer.isBuffer(bytes)||bytes.length!==r.declaration.bytes||uploadHash(bytes)!==r.declaration.sha256)fail('UPLOAD_ORIGINAL_MISMATCH');
   if(r.state!=='prepared')return r; // A retained write attempt is reconciled, never re-sent.
   r=await guard(check=>move(r,{state:'writing'},check));
   let object;try{object=await life.run(signal=>objects.put({objectId:r.objectId,bytes:Buffer.from(bytes),scopes:r.scopes,requestSha256:uploadRequestHash(r)},signal));}
   catch(cause){throw Object.assign(uploadError('UPLOAD_PUT_UNKNOWN'),{cause});}
   // Saving a returned object is custody bookkeeping even if access is revoked now; release still rechecks authority.
   return move(r,{state:'stored',object});
  });},
  status(uploadId,options){return status(uploadId,false,options);},
  statusByRequest(requestId,options){return status(requestId,true,options);},
  inspect(uploadId,options){return operation(options,async({read,move,life,fresh,guard})=>{const r=await read(uploadId);if(r.state!=='stored')fail('UPLOAD_NOT_STORED');
   // A lost inspect reply is reconciled from the retained settled observation; only an outage (no scanner or no
   // extractor verdict) may be inspected again. Neither path re-runs a native tool over a settled original.
   if(r.inspection!==null&&(r.inspection.scan.status==='infected'||r.inspection.scan.status==='clean'&&r.inspection.extraction.status!=='unavailable'))return r;
   const bytes=await life.run(signal=>objects.get(r.object,signal));
   const current=await fresh(),binding=current?.binding;
   // The inspected host receives a PRIVATE, immutable snapshot of what authority was current for this call.
   // It can only use it through `assertCurrent`, which re-runs the SAME authority+retention owner and the
   // same upload read; nothing here is serializable state and no credential is exposed.
   const record=Object.freeze(data(r)),scopes=Object.freeze(current.scopes.map(scope=>Object.freeze({...scope})));
   const pinned=Object.freeze({binding:Object.freeze({...binding}),scopes,selectedClientId:current.selectedClientId});
   const custodyContext=Object.freeze({record,current:Object.freeze({...current,binding:pinned.binding,scopes}),
    assertCurrent:async()=>{
     life.check();
     const latest=await fresh();
     if(!latest||!equal(latest.binding,pinned.binding)||!equal(latest.scopes,pinned.scopes)||
      latest.selectedClientId!==pinned.selectedClientId)fail('UPLOAD_AUTHORITY_CHANGED');
     const again=await read(r.uploadId);
     if(hash(again)!==hash(record))fail('UPLOAD_CHANGED');
     life.check();
     return latest;
    }});
   const result=await life.run(signal=>inspection.inspect(r.declaration,bytes,
    {signal,deadlineMs:life.deadline(),custodyContext}));
   return guard(check=>move(r,{inspection:result},check));
  });},
  read(uploadId,options){return operation(options,async({read,life,fresh})=>{const r=await read(uploadId);
   if(r.state!=='stored'||r.inspection?.scan.status!=='clean')fail('UPLOAD_NOT_CLEAN');
   const bytes=await life.run(signal=>objects.get(r.object,signal));
   if(!Buffer.isBuffer(bytes)||bytes.length!==r.declaration.bytes||uploadHash(bytes)!==r.declaration.sha256)fail('UPLOAD_ORIGINAL_MISMATCH');
   await fresh();const again=await read(uploadId);if(!equal(again,r))fail('UPLOAD_CHANGED');return {record:r,bytes:Buffer.from(bytes)};
  });},
  remove(uploadId,options){return operation(options,async({read,move,life,guard,fresh})=>{let r=await read(uploadId);if(r.state==='removed')return r;
   if(r.state==='prepared')return guard(check=>move(r,{state:'removed'},check)); // No native attempt exists; cancellation is a single guarded SQL transition.
   if(r.state!=='stored'&&r.state!=='removing')fail('UPLOAD_REMOVAL_UNCERTAIN');
   if(r.state==='stored')r=await guard(check=>move(r,{state:'removing'},check)); // Serving stops before physical deletion.
   const receipt=await life.run(signal=>removeOriginal({object:r.object,owner:r.owner,signal,deadlineMs:life.deadline(),assertCurrent:fresh}));
   if(receipt?.deleted!==true||receipt.objectId!==r.object.objectId||receipt.versionId!==r.object.versionId)fail('UPLOAD_REMOVAL_UNCERTAIN');
   return move(r,{state:'removed',inspection:null});
  });},
 };
 return Object.freeze({...owner,async readForInput(raw,options){
  const selector=own(data(raw),['uploadId','sha256']);uuid(selector.uploadId);
  if(typeof selector.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(selector.sha256))fail('UPLOAD_HASH');
  const result=await owner.read(selector.uploadId,options);
  if(result.record.declaration.sha256!==selector.sha256)fail('UPLOAD_ORIGINAL_MISMATCH');
  if(!['available','partial'].includes(result.record.inspection.extraction.status))fail('UPLOAD_EXTRACTION_UNAVAILABLE');
  // Private producer seam only. The input owner projects inert source text/provenance; no browser receipt supplies these facts.
  return result;
 }});
}

/** Typed document delivery over the existing intent-preparation journal and immutable publication owner. */
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createIntentJournal} from '../control/intents/journal.mjs';
import {createPostgresIntentJournalStore} from '../control/intents/postgres-journal.mjs';
import {createArtifactService} from './service.mjs';
import {officeEditSource,officeEditRequestSha256} from '../../packages/contracts/office-edit.mjs';
import {inspectOfficeEdit} from './edit-sessions/inspect-office.mjs';
import {createOfficeOriginalPublisher} from './office-original.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>hash(a)===hash(b);
const own=(v,required,optional=[])=>{if(!v||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>![...required,...optional].includes(k)))fail('ARTIFACT_CONFIGURATION');return v;};
const id=(invocationId,kind)=>{const h=hash({invocationId,kind});return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
/** Read-only custody of the same delivery, including an uncertain claim. */
export async function readDocumentInvocation({pool,binding,invocationId,signal}){
 validateShape('RunBinding',binding);if(!/^sdk:[a-f0-9]{64}$/u.test(invocationId))fail('ARTIFACT_INVOCATION');
 const entry=await createPostgresIntentJournalStore({pool}).read({key:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:invocationId},signal});
 return entry===null?null:{entry,versionId:id(invocationId,'version')};
}
export function createPostgresArtifactService(options){
 const c=own(options,['pool','context','validators','authorize','versions','objects','executor','now'],['retention','admitRetainedEvidence','selectedInvocationId','retainedAssetMapWrites','officeEditWrites','officeOriginalWrites']),v=c.validators,context=v.context(c.context);
 if(![v.nativeRequestSha256,c.authorize,c.versions?.read,c.versions?.commit,c.objects?.get,c.objects?.put,c.executor?.execute,c.now].every(f=>typeof f==='function'))fail('ARTIFACT_CONFIGURATION');
 validateShape('RunBinding',context.binding);
 if(c.admitRetainedEvidence!==undefined&&typeof c.admitRetainedEvidence!=='function')fail('ARTIFACT_CONFIGURATION');
 if(c.retainedAssetMapWrites!==undefined&&typeof c.retainedAssetMapWrites!=='boolean')fail('ARTIFACT_CONFIGURATION');
 if(c.officeEditWrites!==undefined&&typeof c.officeEditWrites!=='boolean')fail('ARTIFACT_CONFIGURATION');
 if(c.officeOriginalWrites!==undefined&&typeof c.officeOriginalWrites!=='boolean')fail('ARTIFACT_CONFIGURATION');
 if(c.selectedInvocationId!==undefined&&(!/^sdk:[a-f0-9]{64}$/u.test(c.selectedInvocationId)||typeof c.admitRetainedEvidence!=='function'||c.admitRetainedEvidence(v.snapshot(context))!==undefined))fail('ARTIFACT_INVOCATION');
 const retained=context.evidence.map(v.nativeSourceEvidence).some(e=>!same(e.binding,context.binding));
 if(retained&&(typeof c.admitRetainedEvidence!=='function'||c.admitRetainedEvidence(v.snapshot(context))!==undefined))fail('ARTIFACT_EVIDENCE_BINDING');
 const storage=createPostgresIntentJournalStore({pool:c.pool}),journal=createIntentJournal(storage);
 function input(raw){const call=v.snapshot(own(raw,['deliveryId','baseVersionId','request']));
  if(typeof call.deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/u.test(call.deliveryId)||!(call.baseVersionId===null||typeof call.baseVersionId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(call.baseVersionId)))fail('ARTIFACT_INPUT');
  call.request=v.request(call.request);if(call.request.format==='sandbox'||context.analysisAdmission)fail('ANALYSIS_SANDBOX_DISPATCH_REQUIRED');return call;}
 async function execute(value,signal){const call=input(value),binding=context.binding,invocationId=c.selectedInvocationId??'sdk:'+hash({kind:'document-generation',binding,deliveryId:call.deliveryId});
  const requestSha256=v.nativeRequestSha256(call.request,context,call.baseVersionId),invocation={invocationId,versionId:id(invocationId,'version'),requestSha256};
  const record={operation:{id:call.request.operation,version:'0.2.0'},argumentsSha256:requestSha256},key={binding,deliveryId:invocationId,record,signal};
  const service=createArtifactService({...c,ids:()=>({artifactId:id(invocationId,'artifact'),versionId:invocation.versionId,objectId:id(invocationId,'object')})});
  const check=()=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');if(!Number.isSafeInteger(c.now())||c.now()>=context.deadlineMs)fail('ARTIFACT_DEADLINE');};
  check();let claim;
  try{claim=await journal.begin(key);}catch(error){
   if(error.code!=='UNKNOWN')throw error;
   const prior=await storage.read({key:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:invocationId},signal});
   if(!prior||!same(prior.record,record)||!['PENDING','UNKNOWN','PREPARED'].includes(prior.state))throw error;
   claim={replayed:true,result:prior.outcome?.result??null};
  }
  check();
  if(claim.replayed){
   // A lost executor or object acknowledgement never redispatches. Recovery can
   // return only an already-published exact version after current access checks.
   const recovered=await service.recover(call.baseVersionId,call.request,context,{signal,evidence:invocation});
   if(claim.result&&(!same(claim.result.version,recovered.version)||!same(claim.result.inspection,recovered.inspection)||claim.result.execution?.invocationId!==invocationId||claim.result.execution?.requestSha256!==requestSha256))fail('ARTIFACT_REPLAY_EVIDENCE');
   check();return recovered;
  }
  let result;
  try{result=await (call.baseVersionId===null?service.create(call.request,context,{signal,invocation}):service.revise(call.baseVersionId,call.request,context,{signal,invocation}));check();}
  catch(cause){
   // A definite refusal (superseded parent, no qualified renderer) left no effect: the delivery settles FAILED
   // and replays as the same refusal. Anything else stays UNKNOWN until canonical reconciliation.
   const definite=cause?.code==='ARTIFACT_STALE_PARENT'?'CONFLICT':cause?.code==='ARTIFACT_RENDERER_UNAVAILABLE'?'UNAVAILABLE':null;
   try{await journal.settle({...key,...(definite===null?{state:'UNKNOWN',outcome:null}:{state:'FAILED',outcome:{code:definite}})});}catch{}throw cause;}
  try{await journal.settle({...key,state:'PREPARED',outcome:{result,release:{binding,scopes:context.scopes,expiresAtMs:context.deadlineMs}}});check();}
  catch(cause){throw Object.assign(Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:invocation.versionId,versionCommitted:true});}
  return result;
 }
 /** Private explicit Publish only. The browser/model never supplies this port or
  * its source record. A draft sequence has one durable attempt across reconnects. */
 async function executeOfficeEdit(value,byteValue,signal,recoveryOnly=false){
  if(c.officeEditWrites!==true||c.selectedInvocationId!==undefined||context.analysisAdmission)fail('EDITOR_PUBLISH_UNAVAILABLE');
  const call=v.snapshot(own(value,['deliveryId','baseVersionId','request']));call.request=officeEditSource(call.request);
  const edit=call.request.edit,binding=context.binding;
  if(call.deliveryId!==`office:${edit.sessionId}:${edit.draftSequence}`||call.baseVersionId!==edit.baseVersionId||!Buffer.isBuffer(byteValue))fail('EDITOR_SAVE_INVALID');
  const bytes=Buffer.from(byteValue),requestSha256=officeEditRequestSha256(v,call.request,context,call.baseVersionId);
  if(bytes.length>context.maxBytes||inspectOfficeEdit(bytes,call.request.format).sha256!==edit.draftSha256)fail('EDITOR_SAVE_INVALID');
  const invocationId='sdk:'+hash({kind:'office-edit',tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:call.deliveryId});
  const invocation={invocationId,versionId:id(invocationId,'version'),requestSha256};
  const record={operation:{id:call.request.operation,version:'0.2.0'},argumentsSha256:requestSha256},key={binding,deliveryId:invocationId,record,signal};
  const service=createArtifactService({...c,ids:()=>({artifactId:id(invocationId,'artifact'),versionId:invocation.versionId,objectId:id(invocationId,'object')})});
  const check=()=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');if(!Number.isSafeInteger(c.now())||c.now()>=context.deadlineMs)fail('ARTIFACT_DEADLINE');};
  const read=()=>storage.read({key:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:invocationId},signal});
  async function replay(prior){
   if(!prior||!same(prior.record.operation,record.operation))fail('ARTIFACT_REPLAY_EVIDENCE');
   if(prior.state==='FAILED')fail(prior.outcome?.code==='CONFLICT'?'ARTIFACT_STALE_PARENT':'EDITOR_PUBLISH_REFUSED');
   if(!['PENDING','UNKNOWN','PREPARED'].includes(prior.state))fail('ARTIFACT_REPLAY_EVIDENCE');
   const evidence={...invocation,requestSha256:prior.record.argumentsSha256};
   const recovered=await service.recoverOfficeEdit(call.baseVersionId,call.request,context,{signal,evidence});
   const result=prior.outcome?.result;
   if(result&&(!same(result.version,recovered.version)||!same(result.inspection,recovered.inspection)||result.execution?.invocationId!==invocationId||result.execution?.requestSha256!==evidence.requestSha256))fail('ARTIFACT_REPLAY_EVIDENCE');
   check();return recovered;
  }
  check();const prior=await read();check();if(prior)return replay(prior);
  // Core may have committed its private-draft Publish barrier before a caller
  // lost the acknowledgement or reached this journal. Absence is not permission
  // to dispatch from recovery: the original caller could still be in flight.
  if(recoveryOnly)fail('EDITOR_PUBLISH_UNRESOLVED');
  let claim;
  try{claim=await journal.begin(key);}
  catch(error){if(!['UNKNOWN','CONFLICT','UNAVAILABLE'].includes(error.code))throw error;const retained=await read();if(retained)return replay(retained);throw error;}
  check();if(claim.replayed)return replay(await read());
  let result;
  try{result=await service.publishOfficeEdit(call.baseVersionId,call.request,bytes,context,{signal,invocation});check();}
  catch(cause){
   // Only the canonical stale-head refusal proves publication did not happen.
   // All other post-claim failures retain the existing uncertainty barrier.
   const conflict=cause?.code==='ARTIFACT_STALE_PARENT';
   try{await journal.settle({...key,state:conflict?'FAILED':'UNKNOWN',outcome:conflict?{code:'CONFLICT'}:null});}catch{}
   throw cause;
  }
  try{await journal.settle({...key,state:'PREPARED',outcome:{result,release:{binding,scopes:context.scopes,expiresAtMs:context.deadlineMs}}});check();}
  catch(cause){throw Object.assign(Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:invocation.versionId,versionCommitted:true});}
  return result;
 }
 return Object.freeze({...createOfficeOriginalPublisher({options:c,context,journal,storage,id}),execute,executeOfficeEdit:(value,bytes,signal)=>executeOfficeEdit(value,bytes,signal),
  recoverOfficeEdit:(value,bytes,signal)=>executeOfficeEdit(value,bytes,signal,true)});
}

/** Production continuation authority for the conversation lifecycle (resume / fork; dot PR #121 6247464370 item 6), over the
 * existing durable run owners. It supplies the two lifecycle product ports `apps/runtime/product-applications.mjs` captures and
 * `apps/control/conversations/lifecycle/{service,journal,authority}.mjs` verify:
 *
 *  transitionAuthority.readCurrent({binding,scopes,selectedClientId,policyRevision,deadlineMs,signal})
 *    -> {binding,scopes,selectedClientId,policyRevision,checkedAtMs,expiresAtMs}
 *    The fresh canonical currentness of exactly that run, read outside the journal's own SQL locks: the durable run record
 *    (binding, scopes, versions, policy revision, not terminal) and the conversation's current-run join (`store.nextRuns.current`:
 *    the live latest run, never a reservation). Used by the journal before it closes a source range (source) and for the
 *    post-commit target checks (target). The fact is Meri-stamped and valid for `authorityWindowMs`.
 *  continuationAdmission.admit({controlId,mode,sourceBinding,checkpoint,checkpointSha256,request,scopes,selectedClientId,versions,signal})
 *    -> {binding,scopes,selectedClientId,admissionReceiptId,targetSessionId,expiresAtMs}
 *    Nominates the target run of one lifecycle control after verifying the source against the durable record it was captured
 *    from (exact request, scopes, versions, policy revision, checkpoint binding/scopes/versions/digest, checkpointed state for a
 *    resume, latest run of its conversation). The target binding, receipt id and fork session id are DERIVED (sha256 over the
 *    control id, mode, source binding and checkpoint digest), so a repeat for the same control nominates the same target; a
 *    derived target already present in the store is admitted again only as this control's own committed continuation. A fork
 *    also claims the new conversation's initial run binding through the existing journal (`initialBindings.claim`, idempotent by
 *    conversation), the record the prepared-run registry admits a writer-fence-1 run on; without those owners a fork refuses.
 *  continuationAdmission.retire({controlId,binding,checkpoint,signal}) -> {binding,retirementReceiptId,expiresAtMs}
 *    Physically retires the checkpointed source before a resume: the existing native stop (`execution/kickoff/stop` of the
 *    prepared candidate / run registry: grant revocation, ECS containment, RETIRED with the physical-stop proof) is asked, and
 *    only the durable allocation record's RETIRED + physicalStopProven is trusted (an unproven stop refuses; nothing is written).
 *    The receipt id is derived from the control, binding, checkpoint digest, task ARN, allocation digest and revoked grant ids.
 *
 * Nothing here mints credentials, writes a run or dispatches: the lifecycle journal inserts the target under its own locks, and
 * the session owner's `verifyTransition` (Core current-transition context) still guards every effect. Construction is inert. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape,assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const CONTINUATION_DERIVATION='meri.lifecycle.continuation/1';
const TERMINAL=['completed','failed','cancelled'],CHECKPOINTED=['paused','waiting-for-approval'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const same=(a,b)=>hash(a)===hash(b),ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const fault=code=>Object.assign(Error('CONTINUATION_'+code),{code:'CONTINUATION_'+code});
const refuse=code=>{throw fault(code);};
const retired=record=>record?.state==='RETIRED'&&record.resource?.physicalStopProven===true;
/** A deterministic RFC 4122-shaped id from the canonical digest of its facts (version and variant nibbles set). */
export function derivedUuid(facts){
 const h=hash({derivation:CONTINUATION_DERIVATION,...data(facts)});
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${((parseInt(h[16],16)&0x3)|0x8).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function createContinuationAuthority(configuration){
 let c,fork=null,limits;
 try{
  c=own(configuration,['store','stop','selectedClientId','policyRevision','versions','now'],['fork','limits']);
  for(const method of ['readOptional'])storageMethod(c.store,method);storageMethod(c.store.allocations,'read');storageMethod(c.store.nextRuns,'current');storageMethod(c.store.lifecycle,'get');
  if(!ordinary(c.stop)||!ordinary(c.now)||typeof c.selectedClientId!=='string'||!UUID.test(c.selectedClientId)||typeof c.policyRevision!=='string'||!c.policyRevision||c.policyRevision.length>256)throw Error();
  validateShape('RuntimeVersions',data(c.versions));
  if(c.fork!==undefined){fork=own(c.fork,['initialBindings','configurationSha256','proposeInitialExpiry']);storageMethod(fork.initialBindings,'claim');storageMethod(fork.initialBindings,'readConversation');if(!ordinary(fork.proposeInitialExpiry)||typeof fork.configurationSha256!=='string'||!/^[a-f0-9]{64}$/u.test(fork.configurationSha256))throw Error();}
  const l=c.limits===undefined?{}:own(c.limits,[],['maxRequestMs','authorityWindowMs','admissionWindowMs']);
  limits={maxRequestMs:l.maxRequestMs??3000,authorityWindowMs:l.authorityWindowMs??30000,admissionWindowMs:l.admissionWindowMs??300000};
  if(!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.authorityWindowMs)||limits.authorityWindowMs<1||limits.authorityWindowMs>300000||!Number.isSafeInteger(limits.admissionWindowMs)||limits.admissionWindowMs<1||limits.admissionWindowMs>1800000)throw Error();
 }catch{refuse('CONFIGURATION');}
 const now=c.now,versions=data(c.versions),read=storageMethod(c.store,'readOptional'),readAllocation=storageMethod(c.store.allocations,'read'),current=storageMethod(c.store.nextRuns,'current'),getControl=storageMethod(c.store.lifecycle,'get');
 const claim=fork?storageMethod(fork.initialBindings,'claim'):null,readConversation=fork?storageMethod(fork.initialBindings,'readConversation'):null;
 function lifetime(signal,deadlineMs){nativeSignal(signal);const began=now();if(!Number.isSafeInteger(began))refuse('REFUSED');return createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs??Infinity,began+limits.maxRequestMs),errorFactory:code=>fault(code)});}
 const owned=error=>typeof error?.code==='string'&&error.code.startsWith('CONTINUATION_');
 /** A store outage or lost acknowledgement is UNAVAILABLE; every other store answer (stale writer, not latest, corrupt, refused) is a refusal. */
 const OUTAGE=['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','INITIAL_RUN_BINDING_STORE_UNAVAILABLE','INITIAL_RUN_BINDING_COMMIT_UNKNOWN'];
 async function durable(life,fn){try{return data(await life.run(fn));}catch(error){if(owned(error))throw error;refuse(OUTAGE.includes(error?.code)?'UNAVAILABLE':'REFUSED');}}
 const uuid=value=>{if(typeof value!=='string'||!UUID.test(value))refuse('REFUSED');return value;};
 /** Scopes of this candidate's one client: tenant-bound, one policy revision, exactly one client scope naming the selected client. */
 function clientScopes(scopes,selectedClientId,tenantId){
  if(!Array.isArray(scopes)||!scopes.length||scopes.length>100)refuse('REFUSED');
  for(const scope of scopes){try{validateShape('Scope',scope);}catch{refuse('REFUSED');}if(scope.tenantId!==tenantId||scope.policyRevision!==c.policyRevision)refuse('REFUSED');}
  const clients=scopes.filter(s=>s.kind==='client');
  if(clients.length!==1||clients[0].resourceId!==selectedClientId||selectedClientId!==c.selectedClientId)refuse('REFUSED');
 }
 /** The durable run record of a binding, exactly as captured: scopes, versions and policy revision pinned, not terminal. */
 async function record(life,binding,scopes){
  const saved=await durable(life,()=>read(binding,{},life.check));
  if(saved===null||!same(saved.run.binding,binding)||!same(saved.run.scopes,scopes)||saved.run.policyRevision!==c.policyRevision||!same(saved.run.versions,versions)||TERMINAL.includes(saved.run.state))refuse('REFUSED');
  return saved;
 }
 /** The conversation's current-run join: this binding is its live latest run (never a reservation) with the same scopes. */
 async function latest(life,binding,scopes){
  const selected=await durable(life,()=>current(binding,life.check));
  if(selected.reserved!==false||!same(selected.binding,binding)||!same(selected.scopes,scopes)||selected.policyRevision!==c.policyRevision)refuse('REFUSED');
  return selected;
 }
 async function readCurrent(value){
  const {signal,...raw}=own(value,['binding','scopes','selectedClientId','policyRevision','deadlineMs'],['signal']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.binding);}catch{refuse('REFUSED');}
  if(v.policyRevision!==c.policyRevision||!Number.isSafeInteger(v.deadlineMs))refuse('REFUSED');clientScopes(v.scopes,v.selectedClientId,v.binding.tenantId);
  const life=lifetime(signal,v.deadlineMs),started=now();
  try{
   await record(life,v.binding,v.scopes);await latest(life,v.binding,v.scopes);
   const checkedAtMs=now(),expiresAtMs=started+limits.authorityWindowMs;
   if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<started||expiresAtMs<=checkedAtMs)refuse('REFUSED');life.check();
   return data({binding:v.binding,scopes:v.scopes,selectedClientId:v.selectedClientId,policyRevision:v.policyRevision,checkedAtMs,expiresAtMs});
  }finally{life.close();}
 }
 /** A fork's new conversation: the existing initial-run-binding claim (idempotent by conversation), as a new Core conversation gets. */
 async function forkTarget(life,v,conversationId){
  const principal={tenantId:v.sourceBinding.tenantId,actorId:v.sourceBinding.actorId},query={principal,conversationId,selectedClientId:v.selectedClientId};
  let admitted=await durable(life,()=>readConversation(query,life.check));
  if(admitted===null){
   let proposedExpiresAtMs;try{proposedExpiresAtMs=fork.proposeInitialExpiry({...(life.signal===undefined?{}:{signal:life.signal})});}catch{refuse('UNAVAILABLE');}
   if(!Number.isSafeInteger(proposedExpiresAtMs)||proposedExpiresAtMs<=now())refuse('UNAVAILABLE');
   admitted=(await durable(life,()=>claim({...query,policyRevision:c.policyRevision,versions:v.versions,configurationSha256:fork.configurationSha256,proposedExpiresAtMs},life.check))).record;
  }
  let r;try{r=own(admitted,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']);validateShape('RunBinding',r.binding);}catch{refuse('REFUSED');}
  if(r.schemaVersion!==1||r.state!=='ADMITTED'||r.binding.tenantId!==principal.tenantId||r.binding.actorId!==principal.actorId||r.binding.conversationId!==conversationId||r.binding.writerFence!==1||r.selectedClientId!==v.selectedClientId||r.policyRevision!==c.policyRevision||!same(r.versions,v.versions)||r.configurationSha256!==fork.configurationSha256||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())refuse('REFUSED');
  return {binding:r.binding,expiresAtMs:r.expiresAtMs};
 }
 async function admit(value){
  const {signal,...raw}=own(value,['controlId','mode','sourceBinding','checkpoint','checkpointSha256','request','scopes','selectedClientId','versions'],['signal']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.sourceBinding);validateShape('Checkpoint',v.checkpoint);assertWorkspacePaths(v.checkpoint.workspace);validateShape('RuntimeVersions',v.versions);}catch{refuse('REFUSED');}
  uuid(v.controlId);if(!['resume','fork'].includes(v.mode))refuse('REFUSED');
  const s=v.sourceBinding,cp=v.checkpoint;
  if(hash(cp)!==v.checkpointSha256||!same(cp.binding,s)||!same(cp.workspace.binding,s)||!same(cp.scopes,v.scopes)||!same(cp.workspace.scopes,v.scopes)||!same(cp.versions,v.versions)||!same(v.versions,versions)||cp.workspaceSha256!==hash(cp.workspace))refuse('REFUSED');
  clientScopes(v.scopes,v.selectedClientId,s.tenantId);
  if(v.mode==='fork'&&fork===null)refuse('FORK_UNAVAILABLE');
  const life=lifetime(signal);
  try{
   const saved=await record(life,s,v.scopes);
   if(!same(saved.request,v.request)||cp.lastEventSequence>saved.lastSequence||v.mode==='resume'&&!CHECKPOINTED.includes(saved.run.state))refuse('REFUSED');
   await latest(life,s,v.scopes);
   const facts={controlId:v.controlId,mode:v.mode,sourceBinding:s,checkpointSha256:v.checkpointSha256},field=name=>derivedUuid({...facts,field:name});
   let target,targetSessionId=null,expiresAtMs=now()+limits.admissionWindowMs;
   if(v.mode==='resume')target={tenantId:s.tenantId,actorId:s.actorId,conversationId:s.conversationId,runId:field('runId'),attemptId:field('attemptId'),workerId:field('workerId'),writerFence:s.writerFence+1};
   else{targetSessionId=field('targetSessionId');if(targetSessionId===cp.sessionId)refuse('REFUSED');const claimed=await forkTarget(life,v,field('conversationId'));target=claimed.binding;expiresAtMs=Math.min(expiresAtMs,claimed.expiresAtMs);}
   try{validateShape('RunBinding',target);}catch{refuse('REFUSED');}
   if(['runId','attemptId','workerId'].some(k=>target[k]===s[k])||v.mode==='resume'&&target.conversationId!==s.conversationId||v.mode==='fork'&&target.conversationId===s.conversationId)refuse('REFUSED');
   // A target already in the store is admitted again only as this control's own committed continuation (the saved receipt).
   const existing=await durable(life,()=>read(target,{},life.check));
   if(existing!==null){
    const control=await durable(life,()=>getControl({binding:s,scopes:v.scopes,selectedClientId:v.selectedClientId,controlId:v.controlId},life.check));
    if(!control.target||!same(control.target.binding,target)||control.input?.intent!==v.mode||control.target.targetSessionId!==targetSessionId)refuse('REFUSED');
    life.check();return control.target;
   }
   const admissionReceiptId=derivedUuid({...facts,field:'admissionReceiptId',targetBinding:target,targetSessionId});
   if(!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now())refuse('REFUSED');life.check();
   return data({binding:target,scopes:v.scopes,selectedClientId:v.selectedClientId,admissionReceiptId,targetSessionId,expiresAtMs});
  }finally{life.close();}
 }
 async function retire(value){
  const {signal,...raw}=own(value,['controlId','binding','checkpoint'],['signal']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.binding);validateShape('Checkpoint',v.checkpoint);}catch{refuse('REFUSED');}
  uuid(v.controlId);const b=v.binding,cp=v.checkpoint;if(!same(cp.binding,b))refuse('REFUSED');
  const life=lifetime(signal);
  try{
   const saved=await record(life,b,cp.scopes);
   if(!CHECKPOINTED.includes(saved.run.state)||!same(saved.run.versions,cp.versions))refuse('REFUSED');clientScopes(saved.run.scopes,c.selectedClientId,b.tenantId);
   const allocation=async()=>(await durable(life,()=>readAllocation({binding:b,allocationKey:hash(b)},life.check)))?.record??null;
   let r=await allocation();
   // A checkpointed run claimed an allocation: a missing or foreclosed row is never a proof of stop.
   if(r===null||r.state==='FORECLOSED'||!same(r.original?.binding,b))refuse('REFUSED');
   if(!retired(r)){
    try{await life.run(s=>c.stop({binding:b,...(s===undefined?{}:{signal:s})}));}catch(error){if(owned(error)&&['CONTINUATION_DEADLINE','CONTINUATION_CANCELLED'].includes(error.code))throw error;life.check();}
    r=await allocation();if(!retired(r)||!same(r.original?.binding,b))refuse('STOP_UNPROVEN');
   }
   if(!Array.isArray(r.grantIntents)||!r.grantIntents.length||typeof r.resource?.taskArn!=='string')refuse('STOP_UNPROVEN');
   const retirementReceiptId=derivedUuid({field:'retirementReceiptId',controlId:v.controlId,binding:b,checkpointSha256:hash(cp),taskArn:r.resource.taskArn,allocationSha256:r.allocationSha256??null,grantIds:r.grantIntents.map(g=>g.grantId).sort()});
   const expiresAtMs=now()+limits.admissionWindowMs;life.check();
   return data({binding:b,retirementReceiptId,expiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({transitionAuthority:Object.freeze({readCurrent}),continuationAdmission:Object.freeze({admit,retire}),fork:fork!==null,limits:Object.freeze({...limits})});
}

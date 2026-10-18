/** Authenticated request/history control; policy remains in existing session owners. */
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {resolveWindow} from '../../../packages/window-resolution/index.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {assertSkillManifest,validateShape as retrievalShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {assertSelectionAdmission} from '../../../packages/contracts/selected-skills/validate.mjs';
import {assertConversationInputReceipt} from '../../../packages/contracts/conversation-input/validate.mjs';
import {assertOriginalInputFacts,assertOriginalInputActive,assertOriginalInputAcceptance,prepareOriginalInputFacts,sameOriginalInputIdentity,originalInputReceipt} from './initial-input-facts.mjs';
import {ProductError} from '../product-access/errors.mjs';
import {own,bounded,same,hash,fail,uuid,validateShape,terminal} from './boundary.mjs';
/** Cleanup-only read used by the lifecycle owner's cancellation path: the same authenticated history without the retention serving gate,
 * so trusted cancellation still stops work for a suppressed subject. Not a public intent. */
export const cleanupRead=Symbol('conversation.cleanupRead');
export function createConversationService({sessions,store,dispatcher,versions,fiscalCalendars=[],now=Date.now,newId=randomUUID,maxRequestMs=3000,selectedSkillAdmission,selectedOutputPublication,retention,capabilityPolicy}){
 const admissionPort=selectedSkillAdmission===undefined?undefined:own(selectedSkillAdmission,['admitSelection'],['currentSkillRun']),publicationPort=selectedOutputPublication===undefined?undefined:own(selectedOutputPublication,['prepareEvent']);
 if(admissionPort!==undefined&&typeof admissionPort.admitSelection!=='function'||publicationPort!==undefined&&typeof publicationPort.prepareEvent!=='function')fail('CONTROL_CONFIGURATION');
 // G2: the trusted run capability-policy producer (apps/runtime/product-ports/capability-policy.mjs). Absent, or answering null, a loaded run
 // carries no `capabilities` and keeps first-chat behaviour; the worker validates the record (capabilities/policy.mjs readCapabilityPolicy).
 const capabilityPort=capabilityPolicy===undefined?undefined:own(capabilityPolicy,['forRun'],['profile','profileSha256']);if(capabilityPort!==undefined&&typeof capabilityPort.forRun!=='function')fail('CONTROL_CONFIGURATION');
 // The canonical retention read gate (trusted tenant/conversation identity from the authenticated current context) is consulted in every
 // fresh() pass: before any data is exposed, across awaited work and immediately before release. Its refusals keep their own codes
 // (RETENTION_SUPPRESSED, RETENTION_RECOVERY_BARRIER, RETENTION_READ_UNAVAILABLE) and reach the public boundary as the existing
 // unavailable response; an unreadable journal or a closed barrier never means "unsuppressed". Cancellation runs without the gate.
 const retentionGate=retention===undefined?undefined:own(retention,['assertServable'],['isSuppressed']);if(retentionGate!==undefined&&typeof retentionGate.assertServable!=='function')fail('CONTROL_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);fiscalCalendars=bounded(fiscalCalendars);if(['authenticateSession','readCurrentState'].some(k=>typeof sessions?.[k]!=='function')||['accept','append','read'].some(k=>typeof store?.[k]!=='function')||['start','cancel'].some(k=>typeof dispatcher?.[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONTROL_CONFIGURATION');
 async function operation(credential,signal,body,{cleanup=false}={}){if(typeof credential!=='string'||!credential||credential.length>8192)fail('SESSION_REFUSED');const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:failError});let pinned,authorityExpiresAtMs=Number.MAX_SAFE_INTEGER;
  async function fresh(){const started=now();const authentication=bounded(await life.run(signal=>sessions.authenticateSession({credential,signal,deadlineMs:started+maxRequestMs})));const current=bounded(await life.run(signal=>sessions.readCurrentState({authentication,signal,deadlineMs:started+maxRequestMs})));
   if(current.authenticationSha256!==hash(authentication)||authentication.principal?.tenantId!==current.binding?.tenantId||authentication.principal?.actorId!==current.binding?.actorId||authentication.principal?.conversationId!==current.binding?.conversationId||authentication.principal?.runId!==current.binding?.runId)fail('SESSION_REFUSED');validateShape('RunBinding',current.binding);if(!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)fail('SCOPE_REFUSED');
   for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==current.binding.tenantId)fail('SCOPE_REFUSED');}if(new Set(current.scopes.map(hash)).size!==current.scopes.length||new Set(current.scopes.map(s=>s.policyRevision)).size!==1)fail('SCOPE_REFUSED');
   const at=now();for(const receipt of [authentication,current])if(!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=at)fail('SESSION_REFUSED');authorityExpiresAtMs=Math.min(authorityExpiresAtMs,authentication.expiresAtMs,current.expiresAtMs);life.limitDeadline(authorityExpiresAtMs);
   const selected=bounded({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});if(pinned&&!same(pinned,selected))fail('SESSION_CHANGED');pinned??=selected;life.check();
   if(retentionGate&&!cleanup){await life.run(()=>retentionGate.assertServable({tenantId:pinned.binding.tenantId,kind:'conversation',subjectId:pinned.binding.conversationId}));life.check();}
   return pinned;
  }
  try{const context=await fresh();const result=await body(context,life,fresh,()=>authorityExpiresAtMs);await fresh();life.check();return result;}finally{life.close();}
 }
 const event=(binding,scopes,type,data)=>({contractVersion:'0.1.0',eventId:newId(),binding,sequence:1,createdAt:new Date(now()).toISOString(),scopes,type,data});
 function inputIntent(raw){const i=bounded(raw);own(i,['requestId','prompt'],['skill','windowRequest']);uuid(i.requestId);if(typeof i.prompt!=='string'||!i.prompt.trim()||i.prompt.length>100000)fail('INVALID_REQUEST');if(i.windowRequest)retrievalShape('WindowRequest',i.windowRequest);return i;}
 function prepareInput(i,createdAt){let skill=null,window=i.windowRequest?resolveWindow(i.windowRequest,{referenceAt:createdAt,fiscalCalendars}):null;
  if(i.skill){own(i.skill,['skillId','skillVersion']);const selected=selectSkill(i.skill.skillId,i.skill.skillVersion);if(!selectedSkillAdmission)assertSkillManifest(selected.manifest,catalog);if(!window)fail('SKILL_WINDOW_REQUIRED');if(!selected.manifest.subjectKinds.includes('client')||!selected.manifest.windowBases.includes(window.basis))fail('SKILL_SCOPE_REFUSED');skill=selected.pin;}
  if(window)retrievalShape('NormalizedWindow',window);return {requestId:i.requestId,prompt:i.prompt,skill,window,windowRequest:i.windowRequest??null};
 }
 async function admitPrepared(request,context,life,fresh){if(!request.skill)return;const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);if(!selectedSkillAdmission){assertSkillManifest(selected.manifest,catalog);return;}await fresh();const started=now();const receipt=assertSelectionAdmission(await life.run(signal=>admissionPort.admitSelection.call(selectedSkillAdmission,{binding:context.binding,request,scopes:context.scopes,selectedClientId:context.selectedClientId,signal})),{binding:context.binding,request,scopes:context.scopes,selectedClientId:context.selectedClientId,selected,started,now});life.limitDeadline(receipt.expiresAtMs);await fresh();}
 function initialPorts(){const ports=own(store.initialInputs,['claim','read','accept']);if(Object.values(ports).some(p=>typeof p!=='function'))fail('CONTROL_CONFIGURATION');return ports;}
 function pinOriginal(saved,context,i,life){own(saved,['facts','state']);if(!['RESERVED','ACCEPTED'].includes(saved.state))fail('INITIAL_INPUT_CORRUPT');const f=assertOriginalInputFacts(saved.facts);
  if(!same(f.binding,context.binding)||!same(f.scopes,context.scopes)||!same(f.versions,versions)||f.selectedClientId!==context.selectedClientId||f.requestId!==i.requestId||f.inputSha256!==hash(i))fail('INITIAL_INPUT_CONFLICT');assertOriginalInputActive(f,now());life.limitDeadline(f.expiresAtMs);return f;
 }
 /** Only the existing store's conditional acknowledgement proves a new original allocation. No run/event/dispatcher is created. */
 async function allocateInput({credential,input,signal}){const i=inputIntent(input);let acknowledged=false;try{return await operation(credential,signal,async(context,life,fresh,authorityExpiry)=>{
  if(context.binding.writerFence!==1)fail('INITIAL_INPUT_CONFLICT');const ports=initialPorts(),saved=await life.run(()=>ports.read(context.binding,life.check));
  const original=saved?pinOriginal(saved,context,i,life):null,allocatedAtMs=original?.allocatedAtMs??now(),request=prepareInput(i,new Date(allocatedAtMs).toISOString());
  await admitPrepared(request,context,life,fresh);await fresh();
  let facts=await prepareOriginalInputFacts({...context,versions,input:i,request,allocatedAtMs,expiresAtMs:original?.expiresAtMs??authorityExpiry()});life.check();await fresh();
  if(!original)facts=assertOriginalInputFacts({...facts,expiresAtMs:Math.min(facts.expiresAtMs,authorityExpiry())});
  const result=bounded(await life.run(()=>ports.claim(facts,life.check)));acknowledged=true;own(result,['allocation','state','created']);const out=originalInputReceipt(result.allocation,result.state,result.created);
  if(!sameOriginalInputIdentity(out.allocation,facts)||saved&&out.created)fail('INITIAL_INPUT_CORRUPT');assertOriginalInputActive(out.allocation,now());life.limitDeadline(out.allocation.expiresAtMs);return out;
 });}catch(error){if(acknowledged)throw new ProductError('INITIAL_INPUT_UNAVAILABLE','UNKNOWN');throw error;}}
 // Admission and submit share the existing immutable acceptance transaction. Only submit may dispatch.
 async function acceptInput({credential,input,signal},dispatch){const i=inputIntent(input);
  return operation(credential,signal,async(context,life,fresh)=>{const b=context.binding;
   const admit=request=>admitPrepared(request,context,life,fresh);
   async function release(saved){if(!same(saved.run.binding,b))fail('STALE_WRITER');if(!same(saved.run.scopes,context.scopes))fail('SCOPE_REFUSED');await fresh();await admit(saved.request);if(dispatch&&saved.run.state==='queued')await life.run(signal=>dispatcher.start({binding:b,signal}));await fresh();await admit(saved.request);return dispatch?{run:saved.run,requestId:i.requestId,lastSequence:saved.lastSequence,replayed:saved.replayed}:assertConversationInputReceipt({run:saved.run,request:saved.request,lastSequence:saved.lastSequence,replayed:saved.replayed},i);}
   if(typeof store.findRequest!=='function')fail('CONTROL_CONFIGURATION');const retained=await life.run(()=>store.findRequest(b,i.requestId,life.check));
   const originalPorts=b.writerFence===1?initialPorts():null,allocation=originalPorts?await life.run(()=>originalPorts.read(b,life.check)):null,original=allocation?pinOriginal(allocation,context,i,life):null;
   if(retained){const selected=i.skill?selectSkill(i.skill.skillId,i.skill.skillVersion):null;if(i.skill)own(i.skill,['skillId','skillVersion']);if(!same(retained.run.scopes,context.scopes))fail('SCOPE_REFUSED');if(!same(retained.run.versions,versions)||retained.request.prompt!==i.prompt||!same(retained.request.windowRequest??null,i.windowRequest??null)||!same(retained.request.skill,selected?.pin??null))fail('REQUEST_REPLAY_REFUSED');return release(retained);}
   if(!originalPorts){
    if(typeof store.nextRuns?.readTarget!=='function'||typeof store.nextRuns.accept!=='function')fail('CONTROL_CONFIGURATION');
    const candidate=await life.run(()=>store.nextRuns.readTarget(b,life.check)),reservation=candidate?bounded(candidate):null;
    if(!reservation||!['RESERVED','ACCEPTED'].includes(reservation.state)||!same(reservation.target,b))fail('NEXT_RUN_NOT_RESERVED');
   }
   if(originalPorts&&!original)fail('INITIAL_INPUT_REQUIRED');const createdAt=new Date(original?.allocatedAtMs??now()).toISOString(),request=prepareInput(i,createdAt),run={binding:b,state:'queued',scopes:context.scopes,createdAt,policyRevision:context.scopes[0].policyRevision,versions};
   if(original)assertOriginalInputAcceptance(original,{run,request,selectedClientId:context.selectedClientId});
   const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:context.scopes,createdAt,policyRevision:run.policyRevision};
   await admit(request);
   // Both paths have positive journal authority. The journal rechecks the exact mapping atomically, including an ACCEPTED duplicate race.
   await fresh();
   const saved=await life.run(()=>(originalPorts?originalPorts.accept:store.nextRuns.accept)({conversation,run,request,event:event(b,context.scopes,'run.status',{state:'queued',reasonCode:null}),...(originalPorts?{selectedClientId:context.selectedClientId}:{})},life.check));
   // Durable request precedes Temporal start. A repeated submission recovers a lost start acknowledgement using the exact workflow ID.
   return release(saved);});
 }
 const submit=input=>acceptInput(input,true),admitInput=input=>acceptInput(input,false);
 async function history({credential,after=0,limit=100,signal}){return operation(credential,signal,async(c,life)=>{
  // An admitted conversation has no run row until its first input is accepted: that is "no saved turns yet" (404), not corruption.
  const result=typeof store.readOptional==='function'?await life.run(()=>store.readOptional(c.binding,{after,limit},life.check)):await life.run(()=>store.read(c.binding,{after,limit},life.check));if(result===null)fail('NOT_FOUND');if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');return result;});}
 async function cancel({credential,signal}){return operation(credential,signal,async(c,life,fresh)=>{const old=await life.run(()=>store.read(c.binding,{after:0,limit:1},life.check));if(!same(old.run.scopes,c.scopes))fail('SCOPE_REFUSED');if(!terminal(old.run.state)){await fresh();const e=event(c.binding,c.scopes,'run.status',{state:'cancelled',reasonCode:'USER_CANCELLED'});await life.run(()=>store.append(c.binding,e,life.check,c.scopes));}await fresh();await life.run(signal=>dispatcher.cancel({binding:c.binding,signal}));return {state:terminal(old.run.state)?old.run.state:'cancelled'};},{cleanup:true});}
 async function loadForExecution({credential,binding,signal}){validateShape('RunBinding',binding);return operation(credential,signal,async(c,life)=>{if(!same(c.binding,binding))fail('STALE_WRITER');const result=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');const lineage=typeof store.nextRuns?.execution==='function'?await life.run(()=>store.nextRuns.execution({binding,scopes:c.scopes,selectedClientId:c.selectedClientId},life.check)):null;const capabilities=capabilityPort===undefined?null:await life.run(signal=>capabilityPort.forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,signal}));return {run:result.run,request:result.request,...(lineage??{}),...(capabilities===null?{}:{capabilities})};});}
 async function publish({credential,binding,event,signal}){validateShape('RunBinding',binding);const e=bounded(event);own(e,['eventId','createdAt','type','data']);if(!['run.status','message.delta'].includes(e.type))fail('EVENT_TYPE_REFUSED');return operation(credential,signal,async(c,life)=>{if(!same(c.binding,binding))fail('STALE_WRITER');const result=await life.run(()=>store.append(binding,e,life.check,c.scopes));if(!same(result.scopes,c.scopes))fail('SCOPE_REFUSED');return result;});}
 async function publishSelectedOutput({credential,binding,output,signal}){validateShape('RunBinding',binding);if(!selectedOutputPublication)fail('OUTPUT_PUBLICATION_UNAVAILABLE');return operation(credential,signal,async(c,life,fresh)=>{
  if(!same(c.binding,binding))fail('STALE_WRITER');const saved=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));if(!same(saved.run.scopes,c.scopes)||saved.run.state!=='running')fail('RUN_NOT_WRITABLE');
  await fresh();const at=now(),value=bounded(await life.run(signal=>publicationPort.prepareEvent.call(selectedOutputPublication,{binding,request:saved.request,scopes:c.scopes,selectedClientId:c.selectedClientId,output,signal})),2097152);
  own(value,['event','checkedAtMs','expiresAtMs']);const e=own(value.event,['eventId','createdAt','type','data']);if(!['message.delta','artifact.available'].includes(e.type)||!Number.isSafeInteger(value.checkedAtMs)||value.checkedAtMs<at||value.checkedAtMs>now()||!Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs<=now())fail('OUTPUT_PUBLICATION_REFUSED');life.limitDeadline(value.expiresAtMs);
  await fresh();const result=await life.run(()=>store.append(binding,e,life.check,c.scopes));if(!same(result.scopes,c.scopes))fail('SCOPE_REFUSED');await fresh();return result;
 });}
 async function historyForCleanup({credential,after=0,limit=100,signal}){return operation(credential,signal,async(c,life)=>{const result=await life.run(()=>store.read(c.binding,{after,limit},life.check));if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');return result;},{cleanup:true});}
 return Object.freeze({submit,admitInput,allocateInput,history,cancel,loadForExecution,publish,publishSelectedOutput,[cleanupRead]:historyForCleanup});
}
function failError(code){return Object.assign(new Error(code),{code});}

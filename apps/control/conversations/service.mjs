import {assertDocumentRevisionSelection,supportsSelectedDocumentRevision} from '../../../packages/contracts/document-revision.mjs';
import {assertSiteWorkflowSelection} from '../../../packages/contracts/site-workflow-selection.mjs';
import {assertProcedureSelection} from '../../../packages/contracts/procedure-selection.mjs';
import {assertUploadSelections} from '../../../packages/contracts/upload-selection.mjs';
import {assertWorkSelection} from '../../../packages/contracts/work-selection.mjs';
import {createUploadSourceCapture,assertSameUploadSource} from './sources/upload.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
/** Authenticated request/history control; policy remains in existing session owners. */
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {resolveWindow} from '../../../packages/window-resolution/index.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {validateShape as retrievalShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertInstalledSkillManifest} from '../../../packages/contracts/retrieval-0.3/installed-skill.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {assertSelectionAdmission} from '../../../packages/contracts/selected-skills/validate.mjs';
import {assertConversationInputReceipt} from '../../../packages/contracts/conversation-input/validate.mjs';
import {assertOriginalInputFacts,assertOriginalInputActive,assertOriginalInputAcceptance,prepareOriginalInputFacts,sameOriginalInputIdentity,originalInputReceipt} from './initial-input-facts.mjs';
import {ProductError} from '../product-access/errors.mjs';
import {authenticatedCurrentState} from '../action-host/session/owner.mjs';
import {resolveSdkModelConfiguration} from './usage.mjs';
import {assertModelSelection,availableModelSelection,storedModelSelection,HISTORICAL_MODEL_SELECTION} from '../../../packages/contracts/model-selection.mjs';
import {assertUsageInput} from '../../../packages/contracts/runtime-0.2/usage.mjs';
import {own,bounded,same,hash,fail,uuid,validateShape,terminal} from './boundary.mjs';
/** Trusted lifecycle composition only. Keeps its read inside the basic load's authorization lifetime. */
export const loadWithLifecycle=Symbol('conversation.loadWithLifecycle');
/** Events released per observation page: the history route's own page maximum. */
const OBSERVE_PAGE_EVENTS=100;
/** Cap empty-read waits to keep new events and Stop responsive. Explicit slower polls remain supported. */
const OBSERVE_IDLE_POLL_MAX_MS=250;
/** An idle observation window closes this long before its cap: more than one timer tick of lateness (Windows ~15.6 ms) plus loop lag. */
const WINDOW_END_SLACK_MS=50;
export function createConversationService({sessions,store,dispatcher,versions,fiscalCalendars=[],now=Date.now,newId=randomUUID,maxRequestMs=3000,selectedSkillAdmission,selectedOutputPublication,procedureAdmission,siteWorkflowAdmission,retention,capabilityPolicy,readCapabilityRole,runBudgets,modelCatalog,documentRevisionSource,uploadInputSource}){
 const captureUploadSource=uploadInputSource===undefined?undefined:createUploadSourceCapture({store});
 const readCurrent=authenticatedCurrentState(sessions);
 const admissionPort=selectedSkillAdmission===undefined?undefined:own(selectedSkillAdmission,['admitSelection'],['currentSkillRun']),publicationPort=selectedOutputPublication===undefined?undefined:own(selectedOutputPublication,['prepareEvent']),procedurePort=procedureAdmission===undefined?undefined:own(procedureAdmission,['resolve']),siteWorkflowPort=siteWorkflowAdmission===undefined?undefined:own(siteWorkflowAdmission,['resolve']);
 if(admissionPort!==undefined&&typeof admissionPort.admitSelection!=='function'||publicationPort!==undefined&&typeof publicationPort.prepareEvent!=='function'||procedurePort!==undefined&&typeof procedurePort.resolve!=='function'||siteWorkflowPort!==undefined&&typeof siteWorkflowPort.resolve!=='function')fail('CONTROL_CONFIGURATION');
 // The trusted current run capability-policy producer (apps/runtime/product-ports/capability-policy.mjs). Absent, or answering null, a loaded run
 // carries no `capabilities` and keeps first-chat behaviour; the worker validates the record (capabilities/policy.mjs readCapabilityPolicy).
 const capabilityPort=capabilityPolicy===undefined?undefined:own(capabilityPolicy,['forRun']);if(capabilityPort!==undefined&&typeof capabilityPort.forRun!=='function'||readCapabilityRole!==undefined&&typeof readCapabilityRole!=='function')fail('CONTROL_CONFIGURATION');
 // The run's admitted allocation budgets (read-only, apps/gateway/budget/run-allocation-budgets.mjs) for the worker's early read ledger.
 // Absent, or answering null (no installed allocation yet), a loaded run carries no `runBudgets` and the ledger keeps its default.
 const runBudgetPort=runBudgets===undefined?undefined:own(runBudgets,['read']);if(runBudgetPort!==undefined&&typeof runBudgetPort.read!=='function')fail('CONTROL_CONFIGURATION');
 // The canonical retention read gate (trusted tenant/conversation identity from the authenticated current context) is consulted in every
 // fresh() pass: before any data is exposed, across awaited work and immediately before release. Its refusals keep their own codes
 // (RETENTION_SUPPRESSED, RETENTION_RECOVERY_BARRIER, RETENTION_READ_UNAVAILABLE) and reach the public boundary as the existing
 // unavailable response; an unreadable journal or a closed barrier never means "unsuppressed". Cancellation runs without the gate.
 const retentionGate=retention===undefined?undefined:own(retention,['assertServable'],['isSuppressed','withRelease']);
 if(retentionGate!==undefined&&(typeof retentionGate.assertServable!=='function'||Object.hasOwn(retentionGate,'withRelease')&&typeof retentionGate.withRelease!=='function'))fail('CONTROL_CONFIGURATION');
 validateShape('RuntimeVersions',versions);versions=bounded(versions);fiscalCalendars=bounded(fiscalCalendars);if(['authenticateSession','readCurrentState'].some(k=>typeof sessions?.[k]!=='function')||['accept','append','read'].some(k=>typeof store?.[k]!=='function')||['start','cancel'].some(k=>typeof dispatcher?.[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONTROL_CONFIGURATION');
 // untilMs: an observation window whose body releases nothing without its own post-read fresh(); it ends at untilMs instead of
 // maxRequestMs and skips the trailing recheck, which would only repeat the last release's.
 async function operation(credential,signal,body,{cleanup=false,untilMs,release}={}){if(typeof credential!=='string'||!credential||credential.length>8192)fail('SESSION_REFUSED');const life=createOperationLifetime({deadlineMs:untilMs??now()+maxRequestMs,now,signal,errorFactory:failError});let pinned,authorityExpiresAtMs=Number.MAX_SAFE_INTEGER;
  // One pass is one complete session observation: the registered owner's fused reader resolves the session once and yields both
  // receipts. A plain session port keeps the authenticate + current-state pair.
  async function fresh(){const started=now();let authentication,current;
   if(readCurrent)({authentication,current}=bounded(await life.run(signal=>readCurrent({credential,signal,deadlineMs:started+maxRequestMs}))));
   else{authentication=bounded(await life.run(signal=>sessions.authenticateSession({credential,signal,deadlineMs:started+maxRequestMs})));current=bounded(await life.run(signal=>sessions.readCurrentState({authentication,signal,deadlineMs:started+maxRequestMs})));}
   if(current.authenticationSha256!==hash(authentication)||authentication.principal?.tenantId!==current.binding?.tenantId||authentication.principal?.actorId!==current.binding?.actorId||authentication.principal?.conversationId!==current.binding?.conversationId||authentication.principal?.runId!==current.binding?.runId)fail('SESSION_REFUSED');validateShape('RunBinding',current.binding);if(!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)fail('SCOPE_REFUSED');
   for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==current.binding.tenantId)fail('SCOPE_REFUSED');}if(new Set(current.scopes.map(hash)).size!==current.scopes.length||new Set(current.scopes.map(s=>s.policyRevision)).size!==1)fail('SCOPE_REFUSED');
   const at=now();for(const receipt of [authentication,current])if(!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=at)fail('SESSION_REFUSED');authorityExpiresAtMs=Math.min(authorityExpiresAtMs,authentication.expiresAtMs,current.expiresAtMs);life.limitDeadline(authorityExpiresAtMs);
   const selected=bounded({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});if(pinned&&!same(pinned,selected))fail('SESSION_CHANGED');pinned??=selected;life.check();
   if(retentionGate&&!cleanup){await life.run(()=>retentionGate.assertServable({tenantId:pinned.binding.tenantId,kind:'conversation',subjectId:pinned.binding.conversationId}));life.check();}
   return pinned;
  }
  try{const context=await fresh();let result=await body(context,life,fresh,()=>authorityExpiresAtMs);if(untilMs===undefined)await fresh();if(release)result=await release(result,life);life.check();return result;}finally{life.close();}
 }
 const event=(binding,scopes,type,data)=>({contractVersion:'0.1.0',eventId:newId(),binding,sequence:1,createdAt:new Date(now()).toISOString(),scopes,type,data});
 function inputIntent(raw){const i=bounded(raw);own(i,['requestId','prompt'],['skill','windowRequest','modelSelection','documentRevision','uploads','procedure','siteWorkflow','work']);if(Object.hasOwn(i,'documentRevision')){try{assertDocumentRevisionSelection(i.documentRevision);if(i.skill&&!supportsSelectedDocumentRevision(i.skill))throw 0;}catch{fail('INVALID_REQUEST');}}if(i.siteWorkflow!==undefined){try{assertSiteWorkflowSelection(i.siteWorkflow);}catch{fail('INVALID_REQUEST');}}if(i.procedure!==undefined){try{assertProcedureSelection(i.procedure);if(Object.hasOwn(i,'skill'))throw 0;}catch{fail('INVALID_REQUEST');}}if(i.uploads!==undefined){try{assertUploadSelections(i.uploads);}catch{fail('INVALID_REQUEST');}}if(i.work!==undefined){try{assertWorkSelection(i.work);}catch{fail('INVALID_REQUEST');}}uuid(i.requestId);if(typeof i.prompt!=='string'||!i.prompt.trim()||i.prompt.length>100000)fail('INVALID_REQUEST');if(i.windowRequest)retrievalShape('WindowRequest',i.windowRequest);if(Object.hasOwn(i,'modelSelection')){try{assertModelSelection(i.modelSelection);}catch{fail('INVALID_REQUEST');}}return i;}
 const available=selection=>{try{return availableModelSelection(modelCatalog,selection);}catch(error){fail(error.code==='MODEL_SELECTION_UNAVAILABLE'?'MODEL_SELECTION_UNAVAILABLE':'MODEL_SETTINGS_UNAVAILABLE');}};
 function prepareInput(i,createdAt,modelSelection){let skill=null,window=i.windowRequest?resolveWindow(i.windowRequest,{referenceAt:createdAt,fiscalCalendars}):null;
  if(i.skill){own(i.skill,['skillId','skillVersion']);const selected=selectSkill(i.skill.skillId,i.skill.skillVersion);if(!selectedSkillAdmission)assertInstalledSkillManifest(selected.manifest,catalog);if(!window)fail('SKILL_WINDOW_REQUIRED');if((!selectedSkillAdmission&&!selected.manifest.subjectKinds.includes('client'))||!selected.manifest.windowBases.includes(window.basis))fail('SKILL_SCOPE_REFUSED');skill=selected.pin;}
  if(window)retrievalShape('NormalizedWindow',window);return {requestId:i.requestId,prompt:i.prompt,skill,window,windowRequest:i.windowRequest??null,...(i.documentRevision===undefined?{}:{documentRevision:i.documentRevision}),...(i.uploads===undefined?{}:{uploads:i.uploads}),...(i.procedure===undefined?{}:{procedure:assertProcedureSelection(i.procedure)}),...(i.siteWorkflow===undefined?{}:{siteWorkflow:assertSiteWorkflowSelection(i.siteWorkflow)}),...(i.work===undefined?{}:{work:assertWorkSelection(i.work)}),...(modelSelection===undefined?{}:{modelSelection})};
 }
 async function admitPrepared(request,context,life,fresh,credential){if(request.uploads!==undefined){if(typeof uploadInputSource?.admit!=='function')fail('CONVERSATION_UNAVAILABLE');for(const selection of assertUploadSelections(request.uploads)){await fresh();await life.run(signal=>uploadInputSource.admit({credential,binding:context.binding,selection,deadlineMs:life.deadline(),signal}));await fresh();}}if(!request.skill)return;const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);if(!selectedSkillAdmission){assertInstalledSkillManifest(selected.manifest,catalog);return;}await fresh();const started=now();const receipt=assertSelectionAdmission(await life.run(signal=>admissionPort.admitSelection.call(selectedSkillAdmission,{binding:context.binding,request,scopes:context.scopes,selectedClientId:context.selectedClientId,deadlineMs:life.deadline(),signal})),{binding:context.binding,request,scopes:context.scopes,selectedClientId:context.selectedClientId,selected,started,now});life.limitDeadline(receipt.expiresAtMs);await fresh();}
 function initialPorts(){const ports=own(store.initialInputs,['claim','read','accept']);if(Object.values(ports).some(p=>typeof p!=='function'))fail('CONTROL_CONFIGURATION');return ports;}
 function pinOriginal(saved,context,i,life,retained){own(saved,['facts','state']);if(!['RESERVED','ACCEPTED'].includes(saved.state))fail('INITIAL_INPUT_CORRUPT');const f=assertOriginalInputFacts(saved.facts);
  let sameInput=f.inputSha256===hash(i);
  // History includes the resolved default. Only a positively accepted, unchanged
  // request may replay that value when the original input omitted modelSelection.
  if(!sameInput&&saved.state==='ACCEPTED'&&retained&&i.modelSelection!==undefined&&same(i.modelSelection,f.modelSelection)){
   assertOriginalInputAcceptance(f,{...retained,selectedClientId:context.selectedClientId});
   const {modelSelection,...originalInput}=i;sameInput=f.inputSha256===hash(originalInput);
  }
  if(!same(f.binding,context.binding)||!same(f.scopes,context.scopes)||!same(f.versions,versions)||f.selectedClientId!==context.selectedClientId||f.requestId!==i.requestId||!sameInput)fail('INITIAL_INPUT_CONFLICT');assertOriginalInputActive(f,now());life.limitDeadline(f.expiresAtMs);return f;
 }
 /** Only the existing store's conditional acknowledgement proves a new original allocation. No run/event/dispatcher is created. */
 async function allocateInput({credential,input,signal}){const i=inputIntent(input);let acknowledged=false;try{return await operation(credential,signal,async(context,life,fresh,authorityExpiry)=>{
  if(context.binding.writerFence!==1)fail('INITIAL_INPUT_CONFLICT');const ports=initialPorts(),saved=await life.run(()=>ports.read(context.binding,life.check));
  const original=saved?pinOriginal(saved,context,i,life):null,allocatedAtMs=original?.allocatedAtMs??now();
  if(!original&&i.modelSelection===undefined&&typeof store.readDefaultModelSelection!=='function')fail('MODEL_SETTINGS_UNAVAILABLE');
  const selected=original?original.modelSelection:available(i.modelSelection??await life.run(()=>store.readDefaultModelSelection(context.binding,life.check)));
  available(selected??HISTORICAL_MODEL_SELECTION);const request=prepareInput(i,new Date(allocatedAtMs).toISOString(),selected);
  await admitPrepared(request,context,life,fresh,credential);await fresh();
  let facts=await prepareOriginalInputFacts({...context,versions,input:i,request,allocatedAtMs,expiresAtMs:original?.expiresAtMs??authorityExpiry()});life.check();await fresh();
  if(!original)facts=assertOriginalInputFacts({...facts,expiresAtMs:Math.min(facts.expiresAtMs,authorityExpiry())});
  const result=bounded(await life.run(()=>ports.claim(facts,life.check)));acknowledged=true;own(result,['allocation','state','created']);const out=originalInputReceipt(result.allocation,result.state,result.created);
  if(!sameOriginalInputIdentity(out.allocation,facts)||saved&&out.created)fail('INITIAL_INPUT_CORRUPT');assertOriginalInputActive(out.allocation,now());life.limitDeadline(out.allocation.expiresAtMs);return out;
 });}catch(error){if(acknowledged)throw new ProductError('INITIAL_INPUT_UNAVAILABLE','UNKNOWN');throw error;}}
 // Admission and submit share the existing immutable acceptance transaction. Only submit may dispatch.
 async function acceptInput({credential,input,signal},dispatch){const i=inputIntent(input);
  return operation(credential,signal,async(context,life,fresh)=>{const b=context.binding;
   const admit=request=>admitPrepared(request,context,life,fresh,credential);
   async function release(saved){if(!same(saved.run.binding,b))fail('STALE_WRITER');if(!same(saved.run.scopes,context.scopes))fail('SCOPE_REFUSED');await fresh();await admit(saved.request);if(dispatch&&saved.run.state==='queued')await life.run(signal=>dispatcher.start({binding:b,signal}));await fresh();await admit(saved.request);return dispatch?{run:saved.run,requestId:i.requestId,lastSequence:saved.lastSequence,replayed:saved.replayed}:assertConversationInputReceipt({run:saved.run,request:saved.request,lastSequence:saved.lastSequence,replayed:saved.replayed},i);}
   if(typeof store.findRequest!=='function')fail('CONTROL_CONFIGURATION');const retained=await life.run(()=>store.findRequest(b,i.requestId,life.check));
   const originalPorts=b.writerFence===1?initialPorts():null,allocation=originalPorts?await life.run(()=>originalPorts.read(b,life.check)):null,original=allocation?pinOriginal(allocation,context,i,life,retained):null;
   if(retained){const selected=i.skill?selectSkill(i.skill.skillId,i.skill.skillVersion):null;if(i.skill)own(i.skill,['skillId','skillVersion']);if(!same(retained.run.scopes,context.scopes))fail('SCOPE_REFUSED');if(!same(retained.run.versions,versions)||retained.request.prompt!==i.prompt||!same(retained.request.siteWorkflow??null,i.siteWorkflow??null)||!same(retained.request.procedure??null,i.procedure??null)||!same(retained.request.work??null,i.work??null)||!same(retained.request.uploads??null,i.uploads??null)||!same(retained.request.documentRevision??null,i.documentRevision??null)||!same(retained.request.windowRequest??null,i.windowRequest??null)||!same(retained.request.skill,selected?.pin??null)||i.modelSelection!==undefined&&!same(i.modelSelection,storedModelSelection(retained.request)))fail('REQUEST_REPLAY_REFUSED');return release(retained);}
   let inherited;
   if(!originalPorts){
    if(typeof store.nextRuns?.readTarget!=='function'||typeof store.nextRuns.accept!=='function')fail('CONTROL_CONFIGURATION');
    const candidate=await life.run(()=>store.nextRuns.readTarget(b,life.check)),reservation=candidate?bounded(candidate):null;
    if(!reservation||!['RESERVED','ACCEPTED'].includes(reservation.state)||!same(reservation.target,b))fail('NEXT_RUN_NOT_RESERVED');
    if(i.modelSelection===undefined){const previous=await life.run(()=>store.read(reservation.source,{after:0,limit:1},life.check));if(!same(previous.run.binding,reservation.source)||!same(previous.run.scopes,context.scopes))fail('NEXT_RUN_SCOPE_REFUSED');inherited=storedModelSelection(previous.request);}
   }
   if(originalPorts&&!original)fail('INITIAL_INPUT_REQUIRED');const selected=original?original.modelSelection:available(i.modelSelection??inherited);available(selected??HISTORICAL_MODEL_SELECTION);
   const createdAt=new Date(original?.allocatedAtMs??now()).toISOString(),request=prepareInput(i,createdAt,selected),run={binding:b,state:'queued',scopes:context.scopes,createdAt,policyRevision:context.scopes[0].policyRevision,versions};
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
 // One saved page under the pinned context. An admitted conversation has no run row until its first input is accepted: that is
 // "no saved turns yet" (404), not corruption.
 async function readPage(c,life,after,limit){const result=typeof store.readOptional==='function'?await life.run(()=>store.readOptional(c.binding,{after,limit},life.check)):await life.run(()=>store.read(c.binding,{after,limit},life.check));if(result===null)fail('NOT_FOUND');if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');return result;}
 async function history({credential,after=0,limit=100,signal}){return operation(credential,signal,(c,life)=>readPage(c,life,after,limit));}
 async function feedbackRead({credential,input,signal}){
  if(typeof store.feedback?.read!=='function')fail('CONVERSATION_UNAVAILABLE');
  return operation(credential,signal,(c,life)=>life.run(()=>store.feedback.read(c,input,life.check)));
 }
 async function feedback({credential,input,signal}){
  if(typeof store.feedback?.record!=='function')fail('CONVERSATION_UNAVAILABLE');
  let acknowledged=false,dispatched=false;
  try{return await operation(credential,signal,async(c,life,fresh)=>{
   await fresh();dispatched=true;const result=await life.run(()=>store.feedback.record(c,input,life.check));acknowledged=true;return result;
  });}catch(error){
   if(acknowledged||dispatched&&['STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','DEADLINE','CANCELLED'].includes(error.code))fail('FEEDBACK_WRITE_UNKNOWN');
   throw error;
  }
 }
 /** Event-stream window until untilMs. Polls read only the store. A page of new events is passed to deliver only after a complete
  * fresh recheck that started after the page was read, as history releases; an idle window also rechecks once idleRecheckMs has
  * passed since the last one, so revocation or suppression ends it. Latency bound: no event is released after a refusal; an idle
  * wait is bounded by the next idle recheck, in addition to the subscription deadline. Returns once the run is terminal and fully
  * delivered, or at untilMs. opened(run), when given, is called once with the first authorized page's run before anything is
  * delivered, so a caller can validate its selector and cursor without a separate history read. */
 async function observe({credential,after=0,untilMs,pollMs,idleRecheckMs,signal,deliver,opened}){
  if(typeof deliver!=='function'||opened!==undefined&&typeof opened!=='function'||![after,untilMs,pollMs,idleRecheckMs].every(Number.isSafeInteger)||after<0||pollMs<1||idleRecheckMs<1)fail('SUBSCRIPTION_CONFIGURATION');
  const begun=now();
  return operation(credential,signal,async(c,life,fresh)=>{let cursor=after,checkedAt=now(),longest=checkedAt-begun,first=true,pollDelay=pollMs;
   // A recheck still running at untilMs ends the window with an error instead of a clean close. One is started only when the
   // longest recheck seen in this window (the opening one included) still fits; otherwise the window closes now, releasing nothing
   // that was not rechecked after its read, and the reconnect resumes from the same cursor.
   const recheck=async()=>{if(untilMs-now()<longest+WINDOW_END_SLACK_MS)return false;const started=now();await fresh();checkedAt=now();longest=Math.max(longest,checkedAt-started);return true;};
   while(now()<untilMs){const page=await readPage(c,life,cursor,OBSERVE_PAGE_EVENTS);
    if(first){first=false;opened?.(page.run);}
    if(page.events.length){if(!await recheck())return;deliver(page.events);cursor=page.events.at(-1).sequence;}
    if(terminal(page.run.state)&&(!page.events.length||cursor===page.lastSequence))return;
    if(page.events.length){pollDelay=pollMs;continue;}
    if(now()-checkedAt>=idleRecheckMs&&!await recheck())return;
    // Never sleep into the window deadline: the lifetime timer enforces the hard cap and, firing first, would turn a clean idle
    // end into an error. The idle window ends WINDOW_END_SLACK_MS early so a late poll timer cannot reach the cap.
    const left=untilMs-now()-WINDOW_END_SLACK_MS;if(left<=0)return;
    // Keep the initial/active poll prompt, then back off empty reads. Access rechecks and cancellation retain their own deadlines.
    await life.run(signal=>delay(Math.min(pollDelay,left,Math.max(1,checkedAt+idleRecheckMs-now())),undefined,{signal}));
    pollDelay=Math.min(pollDelay*2,Math.max(pollMs,OBSERVE_IDLE_POLL_MAX_MS));
   }},{untilMs});}
 async function cancel({credential,signal}){return operation(credential,signal,async(c,life,fresh)=>{const old=await life.run(()=>store.read(c.binding,{after:0,limit:1},life.check));if(!same(old.run.scopes,c.scopes))fail('SCOPE_REFUSED');if(!terminal(old.run.state)){await fresh();const e=event(c.binding,c.scopes,'run.status',{state:'cancelled',reasonCode:'USER_CANCELLED'});await life.run(()=>store.append(c.binding,e,life.check,c.scopes));}await fresh();await life.run(signal=>dispatcher.cancel({binding:c.binding,signal}));return {state:terminal(old.run.state)?old.run.state:'cancelled'};},{cleanup:true});}
 async function loadForExecution({credential,binding,signal},readLifecycle){validateShape('RunBinding',binding);return operation(credential,signal,async(c,life,fresh)=>{
  if(!same(c.binding,binding))fail('STALE_WRITER');
  if(readLifecycle!==undefined){try{assertNativeConversationScope(c);}catch{fail('SCOPE_REFUSED');}}
  const result=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));if(!same(result.run.binding,c.binding))fail('STALE_WRITER');if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');
  if(typeof store.readModelPolicy!=='function')fail('MODEL_SETTINGS_UNAVAILABLE');
  const modelPolicy=await life.run(()=>store.readModelPolicy(binding,life.check));
  const model=resolveSdkModelConfiguration(available(storedModelSelection(result.request)),modelPolicy);
  const lineage=typeof store.nextRuns?.execution==='function'?await life.run(()=>store.nextRuns.execution({binding,scopes:c.scopes,selectedClientId:c.selectedClientId},life.check)):null;
  const budgets=runBudgetPort===undefined?null:runBudgetsOf(await life.run(signal=>runBudgetPort.read.call(runBudgets,{binding,signal})));
  let extra=null;
  if(readLifecycle!==undefined){
   // Keep currentness and retention checks on both sides of the journal read. The second store read preserves
   // the lifecycle wrapper's original run/request snapshot comparison if either record changes mid-load.
   await fresh();extra=await life.run(()=>readLifecycle({binding,scopes:c.scopes,selectedClientId:c.selectedClientId},life.check));await fresh();
   const latest=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
   if(!same(latest.run.binding,result.run.binding)||!same(latest.run.scopes,result.run.scopes)||!same(latest.run.versions,result.run.versions)||!same(latest.request,result.request))fail('SESSION_CHANGED');
  }
  if(extra&&lineage?.nextTurn)fail('EXECUTION_LINEAGE_AMBIGUOUS');
  let documentRevisionContext;
  if(result.request.documentRevision!==undefined){
   if(typeof documentRevisionSource!=='function')fail('DOCUMENT_REVISION_UNAVAILABLE');
   await fresh();documentRevisionContext=await life.run(signal=>documentRevisionSource({binding,selection:result.request.documentRevision,deadlineMs:life.deadline(),signal}));await fresh();
  }
  const uploads=[];if(result.request.uploads!==undefined){if(typeof uploadInputSource?.read!=='function')fail('CONVERSATION_UNAVAILABLE');for(const selection of assertUploadSelections(result.request.uploads)){await fresh();uploads.push(await life.run(signal=>uploadInputSource.read({binding,selection,deadlineMs:life.deadline(),signal})));await fresh();}}
  return {run:result.run,request:result.request,model,...(result.request.uploads===undefined?{}:{uploadSources:uploads}),...(documentRevisionContext===undefined?{}:{documentRevisionContext}),...(lineage??{}),...(budgets===null?{}:{runBudgets:budgets}),...(extra??{})};
 },{release:async(result,life)=>{
  if(capabilityPort===undefined)return result;
  // Resolve only after all model/lineage/journal and final local-authority awaits. No earlier capability set is released.
  if(typeof readCapabilityRole!=='function')fail('CAPABILITY_ROLE_UNKNOWN');
  const role=await life.run(signal=>readCapabilityRole({binding,signal,deadlineMs:life.deadline()}));
  life.limitDeadline(role.expiresAtMs);
  const capabilities=await life.run(signal=>capabilityPort.forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,actorRole:role.actorRole,signal}));
  return {...result,...(capabilities===null?{}:{capabilities})};
 }});}
 async function publish({credential,binding,event,signal}){validateShape('RunBinding',binding);const e=bounded(event);own(e,['eventId','createdAt','type','data']);if(!['run.status','message.delta'].includes(e.type))fail('EVENT_TYPE_REFUSED');return operation(credential,signal,async(c,life)=>{if(!same(c.binding,binding))fail('STALE_WRITER');const result=await life.run(()=>store.append(binding,e,life.check,c.scopes));if(!same(result.scopes,c.scopes))fail('SCOPE_REFUSED');return result;});}
 async function recordUsage({credential,binding,input,signal}){
  validateShape('RunBinding',binding);const value=assertUsageInput(input);
  if(typeof store.recordUsage!=='function'||typeof store.nextRuns?.execution!=='function'||typeof store.lifecycle?.execution!=='function')fail('SDK_USAGE_UNAVAILABLE');
  return operation(credential,signal,async(c,life)=>{
   if(!same(c.binding,binding))fail('STALE_WRITER');
   const context={binding,scopes:c.scopes,selectedClientId:c.selectedClientId};
   // These are the current canonical journal readers, not a caller-supplied parent/session selector.
   const next=await life.run(()=>store.nextRuns.execution(context,life.check)),continued=await life.run(()=>store.lifecycle.execution(context,life.check));
   if(next&&continued)fail('SDK_USAGE_PARENT_REFUSED');
   const lineage=continued?.continuation??(next?.nextTurn?{...next.nextTurn,mode:'resume'}:null);
   return life.run(()=>store.recordUsage({binding,scopes:c.scopes,input:value,lineage},life.check));
  });
 }
 async function publishSelectedOutput({credential,binding,output,signal}){validateShape('RunBinding',binding);if(!selectedOutputPublication)fail('OUTPUT_PUBLICATION_UNAVAILABLE');return operation(credential,signal,async(c,life,fresh)=>{
  if(!same(c.binding,binding))fail('STALE_WRITER');const saved=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));if(!same(saved.run.scopes,c.scopes)||saved.run.state!=='running')fail('RUN_NOT_WRITABLE');
  await fresh();const at=now(),value=bounded(await life.run(signal=>publicationPort.prepareEvent.call(selectedOutputPublication,{binding,request:saved.request,scopes:c.scopes,selectedClientId:c.selectedClientId,output,signal})),2097152);
  own(value,['event','checkedAtMs','expiresAtMs']);const e=own(value.event,['eventId','createdAt','type','data']);if(!['approval.required','artifact.available'].includes(e.type)||!Number.isSafeInteger(value.checkedAtMs)||value.checkedAtMs<at||value.checkedAtMs>now()||!Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs<=now())fail('OUTPUT_PUBLICATION_REFUSED');life.limitDeadline(value.expiresAtMs);
  await fresh();const result=await life.run(()=>store.append(binding,e,life.check,c.scopes));if(!same(result.scopes,c.scopes))fail('SCOPE_REFUSED');await fresh();return result;
 });}
 async function readUploadSource({credential,binding,input,signal}){const q=bounded(input);own(q,['selection','page']);assertUploadSelections([q.selection]);if(!Number.isSafeInteger(q.page)||q.page<0||q.page>255)fail('INVALID_REQUEST');return operation(credential,signal,async(c,life,fresh)=>{
  if(!same(c.binding,binding))fail('STALE_WRITER');const saved=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
  if(!same(saved.run.binding,binding)||!same(saved.run.scopes,c.scopes)||terminal(saved.run.state)||!assertUploadSelections(saved.request.uploads).some(selection=>same(selection,q.selection)))fail('SCOPE_REFUSED');
  if(typeof uploadInputSource?.read!=='function')fail('CONVERSATION_UNAVAILABLE');
  const context={binding,selection:q.selection,page:q.page,scopes:c.scopes};
  const read=()=>life.run(signal=>uploadInputSource.read({binding,selection:q.selection,page:q.page,deadlineMs:life.deadline(),signal}));
  await fresh();const source=await read();await fresh();
  const recorded=await life.run(signal=>captureUploadSource({...context,raw:source,signal,check:life.check}));
  // Publication is an observation, never permission: removal, current revocation or source drift during the write withholds text.
  await fresh();const current=assertSameUploadSource(recorded,await read(),context);await fresh();return current;
 });}
 // A procedure admission answers only for the selection the server itself persisted for this run: the worker route
 // supplies the binding and nothing else. The control owner loads the request, the run's scope/versions and the current
 // execution identity, re-validates the stored union with the existing contract, and re-reads both after Core answers.
async function procedureResolve({credential,binding,signal}){validateShape('RunBinding',binding);if(procedurePort===undefined)fail('PROCEDURE_UNAVAILABLE');return operation(credential,signal,async(c,life,fresh)=>{
 if(!same(c.binding,binding))fail('STALE_WRITER');const saved=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
 if(!same(saved.run.binding,binding)||!same(saved.run.scopes,c.scopes)||terminal(saved.run.state))fail('SCOPE_REFUSED');
 if(saved.request.procedure===undefined)fail('PROCEDURE_SELECTION_ABSENT');const selection=assertProcedureSelection(saved.request.procedure);
 await fresh();
 const admission=bounded(await life.run(signal=>procedurePort.resolve({binding,selection,scopes:c.scopes,versions:saved.run.versions,deadlineMs:life.deadline(),signal})));
 // A run or authority that changed while Core answered releases nothing.
 await fresh();const latest=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
 if(!same(latest.run.binding,saved.run.binding)||!same(latest.run.scopes,saved.run.scopes)||!same(latest.request,saved.request)||terminal(latest.run.state))fail('SESSION_CHANGED');
 return admission;
});}
// Only control's persisted selection is resolved; callers cannot supply a manifest or selector.
async function siteWorkflowResolve({credential,binding,signal}){validateShape('RunBinding',binding);if(siteWorkflowPort===undefined)fail('CONVERSATION_UNAVAILABLE');return operation(credential,signal,async(c,life,fresh)=>{
 if(!same(c.binding,binding))fail('STALE_WRITER');const saved=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
 if(!same(saved.run.binding,binding)||!same(saved.run.scopes,c.scopes)||terminal(saved.run.state))fail('SCOPE_REFUSED');
 if(saved.request.siteWorkflow===undefined)fail('INVALID_REQUEST');const selection=assertSiteWorkflowSelection(saved.request.siteWorkflow);
 await fresh();const current=bounded(await life.run(signal=>siteWorkflowPort.resolve({binding,selection,scopes:c.scopes,versions:saved.run.versions,deadlineMs:life.deadline(),signal})));
 await fresh();const latest=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));
 if(!same(latest.run.binding,saved.run.binding)||!same(latest.run.scopes,saved.run.scopes)||!same(latest.request,saved.request)||terminal(latest.run.state))fail('SESSION_CHANGED');
 return current;
});}
return Object.freeze(Object.defineProperty({submit,admitInput,allocateInput,history,feedback,feedbackRead,observe,cancel,loadForExecution:args=>loadForExecution(args),publish,recordUsage,publishSelectedOutput,readUploadSource,procedureResolve,siteWorkflowResolve},loadWithLifecycle,{value:loadForExecution}));
}
function failError(code){return Object.assign(new Error(code),{code});}
/** Closed run budgets: positive integer calls and per-result bytes, and an optional run aggregate no smaller than one result. */
function runBudgetsOf(value){
 if(value===null)return null;let v;try{v=own(bounded(value),['maxToolCalls','maxOutputBytes'],['maxAggregateOutputBytes']);}catch{fail('RUN_BUDGETS_REFUSED');}
 const positive=n=>Number.isSafeInteger(n)&&n>=1;
 if(!positive(v.maxToolCalls)||!positive(v.maxOutputBytes)||v.maxAggregateOutputBytes!==undefined&&(!positive(v.maxAggregateOutputBytes)||v.maxAggregateOutputBytes<v.maxOutputBytes))fail('RUN_BUDGETS_REFUSED');
 return {maxToolCalls:v.maxToolCalls,maxOutputBytes:v.maxOutputBytes,...(v.maxAggregateOutputBytes===undefined?{}:{maxAggregateOutputBytes:v.maxAggregateOutputBytes})};
}

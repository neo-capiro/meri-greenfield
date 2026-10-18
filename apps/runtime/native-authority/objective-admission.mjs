/** Objective-origin original admission (D7-4 runs port, control side). Identity comes from the immutable run-start record
 * (run-starts.mjs): the derived binding, Core's request ID and published prompt. Authority comes only from the required
 * trusted Core port `authority.authorize` (the job's current claim, consent and tenant/actor/client membership; a Core
 * prerequisite with no Meri substitute). It reuses the canonical original-binding journal and the conversation store's
 * initial-input claim/accept, exactly like schedule-origin admission (scheduled-admission.mjs), so an accepted Objective run
 * satisfies native initial-run eligibility and is prepared by the same dynamic-initial-run path. No issuer, session
 * substitute, schema, worker or retry loop lives here; a failed acknowledgement is recovered by repeating the same admit. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {prepareOriginalInputFacts} from '../../control/conversations/initial-input-facts.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';
import {assertObjectiveRunStartRecord,objectiveRunIdentity,objectiveAcceptedRequest} from '../objective-source/run-starts.mjs';

const errors=new WeakSet(),same=(a,b)=>hash(a)===hash(b),integer=v=>Number.isSafeInteger(v)&&v>=0;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
function fault(code){const e=Object.assign(Error(`OBJECTIVE_ADMISSION_${code}`),{code:`OBJECTIVE_ADMISSION_${code}`});errors.add(e);return e;}
const fail=code=>{throw fault(code);};
function closed(value,keys,code){try{return own(value,keys);}catch{fail(code);}}

/** template: the control's own prepared-candidate facts every dynamic initial run must carry (versions, qualification
 * policy revision, bindings configuration digest, run window). Never request data. */
export function createObjectiveNativeAdmission(options){
 let pool,claimInput,acceptInput,readOptional,authorize,t,now,maxRequestMs;
 try{
  const o=own(options,['pool','store','authority','template'],['now','maxRequestMs']);
  pool=Object.freeze({connect:sdkMethod(o.pool,'connect')});
  if(!o.store||types.isProxy(o.store))fail('CONFIGURATION');
  const initial=Object.getOwnPropertyDescriptor(o.store,'initialInputs');
  if(!initial||!Object.hasOwn(initial,'value'))fail('CONFIGURATION');
  claimInput=sdkMethod(initial.value,'claim');acceptInput=sdkMethod(initial.value,'accept');readOptional=sdkMethod(o.store,'readOptional');authorize=sdkMethod(o.authority,'authorize');
  t=data(own(o.template,['versions','policyRevision','configurationSha256','runWindowMs']));validateShape('RuntimeVersions',t.versions);
  if(typeof t.policyRevision!=='string'||!t.policyRevision||t.policyRevision.length>256||!digest(t.configurationSha256)||!integer(t.runWindowMs)||t.runWindowMs<1)fail('CONFIGURATION');
  now=o.now??Date.now;maxRequestMs=o.maxRequestMs??10000;
  if(typeof now!=='function'||!integer(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 }catch{throw fault('CONFIGURATION');}

 function request(raw){
  const v=own(raw,['record'],['signal','deadlineMs']);nativeSignal(v.signal);
  let record;try{record=assertObjectiveRunStartRecord(v.record);}catch{fail('REQUEST');}
  const b=record.binding,identity=objectiveRunIdentity({tenantId:b.tenantId,actorId:b.actorId,generationJobId:record.generationJobId});
  if(!same(identity.binding,b))fail('REQUEST');
  const accepted=objectiveAcceptedRequest(record.selection);if(hash(accepted)!==record.sourceRequestSha256)fail('REQUEST');
  const clientId=record.selection.sourceAdmission.canonical.clientId,scopes=data([{tenantId:b.tenantId,kind:'client',resourceId:clientId,policyRevision:t.policyRevision}]);
  validateShape('Scope',scopes[0]);
  if(v.deadlineMs!==undefined&&!integer(v.deadlineMs))fail('REQUEST');
  return {record,identity,accepted,clientId,scopes,signal:v.signal,deadlineMs:v.deadlineMs};
 }
 async function proof(c,phase,expiresAtMs){
  const b=c.record.binding,selection=data({phase,generationJobId:c.record.generationJobId,binding:b,sourceAdmissionSha256:c.record.sourceAdmissionSha256,
   sourceRequestSha256:c.record.sourceRequestSha256,typedRequestSha256:c.record.typedRequestSha256,runStartSha256:hash(c.record),scopes:c.scopes,
   selectedClientId:c.clientId,policyRevision:t.policyRevision,versions:t.versions,configurationSha256:t.configurationSha256,expiresAtMs});
  const selectionSha256=hash(selection),before=now();
  const r=data(await c.life.run(signal=>authorize({phase,selection,selectionSha256,signal,deadlineMs:c.deadlineMs})));
  closed(r,['authorized','selectionSha256','binding','scopes','selectedClientId','policyRevision','configurationSha256','checkedAtMs','expiresAtMs'],'AUTHORITY');
  if(r.authorized!==true||r.selectionSha256!==selectionSha256||!same(r.binding,b)||!same(r.scopes,c.scopes)||r.selectedClientId!==c.clientId||
   r.policyRevision!==t.policyRevision||r.configurationSha256!==t.configurationSha256||!integer(r.checkedAtMs)||r.checkedAtMs<before||r.checkedAtMs>now()||
   !integer(r.expiresAtMs)||r.expiresAtMs<=now())fail('AUTHORITY');
  c.limit(r.expiresAtMs);return r.expiresAtMs;
 }
 function bindingRecord(c,r){
  closed(r,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs'],'BINDING');
  if(r.schemaVersion!==1||r.state!=='ADMITTED'||!same(r.binding,c.record.binding)||r.selectedClientId!==c.clientId||r.policyRevision!==t.policyRevision||
   !same(r.versions,t.versions)||r.configurationSha256!==t.configurationSha256||!integer(r.createdAtMs)||r.createdAtMs<1||r.createdAtMs>now()||!integer(r.expiresAtMs)||
   r.expiresAtMs<=now()||r.expiresAtMs<=r.createdAtMs||r.expiresAtMs>Math.min(r.createdAtMs+t.runWindowMs,c.record.effectExpiresAtMs))fail('BINDING');
  return r;
 }
 return Object.freeze({async admit(raw){
  let life;
  try{
   const c=request(raw),at=now();c.deadlineMs=Math.min(c.deadlineMs??at+maxRequestMs,at+maxRequestMs);
   life=c.life=createOperationLifetime({now,deadlineMs:c.deadlineMs,signal:c.signal,errorFactory:code=>fault(code)});
   c.limit=ms=>{life.limitDeadline(ms);c.deadlineMs=Math.min(c.deadlineMs,ms);};
   const b=c.record.binding;
   // The derived run/attempt/worker IDs are the only identities the canonical journal may mint for this conversation.
   const ids=[b.runId,b.attemptId,b.workerId];let cursor=0;
   const journal=createInitialRunBindingJournal({pool,now,newId:()=>{if(cursor>=ids.length)fail('IDENTITY');return ids[cursor++];}});
   const old=await life.run(()=>journal.read({binding:b},life.check));
   if(old!==null)bindingRecord(c,old);
   let expiresAtMs=old?.expiresAtMs??Math.min(now()+t.runWindowMs,c.record.effectExpiresAtMs);
   if(expiresAtMs<=now())fail('EXPIRED');
   const authorizedUntil=await proof(c,'before_claim',expiresAtMs);
   if(old&&authorizedUntil<expiresAtMs)fail('AUTHORITY');expiresAtMs=Math.min(expiresAtMs,authorizedUntil);
   const claimed=data(await life.run(()=>journal.claim({principal:{tenantId:b.tenantId,actorId:b.actorId},conversationId:b.conversationId,
    selectedClientId:c.clientId,policyRevision:t.policyRevision,versions:t.versions,configurationSha256:t.configurationSha256,proposedExpiresAtMs:expiresAtMs},life.check)));
   closed(claimed,['record','created'],'BINDING');if(typeof claimed.created!=='boolean')fail('BINDING');
   const saved=bindingRecord(c,claimed.record);if(saved.expiresAtMs>expiresAtMs||old&&!same(old,saved))fail('BINDING');c.limit(saved.expiresAtMs);
   const createdAt=new Date(saved.createdAtMs).toISOString(),run={binding:b,state:'queued',scopes:c.scopes,createdAt,policyRevision:t.policyRevision,versions:t.versions};
   const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:c.scopes,createdAt,policyRevision:t.policyRevision};
   const event={contractVersion:'0.1.0',eventId:c.identity.eventId,binding:b,sequence:1,createdAt,scopes:c.scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
   validateShape('Conversation',conversation);validateShape('Run',run);validateShape('UIEvent',event);
   const facts=await life.run(()=>prepareOriginalInputFacts({binding:b,scopes:c.scopes,versions:t.versions,selectedClientId:c.clientId,
    input:{requestId:c.accepted.requestId,prompt:c.accepted.prompt},request:c.accepted,allocatedAtMs:saved.createdAtMs,expiresAtMs:saved.expiresAtMs}));
   if(facts.requestSha256!==c.record.sourceRequestSha256)fail('INPUT');
   const reserved=data(await life.run(()=>claimInput(facts,life.check)));closed(reserved,['allocation','state','created'],'INPUT');
   if(!same(reserved.allocation,facts)||!['RESERVED','ACCEPTED'].includes(reserved.state)||typeof reserved.created!=='boolean'||reserved.created&&reserved.state!=='RESERVED')fail('INPUT');
   if(await proof(c,'before_accept',saved.expiresAtMs)<saved.expiresAtMs)fail('AUTHORITY');
   const accepted=data(await life.run(()=>acceptInput({conversation,run,request:c.accepted,event,selectedClientId:c.clientId},life.check)));
   closed(accepted,['run','request','lastSequence','replayed'],'INPUT');
   if(!same(accepted.run.binding,b)||!same(accepted.request,c.accepted)||!same(accepted.run.versions,t.versions)||!same(accepted.run.scopes,c.scopes)||
    accepted.run.createdAt!==createdAt||typeof accepted.replayed!=='boolean'||!integer(accepted.lastSequence)||accepted.lastSequence<1)fail('INPUT');
   const back=await life.run(()=>readOptional(b,{after:0,limit:1},life.check));
   if(!back||!same(back.run,accepted.run)||!same(back.request,c.accepted))fail('INPUT');
   if(await proof(c,'before_release',saved.expiresAtMs)<saved.expiresAtMs)fail('AUTHORITY');life.check();
   return data({binding:b,requestSha256:facts.requestSha256,expiresAtMs:saved.expiresAtMs,replayed:accepted.replayed});
  }catch(e){throw errors.has(e)?e:fault('UNKNOWN');}
  finally{life?.close();}
 }});
}

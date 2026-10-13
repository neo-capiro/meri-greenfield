/** Authenticated request/history control; policy remains in existing session owners. */
import {randomUUID} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {resolveWindow} from '../../../packages/window-resolution/index.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {assertSkillManifest,validateShape as retrievalShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,bounded,same,hash,fail,uuid,validateShape,terminal} from './boundary.mjs';
export function createConversationService({sessions,store,dispatcher,versions,fiscalCalendars=[],now=Date.now,newId=randomUUID,maxRequestMs=3000}){
 validateShape('RuntimeVersions',versions);versions=bounded(versions);fiscalCalendars=bounded(fiscalCalendars);if(['authenticateSession','readCurrentState'].some(k=>typeof sessions?.[k]!=='function')||['accept','append','read'].some(k=>typeof store?.[k]!=='function')||['start','cancel'].some(k=>typeof dispatcher?.[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONTROL_CONFIGURATION');
 async function operation(credential,signal,body){if(typeof credential!=='string'||!credential||credential.length>8192)fail('SESSION_REFUSED');const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:failError});let pinned;
  async function fresh(){const started=now();const authentication=bounded(await life.run(signal=>sessions.authenticateSession({credential,signal,deadlineMs:started+maxRequestMs})));const current=bounded(await life.run(signal=>sessions.readCurrentState({authentication,signal,deadlineMs:started+maxRequestMs})));
   if(current.authenticationSha256!==hash(authentication)||authentication.principal?.tenantId!==current.binding?.tenantId||authentication.principal?.actorId!==current.binding?.actorId||authentication.principal?.conversationId!==current.binding?.conversationId||authentication.principal?.runId!==current.binding?.runId)fail('SESSION_REFUSED');validateShape('RunBinding',current.binding);if(!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)fail('SCOPE_REFUSED');
   for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==current.binding.tenantId)fail('SCOPE_REFUSED');}if(new Set(current.scopes.map(hash)).size!==current.scopes.length||new Set(current.scopes.map(s=>s.policyRevision)).size!==1)fail('SCOPE_REFUSED');
   const at=now();for(const receipt of [authentication,current])if(!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=at)fail('SESSION_REFUSED');life.limitDeadline(Math.min(authentication.expiresAtMs,current.expiresAtMs));
   const selected=bounded({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});if(pinned&&!same(pinned,selected))fail('SESSION_CHANGED');pinned??=selected;life.check();return pinned;
  }
  try{const context=await fresh();const result=await body(context,life,fresh);await fresh();life.check();return result;}finally{life.close();}
 }
 const event=(binding,scopes,type,data)=>({contractVersion:'0.1.0',eventId:newId(),binding,sequence:1,createdAt:new Date(now()).toISOString(),scopes,type,data});
 async function submit({credential,input,signal}){const i=bounded(input);own(i,['requestId','prompt'],['skill','windowRequest']);uuid(i.requestId);if(typeof i.prompt!=='string'||!i.prompt.trim()||i.prompt.length>100000)fail('INVALID_REQUEST');
  return operation(credential,signal,async(context,life,fresh)=>{const b=context.binding,createdAt=new Date(now()).toISOString();let skill=null,window=null;
   if(i.windowRequest)window=resolveWindow(i.windowRequest,{referenceAt:createdAt,fiscalCalendars});
   if(i.skill){own(i.skill,['skillId','skillVersion']);const selected=selectSkill(i.skill.skillId,i.skill.skillVersion);assertSkillManifest(selected.manifest,catalog);if(!window)fail('SKILL_WINDOW_REQUIRED');if(!selected.manifest.subjectKinds.includes('client')||!selected.manifest.windowBases.includes(window.basis))fail('SKILL_SCOPE_REFUSED');skill=selected.pin;}
   if(window)retrievalShape('NormalizedWindow',window);
   const request={requestId:i.requestId,prompt:i.prompt,skill,window};const run={binding:b,state:'queued',scopes:context.scopes,createdAt,policyRevision:context.scopes[0].policyRevision,versions};
   const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:context.scopes,createdAt,policyRevision:run.policyRevision};
   const saved=await life.run(()=>store.accept({conversation,run,request,event:event(b,context.scopes,'run.status',{state:'queued',reasonCode:null})},life.check));await fresh();
   // Durable request precedes Temporal start. A repeated submission recovers a lost start acknowledgement using the exact workflow ID.
   if(saved.run.state==='queued')await life.run(signal=>dispatcher.start({binding:b,signal}));await fresh();return {run:saved.run,requestId:i.requestId,lastSequence:saved.lastSequence,replayed:saved.replayed};});
 }
 async function history({credential,after=0,limit=100,signal}){return operation(credential,signal,async(c,life)=>{const result=await life.run(()=>store.read(c.binding,{after,limit},life.check));if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');return result;});}
 async function cancel({credential,signal}){return operation(credential,signal,async(c,life,fresh)=>{const old=await life.run(()=>store.read(c.binding,{after:0,limit:1},life.check));if(!same(old.run.scopes,c.scopes))fail('SCOPE_REFUSED');if(!terminal(old.run.state)){await fresh();const e=event(c.binding,c.scopes,'run.status',{state:'cancelled',reasonCode:'USER_CANCELLED'});await life.run(()=>store.append(c.binding,e,life.check));}await fresh();await life.run(signal=>dispatcher.cancel({binding:c.binding,signal}));return {state:terminal(old.run.state)?old.run.state:'cancelled'};});}
 async function loadForExecution({credential,binding,signal}){validateShape('RunBinding',binding);return operation(credential,signal,async(c,life)=>{if(!same(c.binding,binding))fail('STALE_WRITER');const result=await life.run(()=>store.read(binding,{after:0,limit:1},life.check));if(!same(result.run.scopes,c.scopes))fail('SCOPE_REFUSED');return {run:result.run,request:result.request};});}
 async function publish({credential,binding,event,signal}){validateShape('RunBinding',binding);const e=bounded(event);own(e,['eventId','createdAt','type','data']);if(!['run.status','message.delta'].includes(e.type))fail('EVENT_TYPE_REFUSED');return operation(credential,signal,async(c,life)=>{if(!same(c.binding,binding))fail('STALE_WRITER');const result=await life.run(()=>store.append(binding,e,life.check));if(!same(result.scopes,c.scopes))fail('SCOPE_REFUSED');return result;});}
 return Object.freeze({submit,history,cancel,loadForExecution,publish});
}
function failError(code){return Object.assign(new Error(code),{code});}

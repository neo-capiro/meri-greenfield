/** Control-side owner behind the routine occurrence native operations (routines-occurrence-http.mjs), and the admission's
 * current-policy port for ONE occurrence over the unattended firing authority.
 *
 * `createOccurrenceConsentAuthority` is the `authority` scheduled-admission.mjs requires (`authorize({phase, selection,
 * selectionSha256})` at before_claim / before_accept / before_release, answering the exact nine-member receipt). Every phase is a
 * fresh Core answer: the routine owner's consent for exactly this occurrence (routines-firing-authority.mjs: Meri's own schedule
 * fence first, then Core's wire C `before_admission` grant verified against the pinned key, with the lease ≤ 30 s inside a consent
 * ≤ 30 days). The receipt echoes nothing from the request: its binding is derived from the occurrence, its scopes are the grant's
 * (which must equal the selection's exactly), its client/policy/configuration are the candidate's own template facts. A Core 403
 * (no consent, paused, deleted, membership or scope change) is a closed denial, which the admission refuses as AUTHORITY (evidence);
 * an unavailable Core throws (no evidence, admission UNKNOWN). Nothing is cached or renewed.
 *
 * `createRoutinesOccurrenceOwner` answers the two operations with closed replies:
 *  admit   the occurrence must belong to this control's candidate principal (refused FOREIGN before Core is asked), then the
 *          per-occurrence admission runs (replay answers `replayed:true` with the original window);
 *  retire  Meri's own custody first (the binding's conversation must be a scheduled occurrence of this principal:
 *          scheduleOwner.readOccurrenceForConversation, never request data alone), then the candidate's initial-run retirement
 *          (prepared-run-bindings.mjs retireInitial), which re-proves the physical stop from the sealed allocation and issuance rows.
 * A typed refusal (a code in the dispatch owner's grammar) is carried as `{refused:{code}}`; anything untyped is UNAVAILABLE. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';
import {ROUTINES_OCCURRENCE_CODE} from './routines-occurrence-http.mjs';

const HEX64=/^[a-f0-9]{64}$/u,same=(a,b)=>hash(a)===hash(b);
const fault=code=>Object.assign(Error('ROUTINES_OCCURRENCE_'+code),{code:'ROUTINES_OCCURRENCE_'+code});
const refuse=code=>{throw fault(code);};
/** The admission's three proof phases, all covered by one Core purpose: the occurrence's `before_admission` grant. */
export const ADMISSION_PHASES=Object.freeze(['before_claim','before_accept','before_release']);
const SELECTION_KEYS=['phase','occurrenceKey','binding','intentSha256','effectSha256','requestSha256','configurationSha256','allocationSha256','scopes','selectedClientId','policyRevision','versions','task','destinationId','expiresAtMs'];
const sortedScopes=scopes=>scopes.map(hash).sort();

export function createOccurrenceConsentAuthority(options){
 let authorize,occ,id,t,now;
 try{
  const o=own(options,['firing','template','occurrence','occurrenceKey'],['now']);
  authorize=sdkMethod(o.firing,'authorize');occ=snapshotOccurrence(o.occurrence);id=occurrenceIdentity(occ);now=o.now??Date.now;
  // The whole scheduled-run template (scheduled-admission.mjs validates it); the receipt needs these three facts of it.
  const {selectedClientId,policyRevision,configurationSha256}=own(o.template,['principal','selectedClientId','policyRevision','versions','task','configurationSha256','allocationJson','runWindowMs','destinationId']);
  t=data({selectedClientId,policyRevision,configurationSha256});
  if(o.occurrenceKey!==id.occurrenceKey||typeof t.selectedClientId!=='string'||typeof t.policyRevision!=='string'||!HEX64.test(t.configurationSha256)||typeof now!=='function'||types.isProxy(now))throw Error();
 }catch{throw fault('CONFIGURATION');}
 const owner={tenantId:id.binding.tenantId,actorId:id.binding.actorId};
 async function authorizePhase(value){
  let v,s;
  try{
   v=own(value,['phase','selection','selectionSha256'],['signal','deadlineMs']);nativeSignal(v.signal);
   s=data(own(v.selection,SELECTION_KEYS));validateShape('RunBinding',s.binding);
  }catch{refuse('REQUEST');}
  if(!ADMISSION_PHASES.includes(v.phase)||s.phase!==v.phase||v.selectionSha256!==hash(s)||s.occurrenceKey!==id.occurrenceKey||!same(s.binding,id.binding)||
   s.selectedClientId!==t.selectedClientId||s.policyRevision!==t.policyRevision||s.configurationSha256!==t.configurationSha256||!Array.isArray(s.scopes)||!s.scopes.length)refuse('REQUEST');
  const r=data(await authorize({phase:'before_admission',occurrence:id.identity,occurrenceKey:id.occurrenceKey,projection:occ.projection,...(v.signal===undefined?{}:{signal:v.signal})}));
  const receipt=(authorized,scopes,checkedAtMs,expiresAtMs)=>data({authorized,selectionSha256:v.selectionSha256,binding:id.binding,scopes,selectedClientId:t.selectedClientId,policyRevision:t.policyRevision,configurationSha256:t.configurationSha256,checkedAtMs,expiresAtMs});
  // The three-field denial is evidence: the admission refuses it as AUTHORITY without any effect.
  if(r?.authorized===false&&r.occurrenceKey===id.occurrenceKey&&Object.keys(r).length===3&&typeof r.code==='string'){const at=now();return receipt(false,s.scopes,at,at);}
  let k;try{k=own(r,['authorized','occurrenceKey','owner','scopes','checkedAtMs','expiresAtMs']);}catch{refuse('AUTHORITY');}
  if(k.authorized!==true||k.occurrenceKey!==id.occurrenceKey||!same(k.owner,owner)||!Array.isArray(k.scopes)||!k.scopes.length||k.scopes.length>100||
   !same(sortedScopes(k.scopes),sortedScopes(s.scopes))||!k.scopes.some(scope=>scope?.kind==='client'&&scope.resourceId===t.selectedClientId)||k.scopes.some(scope=>scope?.policyRevision!==t.policyRevision)||
   !Number.isSafeInteger(k.checkedAtMs)||!Number.isSafeInteger(k.expiresAtMs)||k.expiresAtMs<=k.checkedAtMs)refuse('AUTHORITY');
  return receipt(true,k.scopes,k.checkedAtMs,k.expiresAtMs);
 }
 return Object.freeze({authorize:authorizePhase});
}

const typedCode=error=>{const d=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'code'):null;const code=d&&Object.hasOwn(d,'value')?d.value:null;return typeof code==='string'&&ROUTINES_OCCURRENCE_CODE.test(code)?code:null;};
const refused=code=>data({refused:{code:'ROUTINES_OCCURRENCE_'+code}});

export function createRoutinesOccurrenceOwner(options){
 let admissionFor,retire,readOccurrence,principal,now,maxRequestMs;
 try{
  const o=own(options,['admissionFor','retirement','scheduleOwner','principal'],['now','maxRequestMs']);
  admissionFor=o.admissionFor;if(typeof admissionFor!=='function'||types.isProxy(admissionFor))throw Error();
  retire=storageMethod(o.retirement,'retire');readOccurrence=sdkMethod(o.scheduleOwner,'readOccurrenceForConversation');
  principal=data(own(o.principal,['tenantId','actorId']));validateShape('Identity',principal);
  now=o.now??Date.now;maxRequestMs=o.maxRequestMs??10000;
  if(typeof now!=='function'||types.isProxy(now)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error();
 }catch{throw fault('CONFIGURATION');}
 /** Carry the owner's typed refusal; anything else (open shapes, private failures) is no evidence. */
 const carried=error=>{const code=typedCode(error);if(code===null||code==='ROUTINES_OCCURRENCE_UNAVAILABLE'||code==='ROUTINES_OCCURRENCE_DEADLINE'||code==='ROUTINES_OCCURRENCE_CANCELLED')throw fault('UNAVAILABLE');return data({refused:{code}});};
 async function admit(value){
  let v,occ,id;
  try{v=own(value,['occurrence','occurrenceKey','effect','input'],['signal']);nativeSignal(v.signal);occ=snapshotOccurrence(v.occurrence);id=occurrenceIdentity(occ);}catch{return refused('REQUEST');}
  if(v.occurrenceKey!==id.occurrenceKey)return refused('REQUEST');
  // Only this control's candidate principal is admitted here; a foreign owner's occurrence is refused before Core is asked.
  if(!same(occ.projection.owner,principal))return refused('FOREIGN');
  let admission;try{admission=storageMethod(admissionFor(occ,id.occurrenceKey),'admit');}catch{throw fault('UNAVAILABLE');}
  try{
   const r=data(await admission({occurrence:occ,occurrenceKey:id.occurrenceKey,effect:data(v.effect),input:data(v.input),...(v.signal===undefined?{}:{signal:v.signal}),deadlineMs:now()+maxRequestMs}));
   own(r,['binding','requestSha256','expiresAtMs','replayed']);
   if(!same(r.binding,id.binding)||typeof r.requestSha256!=='string'||!HEX64.test(r.requestSha256)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<1||typeof r.replayed!=='boolean')throw fault('UNAVAILABLE');
   return data({admitted:{binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs,replayed:r.replayed}});
  }catch(error){return carried(error);}
 }
 async function retireRun(value){
  let v,binding;
  try{v=own(value,['binding'],['signal']);nativeSignal(v.signal);binding=data(v.binding);validateShape('RunBinding',binding);}catch{return refused('REQUEST');}
  if(binding.tenantId!==principal.tenantId||binding.actorId!==principal.actorId)return refused('FOREIGN');
  const at=now(),deadlineMs=at+maxRequestMs,life=createOperationLifetime({now,signal:v.signal,deadlineMs,errorFactory:code=>fault(code)});
  try{
   // Meri's own custody first: a run that is not a scheduled occurrence of this owner is never retired through this operation.
   const record=data(await life.run(()=>readOccurrence({tenantId:binding.tenantId,conversationId:binding.conversationId},life.check)));
   const origin=record?.effect?.binding,p=record?.occurrence?.projection;
   if(record===null||!origin||!p||!same(p.owner,principal)||origin.tenantId!==binding.tenantId||origin.actorId!==binding.actorId||origin.conversationId!==binding.conversationId)return refused('NOT_SCHEDULED');
   const r=data(await life.run(signal=>retire({binding,signal,deadlineMs})));life.check();
   if(r?.physicalStopProven!==true)throw fault('UNAVAILABLE');
   return data({retired:{physicalStopProven:true}});
  }catch(error){return carried(error);}
  finally{life.close();}
 }
 return Object.freeze({admit,retire:retireRun});
}

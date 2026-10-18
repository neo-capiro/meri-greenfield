/** Read-only restriction for one canonical scheduled job. This supplies no policy, grants, writes or new lineage.
 * Fresh issuance alone uses this resolver; historical retirement must reconstruct its already-sealed allocation. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {assertOccurrenceCostScope} from '../../gateway/budget/occurrence-cost-scope.mjs';
import {createScheduledJobLineage,snapshotScheduledJobSelection} from '../../control/schedules/scheduled-job-lineage.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';

const same=(a,b)=>hash(a)===hash(b),integer=v=>Number.isSafeInteger(v)&&v>0;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const errors=new WeakSet();
const fault=code=>{const e=Object.assign(Error('SCHEDULE_RUN_PROFILE_'+code),{code:'SCHEDULE_RUN_PROFILE_'+code});errors.add(e);return e;};
const fail=code=>{throw fault(code);};
function facet(object,name){
 if(!object||typeof object!=='object'||types.isProxy(object))fail('CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(object,name);
 if(!d||!Object.hasOwn(d,'value'))fail('CONFIGURATION');return d.value;
}

export function createScheduledRunProfile(configuration){
 let c,a,read,lineage,task;
 try{
  c=own(configuration,['scheduleOwner','store','task','selectedClientId','allocationJson','maxCostMicroUSD','now'],['maxRequestMs']);
  a=allocation(c.allocationJson);task=data(own(c.task,['taskId','manifestSha256','version']));
  if(typeof task.taskId!=='string'||!uuid.test(task.taskId)||!integer(task.version)||task.manifestSha256!==a.manifestSha256||
   typeof c.selectedClientId!=='string'||!uuid.test(c.selectedClientId)||
   !integer(c.maxCostMicroUSD)||typeof c.now!=='function')fail('CONFIGURATION');
  c.maxRequestMs??=10000;if(!integer(c.maxRequestMs)||c.maxRequestMs>30000)fail('CONFIGURATION');
  read=sdkMethod(c.scheduleOwner,'readOccurrenceForConversation');
  // Capture data facets without evaluating caller accessors. The canonical helper remains the only lineage owner.
  lineage=createScheduledJobLineage({store:{readOptional:sdkMethod(c.store,'readOptional'),initialInputs:facet(c.store,'initialInputs'),
   nextRuns:facet(c.store,'nextRuns'),lifecycle:facet(c.store,'lifecycle')}});
 }catch{throw fault('CONFIGURATION');}

 function request(raw){
  const q=own(raw,['binding','scopes','expiresAtMs','deadlineMs'],['signal']);nativeSignal(q.signal);
  q.binding=data(q.binding);q.scopes=data(q.scopes);validateShape('RunBinding',q.binding);
  if(!Array.isArray(q.scopes)||!q.scopes.length||q.scopes.length>100||!integer(q.expiresAtMs)||!integer(q.deadlineMs))fail('REQUEST');
  q.scopes.forEach(s=>validateShape('Scope',s));
  return q;
 }
 function origin(raw,q){
  const r=data(own(raw,['occurrenceKey','scheduleId','occurrence','effect','effectSha256','state']));
  const s=snapshotScheduledJobSelection({occurrence:r.occurrence,effect:r.effect}),p=s.occurrence.projection,b=q.binding;
  if(r.state!=='OPEN'||r.occurrenceKey!==s.identity.occurrenceKey||r.scheduleId!==p.scheduleId||r.effectSha256!==hash(s.effect)||
   !same(p.owner,{tenantId:b.tenantId,actorId:b.actorId})||b.tenantId!==a.run.tenantId||b.actorId!==a.run.actorId||
   s.effect.binding.conversationId!==b.conversationId||!same(s.occurrence.task,task)||!same(p.scopes,q.scopes)||
   !q.scopes.some(v=>v.kind==='client'&&v.resourceId===c.selectedClientId))fail('ORIGIN');
  return {r,s};
 }
 function restrict(selection,l,q){
  const p=selection.s.occurrence.projection;
  if(l.occupiedReason!==null||!same(l.originBinding,selection.s.effect.binding)||!same(l.currentBinding,q.binding)||
   l.selectedClientId!==c.selectedClientId||!same(l.scopes,q.scopes)||!l.run||!same(l.run.binding,q.binding)||
   !['queued','starting','running'].includes(l.run.state)||!Number.isSafeInteger(l.allocatedAtMs)||l.allocatedAtMs<0||
   !integer(l.expiresAtMs)||l.expiresAtMs<=l.allocatedAtMs)fail('LINEAGE');
  const runtimeEnd=l.allocatedAtMs+p.maxRuntimeSeconds*1000;
  if(!Number.isSafeInteger(runtimeEnd))fail('EXPIRY');
  const expiresAtMs=Math.min(q.expiresAtMs,l.expiresAtMs,runtimeEnd,Date.parse(a.schedule.expiresAt));
  if(c.now()<l.allocatedAtMs||c.now()>=expiresAtMs)fail('EXPIRY');
  // The group cap is immutable approved occurrence data, independent of a narrower per-run configured profile.
  const run=Object.fromEntries(Object.keys(a.run).map(k=>[k,q.binding[k]]));
  const occurrenceCostScope=assertOccurrenceCostScope({version:1,kind:'schedule-occurrence',occurrenceKey:selection.r.occurrenceKey,
   originBinding:l.originBinding,maxCostMicroUSD:p.maxCostMicrousd},run);
  if(Object.hasOwn(a,'occurrenceCostScope')&&!same(a.occurrenceCostScope,occurrenceCostScope))fail('SCOPE');
  const allocationJson=JSON.stringify({...a,run,occurrenceCostScope}),sealed=allocation(allocationJson);
  return data({allocationJson,allocationSha256:hash(sealed),maxCostMicroUSD:Math.min(c.maxCostMicroUSD,a.budgets.maxCostMicroUSD,p.maxCostMicrousd),expiresAtMs,occurrenceCostScope});
 }
 return Object.freeze({async read(raw){
  let life;
  try{
   const q=request(raw),at=c.now();
   life=createOperationLifetime({now:c.now,deadlineMs:Math.min(q.deadlineMs,at+c.maxRequestMs),signal:q.signal,errorFactory:fault});
   const lookup=()=>life.run(()=>read({tenantId:q.binding.tenantId,conversationId:q.binding.conversationId},life.check));
   const first=await lookup();
   if(first===null){
    if(Object.hasOwn(a,'occurrenceCostScope')||await lookup()!==null)fail('ORIGIN');life.check();return null;
   }
   const selected=origin(first,q),selection={occurrence:selected.s.occurrence,effect:selected.s.effect};
   const before=await life.run(()=>lineage.read(selection,life.check));
   const result=restrict(selected,before,q);life.limitDeadline(result.expiresAtMs);
   const after=await life.run(()=>lineage.read(selection,life.check)),last=await lookup();
   if(!same(before,after)||!same(selected.r,last))fail('CHANGED');
   origin(last,q);restrict(selected,after,q);life.check();return result;
  }catch(error){throw errors.has(error)?error:fault('REFUSED');}finally{life?.close();}
 }});
}

/** Instruction custody for the existing scheduled-dispatch read port. PREPARED is retained text, never approval or firing
 * authority: only the schedule owner's current ACKNOWLEDGED intent binds that text to a generation. A second owner read fences
 * changes during lookup. The caller still supplies the original owner's fresh firing authority to scheduled-dispatch.
 *
 * `preparations` is a separate read-only facet, not an extra method on the closed {claim,settle} intent-journal store:
 * readPreparedSchedule({tenantId,proposalId,intentSha256,signal}) -> null or {key,record,state,outcome}, with original journal key,
 * record, PREPARED state, and canonical {result:{status:'approval_required',proposal},release:{binding,scopes,expiresAtMs}}.
 * The canonical PostgreSQL lookup remains an integration prerequisite; this module never queries or owns its table. */
import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {validateShape as validateToolShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertScheduleIntent,canonicalSha256,frozenScheduleData} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';

const ownedErrors=new WeakSet(),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu,sha=/^[a-f0-9]{64}$/u;
function fault(code){const error=Object.assign(Error(`SCHEDULE_INSTRUCTION_${code}`),{code:`SCHEDULE_INSTRUCTION_${code}`});ownedErrors.add(error);return error;}
const fail=code=>{throw fault(code);},same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
function closed(value,keys,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(code);
 return value;
}
function scopes(value,tenantId){
 if(!Array.isArray(value)||value.length<1||value.length>100)fail('CUSTODY');
 for(const scope of value){validateShape('Scope',scope);if(scope.tenantId!==tenantId)fail('CUSTODY');}
 const scopes=value.map(canonicalSha256);
 if(new Set(scopes).size!==scopes.length)fail('CUSTODY');
 return scopes;
}

export function createApprovedScheduleInstructions(options){
 let readFiring,readPreparedSchedule,now,maxRequestMs;
 try{
  if(!options||types.isProxy(options)||Object.getPrototypeOf(options)!==Object.prototype)fail('CONFIGURATION');
  const keys=Reflect.ownKeys(options),allowed=['scheduleOwner','preparations','now','maxRequestMs'];
  if(keys.some(key=>!allowed.includes(key)))fail('CONFIGURATION');
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(options,key);if(!d.enumerable||!Object.hasOwn(d,'value'))fail('CONFIGURATION');}
  readFiring=sdkMethod(options.scheduleOwner,'readFiring');readPreparedSchedule=sdkMethod(options.preparations,'readPreparedSchedule');
  now=options.now??Date.now;maxRequestMs=options.maxRequestMs??10000;
  if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 }catch{throw fault('CONFIGURATION');}

 function selection(value){
  if(!value||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('REQUEST');
  const d=Object.getOwnPropertyDescriptor(value,'signal'),signal=d&&Object.hasOwn(d,'value')?d.value:undefined;
  if(d&&(!d.enumerable||!Object.hasOwn(d,'value'))||signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))fail('REQUEST');
  const descriptors=Object.getOwnPropertyDescriptors(value),raw={};
  for(const key of Reflect.ownKeys(value)){
   const field=descriptors[key];if(typeof key!=='string'||!field.enumerable||!Object.hasOwn(field,'value'))fail('REQUEST');
   if(key!=='signal')Object.defineProperty(raw,key,{value:field.value,enumerable:true});
  }
  const s=closed(frozenScheduleData(raw),['tenantId','scheduleId','generation','task','instructionSha256'],'REQUEST');
  if(typeof s.tenantId!=='string'||!s.tenantId||s.tenantId.length>128||typeof s.scheduleId!=='string'||!uuid.test(s.scheduleId)||
   !Number.isSafeInteger(s.generation)||s.generation<1||!s.task||typeof s.task!=='object'||Array.isArray(s.task)||typeof s.instructionSha256!=='string'||!sha.test(s.instructionSha256))fail('REQUEST');
  return {s,signal};
 }
 function current(value,s){
  const row=closed(frozenScheduleData(value),['projection','generation','activeIntent','intent'],'STALE');
  if(row.activeIntent!==null||row.generation!==s.generation||row.intent===null)fail('STALE');
  const intent=assertScheduleIntent(row.intent,s.tenantId),p=intent.projection;
  if(intent.operation==='cancel_scheduled_task'||p.scheduleId!==s.scheduleId||intent.generation!==s.generation||p.state!=='active'||intent.configuration.paused||
   !same(p,row.projection)||!same(intent.configuration.task,s.task)||intent.taskInstructionSha256!==s.instructionSha256)fail('STALE');
  return {row,intent,intentSha256:canonicalSha256(intent)};
 }
 function retained(value,s,acknowledged){
  const entry=closed(frozenScheduleData(value),['key','record','state','outcome'],'CUSTODY');
  const key=closed(entry.key,['tenantId','actorId','conversationId','deliveryId'],'CUSTODY');
  validateShape('Identity',{tenantId:key.tenantId,actorId:key.actorId});
  if(key.tenantId!==s.tenantId||typeof key.conversationId!=='string'||!uuid.test(key.conversationId)||typeof key.deliveryId!=='string'||!/^sdk:[a-f0-9]{64}$/u.test(key.deliveryId)||entry.state!=='PREPARED')fail('CUSTODY');
  const record=closed(entry.record,['operation','argumentsSha256'],'CUSTODY'),operation=closed(record.operation,['id','version'],'CUSTODY');
  const {intent,intentSha256}=acknowledged;
  if(operation.id!==intent.operation||operation.version!=='0.2.0'||typeof record.argumentsSha256!=='string'||!sha.test(record.argumentsSha256))fail('CUSTODY');
  const outcome=closed(entry.outcome,['result','release'],'CUSTODY'),result=closed(outcome.result,['status','proposal'],'CUSTODY');
  if(result.status!=='approval_required')fail('CUSTODY');
  const proposal=validateToolShape('ScheduleMutationOutput',result.proposal);
  if(proposal.status!=='approval_required'||proposal.operation!==intent.operation||proposal.proposalId!==intent.intentId||proposal.intentSha256!==intentSha256||
   !same(proposal.projection,intent.projection)||proposal.cancel!==null)fail('CUSTODY');
  const {task,workflow,...policy}=intent.configuration;
  if(!same(proposal.policy,policy)||typeof proposal.taskInstruction!=='string'||proposal.taskInstruction.trim()!==proposal.taskInstruction||canonicalSha256(proposal.taskInstruction)!==s.instructionSha256)fail('CUSTODY');
  const release=closed(outcome.release,['binding','scopes','expiresAtMs'],'CUSTODY');validateShape('RunBinding',release.binding);
  if(release.binding.tenantId!==key.tenantId||release.binding.actorId!==key.actorId||release.binding.conversationId!==key.conversationId||
   !Number.isSafeInteger(release.expiresAtMs)||release.expiresAtMs<1)fail('CUSTODY');
  const originalScopes=new Set(scopes(release.scopes,s.tenantId));
  if(scopes(proposal.projection.scopes,s.tenantId).some(scope=>!originalScopes.has(scope)))fail('CUSTODY');
  // Both envelopes are historical preparation custody: full scopes (including that policy revision) must remain covered.
  // Fresh firing authority and its current policy revision belong to scheduled-dispatch's separate authority port.
  return proposal.taskInstruction;
 }
 return Object.freeze({async read(request){
  let life;
  try{
   const {s,signal}=selection(request);if(signal?.aborted)fail('CANCELLED');
   const at=now(),deadlineMs=at+maxRequestMs;if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(deadlineMs))fail('CONFIGURATION');
   life=createOperationLifetime({deadlineMs,now,signal,errorFactory:code=>fault(code)});
   const selected=Object.freeze({tenantId:s.tenantId,scheduleId:s.scheduleId});
   const first=current(await life.run(()=>readFiring(selected,life.check)),s);
   const entry=await life.run(signal=>readPreparedSchedule({tenantId:s.tenantId,proposalId:first.intent.intentId,intentSha256:first.intentSha256,signal}));
   if(entry===null)fail('UNAVAILABLE');
   const instruction=retained(entry,s,first);
   const last=current(await life.run(()=>readFiring(selected,life.check)),s);
   if(!same(first.row,last.row))fail('STALE');life.check();
   return frozenScheduleData({instruction});
  }catch(error){throw ownedErrors.has(error)?error:fault('UNAVAILABLE');}
  finally{life?.close();}
 }});
}

/** Attended routines receive their identity, sealed allocation and generic task from the prepared candidate.
 * The schedule workflow target is an explicit trusted startup input shared with the schedule-worker render; JSON alone
 * grants no authority. Candidate binding occurs after startPreparedCandidate and before product-port composition.
 * Core policy and cancellation proof remain owned by product-ports/routines.mjs; this module never issues them.
 */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createScheduleRuntimeContext} from '../../control/schedules/runtime-context.mjs';
import {createRoutinesFamily,routinesFamily} from '../product-ports/routines.mjs';

const fault=()=>Object.assign(Error('ROUTINES_OWNER_CONFIGURATION'),{code:'ROUTINES_OWNER_CONFIGURATION'});
const refuse=()=>Object.assign(Error('ROUTINES_RETIREMENT_UNPROVEN'),{code:'ROUTINES_RETIREMENT_UNPROVEN'});
const contextRefuse=()=>Object.assign(Error('ROUTINES_CONTEXT_UNAVAILABLE'),{code:'ROUTINES_CONTEXT_UNAVAILABLE'});
const same=(a,b)=>hash(a)===hash(b),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
function facet(object,key){
 if(!object||typeof object!=='object'||types.isProxy(object))throw fault();
 const descriptor=Object.getOwnPropertyDescriptor(object,key);
 if(!descriptor||!Object.hasOwn(descriptor,'value'))throw fault();
 return descriptor.value;
}

function workflowTarget(raw){
 const w=data(own(raw,['taskQueue','workflowIdPrefix']));
 if(typeof w.taskQueue!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(w.taskQueue)||
  typeof w.workflowIdPrefix!=='string'||!/^[A-Za-z0-9._/-]{1,128}$/u.test(w.workflowIdPrefix))throw fault();
 return w;
}

/** Reconstruct the same reviewed allocation retarget used by prepared-run-bindings. The durable admission must commit
 * to this exact parsed allocation before it can be used for an attended request from another run. */
export function retargetRoutinesAllocation(baseJson,binding){
 const base=allocation(baseJson),copy=JSON.parse(baseJson);
 copy.run=Object.fromEntries(Object.keys(base.run).map(key=>[key,binding[key]]));
 const json=JSON.stringify(copy),retargeted=allocation(json);
 if(!same(retargeted.run,Object.fromEntries(Object.keys(base.run).map(key=>[key,binding[key]]))))throw fault();
 return Object.freeze({json,sha256:hash(retargeted)});
}

/** Select a context separately for each authenticated action session. The session's current binding chooses the
 * allocation row; neither a request body nor the startup original binding can choose a later run. The canonical
 * schedule context then repeats currentness/policy checks across preparation and release. */
export function createAttendedRoutinesContextOwner({base,sessions,scheduleOwner,allocations,now=Date.now,newId}){
 let authenticate,readState,readAllocation,c;
 try{
  c=own(base,['commandContext','allocationJson','template','workflow','policy','limits','versions','policyRevision']);
  authenticate=storageMethod(sessions,'authenticateSession');readState=storageMethod(sessions,'readCurrentState');
  readAllocation=storageMethod(allocations,'read');
  if(!ordinary(now)||!ordinary(newId)||!Number.isSafeInteger(c.limits.maxRequestMs)||c.limits.maxRequestMs<1||c.limits.maxRequestMs>30000)throw Error();
  allocation(c.allocationJson);validateShape('RunBinding',c.commandContext.binding);validateShape('RuntimeVersions',c.versions);
  const resolution=data(own(c.commandContext.clientResolution,['reference','clientId']));
  if(!uuid.test(resolution.clientId)||resolution.reference!==resolution.clientId||typeof c.policyRevision!=='string'||!c.policyRevision)throw Error();
 }catch{throw fault();}
 async function select(value){
  let request,life;
  try{
   request=own(value,['credential','operation','request','deadlineMs'],['signal','proposal']);nativeSignal(request.signal);
   if(typeof request.credential!=='string'||!request.credential||!Number.isSafeInteger(request.deadlineMs))throw Error();
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:Math.min(request.deadlineMs,now()+c.limits.maxRequestMs),errorFactory:contextRefuse});
   const auth=data(own(await life.run(signal=>authenticate({credential:request.credential,signal,deadlineMs:request.deadlineMs})),['principal','sessionRevision','checkedAtMs','expiresAtMs']));
   const current=data(own(await life.run(signal=>readState({authentication:auth,signal,deadlineMs:request.deadlineMs})),['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']));
   const binding=data(current.binding);validateShape('RunBinding',binding);
   const principal=data(own(auth.principal,['sessionId','tenantId','actorId','conversationId','runId']));
   if(current.authenticationSha256!==hash(auth)||['tenantId','actorId','conversationId','runId'].some(key=>principal[key]!==binding[key])||
    binding.tenantId!==c.commandContext.binding.tenantId||binding.actorId!==c.commandContext.binding.actorId||
    current.selectedClientId!==c.commandContext.clientResolution.clientId||!Array.isArray(current.scopes)||!current.scopes.length||
    current.scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==c.policyRevision)||
    !current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId===current.selectedClientId)||
    !Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=now()||!Number.isSafeInteger(auth.expiresAtMs)||auth.expiresAtMs<=now())throw Error();
   const retargeted=retargetRoutinesAllocation(c.allocationJson,binding),saved=data(await life.run(()=>readAllocation({binding,allocationKey:hash(binding)},life.check)));
   const record=saved?.record,run=saved?.run;
   if(!same(run?.binding,binding)||!['starting','running','waiting-for-approval'].includes(run?.state)||!same(run?.scopes,current.scopes)||!same(run?.versions,c.versions)||run?.policyRevision!==c.policyRevision||
    record?.state!=='ADMITTED'||!same(record.original?.binding,binding)||record.original?.executionKey!==hash(binding)||
    !same(record.original?.versions,c.versions)||record.qualification?.policyRevision!==c.policyRevision||
    record.allocationSha256!==retargeted.sha256||!Number.isSafeInteger(record.expiresAtMs)||record.expiresAtMs<=now())throw Error();
   life.check();
   return createScheduleRuntimeContext({sessions,commandContext:{binding,clientResolution:{reference:current.selectedClientId,clientId:current.selectedClientId}},
    allocationJson:retargeted.json,template:c.template,workflow:c.workflow,policy:c.policy,limits:c.limits,scheduleOwner,now,newId});
  }catch{throw contextRefuse();}finally{life?.close();}
 }
 return Object.freeze({async resolve(value){const owner=await select(value);return owner.resolve(value);},
  async authorizeRequest(value){const owner=await select(value);return owner.authorizeRequest(value);}});
}

/** The native stop port is the candidate's existing execution/kickoff/stop route for initial and successor runs.
 * A successful route response is insufficient: re-read the durable allocation and require physical-stop proof. */
export function createAttendedRoutinesRetirement({native,allocations,principal,now=Date.now,maxRequestMs}){
 let call,read,p;
 try{
  call=storageMethod(native,'call');read=storageMethod(allocations,'read');p=data(own(principal,['tenantId','actorId']));
  validateShape('Identity',p);
  if(!ordinary(now)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error();
 }catch{throw fault();}
 return Object.freeze({async retire(raw){
  let v,b;
  try{v=own(raw,['binding'],['signal','deadlineMs']);nativeSignal(v.signal);b=data(v.binding);validateShape('RunBinding',b);
   if(b.tenantId!==p.tenantId||b.actorId!==p.actorId||v.deadlineMs!==undefined&&!Number.isSafeInteger(v.deadlineMs))throw Error();
  }catch{throw refuse();}
  const at=now(),deadlineMs=Math.min(v.deadlineMs??at+maxRequestMs,at+maxRequestMs);
  if(deadlineMs<=at)throw refuse();
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs,errorFactory:refuse});
  try{
   const executionId=hash(b),receipt=data(own(await life.run(signal=>call('execution/kickoff/stop',{binding:b,executionId},{signal})),['binding','executionId','expiresAtMs']));
   if(!same(receipt.binding,b)||receipt.executionId!==executionId||!Number.isSafeInteger(receipt.expiresAtMs))throw refuse();
   const saved=data(await life.run(()=>read({binding:b,allocationKey:executionId},life.check)));
   const record=saved?.record;
   if(!same(saved?.run?.binding,b)||record?.state!=='RETIRED'||record.resource?.physicalStopProven!==true||!same(record.original?.binding,b))throw refuse();
   life.check();return Object.freeze({physicalStopProven:true});
  }catch{throw refuse();}finally{life.close();}
 }});
}

/** Derive only from the compiled candidate's exact scheduled template and control's own configuration. No allocation or I/O. */
export function deriveAttendedRoutinesOwners({configuration,candidate,workflow,allocations,now=Date.now,readConsents}){
 try{
  const routines=facet(configuration,'routines'),configured=facet(configuration,'nativeCandidate');
  if(routines?.enabled!==true||routines?.core?.cancellationProof===undefined||routines?.task===undefined)throw Error();
  if(configured.multiRun?.dynamicInitialRuns!==true||!ordinary(now))throw Error();
  const identity=facet(configured,'identity'),commandContext=data(own(facet(identity,'commandContext'),['binding','clientResolution']));
  validateShape('RunBinding',commandContext.binding);
  const clientResolution=data(own(commandContext.clientResolution,['reference','clientId']));
  if(clientResolution.reference!==clientResolution.clientId||!uuid.test(clientResolution.clientId)||!same(commandContext.binding,facet(configured,'runtime').binding))throw Error();
  const a=allocation(facet(configured,'allocationJson')),root=Object.fromEntries(Object.keys(a.run).map(k=>[k,commandContext.binding[k]]));
  if(!same(root,a.run))throw Error();
  if(!same(facet(candidate,'original').binding,commandContext.binding))throw Error();
  const scheduled=own(facet(candidate,'routinesOccurrenceOwners'),['template','retirement']);
  if(!ordinary(scheduled.retirement?.retire))throw Error();
  const t=data(own(scheduled.template,['principal','selectedClientId','policyRevision','versions','task','configurationSha256','allocationJson','runWindowMs','destinationId']));
  const principal=data(own(t.principal,['tenantId','actorId'])),task=data(own(t.task,['taskId','version','manifestSha256']));
  if(!same(principal,{tenantId:commandContext.binding.tenantId,actorId:commandContext.binding.actorId})||
   t.selectedClientId!==clientResolution.clientId||!same(t.versions,facet(configuration,'versions'))||t.policyRevision!==configured.qualification?.policyRevision||
   t.allocationJson!==configured.allocationJson||task.taskId!==routines.task.taskId||task.version!==routines.task.version||task.manifestSha256!==a.manifestSha256)throw Error();
  const limits=facet(configuration,'limits');
  if(!Number.isSafeInteger(limits.requestMs)||limits.requestMs<1||limits.requestMs>30000)throw Error();
  const target=workflowTarget(workflow),retirement=createAttendedRoutinesRetirement({native:facet(candidate,'native'),allocations,principal,now,maxRequestMs:limits.requestMs});
  if(configuration.reads?.delegation?.enabled===true&&readConsents===undefined)throw Error();
  const context=Object.freeze({commandContext,allocationJson:configured.allocationJson,template:task,workflow:target,
   limits:Object.freeze({maxRequestMs:limits.requestMs,maxFactBytes:131072,retryLimit:0})});
  return Object.freeze({context,contextOwnerFactory:({sessions,scheduleOwner,now:requestNow,newId,policy})=>createAttendedRoutinesContextOwner({
    base:{...context,policy,versions:configuration.versions,policyRevision:configured.qualification.policyRevision},sessions,scheduleOwner,
    allocations,now:requestNow,newId}),retirement,
   ...(readConsents===undefined?{}:{readConsents})});
 }catch{throw fault();}
}

/** Late-bind exactly one prepared candidate. Missing ownership keeps the existing 503 family and readiness `unavailable`.
 * `workflow` must be the same target rendered for the schedule worker; the caller owns that cross-role pin. */
export function createAttendedRoutinesOwnerComposition({configuration,workflow,readConsents}={}){
 let candidate=null,bound=false;
 const enabled=configuration?.routines?.enabled===true;
 return Object.freeze({
  bindCandidate(value){if(bound)throw fault();bound=true;if(value===null||typeof value!=='object'||types.isProxy(value))throw fault();candidate=value;},
  family(context){
   if(!enabled||candidate===null||workflow===undefined||configuration?.routines?.task===undefined||configuration?.routines?.core?.cancellationProof===undefined||
    configuration?.reads?.delegation?.enabled===true&&readConsents===undefined)return createRoutinesFamily(context);
   const {pool,now=Date.now}=context??{};
   const allocations=createPostgresConversationStore({pool,now}).allocations;
   return routinesFamily(deriveAttendedRoutinesOwners({configuration,candidate,workflow,allocations,now,readConsents}))(context);
  },
  state(){return !enabled?'disabled':candidate===null||workflow===undefined||configuration?.routines?.task===undefined||
   configuration?.routines?.core?.cancellationProof===undefined||configuration?.reads?.delegation?.enabled===true&&readConsents===undefined?'owners-unavailable':'bound';}
 });
}

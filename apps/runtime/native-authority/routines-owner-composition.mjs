/** Attended routines receive their identity, sealed allocation and generic task from the prepared candidate.
 * The schedule workflow target is an explicit trusted startup input shared with the schedule-worker render; JSON alone
 * grants no authority. Candidate binding occurs after startPreparedCandidate and before product-port composition.
 * Core policy and cancellation proof remain owned by product-ports/routines.mjs; this module never issues them.
 */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createScheduleRuntimeContext} from '../../control/schedules/runtime-context.mjs';
import {createRoutinesFamily,routinesFamily} from '../product-ports/routines.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {compileAgentCoreConfiguration} from '../agentcore-configuration.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../../control/schedules/scheduled-occurrence.mjs';

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

/** AgentCore foreground actions use the existing live action session and current run/model-policy owners.
 * They do not require a running SDK invocation: reviewing an already prepared proposal after completion
 * still requires the same current conversation selection and a fresh signed-in Core policy decision. */
export function createNativeRoutinesContextOwner({base,sessions,scheduleOwner,store,now=Date.now,newId,runCancellation}){
 let c,authenticate,readState,readRun,readModelPolicy,readHead;
 try{
  c=own(base,['template','workflow','policy','limits','versions','maxRuntimeSeconds']);
  validateShape('RuntimeVersions',c.versions);
  authenticate=storageMethod(sessions,'authenticateSession');readState=storageMethod(sessions,'readCurrentState');
  readRun=storageMethod(store,'read');readModelPolicy=storageMethod(store,'readModelPolicy');readHead=storageMethod(facet(store,'nextRuns'),'current');
  if(!ordinary(now)||!ordinary(newId)||!Number.isSafeInteger(c.maxRuntimeSeconds)||c.maxRuntimeSeconds<1||
   !Number.isSafeInteger(c.limits.maxRequestMs)||c.limits.maxRequestMs<1||c.limits.maxRequestMs>30000)throw Error();
 }catch{throw fault();}
 async function select(value){
  let request,life;
  try{
   request=own(value,['credential','operation','request','deadlineMs'],['signal','proposal']);nativeSignal(request.signal);
   if(typeof request.credential!=='string'||!request.credential||!Number.isSafeInteger(request.deadlineMs))throw Error();
   // Listing and stopping future firings do not start model work. Keep execution eligibility
   // unchanged for new/updated schedules and cancellation that selects running work.
   const cancel=request.operation==='cancel_scheduled_task'?scheduleToolValidators.normalizeRequest(request.operation,request.request):null;
   const managementOnly=request.operation==='list_scheduled_tasks'||cancel?.running==='leave'&&cancel.runs.length===0;
   const deadlineMs=Math.min(request.deadlineMs,now()+c.limits.maxRequestMs);
   life=createOperationLifetime({now,signal:request.signal,deadlineMs,errorFactory:contextRefuse});
   const auth=data(own(await life.run(signal=>authenticate({credential:request.credential,signal,deadlineMs})),['principal','sessionRevision','checkedAtMs','expiresAtMs']));
   let selected=null,budget=null,persistedManagement=null;
   async function currentFor(call){
    const check=()=>{call.signal?.throwIfAborted();if(now()>=call.deadlineMs)throw contextRefuse();};
    const current=data(own(await readState(call),['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']));check();
    const b=current.binding;validateShape('RunBinding',b);
    const principal=data(own(call.authentication.principal,['sessionId','tenantId','actorId','conversationId','runId']));
    if(current.authenticationSha256!==hash(call.authentication)||['tenantId','actorId','conversationId','runId'].some(key=>principal[key]!==b[key])||
     current.expiresAtMs<=now()||call.authentication.expiresAtMs<=now())throw contextRefuse();
    assertNativeConversationScope(current);
    const choice={binding:b,scopes:current.scopes,selectedClientId:current.selectedClientId};
    if(selected!==null&&!same(choice,selected))throw contextRefuse();
    const saved=typeof store.readOptional==='function'?await store.readOptional(b,{after:0,limit:1},check):await readRun(b,{after:0,limit:1},check);check();let policy;
    // Only a persisted exact-session management request may omit model admission.
    // An initial binding keeps its positive budget even if the run persists during this request.
    persistedManagement??=managementOnly&&saved!==null;
    if(saved===null){
     if(persistedManagement)throw contextRefuse();
     if(typeof store.initialBindings?.readPreparation!=='function'||typeof store.readCurrentModelPolicy!=='function')throw contextRefuse();
     const initial=await store.initialBindings.readPreparation({binding:b},check);check();const record=initial?.record;
     if(!record||initial.recordSha256!==hash(record)||!same(record.binding,b)||!same(record.versions,c.versions)||record.selectedClientId!==current.selectedClientId||
      record.policyRevision!==current.scopes[0].policyRevision||record.expiresAtMs<=now())throw contextRefuse();
     policy=await store.readCurrentModelPolicy(b,check);check();
     const after=await store.initialBindings.readPreparation({binding:b},check);check();if(!same(initial,after))throw contextRefuse();
    }else{
     const {run}=saved,head=await readHead(b,check);if(!persistedManagement)policy=await readModelPolicy(b,check);check();
     validateShape('RuntimeVersions',run.versions);
     // An existing exact session may manage future firings after an image deployment.
     // Other version compatibility and every execution operation keep the configured pins.
     const requiredVersions=managementOnly?{...c.versions,imageDigest:run.versions.imageDigest}:c.versions;
     if(!same(run.binding,b)||!same(run.scopes,current.scopes)||!same(run.versions,requiredVersions)||run.policyRevision!==current.scopes[0].policyRevision||
      !(['starting','running','paused','waiting-for-approval','completed'].includes(run.state)||managementOnly&&['failed','cancelled'].includes(run.state))||head.reserved!==false||!same(head.binding,b)||
      !same(head.scopes,current.scopes)||head.policyRevision!==run.policyRevision)throw contextRefuse();
    }
    if(!persistedManagement){
     if(!Number.isSafeInteger(policy.maxBudgetMicroUsd)||policy.maxBudgetMicroUsd<1)throw contextRefuse();
     // A changed tenant budget never reuses execution proposal/authorization silently.
     if(budget!==null&&budget!==policy.maxBudgetMicroUsd)throw contextRefuse();
     budget??=policy.maxBudgetMicroUsd;
    }
    selected??=data(choice);
    return {...current,checkedAtMs:now(),expiresAtMs:Math.min(current.expiresAtMs,call.authentication.expiresAtMs,deadlineMs)};
   }
   const first=await life.run(signal=>currentFor({authentication:auth,signal,deadlineMs}));life.check();
   return createScheduleRuntimeContext({sessions:{authenticateSession:authenticate,readCurrentState:currentFor},
    commandContext:{binding:first.binding,clientResolution:first.selectedClientId===null?null:{reference:first.selectedClientId,clientId:first.selectedClientId}},
    ...(persistedManagement?{managementExpiresAtMs:first.expiresAtMs}:{executionLimits:{expiresAtMs:first.expiresAtMs,maxCostMicrousd:budget,maxRuntimeSeconds:c.maxRuntimeSeconds,retryLimit:0}}),
    template:c.template,workflow:c.workflow,policy:c.policy,limits:c.limits,scheduleOwner,now,newId,
    ...(runCancellation===undefined?{}:{runCancellation})});
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
  if(configuration.agentcore!==undefined){
   const task=compileNativeRoutinesTask(configuration),scheduled=own(facet(candidate,'routinesOccurrenceOwners'),['templateFor','retirement']);
   if(!same(candidate.routinesTask,task)||!ordinary(scheduled.templateFor)||!ordinary(scheduled.retirement?.retire)||readConsents!==undefined)throw Error();
   const context=Object.freeze({template:task,workflow:workflowTarget(workflow),limits:{maxRequestMs:configuration.limits.requestMs,maxFactBytes:131072,retryLimit:0}});
   return Object.freeze({context,retirement:scheduled.retirement,contextOwnerFactory:({sessions,scheduleOwner,now:requestNow,newId,policy,runCancellation})=>createNativeRoutinesContextOwner({
    base:{...context,policy,versions:configuration.versions,maxRuntimeSeconds:Math.floor(configuration.agentcore.runWindowMs/1000)},sessions,scheduleOwner,
    store:allocations,now:requestNow,newId,runCancellation})});
  }
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
   const store=createPostgresConversationStore({pool,now}),allocations=configuration.agentcore===undefined?store.allocations:store;
   return routinesFamily(deriveAttendedRoutinesOwners({configuration,candidate,workflow,allocations,now,readConsents}))(context);
  },
  state(){return !enabled?'disabled':candidate===null||workflow===undefined||configuration?.routines?.task===undefined||
   configuration?.routines?.core?.cancellationProof===undefined||configuration?.reads?.delegation?.enabled===true&&readConsents===undefined?'owners-unavailable':'bound';}
 });
}

/** The persisted task identity stays operator-configured. Its manifest pin is the actual
 * compiled native SDK profile; a changed deployment/tool/model profile requires approval again. */
export function compileNativeRoutinesTask(configuration){
 try{
  const configured=data(own(configuration.routines.task,['taskId','version'])),agentcore=compileAgentCoreConfiguration(configuration.agentcore);
  validateShape('RuntimeVersions',configuration.versions);
  if(!uuid.test(configured.taskId)||!Number.isSafeInteger(configured.version)||configured.version<1||typeof configuration.sourceEnabled!=='boolean')throw Error();
  const profile=data({versions:configuration.versions,agentcore,sourceEnabled:configuration.sourceEnabled,models:configuration.models??null,
   capabilities:configuration.capabilityPlatform??null,intents:configuration.intents?.enabled===true});
  return data({...configured,manifestSha256:hash(profile)});
 }catch{throw fault();}
}

/** One template per canonical occurrence, with no startup actor/client binding or allocation. */
export function createNativeRoutinesOccurrenceOwners({configuration,native,store,now=Date.now}){
 const task=compileNativeRoutinesTask(configuration),config=compileAgentCoreConfiguration(configuration.agentcore);
 const call=storageMethod(native,'call'),settlement=storageMethod(facet(store,'executions'),'settlement');
 return Object.freeze({templateFor(raw){
  const occurrence=snapshotOccurrence(raw),p=occurrence.projection,scope=p.scopes[0];
  if(p.scopes.length!==1||!same(occurrence.task,task)||scope.policyRevision!==config.policyRevision)throw fault();
  const selectedClientId=scope.kind==='client'?scope.resourceId:null;
  assertNativeConversationScope({binding:occurrenceIdentity(occurrence).binding,scopes:p.scopes,selectedClientId});
  return data({principal:p.owner,selectedClientId,policyRevision:config.policyRevision,versions:configuration.versions,task,
   configurationSha256:hash(config),runWindowMs:config.runWindowMs,destinationId:'meri-inbox'});
 },retirement:Object.freeze({async retire(raw){
  const q=own(raw,['binding'],['signal','deadlineMs']);validateShape('RunBinding',q.binding);nativeSignal(q.signal);
  const life=createOperationLifetime({now,signal:q.signal,deadlineMs:Math.min(q.deadlineMs??now()+configuration.limits.requestMs,now()+configuration.limits.requestMs),errorFactory:refuse});
  try{
   const executionId=hash(q.binding),result=await life.run(signal=>call('execution/kickoff/stop',{binding:q.binding,executionId},{signal}));
   if(!same(result.binding,q.binding)||result.executionId!==executionId)throw refuse();
   const saved=await life.run(()=>settlement(q.binding,life.check));life.check();
   if(saved.settled!==true||!same(saved.run.binding,q.binding))throw refuse();
   // Metadata settlement is not physical retirement: only a provider-confirmed stop proves it.
   return Object.freeze({physicalStopProven:saved.stopped===true});
  }finally{life.close();}
 }})});
}

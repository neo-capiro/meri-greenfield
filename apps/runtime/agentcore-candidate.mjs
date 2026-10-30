/** Control composition for one immutable AgentCore deployment. Core admits turns; the existing journals own runs and SDK data. */
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../packages/contracts/runtime-0.2/session.mjs';
import {assertForkBootstrapReceipt} from '../../packages/contracts/conversation-lifecycle/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../control/action-application/http.mjs';
import {createCapiroApplicationAuthorityClient} from '../control/action-host/application-adapters/authority-http.mjs';
import {createCoreMembershipGate} from '../control/product-access/core-membership.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {createInitialRunBindingJournal} from '../control/conversations/initial-run-binding-journal.mjs';
import {createNextRunOwner} from '../control/conversations/next-run.mjs';
import {createRunReconciler} from '../control/conversations/run-reconciler.mjs';
import {compileAgentCoreConfiguration} from './agentcore-configuration.mjs';
import {createAgentCoreExecutionOwner} from './agentcore-execution.mjs';
import {createAgentCoreControlApplication} from './agentcore-control-http.mjs';
import {createConversationIdentity} from './conversation-identity.mjs';
import {createCoreConversationCurrentness} from './native-authority/conversation-currentness.mjs';
import {createCoreConversationManagement} from './native-authority/conversation-management.mjs';
import {createCoreConversationSourceReader} from './native-authority/conversation-source.mjs';
import {createCoreSiteWorkflowAdmission} from './native-authority/site-workflow-admission.mjs';
import {createCoreProcedureAdmission} from './native-authority/procedure-admission.mjs';
import {createDurableSdkSessionOwner} from './sdk-session-owner.mjs';
import {createNativeSessionContinuation} from './sdk-continuation-owner.mjs';
import {createObjectiveSelectionOwner} from './objective-generation/selection-owner.mjs';
import {createPostgresObjectiveRunStartStore} from './objective-source/postgres-run-starts.mjs';
import {createOutreachCore} from './outreach-generation/core.mjs';
import {assertOutreachRequest,outreachIdentity} from '../../packages/runtime/outreach-generation.mjs';
import {createAutomaticClientContextReader} from './automatic-client-context.mjs';
import {createObjectiveCorePorts} from './objective-generation/core-ports.mjs';
import {createNativeSessionContinuationApplication} from './sdk-continuation-http.mjs';
import {NATIVE_FILE_PATHS} from './artifacts/native-files-http.mjs';
import {createNativeLifecycleAdmission} from './product-ports/lifecycle.mjs';
import {countingFetch} from './telemetry/counting.mjs';
import {fault} from './config.mjs';
import {compileNativeRoutinesTask,createNativeRoutinesOccurrenceOwners} from './native-authority/routines-owner-composition.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {compileRoutinesCoreConfiguration,routinesReservedSecretFiles} from './native-authority/routines-configuration.mjs';
import {createRoutinesCoreClient,createRoutinesServiceSecret} from './native-authority/routines-core-client.mjs';
import {routineFiringTrust} from './native-authority/routines-firing-grant.mjs';
import {createRoutinesFiringAuthority} from './native-authority/routines-firing-authority.mjs';
import {createNativeRoutineCurrent} from './native-authority/routines-run-current.mjs';
import {readSecret as readRuntimeSecret} from './config.mjs';
import {createConfiguredRunCapabilityPolicy,projectCapabilityRole} from './product-ports/capability-policy.mjs';

const same=(a,b)=>hash(a)===hash(b);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
const refuse=()=>{throw fault('AGENTCORE_ADMISSION_REFUSED');};
const check=signal=>()=>signal?.throwIfAborted();
const absent=code=>Response.json({error:{code}},{status:503,headers:{'cache-control':'no-store'}});

/** Dependencies are borrowed. Only startAgentCoreCandidate creates and closes the provider client. */
export function assembleAgentCoreCandidate({configuration,pool,provider,controlCredential,nativeCredentials,
 store,initialBindings=createInitialRunBindingJournal({pool}),
 fetchImpl=globalThis.fetch,now=Date.now,createReadsRuntime,turnTelemetry,getCoreServiceSecret,readSecret=readRuntimeSecret}){
 const config=compileAgentCoreConfiguration(configuration.agentcore),versions=configuration.versions;
 if(typeof controlCredential!=='string'||!/^\S{32,8192}$/u.test(controlCredential)||typeof nativeCredentials?.nativeCredentialFor!=='function'||
  createReadsRuntime!==undefined&&typeof createReadsRuntime!=='function')throw fault('AGENTCORE_CONFIGURATION');
 const requestMs=configuration.limits.requestMs,limits={maxRequestMs:requestMs,maxFactBytes:131072};
 const capabilityPolicy=createReadsRuntime?createConfiguredRunCapabilityPolicy(configuration,{pool}):undefined;
 const coreFetch=countingFetch(fetchImpl,turnTelemetry,{origin:config.identity.origin});
 const runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool,now});
 const objectiveCore=getCoreServiceSecret?createObjectiveCorePorts({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,runStarts,fetchImpl:coreFetch,now,maxRequestMs:requestMs}):null;
 const core=createCapiroApplicationAuthorityClient({origin:config.identity.origin,fetchImpl:coreFetch,now,enabled:true,limits:{maxRequestMs:requestMs,maxResponseBytes:131072}});
 const conversationManagement=getCoreServiceSecret?createCoreConversationManagement({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,policyRevision:config.policyRevision,nativeCredentials,fetchImpl:coreFetch,now,maxRequestMs:requestMs}):undefined;
 const conversationSourceReader=getCoreServiceSecret?createCoreConversationSourceReader({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,fetchImpl:coreFetch,now,maxRequestMs:requestMs}):undefined;
 // Wave5 MO01/ST16: the procedure admission port holds the Core service secret control-side, exactly as the source
 // reader above does. It reaches the worker's run-owner route only through the control conversations service.
 const siteWorkflowAdmission=getCoreServiceSecret?createCoreSiteWorkflowAdmission({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,nativeCredentials,fetchImpl:coreFetch,now,maxRequestMs:requestMs}):undefined;
 const procedureAdmission=getCoreServiceSecret?createCoreProcedureAdmission({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,nativeCredentials,fetchImpl:coreFetch,now,maxRequestMs:requestMs}):undefined;
 store??=createPostgresConversationStore({pool,modelCatalog:configuration.models,assertConversationActive:conversationManagement?.assertActiveBinding,
  onPublished:event=>{turnTelemetry?.bind(event.binding);turnTelemetry?.summary(event);}});
 const routinesTask=configuration.routines?.enabled===true&&configuration.routines.task?compileNativeRoutinesTask(configuration):null;
 const routinesConfig=routinesTask?compileRoutinesCoreConfiguration(configuration):null;
 const scheduleOwner=routinesTask?createPostgresScheduleOwner({pool}):undefined;
 let routineCore=null;
 if(routinesConfig?.unattendedGrant){
  const getServiceSecret=createRoutinesServiceSecret({file:routinesConfig.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret});
  const wires=createRoutinesCoreClient({origin:routinesConfig.origin,getServiceSecret,fetchImpl:coreFetch,now,maxRequestMs:requestMs});
  const firing=createRoutinesFiringAuthority({wires,trust:routineFiringTrust(routinesConfig.unattendedGrant),scheduleOwner,now,maxRequestMs:requestMs});
  routineCore=Object.freeze({...createNativeRoutineCurrent({configuration,task:routinesTask,store,scheduleOwner,firing,wires,now}),origin:routinesConfig.origin,getServiceSecret});
 }
 const nextRunOwner=createNextRunOwner({store,versions,now});
 const identityContext=createConversationIdentity({store,identity:{...config.identity,fetchImpl:coreFetch},
  qualification:{policyRevision:config.policyRevision},now,limits,nextRunOwner,initialBindings,
  configurationSha256:hash(config),versions,proposeInitialExpiry:()=>now()+config.runWindowMs,factWindowMs:config.runWindowMs,...(scheduleOwner?{scheduleOwner}:{})});
 const conversationMembership=createCoreMembershipGate({origin:config.identity.origin,identityContext,fetchImpl:coreFetch,now,limits:{...limits,maxFactBytes:262144}});
 const conversationCurrentness=createCoreConversationCurrentness({origin:config.identity.origin,fetchImpl:coreFetch,now,limits});
 async function contextFor({binding,run,signal}){
  validateShape('RunBinding',binding);
  let context=await initialBindings.readContext({binding},check(signal));check(signal)();
  if(!context||!same(run.binding,binding)||context.policyRevision!==run.policyRevision)refuse();
  assertNativeConversationScope({binding,scopes:run.scopes,selectedClientId:context.selectedClientId});
  if(!same(run.scopes,[{kind:context.selectedClientId===null?'private-user':'client',tenantId:binding.tenantId,resourceId:context.selectedClientId===null?binding.actorId:context.selectedClientId,policyRevision:context.policyRevision}]))refuse();
  return context;
 }
 function bootstrapReceipt(raw,{sourceBinding,controlId,selectedClientId,conversationId}){
  const receipt=data(raw);
  return assertForkBootstrapReceipt(receipt,{controlId,sourceBinding,selectedClientId,targetBinding:{tenantId:sourceBinding.tenantId,actorId:sourceBinding.actorId,conversationId:conversationId??receipt.conversationId}});
 }
 async function continuationOrigin(binding,run,context,signal){
  if(typeof store.lifecycle?.continuationOrigin!=='function')refuse();
  const origin=data(own(await store.lifecycle.continuationOrigin({binding,scopes:run.scopes,selectedClientId:context.selectedClientId},check(signal)),['controlId','mode','sourceBinding','bootstrap']));check(signal)();
  validateShape('RunBinding',origin.sourceBinding);
  const source=origin.sourceBinding;
  if(!uuid(origin.controlId)||source.tenantId!==binding.tenantId||source.actorId!==binding.actorId||['runId','attemptId','workerId'].some(k=>source[k]===binding[k]))refuse();
  if(origin.mode==='resume'){
   if(source.conversationId!==binding.conversationId||binding.writerFence!==source.writerFence+1||origin.bootstrap!==null)refuse();
  }else if(origin.mode==='fork'){
   if(source.conversationId===binding.conversationId||binding.writerFence!==1)refuse();
   bootstrapReceipt(origin.bootstrap,{...origin,selectedClientId:context.selectedClientId,conversationId:binding.conversationId});
  }else refuse();
  return origin;
 }
 async function nativeAccess({binding,run,context,signal}){
  let origin,credentialBinding=binding,borrowed;
  try{borrowed=nativeCredentials.nativeCredentialFor({binding,selectedClientId:context.selectedClientId,signal});}
  catch(error){
   if(error?.code!=='SESSION_UNAVAILABLE')throw error;
   origin=await continuationOrigin(binding,run,context,signal);credentialBinding=origin.sourceBinding;
   const source=(await store.read(credentialBinding,{after:0,limit:1},check(signal))).run;
   const sourceContext=await contextFor({binding:credentialBinding,run:source,signal});
   if(!same(source.scopes,run.scopes)||!same(sourceContext,context))refuse();
   borrowed=nativeCredentials.nativeCredentialFor({binding:credentialBinding,selectedClientId:context.selectedClientId,signal});
  }
  if(typeof borrowed?.credential!=='string'||!Number.isSafeInteger(borrowed.expiresAtMs)||borrowed.expiresAtMs<=now())refuse();
  return {credential:borrowed.credential,async verify(){
   check(signal)();const after=nativeCredentials.nativeCredentialFor({binding:credentialBinding,selectedClientId:context.selectedClientId,signal});
   if(after.credential!==borrowed.credential||after.expiresAtMs<=now())refuse();
   if(origin&&!same(await continuationOrigin(binding,run,context,signal),origin))refuse();
  }};
 }
 async function readCurrent({binding,run,context,signal,deadlineMs=now()+requestMs,beforeExecution=false,transition=false}){
  const start=await runStarts.read({binding,signal});
  if(start.state!=='ABSENT'){
   if(start.state!=='STARTED'||!objectiveCore)refuse();
   const current=await objectiveCore.currentRecord({record:start.record,signal});
   if(current.clientId!==context.selectedClientId||current.tenantId!==binding.tenantId||current.actorId!==binding.actorId)refuse();
   return {...current,expiresAtMs:Math.min(current.effectExpiresAtMs,start.record.effectExpiresAtMs)};
  }
  if(routineCore){
   const routine=await routineCore[beforeExecution?'admitExecution':transition?'forTransition':'forBinding']({binding,signal,deadlineMs});
   if(routine!==null){const record=beforeExecution?routine:routine.record;
    if(record.selectedClientId!==context.selectedClientId||!same(record.scopes,run.scopes))refuse();
    return {...(beforeExecution?{}:routine.current),expiresAtMs:record.expiresAtMs,routine:true};
   }
  }
  const access=await nativeAccess({binding,run,context,signal}),started=now();
  const current=await core.readCurrent({credential:access.credential,conversationId:binding.conversationId,clientId:context.selectedClientId,signal,deadlineMs:Math.min(deadlineMs,started+requestMs)});
  await access.verify();
  if(current.checkedAtMs<started||current.checkedAtMs>now()||current.expiresAtMs<=now()||current.principal.tenantId!==binding.tenantId||current.principal.actorId!==binding.actorId||current.conversationId!==binding.conversationId||current.selectedClientId!==context.selectedClientId)refuse();
  return current;
 }

 // A policy decision needs current Core/job authority; local execution authentication deliberately stays local.
 async function readCapabilityRole({binding,signal,deadlineMs=now()+requestMs}){
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+requestMs),errorFactory:code=>fault(code)});
  try{
   const run=(await life.run(()=>store.read(binding,{after:0,limit:1},life.check))).run;
   const context=await life.run(signal=>contextFor({binding,run,signal})),started=now();
   const current=await life.run(signal=>readCurrent({binding,run,context,signal,deadlineMs:life.deadline()}));
   life.check();return projectCapabilityRole(current,{started,now:now()});
  }finally{life.close();}
 }

 async function admit({binding,signal}){
  const run=(await store.read(binding,{after:0,limit:1},check(signal))).run,context=await contextFor({binding,run,signal});
  // Attribute current access only after the durable run and scope agree.
  try{turnTelemetry?.bind(run.binding);}catch{}
  const current=await readCurrent({binding,run,context,signal,beforeExecution:true});
  // This is the execution lifetime, not a cached permission receipt. Business-data access rechecks Core through its own gateway.
  return {run,expiresAtMs:current.routine?current.expiresAtMs:now()+config.runWindowMs,settings:{sourceEnabled:configuration.sourceEnabled,
   ...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads}),
   ...(configuration.intents===undefined?{}:{intents:{enabled:configuration.intents.enabled}})}};
 }
 async function admitFork(value){
  const {signal,...raw}=own(value,['controlId','sourceBinding','scopes','selectedClientId','versions'],['signal']),v=data(raw);
  validateShape('RunBinding',v.sourceBinding);validateShape('RuntimeVersions',v.versions);
  if(!uuid(v.controlId)||v.selectedClientId!==null&&!uuid(v.selectedClientId)||!same(v.versions,versions))refuse();
  const life=createOperationLifetime({now,signal,deadlineMs:now()+requestMs,errorFactory:code=>fault(code)});
  try{
   const source=(await store.read(v.sourceBinding,{after:0,limit:1},life.check)).run;
   const context=await contextFor({binding:v.sourceBinding,run:source,signal:life.signal});
   if(context.selectedClientId!==v.selectedClientId||!same(source.scopes,v.scopes)||['failed','cancelled'].includes(source.state))refuse();
   await readCurrent({binding:v.sourceBinding,run:source,context,signal:life.signal,deadlineMs:life.deadline()});
   const borrowed=nativeCredentials.nativeCredentialFor({binding:v.sourceBinding,selectedClientId:v.selectedClientId,signal:life.signal});
   const response=await life.run(signal=>coreFetch(new URL('/api/clio/conversations/bootstrap',config.identity.origin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:`Bearer ${borrowed.credential}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(v.selectedClientId===null?{schemaVersion:2,requestId:v.controlId,scopeKind:'general',clientId:null}:{schemaVersion:1,requestId:v.controlId,clientId:v.selectedClientId})}));
   if(response.status!==200&&response.status!==201||response.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??'')){
    await response.body?.cancel();refuse();
   }
   const length=response.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length)){await response.body?.cancel();refuse();}
   const bootstrap=bootstrapReceipt(await jsonBody({body:response.body,length:length===null?null:Number(length)},4096,life,life.check),v);
   const started=now(),current=await core.readCurrent({credential:borrowed.credential,conversationId:bootstrap.conversationId,clientId:v.selectedClientId,signal:life.signal,deadlineMs:life.deadline()});life.check();
   const after=nativeCredentials.nativeCredentialFor({binding:v.sourceBinding,selectedClientId:v.selectedClientId,signal:life.signal});
   if(after.credential!==borrowed.credential||after.expiresAtMs<=now()||current.checkedAtMs<started||current.checkedAtMs>now()||current.expiresAtMs<=now()||
    current.principal.tenantId!==v.sourceBinding.tenantId||current.principal.actorId!==v.sourceBinding.actorId||current.conversationId!==bootstrap.conversationId||current.selectedClientId!==v.selectedClientId)refuse();
   const result=await initialBindings.claim({principal:current.principal,conversationId:bootstrap.conversationId,selectedClientId:v.selectedClientId,policyRevision:context.policyRevision,versions,configurationSha256:hash(config),proposedExpiresAtMs:now()+config.runWindowMs},life.check);life.check();
   const r=result.record;validateShape('RunBinding',r.binding);
   if(r.state!=='ADMITTED'||r.binding.tenantId!==current.principal.tenantId||r.binding.actorId!==current.principal.actorId||r.binding.conversationId!==bootstrap.conversationId||r.binding.writerFence!==1||r.selectedClientId!==v.selectedClientId||r.policyRevision!==context.policyRevision||!same(r.versions,versions)||r.configurationSha256!==hash(config)||r.expiresAtMs<=now())refuse();
   return {binding:r.binding,bootstrap,expiresAtMs:r.expiresAtMs};
  }finally{life.close();}
 }
 const continuationAdmission=createNativeLifecycleAdmission({store,versions,runWindowMs:config.runWindowMs,admitFork,now});
 const transitionAuthority=Object.freeze({async readCurrent(value){
  const {signal,...raw}=own(value,['binding','scopes','selectedClientId','policyRevision','deadlineMs'],['signal','committedContinuation']),v=data(raw);
  validateShape('RunBinding',v.binding);assertNativeConversationScope(v);
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(v.deadlineMs,now()+requestMs),errorFactory:code=>fault(code)});
  try{
   const run=(await store.read(v.binding,{},life.check)).run,context=await contextFor({binding:v.binding,run,signal:life.signal});
   if(!same(run.scopes,v.scopes)||context.selectedClientId!==v.selectedClientId||context.policyRevision!==v.policyRevision||run.state==='cancelled')refuse();
   if(v.committedContinuation!==undefined){
    const reference=own(v.committedContinuation,['sourceBinding','controlId']);validateShape('RunBinding',reference.sourceBinding);if(!uuid(reference.controlId))refuse();
    const c=await store.lifecycle.get({binding:reference.sourceBinding,scopes:v.scopes,selectedClientId:v.selectedClientId,controlId:reference.controlId},life.check);life.check();
    if(!['DISPATCHING','APPLIED'].includes(c.state)||!['resume','fork'].includes(c.input.intent)||!c.target||!same(c.target.binding,v.binding)||!same(c.target.scopes,v.scopes)||c.target.selectedClientId!==v.selectedClientId)refuse();
   }else if(run.state==='failed')refuse();
   const latest=await store.nextRuns.current(v.binding,life.check);life.check();
   if(latest.reserved!==false||!same(latest.binding,v.binding)||!same(latest.scopes,v.scopes)||latest.policyRevision!==v.policyRevision)refuse();
   const current=await readCurrent({binding:v.binding,run,context,signal:life.signal,deadlineMs:life.deadline(),transition:true});life.check();
   return {binding:v.binding,scopes:v.scopes,selectedClientId:v.selectedClientId,policyRevision:v.policyRevision,checkedAtMs:now(),expiresAtMs:current.expiresAtMs};
  }finally{life.close();}
 }});
 const execution=createAgentCoreExecutionOwner({store,provider,versions,
  plan:{runtimeArn:config.runtimeArn,runtimeVersion:config.runtimeVersion,qualifier:config.qualifier},credentialSecret:controlCredential,admit,contextFor,now,
  ...(routineCore?{beforeInvocation:routineCore.beforeInvocation}:{})});
 const reconciler=createRunReconciler({store,stopExecution:execution.stopExecution,now,maxReconcileMs:Math.min(120000,configuration.limits.shutdownMs)});
 async function stop({binding,executionId,signal}){
  if(executionId!==hash(binding))refuse();
  const result=await reconciler.reconcile({binding,signal});if(result.outcome==='unknown')throw fault('EXECUTION_STOP_UNKNOWN');
  const saved=await store.executions.read(binding,check(signal));check(signal)();
  if(saved.record)return {binding,executionId,expiresAtMs:saved.record.expiresAtMs};
  // A cancelled/failed run with no invocation has no execution lease. Use its committed terminal event, never a new authority.
  const head=await store.read(binding,{after:0,limit:1},check(signal));
  const last=await store.read(binding,{after:head.lastSequence-1,limit:1},check(signal));
  const event=last.events[0];
  if(last.lastSequence!==head.lastSequence||event?.type!=='run.status'||!['failed','cancelled'].includes(event.data?.state)||event.data.state!==last.run.state)throw fault('EXECUTION_STOP_UNKNOWN');
  const expiresAtMs=Date.parse(event.createdAt);if(!Number.isSafeInteger(expiresAtMs))throw fault('EXECUTION_STOP_UNKNOWN');
  return {binding,executionId,expiresAtMs};
 }
 async function readiness({signal}={}){
  signal?.throwIfAborted();
  const tables=['conversations','runs','events','controls','native_executions','initial_run_bindings','next_runs','sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'].map(n=>'meri_conversations.'+n);tables.push('meri_objective_source.run_starts');
  const result=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[tables]);check(signal)();
  if(result.rows.length!==tables.length||result.rows.some(row=>row.relation===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');
  return {service:'meri-native-capability-provider/1',ready:true};
 }
 const owner=Object.freeze({...execution,stop,readiness,retentionSweep:input=>{
  if(typeof outerApplication?.sweepRetention!=='function')throw fault('EXECUTION_STORE_UNAVAILABLE');
  return outerApplication.sweepRetention(input);
 }});
 const control=createAgentCoreControlApplication({owner,controlCredential,now,maxRequestMs:requestMs,maxRequestBytes:configuration.limits.requestBytes});
 const sdkSessionOwner=createDurableSdkSessionOwner({admission:store.executions,authority:execution,enabled:true,now,maxRequestMs:requestMs});
 const objectiveSelection=createObjectiveSelectionOwner({runStarts,store,now,maxRequestMs:requestMs});
 const automaticReader=createAutomaticClientContextReader({origin:config.identity.origin,getServiceSecret:getCoreServiceSecret,fetchImpl:coreFetch,now,maxRequestMs:requestMs});
 const automaticContext=Object.freeze({async read({binding,run,selectedClientId,signal,deadlineMs}){
  const context=await contextFor({binding,run,signal});if(context.selectedClientId!==selectedClientId)refuse();
  const access=await nativeAccess({binding,run,context,signal});
  const packet=await automaticReader.read({binding,selectedClientId,credential:access.credential,signal,deadlineMs});
  await access.verify();return packet;
 }});
 const outreachCore=createOutreachCore({origin:config.identity.origin,fetchImpl:coreFetch,now,maxRequestMs:requestMs});
 const outreach={async read({binding,run,request,selectedClientId,signal,deadlineMs}){
  const context=await contextFor({binding,run,signal});if(context.selectedClientId!==selectedClientId)refuse();
  const access=await nativeAccess({binding,run,context,signal});
  const value=await outreachCore.read({conversationId:binding.conversationId},{credential:access.credential,signal,deadlineMs});
  await access.verify();return value===null?null:assertOutreachRequest(value,{binding,request,selectedClientId});
 },async settle({binding,run,selection,output,model,errorCode,signal,deadlineMs}){
  const context=await contextFor({binding,run,signal}),access=await nativeAccess({binding,run,context,signal});
  const result=await outreachCore[errorCode===undefined?'complete':'fail']({...outreachIdentity(selection),...(errorCode===undefined?{output,model}:{errorCode})},{credential:access.credential,signal,deadlineMs});
  await access.verify();return result;
 }};
 const sdkSessionSnapshot=createNativeSessionContinuation({store,execution,versions,maxOutputBytes:config.maxOutputBytes,objectiveSelection,outreach,automaticContext,...(routineCore?{routineCore}:{}),now,maxRequestMs:requestMs});
 const runtime=createNativeSessionContinuationApplication({owner:sdkSessionSnapshot,now,maxRequestMs:requestMs});
 let outerApplication,closed=false;
 async function reads(request){
  if(!createReadsRuntime)return absent('UNAVAILABLE');
  const execute=new URL(request.url).pathname==='/v1/runner/reads/execute';
  const life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+(execute?config.approvedReads?.maxExecuteMs??requestMs:requestMs),errorFactory:code=>fault(code)});
  try{
   if(request.method!=='POST'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))return Response.json({error:{code:'INVALID_ARGUMENTS'}},{status:400});
   const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw fault('INVALID_ARGUMENTS');
   const input=await jsonBody({body:request.body,length:length===null?null:Number(length)},config.approvedReads?.maxRequestBytes??configuration.limits.requestBytes,life,life.check);
   validateShape('RunBinding',input.binding);
   const app=createReadsRuntime({execution,conversationStore:store,binding:input.binding,capabilityPolicy,readCapabilityRole,...(objectiveCore?{objectiveCore}:{}),...(routineCore?{routineCore}:{}),...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads})});
   if(typeof app?.handle!=='function')throw fault('READS_CONFIGURATION');
   const headers=new Headers(request.headers);headers.delete('content-length');
   return await life.run(signal=>app.handle(new Request(request.url,{method:'POST',headers,body:JSON.stringify(input),signal})));
  }catch{return absent('UNAVAILABLE');}finally{life.close();}
 }
 const application=Object.freeze({handle(request){const operation=async()=>{
  if(closed)return absent('EXECUTION_UNAVAILABLE');
  const path=new URL(request.url).pathname;
  const answer=await control.handle(request);if(answer!==null)return answer;
  if(['/v1/runner/runtime','/v1/runner/outreach/complete','/v1/runner/outreach/fail'].includes(path))return runtime.handle(request);
  if(path.startsWith('/v1/runner/reads/'))return reads(request);
  if(path.startsWith('/v1/runner/session/'))return outerApplication?outerApplication.handle(request):absent('SDK_SESSION_UNAVAILABLE');
  if(/^\/v1\/runner\/intents\/(availability|prepare)$/u.test(path))return outerApplication?outerApplication.handle(request):absent('UNAVAILABLE');
  if(Object.hasOwn(NATIVE_FILE_PATHS,path))return outerApplication?outerApplication.handle(request):absent('NATIVE_FILES_UNAVAILABLE');
  if(/^\/v1\/runner\/[a-z-]+$/u.test(path)||/^\/v1\/runner\/selected\/(prepare|read|finish|publish)$/u.test(path)){
   if(!outerApplication)return absent('EXECUTION_UNAVAILABLE');
   const url=new URL(request.url);url.pathname=path.replace('/v1/runner/','/internal/conversations/');
   return outerApplication.handle(new Request(url,request));
  }
  return null;
 };return turnTelemetry?turnTelemetry.provisional(operation):operation();}});
 const native=Object.freeze({verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,
  call(operation,input,{signal}={}){const invoke=async()=>{
   if(closed)throw fault('EXECUTION_UNAVAILABLE');
   const method={'execution/kickoff':'kickoff','execution/kickoff/status':'status','execution/kickoff/stop':'stop'}[operation];
   if(!method)throw fault('NATIVE_OPERATION_UNAVAILABLE');return owner[method]({...input,signal});
  };return turnTelemetry?turnTelemetry.provisional(invoke):invoke();},readiness});
 const routinesOccurrenceOwners=routinesTask===null?null:createNativeRoutinesOccurrenceOwners({configuration,native,store,now});
 return Object.freeze({execution,native,application,admitFork,readCapabilityRole,...(routineCore?{workerModelPolicy:routineCore.modelPolicy}:{}),...(routinesOccurrenceOwners===null?{}:{routinesTask,routinesOccurrenceOwners}),
  objective:Object.freeze({runStarts,core:objectiveCore,template:{versions,policyRevision:config.policyRevision,configurationSha256:hash(config),runWindowMs:config.runWindowMs}}),
  productPorts:Object.freeze({executionOwner:execution,objectiveSelection,identityContext,conversationMembership,conversationCurrentness,...(conversationManagement?{conversationManagement}:{}),...(conversationSourceReader?{conversationSourceReader}:{}),conversationTurns:nextRunOwner,sdkSessionOwner,sdkSessionSnapshot,continuationAdmission,transitionAuthority,browserHostCore:core,...(procedureAdmission?{procedureAdmission}:{}),...(siteWorkflowAdmission?{siteWorkflowAdmission}:{})}),
  bindApplication(value){if(outerApplication||typeof value?.handle!=='function')throw fault('AGENTCORE_CONFIGURATION');outerApplication=value;},
  async close(){closed=true;await execution.close();}});
}

export async function startAgentCoreCandidate({configuration,pool,signal,controlCredential,nativeCredentials,createReadsRuntime,turnTelemetry,getCoreServiceSecret}){
 const config=compileAgentCoreConfiguration(configuration.agentcore);signal?.throwIfAborted();
 const {createAgentCoreClient}=await import('./agentcore-client.mjs');
 const provider=createAgentCoreClient({region:'us-east-1',agentRuntimeArn:config.runtimeArn,qualifier:config.qualifier});
 try{
  const candidate=assembleAgentCoreCandidate({configuration,pool,provider,controlCredential,nativeCredentials,createReadsRuntime,turnTelemetry,getCoreServiceSecret});
  return Object.freeze({...candidate,async close(){try{await candidate.close();}finally{provider.close();}}});
 }catch(error){provider.close();throw error;}
}

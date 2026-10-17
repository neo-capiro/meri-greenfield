/** Concrete bounded first-run composition over existing canonical owners. */
import {ECSClient} from '@aws-sdk/client-ecs';
import {S3Client} from '../artifacts/storage/s3-sdk.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {budgetTables} from '../gateway/budget/namespace.mjs';
import {createS3ArtifactObjects} from '../artifacts/storage/s3-objects.mjs';
import {jsonBody} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {readSecret} from './config.mjs';
import {createPreparedRunBindings} from './prepared-run-bindings.mjs';
import {compileNativeBrokerPlan} from './native-authority/broker-stack.mjs';
import {allocateRemoteNativeController,createOriginalRetirement} from './native-authority/remote-composition.mjs';
import {createNativeIdentityContext} from './native-authority/identity-context.mjs';
import {createCoreConversationCurrentness} from './native-authority/conversation-currentness.mjs';
import {createCoreMembershipGate} from '../control/product-access/core-membership.mjs';
import {capabilityDigest,matchesCapability} from './native-authority/task-verifier.mjs';
import {createNativeCheckpointInspection} from './native-authority/checkpoint-inspection.mjs';
import {createNativeCheckpointApplication} from './native-authority/checkpoint-http.mjs';
import {createPreparedTaskKickoff} from './native-authority/prepared-kickoff.mjs';
import {createPreparedKickoffApplication,createPreparedRunnerReleaseClient} from './native-authority/prepared-kickoff-http.mjs';
import {createPreparedNextRunOwner} from './prepared-next-run.mjs';
import {createPreparedRunRegistry} from './prepared-run-registry.mjs';
import {createPreparedNativeReads,captureReadRuntimeOptions} from './native-authority/prepared-reads.mjs';
import {createTaskRouterAuthority} from './native-authority/task-router-authority.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {dirname,join} from 'node:path';
const refuse=()=>{throw Error('PREPARED_CANDIDATE_REFUSED');};
const same=(a,b)=>hash(a)===hash(b);
/** Check the configured first-run proxy bearer against the model grant intent before allocation. */
export function assertFirstRunGrantBindings(grantIntents,taskGrantId,secrets){
 const controlDigest=capabilityDigest(secrets.control),taskDigest=capabilityDigest(secrets.task),proxyDigest=capabilityDigest(secrets.proxy);
 if(!/^[!-~]{32,256}$/u.test(secrets.proxy)||grantIntents.filter(v=>v.grantId===taskGrantId&&v.capabilitySha256===taskDigest).length!==1||grantIntents.filter(v=>v.grantId!==taskGrantId&&v.capabilitySha256===proxyDigest).length!==1||grantIntents.some(v=>v.capabilitySha256===controlDigest))refuse();
 return Object.freeze({controlDigest,taskDigest});
}
/** Fresh native authority; only absence permits the approved fixed first-run input. */
export function createPreparedCandidateIdentity({store,identity,qualification,now=Date.now,limits,nextRunOwner,initialBindings,configurationSha256,versions,proposeInitialExpiry,factWindowMs}){
 const binding=identity.commandContext.binding,scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:identity.commandContext.clientResolution.clientId,policyRevision:qualification.policyRevision}];
 // A run fact's deadlineMs is how long the selected run may be relied on, not this call's request budget: the context
 // adapter folds it into the context expiry and the action-session owner inherits that as the session lifetime. Stamping
 // the request budget here expired every session ~3s after issue (observed live 2026-10-17). The window is the reviewed
 // run window; without one (static first-run profile) the request budget remains the bound.
 if(factWindowMs!==undefined&&(!Number.isSafeInteger(factWindowMs)||factWindowMs<1))refuse();
 const factUntil=()=>now()+(factWindowMs??limits.maxRequestMs);
 if(initialBindings){
  if(!nextRunOwner||typeof initialBindings.claim!=='function'||typeof initialBindings.readConversation!=='function'||typeof proposeInitialExpiry!=='function'||typeof configurationSha256!=='string'||!/^[a-f0-9]{64}$/u.test(configurationSha256)||!versions)refuse();
  const selectedClientId=identity.commandContext.clientResolution.clientId;
  const check=signal=>()=>{if(signal?.aborted)refuse();};
  const valid=(record,principal,conversationId)=>{if(!record||record.schemaVersion!==1||record.state!=='ADMITTED'||principal.tenantId!==binding.tenantId||principal.actorId!==binding.actorId||record.binding.tenantId!==principal.tenantId||record.binding.actorId!==principal.actorId||record.binding.conversationId!==conversationId||record.binding.writerFence!==1||record.selectedClientId!==selectedClientId||record.policyRevision!==qualification.policyRevision||record.configurationSha256!==configurationSha256||!same(record.versions,versions)||!Number.isSafeInteger(record.expiresAtMs))refuse();return record;};
  const fact=selected=>JSON.stringify({binding:selected.binding,policyRevision:selected.policyRevision,checkedAtMs:now(),deadlineMs:Math.min(selected.expiresAtMs??factUntil(),factUntil())});
  async function original(principal,conversationId,signal){const query={principal,conversationId,selectedClientId};let record=await initialBindings.readConversation(query,check(signal));check(signal)();
   if(!record){const proposedExpiresAtMs=proposeInitialExpiry({signal});const claimed=await initialBindings.claim({...query,policyRevision:qualification.policyRevision,versions,configurationSha256,proposedExpiresAtMs},check(signal));record=claimed.record;check(signal)();}
   return valid(record,principal,conversationId);}
  async function select(record,principal,conversationId,signal){const saved=await store.readOptional(record.binding,{},check(signal));check(signal)();
   if(!saved){if(record.expiresAtMs<=now())refuse();return {binding:record.binding,policyRevision:record.policyRevision,expiresAtMs:record.expiresAtMs};}
   if(!same(saved.run.binding,record.binding)||saved.run.policyRevision!==record.policyRevision||!same(saved.run.versions,versions)||!same(saved.run.scopes,[{kind:'client',tenantId:principal.tenantId,resourceId:selectedClientId,policyRevision:record.policyRevision}]))refuse();
   const chosen=await nextRunOwner.selectRun({principal,conversationId,signal}),current=await nextRunOwner.currentRun(chosen.binding,{signal});check(signal)();
   if(!same(current.binding,chosen.binding)||current.policyRevision!==record.policyRevision||!same(current.scopes,saved.run.scopes))refuse();return {binding:current.binding,policyRevision:current.policyRevision};}
  const currentOwner={async currentRun(request,{signal}){if(request.conversationId===binding.conversationId){const saved=await store.readOptional(binding,{},check(signal));check(signal)();if(!saved){if(!same(request,binding))refuse();return fact({binding,policyRevision:qualification.policyRevision});}if(!same(saved.run.binding,binding)||saved.run.policyRevision!==qualification.policyRevision||!same(saved.run.scopes,scopes))refuse();const selected=await nextRunOwner.currentRun(request,{signal});return fact(selected);}
   const principal={tenantId:request.tenantId,actorId:request.actorId},record=valid(await initialBindings.readConversation({principal,conversationId:request.conversationId,selectedClientId},check(signal)),principal,request.conversationId);check(signal)();
   const saved=await store.readOptional(record.binding,{},check(signal));check(signal)();if(!saved){if(!same(request,record.binding)||record.expiresAtMs<=now())refuse();return fact({binding:record.binding,policyRevision:record.policyRevision,expiresAtMs:record.expiresAtMs});}
   if(!same(saved.run.binding,record.binding)||saved.run.policyRevision!==record.policyRevision||!same(saved.run.versions,versions)||!same(saved.run.scopes,[{kind:'client',tenantId:principal.tenantId,resourceId:selectedClientId,policyRevision:record.policyRevision}]))refuse();const selected=await nextRunOwner.currentRun(request,{signal});check(signal)();if(!same(selected.binding,request)||selected.policyRevision!==record.policyRevision||!same(selected.scopes,saved.run.scopes))refuse();return fact(selected);}};
  return createNativeIdentityContext({...identity,currentOwner,selectRun:async({principal,conversationId,signal})=>{if(conversationId!==binding.conversationId)refuse();const saved=await store.readOptional(binding,{},check(signal));if(!saved)return fact({binding,policyRevision:qualification.policyRevision});if(!same(saved.run.binding,binding)||saved.run.policyRevision!==qualification.policyRevision||!same(saved.run.scopes,scopes))refuse();const selected=await nextRunOwner.selectRun({principal,conversationId,signal});return fact(await nextRunOwner.currentRun(selected.binding,{signal}));},admitInitialConversation:async({principal,conversationId,selectedClientId:requestedClient,signal})=>{if(requestedClient!==selectedClientId)refuse();return fact(await select(await original(principal,conversationId,signal),principal,conversationId,signal));},now,limits,enabled:true});
 }
 const currentOwner={async currentRun(request,{signal}){if(!same(request,binding))refuse();const check=()=>{if(signal?.aborted)refuse();};const saved=await store.readOptional(binding,{},check);check();if(saved&&(!same(saved.run.binding,binding)||saved.run.policyRevision!==qualification.policyRevision||!same(saved.run.scopes,scopes)))refuse();return JSON.stringify({binding,policyRevision:qualification.policyRevision,checkedAtMs:now(),deadlineMs:factUntil()});}};
 if(nextRunOwner){
  const fact=selected=>JSON.stringify({binding:selected.binding,policyRevision:selected.policyRevision,checkedAtMs:now(),deadlineMs:factUntil()});
  const fixedCurrent=currentOwner.currentRun;currentOwner.currentRun=async(request,{signal})=>{const saved=await store.readOptional(binding,{},()=>{if(signal?.aborted)refuse();});if(!saved)return fixedCurrent(request,{signal});return fact(await nextRunOwner.currentRun(request,{signal}));};
  return createNativeIdentityContext({...identity,currentOwner,selectRun:async({principal,conversationId,signal})=>{const saved=await store.readOptional(binding,{},()=>{if(signal?.aborted)refuse();});if(!saved)return fact({binding,policyRevision:qualification.policyRevision});const selected=await nextRunOwner.selectRun({principal,conversationId,signal});return fact(await nextRunOwner.currentRun(selected.binding,{signal}));},now,limits,enabled:true});
 }
 return createNativeIdentityContext({...identity,currentOwner,now,limits,enabled:true});
}
/** Borrowed dependencies remain caller-owned; allocation starts only at Temporal kickoff. */
export function assemblePreparedCandidate(options){
 const c=own(options,['configuration','pool','ecs','objects','credentials'],['fetchImpl','now','allocate','retireOriginal','runIssuance','issuanceIntent','admissionForBinding','prepareOriginal','prepareInitial','retireInitial','initialBindings','configurationSha256','proposeInitialExpiry','createReadsRuntime','generalReads']),config=compilePreparedCandidateConfiguration(c.configuration.nativeCandidate,c.configuration.versions),fetchImpl=c.fetchImpl??fetch,now=c.now??Date.now,limits={maxRequestMs:c.configuration.limits.requestMs,maxFactBytes:131072},secrets=own(c.credentials,['identity','task','control','proxy']);
 const reads=captureReadRuntimeOptions(Object.fromEntries(['createReadsRuntime','generalReads'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));
 if((config.multiRun?.dynamicInitialRuns===true)!==(c.initialBindings!==undefined))refuse();
 if([secrets.identity,secrets.task,secrets.control,secrets.proxy].some(v=>typeof v!=='string'||!/^\S{1,8192}$/u.test(v))||new Set(Object.values(secrets)).size!==4||c.retireOriginal!==undefined&&typeof c.retireOriginal!=='function')refuse();
 const runtime={...config.runtime,proxyCredential:secrets.proxy},compiled=compileNativeBrokerPlan({runtime,plan:config.plan,preparationIntent:config.preparationIntent}),original=compiled.original,store=createPostgresConversationStore({pool:c.pool}),identity={origin:config.identity.origin,credential:secrets.identity,commandContext:config.identity.commandContext,fetchImpl};
 const {controlDigest,taskDigest}=assertFirstRunGrantBindings(config.grantIntents,config.grantId,secrets),multi=[c.runIssuance,c.issuanceIntent,c.admissionForBinding].some(v=>v!==undefined);
 if(multi&&(!c.runIssuance||typeof c.issuanceIntent!=='function'||typeof c.admissionForBinding!=='function')||c.initialBindings&&(!multi||typeof c.prepareInitial!=='function'||typeof c.retireInitial!=='function'||typeof c.proposeInitialExpiry!=='function'||typeof c.configurationSha256!=='string'))refuse();
 const nextRunOwner=multi?createPreparedNextRunOwner({store,versions:c.configuration.versions,admissionForBinding:c.admissionForBinding,now}):undefined;
 const runRegistry=multi?createPreparedRunRegistry({issuance:c.runIssuance,issuanceIntent:c.issuanceIntent,store,pool:c.pool,client:c.ecs,identity,controlCapability:secrets.control,objects:c.objects,limits:{...limits,cleanupMs:c.configuration.limits.shutdownMs},now,sourceEnabled:c.configuration.sourceEnabled,...reads,...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads}),...(c.prepareOriginal?{prepareOriginal:c.prepareOriginal}:{}),...(c.initialBindings?{initialBindings:c.initialBindings,configurationSha256:c.configurationSha256,prepareInitial:c.prepareInitial,retireInitial:c.retireInitial}:{}),...(c.allocate?{allocate:c.allocate}:{})}):null;
 const unavailableReads=createPreparedNativeReads({binding:original.binding,...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads}),now}).application;
 const identityContext=createPreparedCandidateIdentity({store,identity:{origin:identity.origin,commandContext:identity.commandContext,fetchImpl},qualification:config.qualification,now,limits,...(config.multiRun?{factWindowMs:config.multiRun.runWindowMs}:{}),...(nextRunOwner?{nextRunOwner}:{}),...(c.initialBindings?{initialBindings:c.initialBindings,configurationSha256:c.configurationSha256,versions:c.configuration.versions,proposeInitialExpiry:c.proposeInitialExpiry}:{})});
 const conversationMembership=createCoreMembershipGate({origin:identity.origin,identityContext,fetchImpl,now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:262144}});
 const conversationCurrentness=createCoreConversationCurrentness({origin:identity.origin,fetchImpl,now,limits,selectedClientId:config.identity.commandContext.clientResolution.clientId});
 let controller,pending,closed=false,outerApplication;
 const lazy={get prepared(){return controller?.prepared;},async reconcile({signal}={}){await lazy.allocate();return controller.reconcile({signal});},allocate(){if(closed)refuse();if(!pending)pending=Promise.resolve().then(()=>{if(closed)refuse();return (c.allocate??allocateRemoteNativeController)({pool:c.pool,client:c.ecs,identity,allocationJson:config.allocationJson,qualification:config.qualification,grantIntents:config.grantIntents,grantId:config.grantId,operations:config.operations,taskCapability:secrets.task,controlCapabilitySha256:controlDigest,runtime,plan:config.plan,preparationIntent:config.preparationIntent,taskRequest:config.taskRequest,containerName:config.containerName,limits,objects:c.objects,enabled:true,now,transportFactory:({original})=>({original,origin:config.taskOrigin,credential:secrets.control,fetchImpl,now})});}).then(async owned=>{controller=owned;if(closed){await owned.close();refuse();}return {original,resource:owned.resource};});return pending;},async close(){closed=true;try{await pending;}catch{}await controller?.close();},
  // Stop-only: forecloses any later allocation here, then the original's canonical stop rebuilt from the same exact allocation facts
  // (also when this process never held it).
  async retire({signal}={}){closed=true;return (c.retireOriginal??createOriginalRetirement)({store,pool:c.pool,client:c.ecs,allocationJson:config.allocationJson,qualification:config.qualification,grantIntents:config.grantIntents,runtime,plan:config.plan,preparationIntent:config.preparationIntent,taskRequest:config.taskRequest,containerName:config.containerName,limits,now}).stop({signal});}};
 const runner=Object.fromEntries(['readiness','release'].map(method=>[method,value=>createPreparedRunnerReleaseClient({original,taskArn:value.taskArn,origin:config.taskOrigin,credential:secrets.control,fetchImpl,now})[method](value)]));
 const kickoff=createPreparedTaskKickoff({original,controller:lazy,store,runner,enabled:true,reconcile:true,now,maxRequestMs:limits.maxRequestMs,maxWaitMs:Math.max(1,Math.min(1800000,original.expiresAtMs-now())),cleanupMs:c.configuration.limits.shutdownMs}),kickoffHttp=createPreparedKickoffApplication({owner:kickoff,controlCapabilitySha256:controlDigest,enabled:true,now,maxRequestMs:limits.maxRequestMs});
 const inspection=createNativeCheckpointInspection({store,objects:c.objects,identity,limits,enabled:true,now}),checkpoints=createNativeCheckpointApplication({inspection,controlCapabilitySha256:controlDigest,enabled:true,now,maxRequestMs:limits.maxRequestMs});
 async function bootstrap(request){let life;try{if(request.method!=='POST'||new URL(request.url).search||!matchesCapability((request.headers.get('authorization')??'').slice(7),taskDigest)||!request.headers.get('authorization')?.startsWith('Bearer ')||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding')||!controller)refuse();life=createOperationLifetime({now,signal:request.signal,deadlineMs:Math.min(now()+limits.maxRequestMs,original.expiresAtMs),errorFactory:()=>Error('PREPARED_CANDIDATE_REFUSED')});const input=own(await jsonBody({body:request.body,length:null},131072,life,life.check),['binding','versions']);if(!same(input.binding,original.binding)||!same(input.versions,original.versions))refuse();await controller.supervisor.taskVerifier.verify({capability:secrets.task,binding:original.binding,operation:'load',inputSha256:hash({binding:original.binding}),signal:life.signal,deadlineMs:now()+limits.maxRequestMs});const admitted=await controller.prepared.preparationAuthorizer.admitted({original,signal:life.signal});if(admitted.taskArn!==controller.resource.taskArn)refuse();life.check();return Response.json({original,preparationIntent:config.preparationIntent,taskArn:admitted.taskArn,controlCapabilitySha256:controlDigest,processOrigin:config.taskOrigin,http:config.taskHttp,preparedKickoff:true},{headers:{'cache-control':'no-store'}});}catch{return Response.json({error:{code:'PREPARED_CANDIDATE_REFUSED'}},{status:403});}finally{life?.close();}}
 const application={async handle(request){const path=new URL(request.url).pathname;if(path==='/v1/readiness'){let life;try{if(request.method!=='POST'||new URL(request.url).search||!request.headers.get('authorization')?.startsWith('Bearer ')||!matchesCapability(request.headers.get('authorization').slice(7),controlDigest)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))refuse();life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:()=>Error('PREPARED_CANDIDATE_REFUSED')});own(await jsonBody({body:request.body,length:null},131072,life,life.check),[]);await localNative.readiness({signal:life.signal});life.check();return Response.json({service:'meri-native-capability-provider/1',ready:true});}catch{return Response.json({error:{code:'PREPARED_CANDIDATE_REFUSED'}},{status:503});}finally{life?.close();}}if(runRegistry){const response=await runRegistry.handle(request);if(response!==null)return response;}if(path.startsWith('/v1/runner/reads/'))return unavailableReads.handle(request);if(path==='/v1/runner/native/bootstrap')return bootstrap(request);for(const app of [kickoffHttp,checkpoints,controller?.supervisor.application,controller?.application])if(app){const value=await app.handle(request);if(value!==null)return value;}const route=/^\/v1\/runner\/([a-z-]+)$/u.exec(path);if(route&&outerApplication){const url=new URL(request.url);url.pathname='/internal/conversations/'+route[1];return outerApplication.handle(new Request(url,request));}return null;}};
 const localNative={verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,async call(operation,input,{signal}={}){if(operation==='checkpoint/read')return inspection.read({...input,signal});const response=await application.handle(new Request('https://control.internal.invalid/v1/'+operation,{method:'POST',headers:{authorization:'Bearer '+secrets.control,'content-type':'application/json'},body:JSON.stringify(input),signal}));if(!response||response.status!==200)refuse();return response.json();},async readiness({signal}={}){const tables=[...Object.values(budgetTables('product')),'meri_product_budget.tenant_budgets','meri_product_budget.tenant_run_reservations',...['conversations','initial_inputs','runs','events','controls','checkpoints','sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches','native_executions','native_allocations','native_restorations','selected_outputs',...(multi?['next_runs','completion_checkpoints','run_issuances','model_run_issuances']:[]),...(c.initialBindings?['initial_run_bindings']:[])].map(name=>'meri_conversations.'+name)],life=createOperationLifetime({now,signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:()=>Error('PREPARED_CANDIDATE_REFUSED')});try{const schema=await life.run(()=>c.pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[tables]));if(schema.rows.length!==tables.length||schema.rows.some(row=>!tables.includes(row.name)||typeof row.relation!=='string')||new Set(schema.rows.map(row=>row.name)).size!==tables.length)refuse();const budget=await life.run(()=>c.pool.query('SELECT cap_micro_usd,consumed_micro_usd,quarantined FROM meri_product_budget.budget WHERE id=1'));if(budget.rows.length!==1||budget.rows[0].quarantined!==false||!/^[1-9][0-9]*$/u.test(String(budget.rows[0].cap_micro_usd))||!/^(0|[1-9][0-9]*)$/u.test(String(budget.rows[0].consumed_micro_usd))||BigInt(budget.rows[0].consumed_micro_usd)>BigInt(budget.rows[0].cap_micro_usd))refuse();life.check();}finally{life.close();}const deadlineMs=now()+limits.maxRequestMs,identity=await identityContext.verifyIdentity({credential:secrets.identity,signal,deadlineMs});if(c.initialBindings){const membership=await conversationMembership.admit({credential:secrets.identity,signal,deadlineMs});if(membership.principal.tenantId!==config.runtime.binding.tenantId||membership.principal.actorId!==config.runtime.binding.actorId||!membership.principal.clientIds.includes(config.identity.commandContext.clientResolution.clientId))refuse();}else await identityContext.resolveContext({identityCredential:secrets.identity,identity,identitySha256:hash(identity),hints:{},signal,deadlineMs});}};
 // Stable ports borrow the same lazy controller's durable owner. No registration is inferred from configuration;
 // before an allocated controller exists every session operation refuses. Multi-run routes retain registry authority.
 const sessionCall=(port,method)=>value=>{if(closed)throw Object.assign(Error('SDK_SESSION_UNAVAILABLE'),{code:'SDK_SESSION_UNAVAILABLE'});const entry=value.request?.binding&&runRegistry?.get(value.request.binding);if(entry)return entry.session(port,method,value);if(!controller||!same(value.request?.binding,original.binding))throw Object.assign(Error('SDK_SESSION_UNAVAILABLE'),{code:'SDK_SESSION_UNAVAILABLE'});return controller.productPorts[port][method](value);};
 const productPorts=Object.freeze({identityContext,conversationMembership,conversationCurrentness,...(nextRunOwner?{conversationTurns:nextRunOwner}:{}),
  sdkSessionOwner:Object.freeze(Object.fromEntries(['register','load','append','listSubkeys'].map(method=>[method,sessionCall('sdkSessionOwner',method)]))),
  sdkSessionSnapshot:Object.freeze({readSnapshot:sessionCall('sdkSessionSnapshot','readSnapshot')})});
 return Object.freeze({original,controlCapabilitySha256:controlDigest,identityContext,productPorts,native:localNative,application,bindApplication(application){if(outerApplication)refuse();outerApplication=application;},readiness:localNative.readiness,async close(){try{await runRegistry?.close();}finally{await kickoff.close();}}});
}
/** The startup owners handed to assemblePreparedCandidate, the task router and the runner poststart authority. The
 * poststart authority signs runner certificates against the durable run issuer, so `issuer` must travel with the
 * multi-run ports: omitting it refused every control start whose taskRouter.poststart is enabled (observed live 2026-10-17). */
export function composePreparedRunBindings(b,initialBindings){
 if(!b||typeof b.issuer!=='object'||b.issuer===null||typeof b.admissionForBinding!=='function')refuse();
 return {runIssuance:b.runIssuance,issuanceIntent:b.issuanceIntent,admissionForBinding:b.admissionForBinding,issuer:b.issuer,
  ...(b.prepareOriginal?{prepareOriginal:b.prepareOriginal}:{}),
  ...(initialBindings?{initialBindings,prepareInitial:b.prepareInitial,retireInitial:b.retireInitial,configurationSha256:b.configurationSha256,proposeInitialExpiry:b.proposeInitialExpiry}:{})};
}
/** CLI-owned clients use the approved control workload role; task receives no AWS credentials. */
export async function startPreparedCandidate({configuration,pool,signal,issuanceStore,capabilityAuthority,modelGrants,initialBindings,createReadsRuntime,generalReads}){
 const config=compilePreparedCandidateConfiguration(configuration.nativeCandidate,configuration.versions),reads=captureReadRuntimeOptions({...(createReadsRuntime===undefined?{}:{createReadsRuntime}),...(generalReads===undefined?{}:{generalReads})});signal?.throwIfAborted();
 if((config.multiRun?.dynamicInitialRuns===true)!==(initialBindings!==undefined))refuse();
 const [identity,task,control,proxy]=await Promise.all([config.identity.credentialFile,config.taskCapabilityFile,config.controlCapabilityFile,config.proxyCredentialFile].map(readSecret));signal?.throwIfAborted();
 // Multi-run mode (S2): the three ports are composed from startup-supplied owners; a declared multi-run mode without them fails startup
 // here instead of advertising the fixed first-run path.
 const bindings=config.multiRun===undefined?{}:composePreparedRunBindings(createPreparedRunBindings({configuration,pool,store:createPostgresConversationStore({pool}),credentials:{proxy:proxy.toString('utf8').trim(),control:control.toString('utf8').trim()},issuanceStore,capabilityAuthority,modelGrants,limits:{maxRequestMs:configuration.limits.requestMs,maxFactBytes:131072},...(initialBindings?{initialBindings}:{})}),initialBindings);
 // The private router borrows exactly the durable issuance/allocation/admission owners already used for multi-run execution.
 // A configuration declaration alone never supplies authorization or a task route.
 const taskRouterAuthority=configuration.taskRouter===undefined?null:(()=>{
  if(!issuanceStore||typeof bindings.admissionForBinding!=='function')refuse();
  return createTaskRouterAuthority({issuanceStore,allocations:createPostgresConversationStore({pool}).allocations,
   admissionForBinding:bindings.admissionForBinding,controlCapabilitySha256:capabilityDigest(control.toString('utf8').trim()),
   operations:config.operations,transport:{origin:config.taskOrigin,http:config.taskHttp},
   ...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads})});
 })();
 const poststartOwners=configuration.taskRouter?.poststart===undefined?null:(()=>{
  if(!issuanceStore||!bindings.issuer||typeof bindings.admissionForBinding!=='function'||config.multiRun?.dynamicInitialRuns!==true)refuse();
  const configured=config.runtime.binding,configuredWorkspace=config.preparationIntent.workspace;
  const runnerConfiguration=Object.freeze({forOriginal({original}){
   const o=remoteOriginal(original),b=o.binding;
   if(b.tenantId!==configured.tenantId||b.actorId!==configured.actorId||hash(o.versions)!==hash(config.runtime.versions))refuse();
   const workspace=b.conversationId===configured.conversationId?configuredWorkspace:join(dirname(configuredWorkspace),b.conversationId);
   return Object.freeze({limits:configuration.limits,native:{maxResponseBytes:configuration.native.maxResponseBytes},workspace,proxyOrigin:new URL(config.runtime.proxyUrl).origin});
  }});
  return Object.freeze({issuanceStore,allocations:createPostgresConversationStore({pool}).allocations,
   admissionForBinding:bindings.admissionForBinding,issuer:bindings.issuer,runnerConfiguration,
   controlCapabilitySha256:capabilityDigest(control.toString('utf8').trim()),operations:config.operations,
   transport:{origin:config.taskOrigin,http:config.taskHttp},
   ...(config.approvedReads===undefined?{}:{approvedReads:config.approvedReads})});
 })();
 // Approved control workload role is resolved by the adopted SDK at future effects.
 // The run issuer belongs to the poststart authority only; assemblePreparedCandidate's option record is closed.
 const {issuer:_poststartIssuer,...candidateBindings}=bindings;
 const ecs=new ECSClient({region:'us-east-1',maxAttempts:1}),s3=new S3Client({region:'us-east-1',maxAttempts:1});let candidate;
 try{const objects=createS3ArtifactObjects({client:s3,...config.objects,now:Date.now,maxRequestMs:configuration.limits.requestMs});candidate=assemblePreparedCandidate({configuration,pool,ecs,objects,credentials:{identity:identity.toString('utf8').trim(),task:task.toString('utf8').trim(),control:control.toString('utf8').trim(),proxy:proxy.toString('utf8').trim()},...candidateBindings,...reads});return Object.freeze({...candidate,...(taskRouterAuthority?{taskRouterAuthority}:{}),...(poststartOwners?{poststartOwners}:{}),async close(){try{await candidate.close();}finally{ecs.destroy();s3.destroy();}}});}catch(error){ecs.destroy();s3.destroy();throw error;}
}

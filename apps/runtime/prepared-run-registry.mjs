/** Lazy per-run composition; existing issuance/allocation/admission owners retain durability. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {types} from 'node:util';
import {jsonBody} from '../control/action-application/http.mjs';
import {allocateRemoteNativeController,createOriginalRetirement} from './native-authority/remote-composition.mjs';
import {compilePreparedRunFacts,parseTransport} from './prepared-run-issuance.mjs';
import {capabilityDigest,matchesCapability} from './native-authority/task-verifier.mjs';
import {createPreparedTaskKickoff} from './native-authority/prepared-kickoff.mjs';
import {createPreparedKickoffApplication,createPreparedRunnerReleaseClient} from './native-authority/prepared-kickoff-http.mjs';
import {createPreparedReadEntry} from './native-authority/prepared-read-entry.mjs';
import {createNativeReadsApplication} from './native-authority/reads-http.mjs';
import {nativeReadFault,assertNativeReadRequest} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {captureReadRuntimeOptions} from './native-authority/prepared-reads.mjs';
const fail=()=>{throw Object.assign(Error('PREPARED_RUN_REGISTRY_REFUSED'),{code:'PREPARED_RUN_REGISTRY_REFUSED'});};
const same=(a,b)=>hash(a)===hash(b);
export function createPreparedRunRegistry(configuration){
 const c=own(configuration,['issuance','issuanceIntent','store','pool','client','identity','controlCapability','objects','limits'],['now','allocate','retireOriginal','fetchImpl','maximumExpiresAtMs','prepareOriginal','prepareInitial','initialBindings','configurationSha256','approvedReads','sourceEnabled','generalReads','createReadsRuntime']);
 const readsRuntime=captureReadRuntimeOptions(Object.fromEntries(['createReadsRuntime','generalReads'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));
 const now=c.now??Date.now,fetchImpl=c.fetchImpl??fetch,limits=own(c.limits,['maxRequestMs','maxFactBytes'],['cleanupMs','maxWaitMs']),controlDigest=capabilityDigest(c.controlCapability),cache=new Map(),ready=new Map(),cancellation=new AbortController();let closed=false,closing;
 const read=storageMethod(c.store,'read'),readTarget=storageMethod(c.store.nextRuns,'readTarget'),current=storageMethod(c.store.nextRuns,'current'),readAllocation=storageMethod(c.store.allocations,'read'),prepare=storageMethod(c.issuance,'prepare'),resolveFacts=storageMethod(c.issuance,'resolveFacts'),resolveCapability=storageMethod(c.issuance,'resolveCapability');
 if(typeof c.issuanceIntent!=='function'||typeof now!=='function'||typeof fetchImpl!=='function'||c.allocate!==undefined&&typeof c.allocate!=='function'||c.retireOriginal!==undefined&&typeof c.retireOriginal!=='function'||typeof c.controlCapability!=='string'||!/^\S{1,8192}$/u.test(c.controlCapability)||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072||limits.cleanupMs!==undefined&&(!Number.isSafeInteger(limits.cleanupMs)||limits.cleanupMs<1||limits.cleanupMs>30000)||limits.maxWaitMs!==undefined&&(!Number.isSafeInteger(limits.maxWaitMs)||limits.maxWaitMs<1||limits.maxWaitMs>1800000)||c.maximumExpiresAtMs!==undefined&&(!Number.isSafeInteger(c.maximumExpiresAtMs)||c.maximumExpiresAtMs<1))fail();
 const portLimits={maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes};
 const rootIdentity=own(c.identity,['origin','credential','commandContext','fetchImpl']);own(rootIdentity.commandContext,['binding','clientResolution']);
 if(c.prepareOriginal!==undefined&&(typeof c.prepareOriginal!=='function'||types.isProxy(c.prepareOriginal)))fail();
 if((c.initialBindings===undefined)!==(c.prepareInitial===undefined)||c.prepareInitial!==undefined&&(typeof c.prepareInitial!=='function'||types.isProxy(c.prepareInitial)||typeof c.configurationSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.configurationSha256)))fail();
 const readInitial=c.initialBindings===undefined?null:storageMethod(c.initialBindings,'read'),isStaticOriginal=binding=>c.prepareOriginal!==undefined&&same(binding,rootIdentity.commandContext.binding);
 function check(signal){if(closed||signal?.aborted)fail();}
 async function initial(binding,life){
  if(!readInitial||isStaticOriginal(binding)||binding.writerFence!==1)return null;
  if(binding.tenantId!==rootIdentity.commandContext.binding.tenantId||binding.actorId!==rootIdentity.commandContext.binding.actorId)fail();
  const raw=await life.run(()=>readInitial({binding},life.check));life.check();if(raw===null)return null;
  const r=data(own(raw,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']));
  if(r.schemaVersion!==1||r.state!=='ADMITTED'||!same(r.binding,binding)||r.selectedClientId!==rootIdentity.commandContext.clientResolution.clientId||r.configurationSha256!==c.configurationSha256||!Number.isSafeInteger(r.createdAtMs)||r.createdAtMs<1||r.createdAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now()||r.expiresAtMs<=r.createdAtMs||c.maximumExpiresAtMs!==undefined&&r.expiresAtMs>c.maximumExpiresAtMs)fail();return r;
 }
 async function accepted(binding,life,expected,stopOnly=false,pinnedInitial){
  check(life.signal);const admission=await initial(binding,life),row=data(await life.run(()=>read(binding,{},life.check))),reservation=data(await life.run(()=>readTarget(binding,life.check))),selected=data(await life.run(()=>current(binding,life.check)));life.check();
  if(pinnedInitial!==undefined&&!same(admission,pinnedInitial)||!same(row.run.binding,binding)||!stopOnly&&!['queued','starting','running'].includes(row.run.state)||!isStaticOriginal(binding)&&!admission&&(!reservation||reservation.state!=='ACCEPTED'||!same(reservation.target,binding)||!same(reservation.scopes,row.run.scopes)||reservation.policyRevision!==row.run.policyRevision||!same(reservation.versions,row.run.versions))||admission&&(admission.policyRevision!==row.run.policyRevision||!same(admission.versions,row.run.versions)||!Array.isArray(row.run.scopes)||!row.run.scopes.some(scope=>scope.kind==='client'&&scope.tenantId===binding.tenantId&&scope.resourceId===admission.selectedClientId&&scope.policyRevision===admission.policyRevision))||selected.reserved!==false||!same(selected.binding,binding)||selected.policyRevision!==row.run.policyRevision||!same(selected.scopes,row.run.scopes)||expected&&!same(row.request,expected))fail();return {row,reservation,admission};
 }
 function lifetime(signal,expiresAtMs=now()+limits.maxRequestMs){nativeSignal(signal);return createOperationLifetime({now,signal:signal?AbortSignal.any([signal,cancellation.signal]):cancellation.signal,deadlineMs:Math.min(expiresAtMs,now()+limits.maxRequestMs),errorFactory:()=>Error('PREPARED_RUN_REGISTRY_REFUSED')});}
 /** A stop-only entry (the stop route after a restart) may serve a run that is already terminal but whose original is not yet retired; it
  * never allocates. A source that never claimed an allocation is named by the store's no-authority evidence the reservation carries. */
 async function build(binding,signal,record,stopOnly){
  const life=lifetime(signal);let entry;
  try{
   const {row,reservation,admission}=await accepted(binding,life,undefined,stopOnly),originalKind=isStaticOriginal(binding)?'static':admission?'admitted':null;let source,policy,issued;
   if(originalKind){
    if(stopOnly)fail();record.issuanceStarted=true;issued=data(await life.run(signal=>originalKind==='static'?c.prepareOriginal({signal}):c.prepareInitial({binding,signal})));policy={expiresAtMs:issued.issuance.expiresAtMs};if(admission&&policy.expiresAtMs!==admission.expiresAtMs)fail();
   }else{
   const sourceSaved=data(await life.run(()=>readAllocation({binding:reservation.source,allocationKey:hash(reservation.source)},life.check)));life.check();const s=sourceSaved.record;
   const noAuthority=reservation.facts?.noAuthority?.foreclosureSha256;
   if(noAuthority!==undefined){if(s?.state!=='FORECLOSED'||!same(s.binding,reservation.source)||hash(s)!==noAuthority)fail();source=data({binding:reservation.source,foreclosureSha256:noAuthority});}
   else{if(!s||!same(s.original.binding,reservation.source)||s.state!=='RETIRED'||s.resource?.physicalStopProven!==true)fail();source=data({original:s.original,grantIntents:s.grantIntents});}
   policy=data(own(await life.run(signal=>c.issuanceIntent({binding,source,request:row.request,signal})),['expiresAtMs'],['persisted']));life.check();
   }
   if(policy.persisted!==undefined&&typeof policy.persisted!=='boolean'||!Number.isSafeInteger(policy.expiresAtMs)||policy.expiresAtMs<=now()||c.maximumExpiresAtMs!==undefined&&policy.expiresAtMs>c.maximumExpiresAtMs)fail();life.limitDeadline(policy.expiresAtMs);
   const intent={binding,requestSha256:hash(row.request),expiresAtMs:policy.expiresAtMs};record.issuanceStarted=true;
   issued??=data(await life.run(signal=>prepare({...intent,source,signal})));const facts=data(await life.run(signal=>resolveFacts(issued.issuance,{signal}))),capability=await life.run(signal=>resolveCapability(issued.issuance,{signal}));life.check();
   const compiled=compilePreparedRunFacts(facts,{intent,issuance:issued.issuance,now});
   if(!same(compiled.original,issued.original)||compiled.factsSha256!==issued.factsSha256||compiled.factsSha256!==issued.issuance.factsSha256||!same(compiled.original.versions,row.run.versions)||facts.qualification.policyRevision!==row.run.policyRevision||compiled.controlCapabilitySha256!==controlDigest||!matchesCapability(capability,issued.issuance.capabilitySha256))fail();
   if(!same(compiled.approvedReads??null,c.approvedReads??null))fail();
   // The delivery/transport contract is this entry's own, bound into the immutable facts hash above; nothing here is shared across entries.
   const transport=parseTransport(compiled.transport);if(!same(transport,issued.transport))fail();
   await accepted(binding,life,row.request,stopOnly,admission);life.check();
   const original=compiled.original,identity={...rootIdentity,commandContext:{...rootIdentity.commandContext,binding}};let controller,pending,controllerClose;
   const readCurrentEntry=compiled.approvedReads===undefined?undefined:createPreparedReadEntry({store:c.store,issuance:c.issuance,issued,request:row.request,now,resource:()=>controller?.resource,readCurrentRun:async(_,{signal})=>{const fresh=lifetime(signal,original.expiresAtMs);try{return (await accepted(binding,fresh,row.request,false,admission)).row;}finally{fresh.close();}}});
   const prepareAgain=signal=>originalKind==='static'?c.prepareOriginal({signal}):originalKind==='admitted'?c.prepareInitial({binding,signal}):prepare({...intent,source,signal});
   const closeController=()=>{if(!controller)return Promise.resolve();return controllerClose??=Promise.resolve().then(()=>controller.close());};
   let entryClosed=false;
   const lazy={get prepared(){return controller?.prepared;},allocate({signal}={}){nativeSignal(signal);check(signal);if(entryClosed||stopOnly)fail();if(!pending)pending=Promise.resolve().then(async()=>{
    const checkLife=lifetime(signal,original.expiresAtMs);try{await accepted(binding,checkLife,row.request,false,admission);const replay=data(await checkLife.run(prepareAgain));if(!same(replay,issued))fail();checkLife.check();}finally{checkLife.close();}
    check(signal);if(entryClosed)fail();return (c.allocate??allocateRemoteNativeController)({pool:c.pool,client:c.client,identity,allocationJson:facts.allocationJson,qualification:facts.qualification,grantIntents:facts.grantIntents,grantId:facts.grantId,operations:facts.operations,taskCapability:capability,controlCapabilitySha256:controlDigest,runtime:facts.runtime,plan:facts.plan,preparationIntent:facts.preparationIntent,taskRequest:facts.taskRequest,containerName:facts.containerName,limits:portLimits,objects:c.objects,enabled:true,now,...(readCurrentEntry?{readCurrentEntry,approvedReads:compiled.approvedReads,runRequestSha256:issued.issuance.requestSha256,issuanceFactsSha256:compiled.factsSha256,scopes:row.run.scopes,sourceEnabled:c.sourceEnabled===true,...readsRuntime}:{}),transportFactory:({original})=>({original,origin:transport.origin,credential:c.controlCapability,fetchImpl,now})});
   }).then(async value=>{controller=value;if(closed||entryClosed){await closeController();fail();}return {original,resource:controller.resource};});return pending;},async reconcile({signal}={}){await lazy.allocate();return controller.reconcile({signal});},async close(){entryClosed=true;try{await pending;}catch{}await closeController();},
    // Stop-only: forecloses later allocation here, then the original's canonical stop rebuilt from these exact replayed issuance facts.
    async retire({signal}={}){entryClosed=true;return (c.retireOriginal??createOriginalRetirement)({store:c.store,pool:c.pool,client:c.client,allocationJson:facts.allocationJson,qualification:facts.qualification,grantIntents:facts.grantIntents,runtime:facts.runtime,plan:facts.plan,preparationIntent:facts.preparationIntent,taskRequest:facts.taskRequest,containerName:facts.containerName,limits:portLimits,now}).stop({signal});}};
   const runner=Object.fromEntries(['readiness','release'].map(method=>[method,value=>createPreparedRunnerReleaseClient({original,taskArn:value.taskArn,origin:transport.origin,credential:c.controlCapability,fetchImpl,now})[method](value)]));
   const kickoff=createPreparedTaskKickoff({original,controller:lazy,store:c.store,runner,enabled:true,reconcile:true,now,maxRequestMs:limits.maxRequestMs,maxWaitMs:limits.maxWaitMs??Math.max(1,Math.min(1800000,original.expiresAtMs-now())),cleanupMs:limits.cleanupMs??3000}),kickoffHttp=createPreparedKickoffApplication({owner:kickoff,controlCapabilitySha256:controlDigest,enabled:true,now,maxRequestMs:limits.maxRequestMs});
   entry=Object.freeze({binding,original,kickoff,kickoffHttp,matchesTaskCapability:credential=>matchesCapability(credential,issued.issuance.capabilitySha256),session(port,method,value){check();if(entryClosed||!controller||!same(value.request?.binding,binding))throw Object.assign(Error('SDK_SESSION_UNAVAILABLE'),{code:'SDK_SESSION_UNAVAILABLE'});return controller.productPorts[port][method](value);},async read(operation,input,credential,signal,deadlineMs){check(signal);if(entryClosed||!controller?.readsOwner||!matchesCapability(credential,issued.issuance.capabilitySha256))throw nativeReadFault('ACCESS_DENIED');const combined=signal?AbortSignal.any([signal,cancellation.signal]):cancellation.signal,result=await controller.readsOwner.handle(operation,input,credential,combined,deadlineMs);check(combined);if(entryClosed)throw nativeReadFault('ACCESS_DENIED');return result;},application:Object.freeze({async handle(request){if(entryClosed||closed||!controller)return null;return await controller.application.handle(request)??await controller.supervisor.application.handle(request);}}),async bootstrap(value){
    const v=own(value,['binding','versions','credential'],['signal']),bootLife=lifetime(v.signal,original.expiresAtMs);try{check(bootLife.signal);if(entryClosed||!controller||!same(v.binding,binding)||!same(v.versions,original.versions)||!matchesCapability(v.credential,issued.issuance.capabilitySha256))fail();await accepted(binding,bootLife,row.request,false,admission);await bootLife.run(signal=>controller.supervisor.taskVerifier.verify({capability, binding,operation:'load',inputSha256:hash({binding}),signal,deadlineMs:Math.min(now()+limits.maxRequestMs,original.expiresAtMs)}));const admitted=await bootLife.run(signal=>controller.prepared.preparationAuthorizer.admitted({original,signal}));bootLife.check();if(admitted.taskArn!==controller.resource.taskArn)fail();return data({original,preparationIntent:facts.preparationIntent,taskArn:admitted.taskArn,controlCapabilitySha256:controlDigest,processOrigin:transport.origin,http:transport.http,preparedKickoff:true,...(compiled.approvedReads===undefined?{}:{approvedReads:compiled.approvedReads})});}finally{bootLife.close();}
   }});
   check(life.signal);ready.set(hash(binding),entry);return entry;
  }catch{if(entry)await entry.kickoff.close().catch(()=>{});fail();}finally{life.close();}
 }
 function ensure(value,stopOnly=false){const v=own(value,['binding'],['signal']),binding=data(v.binding);validateShape('RunBinding',binding);nativeSignal(v.signal);check(v.signal);const key=hash(binding);let record=cache.get(key);if(!record){record={issuanceStarted:false};record.promise=Promise.resolve().then(()=>build(binding,v.signal,record,stopOnly===true)).catch(error=>{if(!record.issuanceStarted)cache.delete(key);throw error;});cache.set(key,record);}return record.promise;}
 function close(){if(closing)return closing;closed=true;cancellation.abort();closing=(async()=>{await Promise.allSettled([...cache.values()].map(v=>v.promise));const results=await Promise.allSettled([...ready.values()].map(v=>v.kickoff.close()));if(results.some(v=>v.status==='rejected'))fail();})();return closing;}
 const getters=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
 const handled=/^\/v1\/(?:execution\/(?:kickoff(?:\/(?:status|stop))?|start|poll)|worker\/authorize|runner\/(?:runtime|native\/(?:bootstrap|prepare|verify|start|started|admitted)|checkpoint\/(?:capture|read|complete)|session\/(?:register|load|append|list-subkeys|snapshot)))$/u;
 const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 // The canonical HTTP owner owns the full body-inclusive operation lifetime. Lookup cannot create an entry or use control authority.
 const reads=createNativeReadsApplication({...(c.approvedReads===undefined?{}:{approvedReads:c.approvedReads}),now,owner:{async handle(operation,input,credential,signal,deadlineMs){check(signal);if(matchesCapability(credential,controlDigest))throw nativeReadFault('ACCESS_DENIED');const request=assertNativeReadRequest('runner/reads/'+operation,input),entry=ready.get(hash(request.binding));if(!entry)throw nativeReadFault('UNAVAILABLE');return entry.read(operation,request,credential,signal,deadlineMs);}}});
 async function handle(request){let life;try{
  if(types.isProxy(request)||!(request instanceof Request))fail();const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url),path=url.pathname;if(path.startsWith('/v1/runner/reads/'))return reads.handle(request);if(!handled.test(path))return null;
  const header=k=>Headers.prototype.get.call(info.headers,k),auth=header('authorization');if(!auth?.startsWith('Bearer '))fail();const credential=auth.slice(7),control=matchesCapability(credential,controlDigest),kickoffRoute=path.startsWith('/v1/execution/kickoff');
  if(kickoffRoute&&!control)fail();if(!control&&![...ready.values()].some(entry=>entry.matchesTaskCapability(credential)))return null;
  if(info.method!=='POST'||url.search||url.hash||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)fail();
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail();
  const cap=path.startsWith('/v1/runner/session/')?9437184:path==='/v1/runner/runtime'||path.startsWith('/v1/runner/checkpoint/')?2097152:path.startsWith('/v1/runner/native/')&&path!=='/v1/runner/native/bootstrap'?262144:131072;
  life=lifetime(info.signal);const clone=Request.prototype.clone.call(request),input=await jsonBody({body:clone.body,length:length===null?null:Number(length)},cap,life,life.check);life.check();
  if(!input||typeof input!=='object'||Array.isArray(input))fail();const binding=data(input.binding??input.original?.binding);validateShape('RunBinding',binding);if(input.binding&&input.original?.binding&&!same(input.binding,input.original.binding))fail();
  let entry=ready.get(hash(binding));
  if(path==='/v1/execution/kickoff'){
   own(input,['binding','executionKey']);if(input.executionKey!==hash(binding))fail();
   if(!entry){if(!isStaticOriginal(binding)&&!await initial(binding,life)){const reservation=await life.run(()=>readTarget(binding,life.check));life.check();if(!reservation)return null;}entry=await life.run(signal=>ensure({binding,signal}));}
   return await life.run(()=>entry.kickoffHttp.handle(request));
  }
  // The broker's independent stop (and the workflow's reconciliation) may reach a control process that has not seen this
  // accepted target since a restart: the entry is rebuilt from the same issuance (exact replay, no allocation) so its stop
  // reaches the canonical owners and the run reconciler. It never kicks off or allocates; it may serve a run that is already terminal.
  if(path==='/v1/execution/kickoff/stop'&&!entry){own(input,['binding','executionId']);if(input.executionId!==hash(binding))fail();if(isStaticOriginal(binding)||await initial(binding,life))return null;const reservation=await life.run(()=>readTarget(binding,life.check));life.check();if(!reservation)return null;entry=await life.run(signal=>ensure({binding,signal},true));}
  if(!entry)return null;if(!control&&!entry.matchesTaskCapability(credential))fail();
  if(kickoffRoute)return await life.run(()=>entry.kickoffHttp.handle(request));
  if(path==='/v1/runner/native/bootstrap'){
   own(input,['binding','versions']);if(!entry.matchesTaskCapability(credential))fail();return reply(await life.run(signal=>entry.bootstrap({...input,credential,signal})));
  }
  return await life.run(()=>entry.application.handle(request));
 }catch{return reply({error:{code:'PREPARED_RUN_REGISTRY_REFUSED'}},403);}finally{life?.close();}}
 return Object.freeze({ensure,get(binding){validateShape('RunBinding',binding);return ready.get(hash(binding))??null;},entries:()=>Object.freeze([...ready.values()]),handle,close});
}

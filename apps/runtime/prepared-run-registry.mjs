/** Lazy per-run composition; existing issuance/allocation/admission owners retain durability. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {types} from 'node:util';
import {jsonBody} from '../control/action-application/http.mjs';
import {allocateRemoteNativeController} from './native-authority/remote-composition.mjs';
import {compilePreparedRunFacts,parseTransport} from './prepared-run-issuance.mjs';
import {capabilityDigest,matchesCapability} from './native-authority/task-verifier.mjs';
import {createPreparedTaskKickoff} from './native-authority/prepared-kickoff.mjs';
import {createPreparedKickoffApplication,createPreparedRunnerReleaseClient} from './native-authority/prepared-kickoff-http.mjs';
const fail=()=>{throw Object.assign(Error('PREPARED_RUN_REGISTRY_REFUSED'),{code:'PREPARED_RUN_REGISTRY_REFUSED'});};
const same=(a,b)=>hash(a)===hash(b);
export function createPreparedRunRegistry(configuration){
 const c=own(configuration,['issuance','issuanceIntent','store','pool','client','identity','controlCapability','objects','limits'],['now','allocate','fetchImpl','maximumExpiresAtMs']);
 const now=c.now??Date.now,fetchImpl=c.fetchImpl??fetch,limits=own(c.limits,['maxRequestMs','maxFactBytes'],['cleanupMs','maxWaitMs']),controlDigest=capabilityDigest(c.controlCapability),cache=new Map(),ready=new Map(),cancellation=new AbortController();let closed=false,closing;
 const read=storageMethod(c.store,'read'),readTarget=storageMethod(c.store.nextRuns,'readTarget'),current=storageMethod(c.store.nextRuns,'current'),readAllocation=storageMethod(c.store.allocations,'read'),prepare=storageMethod(c.issuance,'prepare'),resolveFacts=storageMethod(c.issuance,'resolveFacts'),resolveCapability=storageMethod(c.issuance,'resolveCapability');
 if(typeof c.issuanceIntent!=='function'||typeof now!=='function'||typeof fetchImpl!=='function'||c.allocate!==undefined&&typeof c.allocate!=='function'||typeof c.controlCapability!=='string'||!/^\S{1,8192}$/u.test(c.controlCapability)||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072||limits.cleanupMs!==undefined&&(!Number.isSafeInteger(limits.cleanupMs)||limits.cleanupMs<1||limits.cleanupMs>30000)||limits.maxWaitMs!==undefined&&(!Number.isSafeInteger(limits.maxWaitMs)||limits.maxWaitMs<1||limits.maxWaitMs>1800000)||c.maximumExpiresAtMs!==undefined&&(!Number.isSafeInteger(c.maximumExpiresAtMs)||c.maximumExpiresAtMs<1))fail();
 const portLimits={maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes};
 const rootIdentity=own(c.identity,['origin','credential','commandContext','fetchImpl']);own(rootIdentity.commandContext,['binding','clientResolution']);
 function check(signal){if(closed||signal?.aborted)fail();}
 async function accepted(binding,life,expected){
  check(life.signal);const row=data(await life.run(()=>read(binding,{},life.check))),reservation=data(await life.run(()=>readTarget(binding,life.check))),selected=data(await life.run(()=>current(binding,life.check)));life.check();
  if(!same(row.run.binding,binding)||!['queued','starting','running'].includes(row.run.state)||!reservation||reservation.state!=='ACCEPTED'||!same(reservation.target,binding)||!same(reservation.scopes,row.run.scopes)||reservation.policyRevision!==row.run.policyRevision||!same(reservation.versions,row.run.versions)||selected.reserved!==false||!same(selected.binding,binding)||selected.policyRevision!==row.run.policyRevision||!same(selected.scopes,row.run.scopes)||expected&&!same(row.request,expected))fail();return {row,reservation};
 }
 function lifetime(signal,expiresAtMs=now()+limits.maxRequestMs){nativeSignal(signal);return createOperationLifetime({now,signal:signal?AbortSignal.any([signal,cancellation.signal]):cancellation.signal,deadlineMs:Math.min(expiresAtMs,now()+limits.maxRequestMs),errorFactory:()=>Error('PREPARED_RUN_REGISTRY_REFUSED')});}
 async function build(binding,signal,record){
  const life=lifetime(signal);let entry;
  try{
   const {row,reservation}=await accepted(binding,life),sourceSaved=data(await life.run(()=>readAllocation({binding:reservation.source,allocationKey:hash(reservation.source)},life.check)));life.check();
   if(!sourceSaved.record||!same(sourceSaved.record.original.binding,reservation.source)||sourceSaved.record.state!=='RETIRED'||sourceSaved.record.resource?.physicalStopProven!==true)fail();
   const source=data({original:sourceSaved.record.original,grantIntents:sourceSaved.record.grantIntents}),policy=data(own(await life.run(signal=>c.issuanceIntent({binding,source,request:row.request,signal})),['expiresAtMs']));life.check();
   if(!Number.isSafeInteger(policy.expiresAtMs)||policy.expiresAtMs<=now()||c.maximumExpiresAtMs!==undefined&&policy.expiresAtMs>c.maximumExpiresAtMs)fail();life.limitDeadline(policy.expiresAtMs);
   const intent={binding,requestSha256:hash(row.request),expiresAtMs:policy.expiresAtMs};record.issuanceStarted=true;
   const issued=data(await life.run(signal=>prepare({...intent,source,signal}))),facts=data(await life.run(signal=>resolveFacts(issued.issuance,{signal}))),capability=await life.run(signal=>resolveCapability(issued.issuance,{signal}));life.check();
   const compiled=compilePreparedRunFacts(facts,{intent,issuance:issued.issuance,now});
   if(!same(compiled.original,issued.original)||compiled.factsSha256!==issued.factsSha256||compiled.factsSha256!==issued.issuance.factsSha256||!same(compiled.original.versions,row.run.versions)||facts.qualification.policyRevision!==row.run.policyRevision||compiled.controlCapabilitySha256!==controlDigest||!matchesCapability(capability,issued.issuance.capabilitySha256))fail();
   // The delivery/transport contract is this entry's own, bound into the immutable facts hash above; nothing here is shared across entries.
   const transport=parseTransport(compiled.transport);if(!same(transport,issued.transport))fail();
   await accepted(binding,life,row.request);life.check();
   const original=compiled.original,identity={...rootIdentity,commandContext:{...rootIdentity.commandContext,binding}};let controller,pending,controllerClose;
   const closeController=()=>{if(!controller)return Promise.resolve();return controllerClose??=Promise.resolve().then(()=>controller.close());};
   let entryClosed=false;
   const lazy={get prepared(){return controller?.prepared;},allocate({signal}={}){nativeSignal(signal);check(signal);if(entryClosed)fail();if(!pending)pending=Promise.resolve().then(async()=>{
    const checkLife=lifetime(signal,original.expiresAtMs);try{await accepted(binding,checkLife,row.request);const replay=data(await checkLife.run(signal=>prepare({...intent,source,signal})));if(!same(replay,issued))fail();checkLife.check();}finally{checkLife.close();}
    check(signal);if(entryClosed)fail();return (c.allocate??allocateRemoteNativeController)({pool:c.pool,client:c.client,identity,allocationJson:facts.allocationJson,qualification:facts.qualification,grantIntents:facts.grantIntents,grantId:facts.grantId,operations:facts.operations,taskCapability:capability,controlCapabilitySha256:controlDigest,runtime:facts.runtime,plan:facts.plan,preparationIntent:facts.preparationIntent,taskRequest:facts.taskRequest,containerName:facts.containerName,limits:portLimits,objects:c.objects,enabled:true,now,transportFactory:({original})=>({original,origin:transport.origin,credential:c.controlCapability,fetchImpl,now})});
   }).then(async value=>{controller=value;if(closed||entryClosed){await closeController();fail();}return {original,resource:controller.resource};});return pending;},async reconcile({signal}={}){await lazy.allocate();return controller.reconcile({signal});},async close(){entryClosed=true;try{await pending;}catch{}await closeController();}};
   const runner=Object.fromEntries(['readiness','release'].map(method=>[method,value=>createPreparedRunnerReleaseClient({original,taskArn:value.taskArn,origin:transport.origin,credential:c.controlCapability,fetchImpl,now})[method](value)]));
   const kickoff=createPreparedTaskKickoff({original,controller:lazy,store:c.store,runner,enabled:true,now,maxRequestMs:limits.maxRequestMs,maxWaitMs:limits.maxWaitMs??Math.max(1,Math.min(1800000,original.expiresAtMs-now())),cleanupMs:limits.cleanupMs??3000}),kickoffHttp=createPreparedKickoffApplication({owner:kickoff,controlCapabilitySha256:controlDigest,enabled:true,now,maxRequestMs:limits.maxRequestMs});
   entry=Object.freeze({binding,original,kickoff,kickoffHttp,matchesTaskCapability:credential=>matchesCapability(credential,issued.issuance.capabilitySha256),application:Object.freeze({async handle(request){if(entryClosed||closed||!controller)return null;return await controller.application.handle(request)??await controller.supervisor.application.handle(request);}}),async bootstrap(value){
    const v=own(value,['binding','versions','credential'],['signal']),bootLife=lifetime(v.signal,original.expiresAtMs);try{check(bootLife.signal);if(entryClosed||!controller||!same(v.binding,binding)||!same(v.versions,original.versions)||!matchesCapability(v.credential,issued.issuance.capabilitySha256))fail();await accepted(binding,bootLife,row.request);await bootLife.run(signal=>controller.supervisor.taskVerifier.verify({capability, binding,operation:'load',inputSha256:hash({binding}),signal,deadlineMs:Math.min(now()+limits.maxRequestMs,original.expiresAtMs)}));const admitted=await bootLife.run(signal=>controller.prepared.preparationAuthorizer.admitted({original,signal}));bootLife.check();if(admitted.taskArn!==controller.resource.taskArn)fail();return data({original,preparationIntent:facts.preparationIntent,taskArn:admitted.taskArn,controlCapabilitySha256:controlDigest,processOrigin:transport.origin,http:transport.http,preparedKickoff:true});}finally{bootLife.close();}
   }});
   check(life.signal);ready.set(hash(binding),entry);return entry;
  }catch{if(entry)await entry.kickoff.close().catch(()=>{});fail();}finally{life.close();}
 }
 function ensure(value){const v=own(value,['binding'],['signal']),binding=data(v.binding);validateShape('RunBinding',binding);nativeSignal(v.signal);check(v.signal);const key=hash(binding);let record=cache.get(key);if(!record){record={issuanceStarted:false};record.promise=Promise.resolve().then(()=>build(binding,v.signal,record)).catch(error=>{if(!record.issuanceStarted)cache.delete(key);throw error;});cache.set(key,record);}return record.promise;}
 function close(){if(closing)return closing;closed=true;cancellation.abort();closing=(async()=>{await Promise.allSettled([...cache.values()].map(v=>v.promise));const results=await Promise.allSettled([...ready.values()].map(v=>v.kickoff.close()));if(results.some(v=>v.status==='rejected'))fail();})();return closing;}
 const getters=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
 const handled=/^\/v1\/(?:execution\/(?:kickoff(?:\/(?:status|stop))?|start|poll)|worker\/authorize|runner\/(?:runtime|native\/(?:bootstrap|prepare|verify|start|started|admitted)|checkpoint\/(?:capture|read|complete)|session\/(?:register|load|append|list-subkeys|snapshot)))$/u;
 const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 async function handle(request){let life;try{
  if(types.isProxy(request)||!(request instanceof Request))fail();const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url),path=url.pathname;if(!handled.test(path))return null;
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
   if(!entry){const reservation=await life.run(()=>readTarget(binding,life.check));life.check();if(!reservation)return null;entry=await life.run(signal=>ensure({binding,signal}));}
   return await life.run(()=>entry.kickoffHttp.handle(request));
  }
  if(!entry)return null;if(!control&&!entry.matchesTaskCapability(credential))fail();
  if(kickoffRoute)return await life.run(()=>entry.kickoffHttp.handle(request));
  if(path==='/v1/runner/native/bootstrap'){
   own(input,['binding','versions']);if(!entry.matchesTaskCapability(credential))fail();return reply(await life.run(signal=>entry.bootstrap({...input,credential,signal})));
  }
  return await life.run(()=>entry.application.handle(request));
 }catch{return reply({error:{code:'PREPARED_RUN_REGISTRY_REFUSED'}},403);}finally{life?.close();}}
 return Object.freeze({ensure,get(binding){validateShape('RunBinding',binding);return ready.get(hash(binding))??null;},entries:()=>Object.freeze([...ready.values()]),handle,close});
}

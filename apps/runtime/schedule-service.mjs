/** Owned startup for the existing schedule poller. Trusted firing authority and native admission are mandatory borrowed owners;
 * JSON configuration never selects or manufactures them. Common configuration is validated by the calling runtime entry point.
 *
 * Two ways to supply the owners (exactly one):
 *  `runtimePorts`         the finished record {authority, runAdmission, runControl, retirement, pool?, client?, now?} (tests, embedders);
 *  `runtimePortsFactory`  a trusted plain function the service calls ONCE, after it owns its pool, Temporal client and (when the
 *                         role declares `native`) its native capability client: `factory({pool, client, native?, configuration, now})`
 *                         must return that same record synchronously (schedule-service-owners.mjs composeRoutinesWorkerRuntimePorts
 *                         is the production factory, passed by cli.mjs). It is refused as configuration when it is not a plain
 *                         function, and as unavailable when its record is not complete, before any poller or listener starts; a
 *                         thrown factory tears the owned resources down. The factory never creates resources: the service does. */
import {Pool} from 'pg';
import {Connection,Client} from '@temporalio/client';
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {transact,assertPool} from '../control/product-persistence/transaction.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {temporalTls,temporalAuthorization} from './control.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {assembleScheduleDispatch,startScheduleWorker as startSchedulePoller} from './schedule-worker.mjs';
import {compileScheduleServiceConfiguration,SCHEDULE_NATIVE_MAX_REQUEST_MS} from './schedule-service-configuration.mjs';

const relations=Object.freeze(['meri_schedules.projections','meri_schedules.intents','meri_schedules.occurrences','meri_intents.preparations',
 'meri_conversations.conversations','meri_conversations.runs','meri_conversations.events','meri_conversations.controls','meri_conversations.initial_inputs','meri_conversations.initial_run_bindings',
 'meri_conversations.native_allocations','meri_conversations.checkpoints','meri_conversations.next_runs']);
function capture(value){
 try{
  const c=own(value,['authority','runAdmission','runControl','retirement'],['pool','client','now']);
  const authority=Object.freeze({authorize:storageMethod(c.authority,'authorize')}),runAdmission=Object.freeze({admit:storageMethod(c.runAdmission,'admit')}),now=c.now??Date.now;
  const runControl=Object.freeze({cancel:storageMethod(c.runControl,'cancel')}),retirement=Object.freeze({retire:storageMethod(c.retirement,'retire')});
  if(typeof now!=='function'||types.isProxy(now))throw Error();const at=now();if(!Number.isSafeInteger(at)||at<0)throw Error();
  if(c.pool!==undefined)assertPool(c.pool);
  if(c.client!==undefined&&(!c.client||typeof c.client!=='object'||types.isProxy(c.client)))throw Error();
  return Object.freeze({authority,runAdmission,runControl,retirement,now,...(c.pool===undefined?{}:{pool:c.pool}),...(c.client===undefined?{}:{client:c.client})});
 }catch{throw fault('SCHEDULE_SERVICE_UNAVAILABLE');}
}
/** Pure receiving seam over borrowed canonical resources. No listener, connection, credential read or SQL starts here. */
export function composeScheduleService({configuration,runtimePorts}){
 const p=capture(runtimePorts);compileScheduleServiceConfiguration(configuration);
 if(!p.pool||!p.client)throw fault('SCHEDULE_SERVICE_CONFIGURATION');
 return assembleScheduleDispatch({configuration,pool:p.pool,client:p.client,authority:p.authority,runAdmission:p.runAdmission,runControl:p.runControl,retirement:p.retirement,now:p.now});
}
function connectionString(bytes){
 let text,url;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim();url=new URL(text);}catch{throw fault('DATABASE_CONFIGURATION');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash||url.searchParams.getAll('sslmode').length!==1||url.searchParams.get('sslmode')!=='verify-full'||[...url.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
 return text;
}
async function checkSchema(pool,configuration,now,signal){
 const life=createOperationLifetime({now,signal,deadlineMs:now()+configuration.limits.requestMs,errorFactory:fault});
 try{
  await life.run(()=>transact(pool,async sqlClient=>{
   const result=await sqlClient.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[relations]);life.check();
   if(!Array.isArray(result.rows)||result.rows.length!==relations.length||new Set(result.rows.map(r=>r.name)).size!==relations.length||result.rows.some(r=>!relations.includes(r.name)||typeof r.relation!=='string'))throw fault('SCHEDULE_SCHEMA_UNAVAILABLE');
  },{readOnly:true,check:life.check,unavailable:'SCHEDULE_SCHEMA_UNAVAILABLE',uncertain:'SCHEDULE_SCHEMA_UNAVAILABLE'}));life.check();
 }finally{life.close();}
}
/** A trusted plain synchronous function, or undefined. Accessors, proxies, async and generator functions are configuration faults. */
function captureFactory(options){
 const c=own(options,[],['runtimePorts','runtimePortsFactory','signal']);
 const factory=c.runtimePortsFactory;
 if(factory===undefined)return null;
 if(c.runtimePorts!==undefined||typeof factory!=='function'||types.isProxy(factory)||types.isAsyncFunction(factory)||types.isGeneratorFunction(factory))throw fault('SCHEDULE_SERVICE_CONFIGURATION');
 return factory;
}
function produced(factory,resources){
 const supplied=Reflect.apply(factory,undefined,[Object.freeze(resources)]);
 if(supplied===undefined)throw fault('SCHEDULE_SERVICE_UNAVAILABLE');
 // A plain function can still return a Promise. Consume only a native rejection while refusing it; never run a then getter.
 if(types.isPromise(supplied)){Promise.prototype.then.call(supplied,undefined,()=>{});throw fault('SCHEDULE_SERVICE_UNAVAILABLE');}
 const p=capture(supplied);
 // The record may name the resources it was given, never others: the service owns and closes exactly what it created.
 if(p.pool!==undefined&&p.pool!==resources.pool||p.client!==undefined&&p.client!==resources.client)throw fault('SCHEDULE_SERVICE_UNAVAILABLE');
 return p;
}
export async function startScheduleWorker(configuration,options={}){
 const {runtimePorts,signal}=own(options,[],['runtimePorts','runtimePortsFactory','signal']);nativeSignal(signal);
 const factory=captureFactory(options),plan=compileScheduleServiceConfiguration(configuration);
 // Without a factory the owners must exist now; with one, every resource it will receive is owned here, so the pool needs its file.
 let p=factory===null?capture(runtimePorts):null;
 if((factory===null?!p.pool:true)&&plan.connectionFile===undefined)throw fault('SCHEDULE_SERVICE_CONFIGURATION');
 let ownedPool,ownedClientConnection,ownedClientAuthorization,poller,closing;
 const close=()=>closing??=(async()=>{
  const errors=[];for(const stop of [()=>poller?.close(),()=>ownedClientConnection?.close(),()=>ownedClientAuthorization?.close(),()=>ownedPool?.end()])try{await stop();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'SCHEDULE_SERVICE_CLEANUP_UNKNOWN');
 })();
 try{
  signal?.throwIfAborted();let pool=p?.pool,client=p?.client,native;
  if(!pool){const bytes=await readSecret(plan.connectionFile);signal?.throwIfAborted();ownedPool=new Pool({connectionString:connectionString(bytes),max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});pool=ownedPool;}
  if(!client){
   const tls=await temporalTls(configuration.temporal.tls);ownedClientAuthorization=await temporalAuthorization(configuration,{signal});signal?.throwIfAborted();
   ownedClientConnection=await Connection.connect({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs,...(ownedClientAuthorization?{apiKey:()=>ownedClientAuthorization.apiKey()}:{})});signal?.throwIfAborted();
   client=new Client({connection:ownedClientConnection,namespace:configuration.temporal.namespace});
  }
  if(factory!==null){
   // The native capability client (control's private native operations) is owned here too, only when the role declares it.
   if(plan.native!==undefined){
    const capability=await readSecret(plan.native.capabilityFile);signal?.throwIfAborted();
    native=createNativeCapabilityClient({configuration:plan.native,credential:new TextDecoder('utf-8',{fatal:true}).decode(capability).trim(),maxRequestMs:Math.min(configuration.limits.requestMs,SCHEDULE_NATIVE_MAX_REQUEST_MS)});
   }
   p=produced(factory,{pool,client,...(native===undefined?{}:{native}),configuration,now:Date.now});signal?.throwIfAborted();
  }
  const dispatch=composeScheduleService({configuration,runtimePorts:{...p,pool,client}});
  await checkSchema(pool,configuration,p.now,signal);signal?.throwIfAborted();
  poller=await startSchedulePoller(configuration,{dispatch,signal});signal?.throwIfAborted();
  return Object.freeze({address:poller.address,completion:poller.completion,close});
 }catch(error){await close().catch(()=>{});throw Object.assign(fault('SCHEDULE_SERVICE_STARTUP_FAILED'),{cause:error});}
}

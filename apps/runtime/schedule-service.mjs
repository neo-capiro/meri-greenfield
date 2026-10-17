/** Owned startup for the existing schedule poller. Trusted firing authority and native admission are mandatory borrowed owners;
 * JSON configuration never selects or manufactures them. Common configuration is validated by the calling runtime entry point. */
import {Pool} from 'pg';
import {Connection,Client} from '@temporalio/client';
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {transact,assertPool} from '../control/product-persistence/transaction.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {temporalTls,temporalAuthorization} from './control.mjs';
import {assembleScheduleDispatch,startScheduleWorker as startSchedulePoller} from './schedule-worker.mjs';
import {compileScheduleServiceConfiguration} from './schedule-service-configuration.mjs';

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
export async function startScheduleWorker(configuration,options={}){
 const {runtimePorts,signal}=own(options,[],['runtimePorts','signal']);nativeSignal(signal);
 const p=capture(runtimePorts),plan=compileScheduleServiceConfiguration(configuration);
 if(!p.pool&&plan.connectionFile===undefined)throw fault('SCHEDULE_SERVICE_CONFIGURATION');
 let ownedPool,ownedClientConnection,ownedClientAuthorization,poller,closing;
 const close=()=>closing??=(async()=>{
  const errors=[];for(const stop of [()=>poller?.close(),()=>ownedClientConnection?.close(),()=>ownedClientAuthorization?.close(),()=>ownedPool?.end()])try{await stop();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'SCHEDULE_SERVICE_CLEANUP_UNKNOWN');
 })();
 try{
  signal?.throwIfAborted();let pool=p.pool,client=p.client;
  if(!pool){const bytes=await readSecret(plan.connectionFile);signal?.throwIfAborted();ownedPool=new Pool({connectionString:connectionString(bytes),max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});pool=ownedPool;}
  if(!client){
   const tls=await temporalTls(configuration.temporal.tls);ownedClientAuthorization=await temporalAuthorization(configuration,{signal});signal?.throwIfAborted();
   ownedClientConnection=await Connection.connect({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs,...(ownedClientAuthorization?{apiKey:()=>ownedClientAuthorization.apiKey()}:{})});signal?.throwIfAborted();
   client=new Client({connection:ownedClientConnection,namespace:configuration.temporal.namespace});
  }
  const dispatch=composeScheduleService({configuration,runtimePorts:{...p,pool,client}});
  await checkSchema(pool,configuration,p.now,signal);signal?.throwIfAborted();
  poller=await startSchedulePoller(configuration,{dispatch,signal});signal?.throwIfAborted();
  return Object.freeze({address:poller.address,completion:poller.completion,close});
 }catch(error){await close().catch(()=>{});throw Object.assign(fault('SCHEDULE_SERVICE_STARTUP_FAILED'),{cause:error});}
}

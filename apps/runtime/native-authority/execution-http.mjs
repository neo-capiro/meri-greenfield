/** Fixed existing native execution/runtime routes; role-separated original caller capabilities. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {executionFault} from './execution-broker.mjs';
const getters=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function createNativeExecutionApplication(configuration){
 const c=own(configuration,['broker','runtime','controlCapabilitySha256','taskCapabilitySha256'],['enabled','now','maxRequestMs','readiness']);
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(c.runtime.taskCapabilitySha256!==c.taskCapabilitySha256||typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||[c.controlCapabilitySha256,c.taskCapabilitySha256].some(d=>typeof d!=='string'||!/^[a-f0-9]{64}$/u.test(d))||c.controlCapabilitySha256===c.taskCapabilitySha256)throw executionFault('CONFIGURATION');
 const routes=new Map([['/v1/execution/start',{call:storageMethod(c.broker,'start'),fields:['binding','executionKey'],digest:c.controlCapabilitySha256}],['/v1/execution/poll',{call:storageMethod(c.broker,'poll'),fields:['binding','executionId'],digest:c.controlCapabilitySha256}],['/v1/runner/runtime',{call:storageMethod(c.runtime,'runtime'),fields:['binding','versions'],digest:c.taskCapabilitySha256}]]);
 if(c.readiness)routes.set('/v1/readiness',{call:storageMethod(c.readiness,'check'),fields:[],digest:c.controlCapabilitySha256});
 const reply=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 return Object.freeze({async handle(request){let life;try{
  const input=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(input.url),route=routes.get(url.pathname);if(!route)return null;
  if(!enabled)return reply({error:{code:'NATIVE_EXECUTION_UNAVAILABLE'}},503);
  if(input.method!=='POST'||url.search)throw executionFault('REQUEST');const h=k=>Headers.prototype.get.call(input.headers,k),auth=h('authorization');
  if(!auth?.startsWith('Bearer ')||!matchesCapability(auth.slice(7),route.digest))throw executionFault('REFUSED');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(h('content-type')??'')||h('content-encoding'))throw executionFault('REQUEST');
  const length=h('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw executionFault('REQUEST');
  life=createOperationLifetime({now,signal:input.signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>executionFault('UNAVAILABLE')});
  const body=own(await jsonBody({body:input.body,length:length===null?null:Number(length)},url.pathname==='/v1/runner/runtime'?2097152:131072,life,life.check),route.fields,url.pathname==='/v1/runner/runtime'?['continuation','sourceRequest','request','scopes']:[]);
  const result=await life.run(signal=>route.call({...body,signal}));life.check();return reply(result);
 }catch(error){return reply({error:{code:error?.code==='NATIVE_EXECUTION_REFUSED'?'NATIVE_EXECUTION_REFUSED':'NATIVE_EXECUTION_UNAVAILABLE'}},error?.code==='NATIVE_EXECUTION_REFUSED'?403:503);}finally{life?.close();}}});
}

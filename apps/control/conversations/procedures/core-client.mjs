// @ts-check
/**
 * Attended Core transport for the protected procedure-runtime operation.
 *
 * Copies the exact discipline of apps/runtime/native-authority/routines-core-client.mjs: a fixed route, the verified
 * service identity header Core's ToolServiceSecretGuard requires, the native bearer resolved per call for the exact
 * run and selected client, redirect:'error', credentials:'omit', strict status/JSON validation, and the same live
 * session re-read after Core answers so a credential revoked during the round trip cannot be used.
 */
import {types} from 'node:util';
import {markAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {cancelBody,responseBody} from '../../../gateway/sources/json-response.mjs';
const fault=code=>Object.assign(Error('PROCEDURE_CORE_'+code),{code:'PROCEDURE_CORE_'+code});
const refuse=code=>{throw fault(code);};
const owned=error=>typeof error?.code==='string'&&error.code.startsWith('PROCEDURE_CORE_');
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
export const PROCEDURE_RUNTIME_ROUTE='/api/clio/procedure-runtime/validate';
const ROUTE_KEYS=['tenantId','actorId','conversationId','runId'];

export function createProcedureCoreClient(configuration){
 let c,origin,nativeCredentialFor;
 try{
  c=own(configuration,['origin','getServiceSecret','now'],['nativeCredentialFor','fetchImpl','maxRequestMs']);
  if(typeof c.origin!=='string'||typeof c.getServiceSecret!=='function'||typeof c.now!=='function')throw Error();
  const url=new URL(c.origin);if(url.protocol!=='https:')throw Error();origin=url.origin;
  if(c.nativeCredentialFor!==undefined){
   if(!c.nativeCredentialFor||typeof c.nativeCredentialFor!=='object'||types.isProxy(c.nativeCredentialFor))throw Error();
   const descriptor=Object.getOwnPropertyDescriptor(c.nativeCredentialFor,'nativeCredentialFor');
   if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function')throw Error();
   nativeCredentialFor=descriptor.value;
  }
  if(c.maxRequestMs!==undefined&&(!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000))throw Error();
 }catch{throw fault('CONFIGURATION');}
 const now=c.now,fetchImpl=c.fetchImpl??globalThis.fetch,maxRequestMs=c.maxRequestMs??10000;
 function session(binding,selectedClientId){
  let value;try{value=data(own({binding,selectedClientId},['binding','selectedClientId']));}catch{refuse('REQUEST');}
  if(!value.binding||typeof value.binding!=='object'||ROUTE_KEYS.some(key=>typeof value.binding[key]!=='string'||!value.binding[key]))refuse('REQUEST');
  if(value.selectedClientId!==null&&(typeof value.selectedClientId!=='string'||!value.selectedClientId))refuse('REQUEST');
  return value;
 }
 function bearer(selected,signal){
  if(nativeCredentialFor===undefined)refuse('SESSION_UNAVAILABLE');
  let issued;
  try{issued=data(own(Reflect.apply(nativeCredentialFor,c.nativeCredentialFor,[{binding:selected.binding,selectedClientId:selected.selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{refuse('SESSION_UNAVAILABLE');}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('SESSION_UNAVAILABLE');
  return issued;
 }
 /**
  * `{binding, selectedClientId, scope, selector, signal, deadlineMs}` -> the Core admission object.
  * The conversation and client come from the run binding and the run's own client scope, never from the selector.
  */
 async function resolve(value){
  let v,binding,selector;let life,acquired;
  try{
   v=own(value,['binding','selectedClientId','scope','selector'],['signal','deadlineMs']);nativeSignal(v.signal);
   binding=data(v.binding);selector=data(v.selector);
   if(v.scope!=='general'&&v.scope!=='client'||!(selector.source==='firm'||selector.source==='builtin'))refuse('REQUEST');
  }catch(error){if(owned(error))throw error;refuse('REQUEST');}
  const selected=session(binding,v.selectedClientId);
  try{
   const began=now();
   life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs??Infinity,began+maxRequestMs),errorFactory:fault});
   const first=bearer(selected,v.signal);life.limitDeadline(first.expiresAtMs);
   const secret=await life.run(()=>c.getServiceSecret());
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential)refuse('UNAVAILABLE');
   // The secret read is an await: the same session must still be live before anything is released.
   if(bearer(selected,v.signal).credential!==first.credential)refuse('SESSION_UNAVAILABLE');
   acquired=await life.run(signal=>Promise.resolve(fetchImpl(origin+PROCEDURE_RUNTIME_ROUTE,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
    body:JSON.stringify({conversationId:selected.binding.conversationId,clientId:selected.selectedClientId,scope:v.scope,selector})})));
   if(!(acquired instanceof Response)||types.isProxy(acquired))refuse('INVALID_RESULT');
   if(acquired.status!==200)refuse([400,401,403,404,409].includes(acquired.status)?'REFUSED':'UNAVAILABLE');
   let body;
   try{body=JSON.parse(await acquired.text());}catch{refuse('INVALID_RESULT');}
   if(!body||typeof body!=='object'||Array.isArray(body))refuse('INVALID_RESULT');
   // Core answered; the same session must still be live or the admission is not released.
   if(bearer(selected,v.signal).credential!==first.credential)refuse('SESSION_UNAVAILABLE');
   life.check();
   return body;
  }catch(error){
   if(owned(error)){if(error.code==='PROCEDURE_CORE_UNAVAILABLE')markAuthorityUnavailable(error);throw error;}
   throw Object.assign(fault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'UNAVAILABLE'),{cause:error});
  }finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}
 }
 return Object.freeze({origin,resolve,attended:nativeCredentialFor!==undefined});
}

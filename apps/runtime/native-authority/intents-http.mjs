/** P-INT-9, control side: the runner -> control conversation write-intent transport. Two fixed private POST routes on the same
 * task-authorized surface as `/v1/runner/reads/*` (prepared-run-registry / remote-composition), never on the public listener:
 *
 *  POST /v1/runner/intents/availability  {binding}                                    -> {binding,operations,checkedAtMs,expiresAtMs}
 *  POST /v1/runner/intents/prepare       {binding,operation:{id,version},arguments,deliveryId} -> the owner's prepare-only result
 *
 * Both take the run's TASK capability as Bearer. Authorization belongs to the trusted composer's `resolveRun`, exactly as the reads
 * owner is reached through the registry entry: it must refuse the control capability and any credential that is not the issued task
 * capability of the run named by `binding`, and it returns that run's control intent mount (`apps/control/intents/mount.mjs`,
 * `{readAvailability, prepare}`), whose preparers' canonical owners recheck current authority and whose journal owns replay. This
 * module adds transport bounds only: closed bodies, a byte ceiling, a deadline, closed failure codes and the rule that once
 * `prepare` reached the mount, any failure without an owner-closed code is UNKNOWN (a proposal may exist; never retried here).
 * An optional `controlCapabilitySha256` refuses the control credential before `resolveRun` is consulted.
 *
 * Construction is inert: no listener, owner call, timer or allocation. `enabled` defaults to false (UNAVAILABLE after route checks). */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody,response,ApplicationError} from '../../control/action-application/http.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {RUNNER_INTENT_FAILURES,RUNNER_INTENT_PATHS,RUNNER_INTENT_AVAILABILITY_MS,runnerIntentFault,runnerIntentCode as closed,runnerIntentRequest,runnerIntentAvailability} from './intents-client.mjs';
export {RUNNER_INTENT_FAILURES,RUNNER_INTENT_PATHS,runnerIntentFault};
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function createRunnerIntentsApplication(configuration){
 const c=own(configuration,['resolveRun'],['enabled','now','limits','controlCapabilitySha256']),now=c.now??Date.now,enabled=c.enabled??false;
 const limits=c.limits===undefined?{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:30000}:own(c.limits,['maxRequestBytes','maxResponseBytes','maxPrepareMs']);
 if(typeof c.resolveRun!=='function'||types.isProxy(c.resolveRun)||typeof now!=='function'||typeof enabled!=='boolean'||!integer(limits.maxRequestBytes,1,1048576)||!integer(limits.maxResponseBytes,1,2097152)||!integer(limits.maxPrepareMs,1000,60000)||
  c.controlCapabilitySha256!==undefined&&(typeof c.controlCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.controlCapabilitySha256)))throw runnerIntentFault('UNAVAILABLE');
 const resolveRun=c.resolveRun;
 return Object.freeze({paths:Object.freeze(Object.values(RUNNER_INTENT_PATHS)),async handle(request){let info,life,dispatched=false;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))throw runnerIntentFault('INVALID_ARGUMENTS');info=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)]));
  const url=new URL(info.url),route=/^\/v1\/runner\/intents\/(availability|prepare)$/u.exec(url.pathname)?.[1];
  if(!route||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
  if(!enabled)throw runnerIntentFault('UNAVAILABLE');const header=k=>Headers.prototype.get.call(info.headers,k),auth=header('authorization');
  if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(auth??''))return response({error:{code:'ACCESS_DENIED'}},401);
  const credential=auth.slice(7);if(c.controlCapabilitySha256!==undefined&&matchesCapability(credential,c.controlCapabilitySha256))throw runnerIntentFault('ACCESS_DENIED');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))throw runnerIntentFault('INVALID_ARGUMENTS');
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw runnerIntentFault('INVALID_ARGUMENTS');if(length!==null&&Number(length)>limits.maxRequestBytes)throw runnerIntentFault('RESOURCE_LIMIT');
  const deadlineMs=now()+(route==='prepare'?limits.maxPrepareMs:RUNNER_INTENT_AVAILABILITY_MS);life=createOperationLifetime({now,deadlineMs,signal:info.signal,errorFactory:runnerIntentFault});
  let input;try{input=await jsonBody({...info,length:length===null?null:Number(length)},limits.maxRequestBytes,life,life.check);}catch(error){if(closed(error))throw error;const tooLarge=error&&!types.isProxy(error)&&error instanceof ApplicationError&&error.message==='REQUEST_TOO_LARGE';throw runnerIntentFault(tooLarge?'RESOURCE_LIMIT':'INVALID_ARGUMENTS');}
  const v=runnerIntentRequest(route,input);
  let mount;try{mount=await life.run(signal=>resolveRun({binding:v.binding,credential,operation:'runner/intents/'+route,signal,deadlineMs}));}catch(error){const code=closed(error);throw runnerIntentFault(code==='ACCESS_DENIED'||code==='DEADLINE'||code==='CANCELLED'?code:'UNAVAILABLE');}
  let readAvailability,prepare;try{readAvailability=storageMethod(mount,'readAvailability');prepare=storageMethod(mount,'prepare');}catch{throw runnerIntentFault('UNAVAILABLE');}
  if(route==='availability'){const raw=await life.run(signal=>readAvailability({signal}));life.check();const result=runnerIntentAvailability(raw,v.binding,now());
   if(Buffer.byteLength(JSON.stringify(result),'utf8')>limits.maxResponseBytes)throw runnerIntentFault('UNAVAILABLE');return response(result);}
  dispatched=true;const raw=await life.run(signal=>prepare({operation:v.operation,arguments:v.arguments,deliveryId:v.deliveryId,signal}));
  // The preparation exists from here on. A result that cannot be released intact is UNKNOWN, never a refusal inviting a retry.
  let result;try{result=data(raw);}catch{throw runnerIntentFault('UNKNOWN');}
  if(result===null||typeof result!=='object'||Array.isArray(result)||Buffer.byteLength(JSON.stringify(result),'utf8')>limits.maxResponseBytes)throw runnerIntentFault('UNKNOWN');
  life.check();return response(result);
 }catch(error){let code=closed(error)??(dispatched?'UNKNOWN':'UNAVAILABLE');if(dispatched&&(code==='DEADLINE'||code==='CANCELLED'||code==='RESOURCE_LIMIT'))code='UNKNOWN';return response({error:{code}},RUNNER_INTENT_FAILURES[code]);}
 finally{life?.close();try{if(info?.body&&!info.body.locked)void info.body.cancel().catch(()=>{});}catch{}}}});
}

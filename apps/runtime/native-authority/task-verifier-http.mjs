/** Private trusted-control receiving boundary for the existing worker/authorize wire. */
import {types} from 'node:util';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {matchesCapability,taskFault} from './task-verifier.mjs';
export function createNativeTaskVerifierApplication(configuration){
 const c=own(configuration,['verifier','callerCapabilitySha256','taskCapabilitySha256'],['enabled','now','maxRequestMs']);
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  [c.callerCapabilitySha256,c.taskCapabilitySha256].some(d=>typeof d!=='string'||!/^[a-f0-9]{64}$/u.test(d))||c.callerCapabilitySha256===c.taskCapabilitySha256)throw taskFault('CONFIGURATION');
 const verify=storageMethod(c.verifier,'verify'),reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))throw taskFault('REQUEST');
  const url=new URL(request.url);if(url.pathname!=='/v1/worker/authorize')return null;
  if(url.search||request.method!=='POST')return reply({error:{code:'NATIVE_TASK_REQUEST'}},400);
  if(!enabled)return reply({error:{code:'NATIVE_TASK_UNAVAILABLE'}},503);
  const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer ')||!matchesCapability(bearer.slice(7),c.callerCapabilitySha256))throw taskFault('REFUSED');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw taskFault('REQUEST');
  const length=request.headers.get('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw taskFault('REQUEST');
  const deadlineMs=now()+maxRequestMs;nativeSignal(request.signal);life=createOperationLifetime({now,deadlineMs,signal:request.signal,errorFactory:()=>taskFault('REFUSED')});
  const input=own(await jsonBody({body:request.body,length:length===null?null:Number(length)},131072,life,life.check),['capability','binding','operation','inputSha256']);
  const receipt=await life.run(signal=>verify({...input,signal,deadlineMs}));life.check();return reply(receipt);
 }catch{return reply({error:{code:'NATIVE_TASK_REFUSED'}},403);}finally{life?.close();}}});
}

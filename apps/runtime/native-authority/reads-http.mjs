/** Two fixed private POST routes. No listener or entry/bootstrap authority. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeReadConfiguration,nativeReadFault,nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody,response,ApplicationError} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const status={CONFIGURATION:503,INVALID_ARGUMENTS:400,ACCESS_DENIED:403,UNAVAILABLE:503,DEADLINE:408,CANCELLED:408,INVALID_RESULT:502,RESOURCE_LIMIT:413,BUDGET_UNCERTAIN:409};
export function createNativeReadsApplication(configuration){
 const c=own(configuration,['owner','approvedReads'],['now']),config=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),handle=storageMethod(c.owner,'handle'),now=c.now??Date.now;if(typeof now!=='function')throw nativeReadFault('CONFIGURATION');
 return Object.freeze({async handle(request){let info,life;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))throw nativeReadFault('INVALID_ARGUMENTS');info=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)]));
  const url=new URL(info.url),route=/^\/v1\/runner\/reads\/(availability|execute)$/u.exec(url.pathname);
  if(!route||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
  if(!config?.enabled)throw nativeReadFault('UNAVAILABLE');const header=k=>Headers.prototype.get.call(info.headers,k),credential=header('authorization');
  if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(credential??''))return response({error:{code:'ACCESS_DENIED'}},401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))throw nativeReadFault('INVALID_ARGUMENTS');
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))throw nativeReadFault('INVALID_ARGUMENTS');if(length!==null&&Number(length)>config.maxRequestBytes)throw nativeReadFault('RESOURCE_LIMIT');
  const deadlineMs=now()+(route[1]==='execute'?config.maxExecuteMs:3000);life=createOperationLifetime({now,deadlineMs,signal:info.signal,errorFactory:nativeReadFault});
  let input;try{input=await jsonBody({...info,length:length===null?null:Number(length)},config.maxRequestBytes,life,life.check);}catch(error){if(nativeReadFailureCode(error))throw error;const tooLarge=error&&!types.isProxy(error)&&error instanceof ApplicationError&&error.message==='REQUEST_TOO_LARGE';throw nativeReadFault(tooLarge?'RESOURCE_LIMIT':'INVALID_ARGUMENTS');}
  const result=await life.run(signal=>handle(route[1],input,credential.slice(7),signal,deadlineMs));life.check();if(Buffer.byteLength(JSON.stringify(result),'utf8')>config.maxResponseBytes)throw nativeReadFault('RESOURCE_LIMIT');return response(result);
 }catch(error){const code=nativeReadFailureCode(error)??'UNAVAILABLE';return response({error:{code}},status[code]??503);}finally{life?.close();try{if(info?.body&&!info.body.locked)void info.body.cancel().catch(()=>{});}catch{}}}});
}

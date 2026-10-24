/** Per-request native owner resolution -> unchanged canonical document application. */
import {types} from 'node:util';
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createDocumentApplication} from '../../control/document-application/index.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {requestInfo,jsonBody,errorResponse} from '../../control/document-application/http.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
function method(port,name){if(!port||typeof port!=='object'||types.isProxy(port))fail('ARTIFACT_RUNTIME_CONFIGURATION');const d=Object.getOwnPropertyDescriptor(port,name);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))fail('ARTIFACT_RUNTIME_CONFIGURATION');const fn=d.value;return (...args)=>Reflect.apply(fn,port,args);}
export function createRuntimeArtifactApplication(configuration){const c=own(configuration,['sessions','now','limits'],['optionsOwner','retention']),limits=data(own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']));
 if(typeof c.now!=='function'||Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1)||limits.maxRequestMs>60000||limits.maxRequestBytes>2097152||limits.maxResponseBytes>16777216||c.retention!==undefined&&typeof c.retention?.assertServable!=='function')fail('ARTIFACT_RUNTIME_CONFIGURATION');
 const resolve=c.optionsOwner===undefined?undefined:method(c.optionsOwner,'resolve');
 return Object.freeze({async handle(request,callerOptions={}){let life;const state={};try{const info=requestInfo(request);if(!resolve)fail('UNAVAILABLE');
  const caller=own(callerOptions,[],['deadlineMs']);if(caller.deadlineMs!==undefined&&!Number.isSafeInteger(caller.deadlineMs))fail('ACCESS_DENIED');
  const requestStarted=c.now(),deadlineMs=Math.min(requestStarted+limits.maxRequestMs,caller.deadlineMs??Infinity);life=createOperationLifetime({deadlineMs,now:c.now,signal:info.signal,errorFactory:code=>new CommandError(code)});
  const body=data(await jsonBody(info,limits.maxRequestBytes,life,life.check)),requestSha256=hash({intent:info.intent,body});
  const rawResolved=await life.run(signal=>resolve({credential:info.credential,intent:info.intent,body,requestSha256,deadlineMs,signal}));if(rawResolved===null||rawResolved===undefined)fail('UNAVAILABLE');
  const resolved=own(rawResolved,['documentOptions','recheck']),recheck=method(rawResolved,'recheck');
  const options=own(resolved.documentOptions,['sessions','selectedClientId','artifactOptions','now','limits'],['enabled','admitPdf','previewOptions','nativeFiles']);if(options.sessions!==c.sessions||options.now!==c.now)fail('ACCESS_DENIED');
  const innerLimits=documentLimits(options.limits),effectiveLimits=Object.fromEntries(Object.keys(limits).map(key=>[key,Math.min(limits[key],innerLimits[key])]));
  const effectiveDeadlineMs=Math.min(deadlineMs,requestStarted+effectiveLimits.maxRequestMs);life.limitDeadline(effectiveDeadlineMs);
  const o=own(options.artifactOptions,['pool','context','validators','authorize','versions','objects','executor','now','ids'],['retention']);
  if(c.retention!==undefined)o.retention=c.retention;o.context=v.context(o.context);life.limitDeadline(o.context.deadlineMs);
  const pinned=hash({intent:info.intent,body});
  async function fresh(phase){life.check();if(hash({intent:info.intent,body})!==pinned)fail('ACCESS_DENIED');
   await life.run(signal=>recheck({phase,intent:info.intent,requestSha256,resource:null,signal,deadlineMs:Math.min(o.context.deadlineMs,effectiveDeadlineMs)}));life.check();}
  // Current session checks remain in the document owner. Core is observed at admission and release,
  // never multiplied around every local immutable storage operation.
  const app=createDocumentApplication({...options,limits:effectiveLimits,artifactOptions:o});
  await fresh('admission');const serialized=JSON.stringify(body),headers=new Headers(info.headers);headers.set('content-length',String(Buffer.byteLength(serialized)));
  state.writeStarted=['create','revise','preview-publish'].includes(info.intent);state.readStarted=!state.writeStarted;
  const response=await life.run(signal=>app.handle(new Request(info.url,{method:info.method,headers,body:serialized,signal})));if(response.status!==200)return response;state.completed=true;
  await fresh('release');life.check();return response;
 }catch(error){return errorResponse(error,state);}finally{life?.close();}}});
}

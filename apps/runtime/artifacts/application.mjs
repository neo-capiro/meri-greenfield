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
 return Object.freeze({async handle(request){let life;const state={};try{const info=requestInfo(request);if(!resolve)fail('UNAVAILABLE');
  const deadlineMs=c.now()+limits.maxRequestMs;life=createOperationLifetime({deadlineMs,now:c.now,signal:info.signal,errorFactory:code=>new CommandError(code)});
  const body=data(await jsonBody(info,limits.maxRequestBytes,life,life.check)),requestSha256=hash({intent:info.intent,body});
  const rawResolved=await life.run(signal=>resolve({credential:info.credential,intent:info.intent,body,requestSha256,deadlineMs,signal}));if(rawResolved===null||rawResolved===undefined)fail('UNAVAILABLE');
  const resolved=own(rawResolved,['documentOptions','recheck']),recheck=method(rawResolved,'recheck');
  const options=own(resolved.documentOptions,['sessions','selectedClientId','artifactOptions','credential','now','limits'],['enabled']);if(options.sessions!==c.sessions||options.now!==c.now)fail('ACCESS_DENIED');
  const innerLimits=documentLimits(options.limits);
  const effectiveLimits=Object.fromEntries(Object.keys(limits).map(key=>[key,Math.min(limits[key],innerLimits[key])]));
  const effectiveDeadlineMs=deadlineMs-limits.maxRequestMs+effectiveLimits.maxRequestMs;life.limitDeadline(effectiveDeadlineMs);
  const o=own(options.artifactOptions,['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled','namespace']);
  // The runtime's canonical retention gate is bound here, never taken from the resolved owner options.
  if(c.retention!==undefined)o.retention=c.retention;
  o.context=v.context(o.context);
  const pinned=hash({intent:info.intent,body});life.limitDeadline(o.context.deadlineMs);
  async function fresh(phase,resource=null){life.check();if(hash({intent:info.intent,body})!==pinned)fail('ACCESS_DENIED');
   const result=await life.run(signal=>recheck({phase,intent:info.intent,requestSha256,resource:resource===null?null:data(resource),signal,deadlineMs:Math.min(o.context.deadlineMs,effectiveDeadlineMs)}));
   // A boolean callback result cannot serve as a source/renderer qualification.
   if(result!==undefined&&(result===null||typeof result!=='object'))fail('ACCESS_DENIED');life.check();}
  const wrap=(port,name,resource=()=>null)=>{const invoke=method(port,name);return async(...args)=>{await fresh('effect',resource(args));const value=await life.run(()=>invoke(...args));await fresh('effect',resource(args));return value;};};
  const authority={check:wrap(o.authority,'check',args=>args[0]?.input??null)},authorize=o.authorize;
  if(typeof authorize!=='function'||types.isProxy(authorize))fail('ACCESS_DENIED');
  const app=createDocumentApplication({...options,limits:effectiveLimits,artifactOptions:{...o,authority,async authorize(call){await fresh('effect',call.resource);const result=await life.run(()=>authorize(call));await fresh('effect',call.resource);return result;},
   versions:{read:wrap(o.versions,'read',args=>typeof args[0]==='string'?{versionId:args[0]}:args[0]),commit:wrap(o.versions,'commit',args=>({versionId:args[0].version.versionId,object:args[0].version.object}))},
   objects:{get:wrap(o.objects,'get',args=>args[0]),put:wrap(o.objects,'put')},executor:{execute:wrap(o.executor,'execute')}}});
  await fresh('admission');const serialized=JSON.stringify(body),headers=new Headers(info.headers);headers.set('content-length',String(Buffer.byteLength(serialized)));
  state.writeStarted=['create','revise'].includes(info.intent);state.readStarted=!state.writeStarted;
  const response=await life.run(signal=>app.handle(new Request(info.url,{method:info.method,headers,body:serialized,signal})));if(response.status!==200)return response;state.completed=true;
  await fresh('release');life.check();return response;
 }catch(error){return errorResponse(error,state);}finally{life?.close();}}});
}

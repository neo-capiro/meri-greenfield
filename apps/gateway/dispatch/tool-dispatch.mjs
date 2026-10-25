/** One bounded typed read. Core owns access; the SDK owns the model/tool loop. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from './dispatch-lifetime.mjs';
import {deny,exactKeys,parseRawJson,rejectArgumentAuthority,safeFailure} from './operation-result.mjs';
import {assertOperationArguments,prepareOperationContext} from './operation-context.mjs';
import {assertDispatchResult} from './read-result-envelope.mjs';
import {assertProjectionConfiguration} from './projection-read-context.mjs';
import {nativeContextPortsFor} from './native-read-context.mjs';
import {signedRetainedSourceId} from '../sources/retained-reads/signed-source-operations.mjs';
import {assertReadContext} from '../sources/source-admission.mjs';
const same=(a,b)=>hash(a)===hash(b);
const selection=value=>value;
const sameContext=(a,b)=>same({...a,subject:selection(a.subject),deadlineMs:0},{...b,subject:selection(b.subject),deadlineMs:0});

export function createToolDispatch({catalog,current,contextFor,limits,now,newId,sourceEnabled=false,
 memoryContextPorts,mailContextPorts,retainedContextPorts,nativeReadContextPorts,defaultCongress}){
 if(!catalog||typeof catalog.entry!=='function'||typeof current!=='function'||typeof contextFor!=='function'||
  typeof now!=='function'||typeof newId!=='function'||typeof sourceEnabled!=='boolean'||!limits||
  ['maxRequestBytes','maxResponseBytes','maxRequestMs'].some(key=>!Number.isSafeInteger(limits[key])||limits[key]<1)||
  limits.maxRequestBytes>16777216||limits.maxResponseBytes>16777216||limits.maxRequestMs>3600000)deny('GATEWAY_CONFIGURATION');
 assertProjectionConfiguration(defaultCongress);
 async function execute(requestJson,signal){
  const request=parseRawJson(requestJson,limits.maxRequestBytes);exactKeys(request,['operation','arguments']);exactKeys(request.operation,['id','version']);
  rejectArgumentAuthority(request.arguments);const entry=catalog.entry(request.operation);
  if(!sourceEnabled||!entry)deny('UNAVAILABLE');
  if(!same(entry.descriptor.operation,request.operation)||entry.descriptor.sideEffect!=='none'||entry.descriptor.approvalBoundary!=='none')deny('GATEWAY_CONFIGURATION');
  assertOperationArguments(entry,request.arguments);
  const invocationId=newId();if(typeof invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(invocationId))deny('GATEWAY_CONFIGURATION');
  let deadlineMs=now()+limits.maxRequestMs;
  const owned=createDispatchLifetime({deadlineMs,now,signal});
  const life={...owned,limitDeadline(next){owned.limitDeadline(next);deadlineMs=Math.min(deadlineMs,next);}};
  try{
   const identity=await life.run(()=>current());life.limitDeadline(identity.execution.expiresAtMs);
   const readContext=async input=>{
    const latest=await life.run(()=>current());
    if(!same(latest,identity))deny('ACCESS_DENIED');
    const result=assertReadContext(await life.run(signal=>contextFor({entry,input,current:latest,signal,deadlineMs})),request.operation,now);
    if(!same(result.binding,identity.execution.binding)||result.executionSha256!==identity.executionSha256||result.policyRevision!==identity.policyRevision||!same(result.scopes,identity.scopes))deny('ACCESS_DENIED');
    life.limitDeadline(result.deadlineMs);return result;
   };
   const context=await prepareOperationContext({entry,request:request.arguments,identity,contextFor:readContext,
    ports:memoryContextPorts,mailPorts:mailContextPorts,retainedPorts:retainedContextPorts,nativePorts:nativeContextPortsFor(nativeReadContextPorts,invocationId),
    lifetime:life,readDeadline:()=>deadlineMs,now,maxBytes:limits.maxResponseBytes,defaultCongress});
   let normalized;try{normalized=context.normalized??entry.contract.normalizeInput(request.arguments,context.options(context.authority));}catch{deny('INVALID_ARGUMENTS');}
   if(!normalized||hash(normalized.input)!==normalized.argumentsSha256)deny('INVALID_ARGUMENTS');
   const effect=await readContext(normalized.input);
   if(context.authority&&!sameContext(context.authority,effect))deny('ACCESS_DENIED');
   await context.observeAuthority(effect);
   const memoryPage=request.operation.id==='search_memory'&&request.operation.version==='0.2.0';let memoryEligibilityObserved=false;
   const limitReleaseDeadline=expiry=>{if(!memoryPage||memoryEligibilityObserved||!Number.isSafeInteger(expiry)||expiry<=now()||expiry>deadlineMs)deny('ACCESS_DENIED');life.limitDeadline(expiry);memoryEligibilityObserved=true;};
   const correlated=signedRetainedSourceId(request.operation.id)||['query_tasks','query_action_items'].includes(request.operation.id);
   const projection=['bound-projection/1','client-documents/1'].includes(entry.contract.binding?.dispatchProfile);
   const outputJson=await life.run(signal=>entry.execute({input:normalized.input,request:normalized.request,authority:effect,argumentsSha256:normalized.argumentsSha256,
    ...(projection||context.handlerNormalization?{normalizationContext:context.options(effect)}:{}),...(correlated?{invocationId}:{}),...(memoryPage?{limitReleaseDeadline}:{}),signal}));
   if(memoryPage&&!memoryEligibilityObserved)deny('INVALID_RESULT');
   const output=parseRawJson(outputJson,Math.min(limits.maxResponseBytes,effect.maxOutputBytes),'INVALID_RESULT');
   const result=assertDispatchResult({entry,output,authority:effect,normalized,context});
   const release=await readContext(normalized.input);if(!sameContext(effect,release))deny('ACCESS_DENIED');
   await context.observeAuthority(release,{finalRelease:true});await context.retain({current:release,normalized,result});
   await life.run(()=>current());life.check();return outputJson;
  }catch(error){life.check();throw safeFailure(error);}finally{life.close();}
 }
 return Object.freeze({execute});
}

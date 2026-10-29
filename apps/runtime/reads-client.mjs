/** Worker-side two-method task transport. No user/provider credential or SQL dependency. */
import {types} from 'node:util';
import catalog from '../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,assertNativeReadConfiguration,assertNativeReadRequest,assertNativeReadResponse,assertNativeReadExternalFacts,nativeReadFault,nativeReadFailureCode} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const get=Object.fromEntries(['status','headers','body','redirected','url'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
const fail=code=>{throw nativeReadFault(code);};
export function createNativeReadsClient(configuration){
 const c=own(configuration,['origin','credential','binding','fetchImpl'],['approvedReads','now']),config=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),binding=data(c.binding),now=c.now??Date.now;let origin;
 try{const u=new URL(c.origin);if(u.protocol!=='https:'||u.pathname!=='/'||u.username||u.password||u.search||u.hash||u.origin!==c.origin)fail('CONFIGURATION');origin=u.origin;}catch{fail('CONFIGURATION');}
 validateShape('RunBinding',binding);if(typeof c.credential!=='string'||!/^\S{1,8192}$/u.test(c.credential)||typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||typeof now!=='function')fail('CONFIGURATION');const fetchImpl=c.fetchImpl,credential=c.credential;let pin;
 // Run-scoped external accounting: each control response carries only the delta of one execute request,
 // so the client owns the run's aggregate. Bounded, content-free, and honest about what was not observed.
 const MAX_CALLS=8,MAX_UNOBSERVED=4;
 const usage={provider:undefined,calls:[],truncated:false,unobserved:[],seen:new Set()};
 function recordFacts(facts,deliveryId){
  if(usage.seen.has(deliveryId))return;usage.seen.add(deliveryId);
  usage.provider??=facts.provider;
  for(const call of facts.calls){if(usage.calls.length>=MAX_CALLS){usage.truncated=true;break;}usage.calls.push(call);}
  if(facts.truncated)usage.truncated=true;
 }
 function recordUnobserved(deliveryId){
  if(usage.seen.has(deliveryId))return;usage.seen.add(deliveryId);
  if(usage.unobserved.length>=MAX_UNOBSERVED){usage.truncated=true;return;}usage.unobserved.push(deliveryId);
 }
 function usageSnapshot(){
  if(!usage.calls.length&&!usage.unobserved.length)return undefined;
  const attempts=usage.calls.reduce((n,call)=>n+call.attempts,0);
  const estimateMicroUsd=usage.calls.reduce((n,call)=>n+call.estimateMicroUsd,0);
  const unknown=usage.unobserved.length>0||usage.calls.some(call=>call.outcome==='unknown');
  const failed=usage.calls.some(call=>call.outcome==='failed');
  return Object.freeze({provider:usage.provider,attempts,estimateMicroUsd,billedMicroUsd:null,
   outcome:unknown?'unknown':failed?'failed':'completed',calls:Object.freeze(usage.calls.slice()),
   truncated:usage.truncated,incomplete:usage.unobserved.length>0,unobserved:Object.freeze(usage.unobserved.slice())});
 }
 async function call(operation,fields,signal){if(!config?.enabled)fail('UNAVAILABLE');nativeSignal(signal);const full='runner/reads/'+operation,request=assertNativeReadRequest(full,{schemaVersion,binding,...fields}),body=JSON.stringify(request);if(Buffer.byteLength(body,'utf8')>config.maxRequestBytes)fail('RESOURCE_LIMIT');
  const started=now(),deadlineMs=started+(operation==='execute'?config.maxExecuteMs:3000),life=createOperationLifetime({now,deadlineMs,signal,errorFactory:nativeReadFault});let response,reader,dispatched=false;
  try{dispatched=true;response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(origin+'/v1/'+full,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,signal}));pending.then(r=>{if(life.signal.aborted)try{get.body.call(r)?.cancel().catch(()=>{});}catch{}},()=>{});return pending;});
   if(types.isProxy(response)||!(response instanceof Response)||get.redirected.call(response))fail('UNAVAILABLE');const responseUrl=get.url.call(response);if(responseUrl&&responseUrl!==origin+'/v1/'+full)fail('UNAVAILABLE');
   const headers=get.headers.call(response),header=k=>Headers.prototype.get.call(headers,k),stream=get.body.call(response);if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!stream)fail('INVALID_RESULT');
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>config.maxResponseBytes))fail('RESOURCE_LIMIT');reader=stream.getReader();let bytes=0;const chunks=[];
   while(true){const part=await life.run(()=>reader.read());if(part.done)break;if(!(part.value instanceof Uint8Array))fail('INVALID_RESULT');bytes+=part.value.byteLength;if(bytes>config.maxResponseBytes)fail('RESOURCE_LIMIT');chunks.push(part.value);}if(length!==null&&bytes!==Number(length))fail('INVALID_RESULT');
   let raw;try{raw=data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));}catch{fail('INVALID_RESULT');}
   if(get.status.call(response)!==200){own(raw,['error'],['externalUsage']);own(raw.error,['code']);
    if(raw.externalUsage!==undefined)recordFacts(assertNativeReadExternalFacts(raw.externalUsage),request.deliveryId===undefined?hash(request):request.deliveryId);if(!['ACCESS_DENIED','UNAVAILABLE','DEADLINE','CANCELLED','INVALID_RESULT','RESOURCE_LIMIT','BUDGET_UNCERTAIN','INVALID_ARGUMENTS','SOURCE_PUBLICATION_UNKNOWN','SOURCE_PUBLICATION_CONFLICT'].includes(raw.error.code))fail('UNAVAILABLE');fail(raw.error.code);}
   const result=assertNativeReadResponse(full,raw,{request,started,now,policyRevision:pin?.policyRevision,executionSha256:pin?.executionSha256,maxResponseBytes:config.maxResponseBytes});
   life.limitDeadline(Math.min(result.expiresAtMs,deadlineMs));life.check();return result;
  }catch(error){throw nativeReadFault(nativeReadFailureCode(error)??(operation==='execute'&&dispatched?'BUDGET_UNCERTAIN':'UNAVAILABLE'));}
  finally{try{if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}else if(response&&!types.isProxy(response)&&response instanceof Response)void get.body.call(response)?.cancel().catch(()=>{});}catch{}life.close();}
 }
 async function readAvailability(raw={}){const {signal}=own(raw,[],['signal']),result=await call('availability',{},signal),identity={installationId:result.installation.installationId,baseCatalogSha256:result.installation.baseCatalogSha256,executionCatalogSha256:result.installation.executionCatalogSha256,executionSha256:result.executionSha256,policyRevision:result.policyRevision};
  const approved=new Set(config.operations.map(hash));if([...result.installation.operations,...result.discovery.operations].some(op=>!approved.has(hash(op))))fail('INVALID_RESULT');
  if(identity.baseCatalogSha256!==hash(catalog)||pin&&hash(pin)!==hash(identity))fail('UNAVAILABLE');pin??=data(identity);return data({installation:result.installation,discovery:result.discovery});}
 async function execute(raw){const v=own(raw,['operation','arguments','deliveryId'],['signal']);nativeSignal(v.signal);if(!pin)await readAvailability({signal:v.signal});if(!config.operations.some(op=>hash(op)===hash(v.operation)))fail('UNAVAILABLE');
  try{
   const result=await call('execute',{operation:v.operation,arguments:v.arguments,deliveryId:v.deliveryId,installationId:pin.installationId,executionCatalogSha256:pin.executionCatalogSha256},v.signal);
   // Each response is this request's delta; the run aggregate is built here.
   if(result.externalUsage!==undefined)recordFacts(assertNativeReadExternalFacts(result.externalUsage),v.deliveryId);
   return result.resultJson;
  }catch(error){
   // A dispatched request whose response was lost, timed out or was cancelled is not evidence of no call:
   // record the observation gap against its delivery identity, never an inferred attempt or zero.
   // Only a lost, expired or cancelled response is an observation gap: a definite refusal answered us.
   if(['BUDGET_UNCERTAIN','DEADLINE','CANCELLED'].includes(nativeReadFailureCode(error)))recordUnobserved(v.deliveryId);
   throw error;
  }}
 return Object.freeze({readAvailability,execute,
  /** Content-free external provider accounting observed by this invocation; absent means nothing was observed. */
  externalUsage:usageSnapshot});
}

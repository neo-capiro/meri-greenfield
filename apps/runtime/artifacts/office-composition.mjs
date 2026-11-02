/** Production Office composition. Inert unless configuration.office.enabled; startup reads the WOPI signing key (fail
 * closed: it is deployment material) and awaits one bounded CODE discovery fetch. An unreachable or malformed editor
 * no longer blocks control: the mount answers UNAVAILABLE, one event is logged and discovery retries on a backoff. */
import {readSecret} from '../config.mjs';
import {OFFICE_SCHEMA} from '../../../packages/contracts/dist/office-application.mjs';
import {routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
import {protectedMaterialFiles} from './office-configuration.mjs';
import {createRoutinesServiceSecret} from '../native-authority/routines-core-client.mjs';
import {createReservedCredentialDigests} from '../native-authority/approval-forwarder.mjs';
import {createWopiAccessTokenCodec} from '../../artifacts/edit-sessions/wopi-access-token.mjs';
import {createCoreOfficeDraftClient} from '../../artifacts/edit-sessions/core-drafts.mjs';
import {createCollaboraCodeLaunch,CODE_DISCOVERY_MAX_BYTES} from '../../artifacts/edit-sessions/collabora-code.mjs';
import {createSuppressionGeneration} from './suppression-generation.mjs';
import {createRuntimeOfficeApplication} from './office-application.mjs';
import {createOfficeIntentOwner} from './office-intents.mjs';
import {registerOfficeIntentOwner} from './intent-binding.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

const fault=()=>Object.assign(new Error('OFFICE_CONFIGURATION'),{code:'OFFICE_CONFIGURATION'});

/** Fetch discovery exactly once with an absolute deadline and a hard byte bound. */
async function cancelReader(reader,ms=25){
 if(!reader)return;
 let timer;try{await Promise.race([Promise.resolve().then(()=>reader.cancel()).catch(()=>{}),
  new Promise(resolve=>{timer=setTimeout(resolve,ms);timer.unref?.();})]);}catch{}finally{if(timer)clearTimeout(timer);}
}
async function cancelBody(response){let reader;try{reader=response?.body?.getReader?.();}catch{}return cancelReader(reader);}
export async function readCodeDiscovery({editorOrigin,signal,now=Date.now,timeoutMs=10000,fetchImpl=globalThis.fetch}){
 if(typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fault();
 const life=createOperationLifetime({now,deadlineMs:now()+timeoutMs,signal,
  errorFactory:code=>Object.assign(Error('OFFICE_DISCOVERY_'+code),{code:'OFFICE_DISCOVERY_'+code})});
 try{
  const response=await life.run(s=>fetchImpl(editorOrigin+'/hosting/discovery',{method:'GET',redirect:'error',
   credentials:'omit',cache:'no-store',signal:s,headers:{accept:'application/xml','accept-encoding':'identity'}}));
  if(!response||response.status!==200||response.url!==editorOrigin+'/hosting/discovery'||response.redirected){await cancelBody(response);throw fault();}
  const length=response.headers?.get?.('content-length');
  if(length!==null&&length!==undefined&&(!/^[0-9]+$/u.test(length)||Number(length)>CODE_DISCOVERY_MAX_BYTES)){await cancelBody(response);throw fault();}
  const reader=response.body?.getReader?.();
  if(!reader)throw fault();
  const chunks=[];let total=0,completed=false;
  try{for(;;){
   const {done,value}=await life.run(()=>reader.read());if(done){completed=true;break;}
   if(!(value instanceof Uint8Array))throw fault();
   total+=value.byteLength;if(total>CODE_DISCOVERY_MAX_BYTES)throw fault();
   chunks.push(value);
  }return Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)));}
  finally{if(!completed)await cancelReader(reader);}
 }finally{life.close();}
}

/** Startup key read, before any listener. The key is deployment material: unreadable or short refuses startup. */
export async function readOfficeKey({office,readMaterial=readSecret}){
 if(office===null||office===undefined||office.enabled!==true)return null;
 const key=await readMaterial(office.keyFile);
 if(!Buffer.isBuffer(key)||key.byteLength<32){if(Buffer.isBuffer(key))key.fill(0);throw fault();}
 return key;
}

export const OFFICE_UNAVAILABLE_EVENT='runtime.office.unavailable',OFFICE_AVAILABLE_EVENT='runtime.office.available';
/** Discovery retry: first attempt after 5 s, doubling to 5 min, until the mount composes or the control closes. */
export const OFFICE_RETRY_MS=Object.freeze({initial:5000,max:300000});
const unavailable=()=>new Response(JSON.stringify({schema:OFFICE_SCHEMA,error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}}),{status:503,
 headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
/** The Office mount the route boundary holds for the control's lifetime. It owns the signing key; `mount(discoveryBytes)`
 * composes the real adapters over a copy of the key exactly once, so a refused (malformed) composition keeps the key for
 * the next discovery attempt. Until then every Office route answers 503 UNAVAILABLE instead of 404 absent. */
export function createOfficeMount({configuration,office,ports,sessions,retention,now,key,context=null,store=null}){
 if(office===null||office===undefined||office.enabled!==true)return null;
 if(!Buffer.isBuffer(key)||key.byteLength<32)throw fault();
 let current=null,closed=false;
 return Object.freeze({
  application:Object.freeze({handleControl:request=>current===null?unavailable():current.application.handleControl(request),
   handleWopi:request=>current===null?unavailable():current.application.handleWopi(request)}),
  mounted:()=>current!==null,
  current:()=>current,
  mount(discoveryBytes){
   if(closed||current!==null)throw fault();
   current=composeOffice({configuration,office,ports,sessions,retention,now,material:{key:Buffer.from(key),discoveryBytes},...(context!==null?{context,store}:{})});
  },
  async close(){if(closed)return;closed=true;try{await current?.close();}finally{key.fill(0);}}
 });
}
/** Editor discovery with a bounded retry. Startup awaits `first`; a failure logs ONE event (not one per retry), leaves the
 * mount unavailable and retries on the doubling backoff; a later success mounts and logs one recovery event. `close` stops
 * the retry; the control's own signal aborts an in-flight fetch. A failing `log` is swallowed: it never schedules a retry
 * (which would loop on an already mounted office) and never fails the attempt. */
export function startOfficeDiscovery({office,mount,signal,now=Date.now,fetchImpl,log=line=>process.stderr.write(JSON.stringify(line)+'\n'),retry=OFFICE_RETRY_MS}){
 if(office?.enabled!==true||typeof mount?.mount!=='function'||typeof mount.mounted!=='function'||typeof log!=='function')throw fault();
 let timer=null,closed=false,delayMs=retry.initial,attempts=0,reported=false;
 const emit=line=>{try{log(line);}catch{}};
 const attempt=async()=>{
  attempts++;
  try{
   const discoveryBytes=await readCodeDiscovery({editorOrigin:office.editorOrigin,signal,now,fetchImpl});
   if(closed)return false;
   mount.mount(discoveryBytes);
  }catch(error){
   if(closed||signal?.aborted||mount.mounted())return false;
   if(!reported){reported=true;emit({event:OFFICE_UNAVAILABLE_EVENT,editorOrigin:office.editorOrigin,code:typeof error?.code==='string'?error.code:'OFFICE_DISCOVERY_FAILED',retryMs:delayMs});}
   timer=setTimeout(()=>{timer=null;attempt();},delayMs);timer.unref?.();
   delayMs=Math.min(delayMs*2,retry.max);
   return false;
  }
  if(reported)emit({event:OFFICE_AVAILABLE_EVENT,editorOrigin:office.editorOrigin,attempts});
  return true;
 };
 return Object.freeze({first:attempt(),close(){closed=true;if(timer!==null){clearTimeout(timer);timer=null;}}});
}

/** Synchronous assembly from already prepared material; returns null when disabled. */
export function composeOffice({configuration,office,ports,sessions,retention,now,material,context=null,store=null}){
 if(office===null||office===undefined||office.enabled!==true)return null;
 const optionsOwner=ports?.artifactOptionsOwner;
 if(material===null||typeof material!=='object'||!Buffer.isBuffer(material.key)||material.key.byteLength<32||
  !(material.discoveryBytes instanceof Uint8Array)||retention===null||retention===undefined||
  typeof retention.journal?.get!=='function'||typeof retention.serving?.isEnabled!=='function'||
  typeof sessions?.nativeCredentialFor!=='function'||typeof optionsOwner?.resolve!=='function'||
  typeof now!=='function')throw fault();
 const key=material.key,reserved=Object.freeze([...new Set([...routinesReservedSecretFiles(configuration),...(configuration.native?.capabilityFile?[configuration.native.capabilityFile]:[])])]);
 let codec=null;
 try{
 if(reserved.includes(office.keyFile)||protectedMaterialFiles(configuration).includes(office.keyFile))throw fault();
 codec=createWopiAccessTokenCodec({key,now});
 const getServiceSecret=createRoutinesServiceSecret({file:office.serviceSecretFile,reservedFiles:reserved,readSecret});
 const reservedCredentials=createReservedCredentialDigests({files:reserved,readSecret});
 const drafts=createCoreOfficeDraftClient({origin:office.coreOrigin,
  nativeCredentials:Object.freeze({nativeCredentialFor:input=>sessions.nativeCredentialFor(input)}),
  getServiceSecret,reservedCredentials,now});
 const launch=createCollaboraCodeLaunch({editorOrigin:office.editorOrigin,wopiOrigin:office.wopiOrigin,
  discoveryBytes:material.discoveryBytes,codec,now});
 const generation=createSuppressionGeneration({journal:retention.journal,serving:retention.serving});
 const originalSource=ports.uploadApplicationFactory?.createOfficeSource?.({sessions,retention:retention.gate});
 const application=createRuntimeOfficeApplication({optionsOwner,sessions,now,originalSource,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes},drafts,codec,launch,generation,browserOrigin:office.browserOrigin});
 if(typeof application.handleControl!=='function'||typeof application.handleWopi!=='function')throw fault();
 // The governed same-document bridge: listed to the model only for a run with a selected Office document, applied only
 // through the approval route. Without a product context (no intents) nothing is registered.
 if(context!==null)registerOfficeIntentOwner(context,createOfficeIntentOwner({context,application,sessions,store,retention:retention.gate,now,limits:{maxRequestMs:configuration.limits.requestMs}}));
 return Object.freeze({application,codec,close(){try{codec.close();}finally{key.fill(0);}}});
 }catch(error){try{codec?.close();}finally{key.fill(0);}throw error;}
}

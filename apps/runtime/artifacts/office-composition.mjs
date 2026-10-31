/** Production Office composition. Inert unless configuration.office.enabled; startup reads only the two named
 * secrets and performs one bounded CODE discovery fetch before any listener accepts requests. */
import {readSecret} from '../config.mjs';
import {routinesReservedSecretFiles} from '../native-authority/routines-configuration.mjs';
import {protectedMaterialFiles} from './office-configuration.mjs';
import {createRoutinesServiceSecret} from '../native-authority/routines-core-client.mjs';
import {createReservedCredentialDigests} from '../native-authority/approval-forwarder.mjs';
import {createWopiAccessTokenCodec} from '../../artifacts/edit-sessions/wopi-access-token.mjs';
import {createCoreOfficeDraftClient} from '../../artifacts/edit-sessions/core-drafts.mjs';
import {createCollaboraCodeLaunch,CODE_DISCOVERY_MAX_BYTES} from '../../artifacts/edit-sessions/collabora-code.mjs';
import {createSuppressionGeneration} from './suppression-generation.mjs';
import {createRuntimeOfficeApplication} from './office-application.mjs';
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

/** Startup preparation: one key read and one discovery fetch, before any listener. */
export async function prepareOfficeMaterial({configuration,office,signal,now=Date.now,fetchImpl,readMaterial=readSecret}){
 if(office===null||office===undefined||office.enabled!==true)return null;
 const key=await readMaterial(office.keyFile);
 if(!Buffer.isBuffer(key)||key.byteLength<32){if(Buffer.isBuffer(key))key.fill(0);throw fault();}
 try{
  const discoveryBytes=await readCodeDiscovery({editorOrigin:office.editorOrigin,signal,now,fetchImpl});
  return Object.freeze({key,discoveryBytes});
 }catch(error){key.fill(0);throw error;}
}

/** Synchronous assembly from already prepared material; returns null when disabled. */
export function composeOffice({configuration,office,ports,sessions,retention,now,material}){
 if(office===null||office===undefined||office.enabled!==true)return null;
 const optionsOwner=ports?.artifactOptionsOwner;
 if(material===null||typeof material!=='object'||!Buffer.isBuffer(material.key)||material.key.byteLength<32||
  !(material.discoveryBytes instanceof Uint8Array)||retention===null||retention===undefined||
  typeof retention.journal?.get!=='function'||typeof retention.serving?.isEnabled!=='function'||
  typeof sessions?.nativeCredentialFor!=='function'||typeof optionsOwner?.resolve!=='function'||
  typeof now!=='function')throw fault();
 const key=material.key,reserved=Object.freeze([...new Set([...routinesReservedSecretFiles(configuration),...(configuration.native?.capabilityFile?[configuration.native.capabilityFile]:[])])]);
 try{
 if(reserved.includes(office.keyFile)||protectedMaterialFiles(configuration).includes(office.keyFile))throw fault();
 const codec=createWopiAccessTokenCodec({key,now});
 const getServiceSecret=createRoutinesServiceSecret({file:office.serviceSecretFile,reservedFiles:reserved,readSecret});
 const reservedCredentials=createReservedCredentialDigests({files:reserved,readSecret});
 const drafts=createCoreOfficeDraftClient({origin:office.coreOrigin,
  nativeCredentials:Object.freeze({nativeCredentialFor:input=>sessions.nativeCredentialFor(input)}),
  getServiceSecret,reservedCredentials,now});
 const launch=createCollaboraCodeLaunch({editorOrigin:office.editorOrigin,wopiOrigin:office.wopiOrigin,
  discoveryBytes:material.discoveryBytes,codec,now});
 const generation=createSuppressionGeneration({journal:retention.journal,serving:retention.serving});
 const application=createRuntimeOfficeApplication({optionsOwner,sessions,now,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes},drafts,codec,launch,generation,browserOrigin:office.browserOrigin});
 if(typeof application.handleControl!=='function'||typeof application.handleWopi!=='function')throw fault();
 return Object.freeze({application,codec,close(){codec.close();key.fill(0);}});
 }catch(error){key.fill(0);throw error;}
}

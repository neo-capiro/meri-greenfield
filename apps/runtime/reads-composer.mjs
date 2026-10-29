/** Control startup composition. The existing execution owner is injected after startup. */
import {randomUUID} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createBillTextSourceCapture} from '../control/conversations/sources/bill-text.mjs';
import {createHearingSourceCapture} from '../control/conversations/sources/hearing-record.mjs';
import {createReadsOwner} from './reads-owner.mjs';
import {createBillWatchReadPolicy} from './selected/bill-watch-read-policy.mjs';
import {createReadsApplication} from './reads-http.mjs';
import {prepareReadFamilies,GENERAL_READ_ADAPTER_FAMILIES} from './read-families.mjs';

const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(value);
const deny=code=>{throw nativeReadFault(code);};
export async function createControlReadsComposer(configuration){
 const c=own(configuration,['coreOrigin','nativeCredentials','readSecret','serviceSecretFile'],
  ['capabilityPolicy','readModeServiceSecretFile','familyIds','defaultCongress','fetchImpl','now','newId','memoryContexts','primaryCredentials']);
 const coreOrigin=retainedOrigin(c.coreOrigin),now=c.now??Date.now,newId=c.newId??randomUUID,fetchImpl=c.fetchImpl??globalThis.fetch;
 if(c.primaryCredentials!==undefined&&typeof c.primaryCredentials!=='function')deny('CONFIGURATION');
 if(typeof c.nativeCredentials?.nativeCredentialFor!=='function'||typeof c.readSecret!=='function'||c.capabilityPolicy!==undefined&&typeof c.capabilityPolicy?.forRun!=='function'||
  typeof now!=='function'||typeof newId!=='function'||typeof fetchImpl!=='function'||typeof c.serviceSecretFile!=='string'||c.memoryContexts!==undefined&&typeof c.memoryContexts.forTask!=='function')deny('CONFIGURATION');
 const familyIds=data(c.familyIds??GENERAL_READ_ADAPTER_FAMILIES);
 async function secret(file){let bytes;try{bytes=await c.readSecret(file);}catch{deny('UNAVAILABLE');}
  const value=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;if(!token(value))deny('UNAVAILABLE');return value;}
 const getServiceSecret=()=>secret(c.serviceSecretFile),getReadModeServiceSecret=c.readModeServiceSecretFile===undefined?undefined:()=>secret(c.readModeServiceSecretFile);
 async function getNativeCredential(request){
  const first=data(own(await c.nativeCredentials.nativeCredentialFor({binding:request.binding,selectedClientId:request.selectedClientId,signal:request.signal}),['credential','expiresAtMs']));
  if(!token(first.credential)||!Number.isSafeInteger(first.expiresAtMs)||first.expiresAtMs<=now())deny('UNAVAILABLE');
  const service=await getServiceSecret();if(service===first.credential)deny('UNAVAILABLE');
  if(getReadModeServiceSecret&&(await getReadModeServiceSecret())===first.credential)deny('UNAVAILABLE');
  const after=data(own(await c.nativeCredentials.nativeCredentialFor({binding:request.binding,selectedClientId:request.selectedClientId,signal:request.signal}),['credential','expiresAtMs']));
  if(after.credential!==first.credential||!Number.isSafeInteger(after.expiresAtMs)||after.expiresAtMs<=now())deny('UNAVAILABLE');
  return {credential:first.credential,expiresAtMs:Math.min(first.expiresAtMs,after.expiresAtMs)};
 }
 const families=prepareReadFamilies({familyIds,coreOrigin,fetchImpl,now,newId,capabilityPolicy:c.capabilityPolicy,getNativeCredential,getServiceSecret,
  ...(c.primaryCredentials===undefined?{}:{primaryCredentials:c.primaryCredentials}),
  ...(getReadModeServiceSecret?{getReadModeServiceSecret}:{}),...(c.defaultCongress===undefined?{}:{defaultCongress:c.defaultCongress}),...(c.memoryContexts?{memoryContexts:c.memoryContexts}:{})});
 function createReadsRuntime({execution,binding,approvedReads,conversationStore,objectiveCore,routineCore,capabilityPolicy=c.capabilityPolicy,readCapabilityRole}){
  if(typeof capabilityPolicy?.forRun!=='function')deny('CONFIGURATION');
  const createGateway=value=>families.createGateway({...value,capabilityPolicy,readCapabilityRole,...(objectiveCore?{objectiveCore}:{}),...(routineCore?{routineCore}:{})});
  const captures=conversationStore?[createBillTextSourceCapture({store:conversationStore,defaultCongress:c.defaultCongress}),createHearingSourceCapture({store:conversationStore})]:[];
  return createReadsApplication({owner:createReadsOwner({execution,binding,approvedReads,createGateway,now,assertReadArguments:createBillWatchReadPolicy({store:conversationStore,binding}),...(conversationStore?{async captureSource(call){for(const capture of captures)await capture(call);}}:{})}),approvedReads,now});
 }
 return Object.freeze({createReadsRuntime,familyIds,missing:families.missing.map(id=>`source-composition:${id}`)});
}

/** The one CONTROL startup hook for general reads. Control startup calls `createControlReadsComposer` once and passes its
 * `createReadsRuntime` to `startControl(configuration,{signal,createReadsRuntime})` (control.mjs → prepared-candidate →
 * remote-composition → prepared-reads → reads-owner). It composes only what exists: Core's native tool authority at the
 * configured Core origin, the native read credential broker over server-side secret files, and the native read families.
 * The gateway's current tool authority, the P2 installation receipt and the P1 discovery grant are decision-gated inputs;
 * while any is absent every task gets the unavailable runtime (fail closed), never an empty success.
 *
 * Credential invariant (Core #83): the marked control credential (`nativeCandidate.identity.credentialFile`) is accepted by
 * Core only at application-authority/{identity,context,membership}. Read routes (tools/*, read-mode-observation,
 * clients/check-ref) take the native read bearer and, for tools/* and read-mode-observation, the internal service secret.
 * Every read secret file must differ from every candidate credential file by path and by bytes at startup, and each call
 * re-reads its file and refuses (UNAVAILABLE) when the bytes are any candidate credential. Only digests of the candidate
 * credentials are kept. */
import {createHash,randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {NATIVE_READ_FAMILIES} from '../../gateway/sources/retained-reads/native-families.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
import {createNativeToolAuthorityClient} from './native-read-credentials/core-client.mjs';
import {prepareGeneralReadInstallation,installationReadOperations} from './general-read-installation/runtime.mjs';
import {taskTuple} from './general-read-installation/configuration.mjs';

/** Server-side secret files the control role renders for reads (absolute paths). `readModeServiceSecret` may name the same
 * file as `serviceSecret`; `nativeReadCredential` may not. */
export const READ_SECRET_FILE_KEYS=Object.freeze(['nativeReadCredential','serviceSecret','readModeServiceSecret']);
/** Decision-gated gateway inputs (current tool authority, gateway limits, P2 installation receipt, P1 discovery grant). */
export const READ_GATEWAY_INPUTS=Object.freeze(['authority','limits','readCurrentInstallation','discoveryOwner']);
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,refuse=code=>{throw nativeReadFault(code);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const filePath=value=>{if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)refuse('CONFIGURATION');return value;};
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};

/** Read credential broker: `getNativeCredential`, `getServiceSecret` and `getReadModeServiceSecret` for the native read
 * credential owner, each present only when its file is configured. `available` needs the bearer and the service secret. */
export async function createNativeReadCredentialBroker(options){
 const c=own(options,['configuration','secretFiles'],['readSecret']),read=c.readSecret??readRuntimeSecret;
 if(typeof read!=='function'||types.isProxy(read))refuse('CONFIGURATION');
 const candidate=c.configuration?.nativeCandidate;if(!candidate||typeof candidate!=='object')refuse('CONFIGURATION');
 const reserved=[candidate.identity?.credentialFile,candidate.taskCapabilityFile,candidate.controlCapabilityFile,candidate.proxyCredentialFile].map(filePath);
 const configured=own(c.secretFiles,[],READ_SECRET_FILE_KEYS),files={};
 for(const key of READ_SECRET_FILE_KEYS)if(configured[key]!==undefined)files[key]=filePath(configured[key]);
 if(Object.values(files).some(path=>reserved.includes(path))||files.nativeReadCredential!==undefined&&[files.serviceSecret,files.readModeServiceSecret].includes(files.nativeReadCredential))refuse('CONFIGURATION');
 const forbidden=new Set();
 for(const path of reserved){let token;try{token=tokenOf(await read(path));}catch{refuse('CONFIGURATION');}if(token===null)refuse('CONFIGURATION');forbidden.add(sha(token));}
 const startup={};
 for(const [key,path] of Object.entries(files)){let token;try{token=tokenOf(await read(path));}catch{refuse('CONFIGURATION');}if(token===null||forbidden.has(sha(token)))refuse('CONFIGURATION');startup[key]=sha(token);}
 if(startup.nativeReadCredential!==undefined&&[startup.serviceSecret,startup.readModeServiceSecret].includes(startup.nativeReadCredential))refuse('CONFIGURATION');
 // Re-read on every call (rotation without restart); a file that now holds a candidate credential fails closed.
 const getter=key=>async()=>{let token;try{token=tokenOf(await read(files[key]));}catch{refuse('UNAVAILABLE');}if(token===null||forbidden.has(sha(token)))refuse('UNAVAILABLE');return token;};
 const getters={};
 for(const [key,name] of [['nativeReadCredential','getNativeCredential'],['serviceSecret','getServiceSecret'],['readModeServiceSecret','getReadModeServiceSecret']])if(files[key]!==undefined)getters[name]=getter(key);
 return Object.freeze({available:Boolean(getters.getNativeCredential&&getters.getServiceSecret),configured:Object.freeze(Object.keys(files)),...getters});
}

/** Returns `{createReadsRuntime, familyIds, missing}`. `missing` names each absent input (no secret values). */
export async function createControlReadsComposer(options){
 const c=own(options,['configuration','secretFiles'],['now','newId','fetchImpl','gateway','defaultCongress','familyIds','readSecret','sourceRoot']);
 const now=c.now??Date.now,newId=c.newId??randomUUID,fetchImpl=c.fetchImpl??globalThis.fetch;
 if(typeof now!=='function'||typeof newId!=='function'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||
  c.defaultCongress!==undefined&&(!Number.isSafeInteger(c.defaultCongress)||c.defaultCongress<1))refuse('CONFIGURATION');
 const broker=await createNativeReadCredentialBroker({configuration:c.configuration,secretFiles:c.secretFiles,...(c.readSecret===undefined?{}:{readSecret:c.readSecret})});
 const coreAuthority=createNativeToolAuthorityClient({origin:c.configuration.nativeCandidate.identity.origin,fetchImpl,now,enabled:broker.available});
 const native=[...new Set(installationReadOperations().map(row=>row.family))].filter(family=>NATIVE_READ_FAMILIES.includes(family));
 const familyIds=c.familyIds===undefined?native:data(c.familyIds);
 if(!Array.isArray(familyIds)||!familyIds.length||new Set(familyIds).size!==familyIds.length||familyIds.some(id=>!native.includes(id)))refuse('CONFIGURATION');
 const gateway=c.gateway===undefined?{}:own(c.gateway,[],[...READ_GATEWAY_INPUTS,'namespace']);
 const missing=Object.freeze([...['nativeReadCredential','serviceSecret'].filter(key=>!broker.configured.includes(key)).map(key=>`secretFiles.${key}`),
  ...READ_GATEWAY_INPUTS.filter(key=>gateway[key]===undefined).map(key=>`gateway.${key}`)]);
 const nativeCredentials={coreAuthority,getNativeCredential:broker.getNativeCredential,getServiceSecret:broker.getServiceSecret,
  ...(broker.getReadModeServiceSecret===undefined?{}:{getReadModeServiceSecret:broker.getReadModeServiceSecret}),...(c.defaultCongress===undefined?{}:{defaultCongress:c.defaultCongress})};
 function taskPorts(raw){
  // An empty gateway makes the installation runtime return its unavailable gateway for this task.
  if(missing.length)return {gateway:{},families:{}};
  const t=taskTuple(raw);
  return {gateway:{authority:gateway.authority,limits:gateway.limits,readCurrentInstallation:gateway.readCurrentInstallation,discoveryOwner:gateway.discoveryOwner,
    producerContext:t.grant,producer:{namespace:'general-reads',executionId:t.original.executionId},credential:t.taskCapability,sourceEnabled:true,...(gateway.namespace===undefined?{}:{namespace:gateway.namespace})},
   families:Object.fromEntries(familyIds.map(id=>[id,{origin:coreAuthority.origin,fetchImpl}])),nativeCredentials};
 }
 const preparation=await prepareGeneralReadInstallation({familyIds,newId,taskPorts,...(c.sourceRoot===undefined?{}:{sourceRoot:c.sourceRoot})});
 return Object.freeze({createReadsRuntime:preparation.createReadsRuntime,familyIds:Object.freeze([...familyIds]),missing});
}

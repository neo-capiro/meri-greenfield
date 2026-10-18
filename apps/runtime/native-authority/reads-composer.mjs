/** The one CONTROL startup hook for general reads. Control startup calls `createControlReadsComposer` once and passes its
 * `createReadsRuntime` to `startControl(configuration,{signal,createReadsRuntime,readCredentialRelay})` (control.mjs →
 * prepared-candidate → remote-composition → prepared-reads → reads-owner). It composes only what exists: Core's native tool
 * authority at the configured Core origin, the read credential broker, and the native read families. The gateway's current
 * tool authority, the P2 installation receipt and the P1 discovery grant are decision-gated inputs; while any is absent
 * every task gets the unavailable runtime (fail closed), never an empty success.
 *
 * Bearer (RC1 option A, dot's source ack 6245772555): the native read bearer is the user's own live action-session token for
 * the same run, resolved per call through `nativeCredentials.nativeCredentialFor` (read-credential-relay.mjs, bound by
 * startControl to the action-session owner). It is never read from a file, cached or persisted; an unbound relay, no live
 * session for the run's tenant/actor/conversation/run and selected client, or an expired session refuses (UNAVAILABLE).
 *
 * Credential invariant (Core #83): the marked control credential (`nativeCandidate.identity.credentialFile`) is accepted by
 * Core only at application-authority/{identity,context,membership}. Read routes (tools/*, read-mode-observation,
 * clients/check-ref) take the native read bearer and, for tools/* and read-mode-observation, the internal service secret.
 * Service secret files must differ from every candidate credential file by path and by bytes at startup and on every call.
 * Every relayed bearer is refused when it is any candidate credential or the current service secret. Only digests of the
 * candidate credentials are kept.
 *
 * Option B (D016-A 4, `delegation.enabled`, default false): each run gets a run-bound Core read delegation
 * (`read-delegation/`). Attended runs create it from the live session and keep reading after that session ends, up to 30
 * minutes from issuance and the run deadline; unattended occurrence runs (reported by the trusted `delegation.readOccurrence`
 * port) get one per occurrence under an active consent, at most 15 minutes. Option A stays the attended fallback when Core
 * delegation is unavailable. `readDelegation.stopRun` is the Stop hook: refuse locally, abort in flight, then revoke. */
import {createHash,randomUUID} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {NATIVE_READ_FAMILIES} from '../../gateway/sources/retained-reads/native-families.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
import {createNativeToolAuthorityClient} from './native-read-credentials/core-client.mjs';
import {prepareGeneralReadInstallation,installationReadOperations} from './general-read-installation/runtime.mjs';
import {taskTuple} from './general-read-installation/configuration.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {createGeneralReadInstallationIssuer} from '../../gateway/general-reads/installation-issuer.mjs';
import {createGeneralReadDiscoveryProducer} from '../../gateway/general-reads/discovery-producer.mjs';
import {createReadDelegationCoreClient} from './read-delegation/core-client.mjs';
import {createRunReadDelegation} from './read-delegation/delegation.mjs';
import {composeDelegatedNativeCredentials} from './read-delegation/native-credentials.mjs';
import {createReadDelegationConsents} from './read-delegation/consent.mjs';
import {createReadDelegationRunOptions} from './read-delegation/run-options.mjs';

/** Server-side secret files the control role renders for reads (absolute paths). `readModeServiceSecret` may name the same
 * file as `serviceSecret`. There is no bearer file: the bearer comes from the live-session relay. */
export const READ_SECRET_FILE_KEYS=Object.freeze(['serviceSecret','readModeServiceSecret']);
/** Decision-gated gateway inputs (current tool authority, gateway limits, P2 installation receipt, P1 discovery grant). */
export const READ_GATEWAY_INPUTS=Object.freeze(['authority','limits','readCurrentInstallation','discoveryOwner']);
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,refuse=code=>{throw nativeReadFault(code);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const filePath=value=>{if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)refuse('CONFIGURATION');return value;};
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};

/** The run's selected client: run scopes are exactly one client scope (prepared-run-registry/-bindings `exactInitialScopes`). */
export function selectedClientOf(scopes){
 const clients=Array.isArray(scopes)?scopes.filter(scope=>scope?.kind==='client'):[];
 return clients.length===1&&scopes.length===1&&typeof clients[0].resourceId==='string'?clients[0].resourceId:null;
}

/** Read credential broker. `getServiceSecret`/`getReadModeServiceSecret` exist only when their file is configured; `bearerFor`
 * returns the per-task `getNativeCredential` over the relay. `available` needs the relay port and the service secret. */
export async function createNativeReadCredentialBroker(options){
 const c=own(options,['configuration','secretFiles'],['readSecret','nativeCredentials','now']),read=c.readSecret??readRuntimeSecret,now=c.now??Date.now;
 if(typeof read!=='function'||types.isProxy(read)||typeof now!=='function')refuse('CONFIGURATION');
 const relay=c.nativeCredentials===undefined?null:own(c.nativeCredentials,['nativeCredentialFor']);
 if(relay!==null&&(typeof relay.nativeCredentialFor!=='function'||types.isProxy(c.nativeCredentials)||types.isProxy(relay.nativeCredentialFor)))refuse('CONFIGURATION');
 const candidate=c.configuration?.nativeCandidate;if(!candidate||typeof candidate!=='object')refuse('CONFIGURATION');
 const reserved=[candidate.identity?.credentialFile,candidate.taskCapabilityFile,candidate.controlCapabilityFile,candidate.proxyCredentialFile].map(filePath);
 let configured;try{configured=own(c.secretFiles,[],READ_SECRET_FILE_KEYS);}catch{refuse('CONFIGURATION');}const files={};
 for(const key of READ_SECRET_FILE_KEYS)if(configured[key]!==undefined)files[key]=filePath(configured[key]);
 if(Object.values(files).some(path=>reserved.includes(path)))refuse('CONFIGURATION');
 const forbidden=new Set();
 for(const path of reserved){let token;try{token=tokenOf(await read(path));}catch{refuse('CONFIGURATION');}if(token===null)refuse('CONFIGURATION');forbidden.add(sha(token));}
 for(const path of Object.values(files)){let token;try{token=tokenOf(await read(path));}catch{refuse('CONFIGURATION');}if(token===null||forbidden.has(sha(token)))refuse('CONFIGURATION');}
 // Re-read on every call (rotation without restart); a file that now holds a candidate credential fails closed.
 const current=async key=>{let token;try{token=tokenOf(await read(files[key]));}catch{refuse('UNAVAILABLE');}if(token===null||forbidden.has(sha(token)))refuse('UNAVAILABLE');return token;};
 const getters={};
 if(files.serviceSecret!==undefined)getters.getServiceSecret=async()=>current('serviceSecret');
 if(files.readModeServiceSecret!==undefined)getters.getReadModeServiceSecret=async()=>current('readModeServiceSecret');
 /** Per task. Resolves the bearer at call time; nothing is cached past the call. */
 function bearerFor({binding,scopes}){
  const pinned=data(binding),selectedClientId=selectedClientOf(data(scopes)),same=value=>{try{return canonicalSha256(data(value))===canonicalSha256(pinned);}catch{return false;}};
  // One live-session lookup: exact run binding and selected client, a well-formed token, unexpired, never a candidate credential.
  const lookup=request=>{
   let issued;try{issued=data(own(relay.nativeCredentialFor({binding:pinned,selectedClientId,...(request.signal===undefined?{}:{signal:request.signal})}),['credential','expiresAtMs']));}catch{refuse('UNAVAILABLE');}
   const token=typeof issued.credential==='string'&&TOKEN.test(issued.credential)?issued.credential:null;
   if(token===null||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now()||forbidden.has(sha(token)))refuse('UNAVAILABLE');
   return {credential:token,expiresAtMs:issued.expiresAtMs};
  };
  // Returns `{credential, expiresAtMs}`: the credential owner folds the session expiry into every later Core call and the
  // source transport deadline (owner.mjs `nativeBearer`), so no read stays in flight past the live session.
  return async request=>{
   if(relay===null||selectedClientId===null||!request||!same(request.binding))refuse('UNAVAILABLE');
   const first=lookup(request);
   for(const key of Object.keys(files))if(sha(await current(key))===sha(first.credential))refuse('UNAVAILABLE');
   // The service-file reads above are awaits: the same session must still be live (not expired, revoked or replaced).
   const second=lookup(request);if(second.credential!==first.credential)refuse('UNAVAILABLE');
   return Object.freeze({credential:first.credential,expiresAtMs:Math.min(first.expiresAtMs,second.expiresAtMs)});
  };
 }
 return Object.freeze({available:Boolean(relay&&getters.getServiceSecret),configured:Object.freeze(Object.keys(files)),bearerFor,...getters});
}

/** Returns `{createReadsRuntime, familyIds, missing}`. `missing` names each absent input (no secret values).
 * P2 (`installation`) and P1 (`discovery`) producers are composed here and stay DISABLED unless their `enabled` is true; an
 * explicit `gateway.readCurrentInstallation` / `gateway.discoveryOwner` port takes precedence (tests, future owners). */
export async function createControlReadsComposer(options){
 const c=own(options,['configuration','secretFiles'],['now','newId','fetchImpl','gateway','nativeCredentials','defaultCongress','familyIds','readSecret','sourceRoot','installation','discovery','delegation']);
 const now=c.now??Date.now,newId=c.newId??randomUUID,fetchImpl=c.fetchImpl??globalThis.fetch;
 if(typeof now!=='function'||typeof newId!=='function'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||
  c.defaultCongress!==undefined&&(!Number.isSafeInteger(c.defaultCongress)||c.defaultCongress<1))refuse('CONFIGURATION');
 const broker=await createNativeReadCredentialBroker({configuration:c.configuration,secretFiles:c.secretFiles,now,
  ...(c.readSecret===undefined?{}:{readSecret:c.readSecret}),...(c.nativeCredentials===undefined?{}:{nativeCredentials:c.nativeCredentials})});
 const coreAuthority=createNativeToolAuthorityClient({origin:c.configuration.nativeCandidate.identity.origin,fetchImpl,now,enabled:broker.available});
 const native=[...new Set(installationReadOperations().map(row=>row.family))].filter(family=>NATIVE_READ_FAMILIES.includes(family));
 const familyIds=c.familyIds===undefined?native:data(c.familyIds);
 if(!Array.isArray(familyIds)||!familyIds.length||new Set(familyIds).size!==familyIds.length||familyIds.some(id=>!native.includes(id)))refuse('CONFIGURATION');
 const gateway=c.gateway===undefined?{}:own(c.gateway,[],[...READ_GATEWAY_INPUTS,'namespace']);
 const installation=c.installation===undefined?{}:own(c.installation,[],['enabled','measurement','measurementSha256','ttlMs','revokedOperations']);
 const discovery=c.discovery===undefined?{}:own(c.discovery,[],['enabled','capabilityPolicy','ttlMs']);
 if(installation.enabled!==undefined&&typeof installation.enabled!=='boolean'||discovery.enabled!==undefined&&typeof discovery.enabled!=='boolean')refuse('CONFIGURATION');
 // P2: one issuer per process; an enabled issuer refuses construction unless its pinned measurement matches this source.
 const issuer=gateway.readCurrentInstallation===undefined?createGeneralReadInstallationIssuer({catalogJson:JSON.stringify(catalog),now,...installation}):null;
 const readCurrentInstallation=gateway.readCurrentInstallation??(issuer.enabled?issuer.readCurrentInstallation:undefined);
 const discoveryEnabled=gateway.discoveryOwner===undefined&&discovery.enabled===true;
 // Option B: composed only when enabled and the service identity exists; nothing is created at startup.
 const delegationOptions=c.delegation===undefined?{}:own(c.delegation,[],['enabled','readOccurrence']);
 if(delegationOptions.enabled!==undefined&&typeof delegationOptions.enabled!=='boolean'||delegationOptions.readOccurrence!==undefined&&(typeof delegationOptions.readOccurrence!=='function'||types.isProxy(delegationOptions.readOccurrence)))refuse('CONFIGURATION');
 const delegationClient=delegationOptions.enabled===true?createReadDelegationCoreClient({origin:c.configuration.nativeCandidate.identity.origin,fetchImpl,now,enabled:broker.getServiceSecret!==undefined,...(broker.getServiceSecret===undefined?{}:{getServiceSecret:broker.getServiceSecret})}):null;
 const unattendedReads=Boolean(delegationClient?.available&&delegationOptions.readOccurrence);
 const delegations=new Map();
 const missing=Object.freeze([...(c.nativeCredentials===undefined&&!unattendedReads?['nativeCredentials.nativeCredentialFor']:[]),...(broker.getServiceSecret===undefined?['secretFiles.serviceSecret']:[]),
  ...['authority','limits'].filter(key=>gateway[key]===undefined).map(key=>`gateway.${key}`),
  ...(readCurrentInstallation===undefined?['installation.enabled']:[]),...(gateway.discoveryOwner===undefined&&!discoveryEnabled?['discovery.enabled']:[])]);
 function taskPorts(raw){
  // An empty gateway makes the installation runtime return its unavailable gateway for this task.
  if(missing.length)return {gateway:{},families:{}};
  const t=taskTuple(raw);
  const bearer=broker.bearerFor({binding:t.binding,scopes:t.scopes});
  // P1: per task, over this run's own allocation and approved reads.
  const discoveryOwner=gateway.discoveryOwner??createGeneralReadDiscoveryProducer({binding:t.binding,policyRevision:t.grant.qualificationBinding.policyRevision,
   allocationJson:t.allocationJson,approvedReads:t.approvedReads,now,enabled:true,capabilityPolicy:discovery.capabilityPolicy,...(discovery.ttlMs===undefined?{}:{ttlMs:discovery.ttlMs})});
  return {gateway:{authority:gateway.authority,limits:gateway.limits,readCurrentInstallation,discoveryOwner,
    producerContext:t.grant,producer:{namespace:'general-reads',executionId:t.original.executionId},credential:t.taskCapability,sourceEnabled:true,...(gateway.namespace===undefined?{}:{namespace:gateway.namespace})},
   families:Object.fromEntries(familyIds.map(id=>[id,{origin:coreAuthority.origin,fetchImpl}])),
   nativeCredentials:{...nativeCredentialsFor(t,bearer),getServiceSecret:broker.getServiceSecret,
    ...(broker.getReadModeServiceSecret===undefined?{}:{getReadModeServiceSecret:broker.getReadModeServiceSecret}),...(c.defaultCongress===undefined?{}:{defaultCongress:c.defaultCongress})}};
 }
 /** Option A only, or option B with A as the attended fallback. One delegation per run attempt (binding), reused across its tasks. */
 function nativeCredentialsFor(t,bearer){
  const fallback=broker.available?{coreAuthority,getNativeCredential:bearer}:undefined;
  if(!delegationClient?.available)return {coreAuthority,getNativeCredential:bearer};
  const key=canonicalSha256(t.binding);let entry=delegations.get(key);
  if(!entry){
   // A stopped run keeps its (refusing) entry until its deadline, so a later task of the same run never creates a new delegation.
   for(const [k,old] of delegations)if(old.runDeadlineMs<=now())delegations.delete(k);
   if(delegations.size>=4096)refuse('RESOURCE_LIMIT');
   const runDeadlineMs=t.original.expiresAtMs;
   const delegation=createRunReadDelegation({binding:t.binding,scopes:t.scopes,allocationJson:t.allocationJson,runDeadlineMs,client:delegationClient,now,
    ...(broker.available?{liveCredentialFor:({signal})=>bearer({binding:t.binding,...(signal===undefined?{}:{signal})})}:{}),
    ...(delegationOptions.readOccurrence?{readOccurrence:delegationOptions.readOccurrence}:{})});
   entry={delegation,runDeadlineMs,credentials:composeDelegatedNativeCredentials({delegation,client:delegationClient,now,...(fallback?{fallback}:{})})};
   delegations.set(key,entry);
  }
  return {coreAuthority:entry.credentials.coreAuthority,getNativeCredential:entry.credentials.getNativeCredential,toolCredential:entry.credentials.toolCredential,stopSignal:entry.delegation.signal};
 }
 /** Stop hook for the run owner, called after it records the run terminal in its own store. The entry stays as a tombstone. */
 async function stopRun({binding,reason='run_terminal'}){
  const entry=delegations.get(canonicalSha256(data(binding)));if(!entry)return Object.freeze({stopped:false,revoked:false});
  return entry.delegation.stop(reason);
 }
 const preparation=await prepareGeneralReadInstallation({familyIds,newId,taskPorts,...(c.sourceRoot===undefined?{}:{sourceRoot:c.sourceRoot})});
 // `runOptions` (lane RD) is the registry-facing form of `stopRun` (`readDelegationRunOptions` of control → prepared candidate →
 // prepared-run registry, registered like `documentsRunOptions`): it never throws and reports a failed stop instead.
 return Object.freeze({createReadsRuntime:preparation.createReadsRuntime,familyIds:Object.freeze([...familyIds]),missing,
  readDelegation:Object.freeze({enabled:Boolean(delegationClient?.available),stopRun,...(delegationClient?.available?{consents:createReadDelegationConsents({client:delegationClient,now}),runOptions:createReadDelegationRunOptions({stopRun})}:{})})});
}

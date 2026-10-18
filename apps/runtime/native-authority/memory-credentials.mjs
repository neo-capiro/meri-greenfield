/** Memory credential broker (control only): the `getCredentials` port of `apps/control/memory/core-http.mjs` for the two ways a
 * Core memory call is made as the member (D016 #4/#6; the reads broker's credential invariant, Core #83, applied unchanged):
 *
 *  surface  the product mount admitted the member's own native bearer for this request (`bearer-custody.mjs`); that exact bearer,
 *           bounded by the admission expiry, goes to Core together with the verified service identity.
 *  run      a conversational `memory.propose` executes for a run: the bearer is the member's live action-session native credential
 *           for exactly that run binding and selected client, resolved per call through the live-session relay
 *           (`read-credential-relay.mjs`, bound by startControl to the action-session owner; RC1 option A). No live session (an
 *           unattended run, an expired or replaced session) refuses; nothing is minted, cached or read from a file.
 *
 * The service secret is the control role's server-side file, re-read on every call (rotation without restart). A bearer that is a
 * marked candidate credential (`nativeCandidate` credential files; digests only) or the current service secret is refused, and the
 * secret file must differ from every candidate credential file by path and bytes. Refusals are typed `MEMORY_CREDENTIAL_*`; the
 * transport maps them to its caller's failure code (an unacknowledged submission, an unavailable read), never to a Core answer. */
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fault=code=>Object.assign(new Error(code),{code});
const sha=value=>createHash('sha256').update(value).digest('hex');
const filePath=value=>{if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)throw fault('MEMORY_CREDENTIAL_CONFIGURATION');return value;};
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};
export function createMemoryCredentialBroker(options){
 const c=own(options,['configuration','serviceSecretFile'],['readSecret','nativeCredentials','now']),read=c.readSecret??readRuntimeSecret,now=c.now??Date.now;
 if(typeof read!=='function'||types.isProxy(read)||typeof now!=='function'||types.isProxy(now))throw fault('MEMORY_CREDENTIAL_CONFIGURATION');
 const relay=c.nativeCredentials===undefined?null:own(c.nativeCredentials,['nativeCredentialFor']);
 if(relay!==null&&(typeof relay.nativeCredentialFor!=='function'||types.isProxy(c.nativeCredentials)||types.isProxy(relay.nativeCredentialFor)))throw fault('MEMORY_CREDENTIAL_CONFIGURATION');
 const secretFile=filePath(c.serviceSecretFile),candidate=c.configuration?.nativeCandidate;
 // Marked candidate credential files (absent outside the prepared-candidate deployment): never the secret file, never a bearer.
 const reserved=candidate===undefined?[]:[candidate.identity?.credentialFile,candidate.taskCapabilityFile,candidate.controlCapabilityFile,candidate.proxyCredentialFile].filter(p=>p!==undefined).map(filePath);
 if(reserved.includes(secretFile))throw fault('MEMORY_CREDENTIAL_CONFIGURATION');
 let forbidden=null;
 /** Digests of the reserved credentials, read once on first use (the family factory is synchronous and reads nothing). */
 async function forbiddenDigests(){
  if(forbidden!==null)return forbidden;
  const digests=new Set();
  for(const path of reserved){let token;try{token=tokenOf(await read(path));}catch{throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');}if(token===null)throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');digests.add(sha(token));}
  forbidden=digests;return forbidden;
 }
 /** The current service secret: re-read per call; a file that now holds a candidate credential fails closed. */
 async function serviceSecret(){
  const digests=await forbiddenDigests();let token;
  try{token=tokenOf(await read(secretFile));}catch{throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');}
  if(token===null||digests.has(sha(token)))throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');return token;
 }
 async function admitBearer(credential,secret){
  if(typeof credential!=='string'||!TOKEN.test(credential)||credential===secret||(await forbiddenDigests()).has(sha(credential)))throw fault('MEMORY_CREDENTIAL_REFUSED');
  return credential;
 }
 const identity=(call,tenantId,actorId)=>{const v=own(call,['tenantId','actorId','purpose','signal','deadlineMs']);if(v.tenantId!==tenantId||v.actorId!==actorId)throw fault('MEMORY_CREDENTIAL_REFUSED');return v;};
 return Object.freeze({
  /** Whether the run path can resolve a bearer at all (the relay port is bound by trusted startup). */
  runAvailable:relay!==null,
  serviceSecret,
  /** `getCredentials` for the member's admitted request bearer. */
  surface({tenantId,actorId,credential,expiresAtMs}){
   if(typeof tenantId!=='string'||!tenantId||typeof actorId!=='string'||!actorId||!Number.isSafeInteger(expiresAtMs))throw fault('MEMORY_CREDENTIAL_CONFIGURATION');
   return async call=>{
    const v=identity(call,tenantId,actorId);if(expiresAtMs<=now())throw fault('MEMORY_CREDENTIAL_REFUSED');
    const secret=await serviceSecret(),bearerToken=await admitBearer(credential,secret);if(v.signal?.aborted)throw fault('MEMORY_CREDENTIAL_REFUSED');
    return Object.freeze({tenantId,actorId,bearerToken,serviceSecret:secret,expiresAtMs});
   };
  },
  /** `getCredentials` for one run: the live session's native credential for exactly `binding` and `selectedClientId`, looked up
   * before and after the service-secret read so the same session is still live (reads-composer `bearerFor`, unchanged). */
  run({binding,selectedClientId}){
   if(relay===null)throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');
   const pinned=data(binding);
   if(['tenantId','actorId','conversationId','runId'].some(k=>typeof pinned?.[k]!=='string'||!pinned[k])||typeof selectedClientId!=='string'||!UUID.test(selectedClientId))throw fault('MEMORY_CREDENTIAL_CONFIGURATION');
   const lookup=signal=>{
    let issued;try{issued=data(own(relay.nativeCredentialFor({binding:pinned,selectedClientId,...(signal===undefined?{}:{signal})}),['credential','expiresAtMs']));}catch{throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');}
    if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');
    return issued;
   };
   return async call=>{
    const v=identity(call,pinned.tenantId,pinned.actorId);
    const first=lookup(v.signal),secret=await serviceSecret();
    const second=lookup(v.signal);if(second.credential!==first.credential)throw fault('MEMORY_CREDENTIAL_UNAVAILABLE');
    const bearerToken=await admitBearer(first.credential,secret);
    return Object.freeze({tenantId:pinned.tenantId,actorId:pinned.actorId,bearerToken,serviceSecret:secret,expiresAtMs:Math.min(first.expiresAtMs,second.expiresAtMs)});
   };
  },
  /** The run's selected client from its admitted scopes: exactly one client scope (prepared-run `exactInitialScopes`). */
  selectedClientOf(scopes){
   const list=Array.isArray(scopes)?scopes:[],clients=list.filter(s=>s?.kind==='client');
   return clients.length===1&&list.length===1&&typeof clients[0].resourceId==='string'&&UUID.test(clients[0].resourceId.toLowerCase())?clients[0].resourceId.toLowerCase():null;
  },
 });
}

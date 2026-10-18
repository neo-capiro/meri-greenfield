/** Credential custody for the artifact current-authority client (control only). Mirrors the reads broker invariants
 * (`../native-authority/reads-composer.mjs`, Core #83 SEC D1):
 *  - the Core service secret is a file read through the runtime's owner-only `readSecret` on every call (rotation without restart);
 *    its path and bytes must differ from every marked candidate credential file (identity, task, control, proxy);
 *  - the bearer is never stored here: it is the run's live action-session native credential (RC1 option A), admitted per call only
 *    when well formed, not a marked candidate credential and not the service secret. Only sha256 digests of the candidate
 *    credentials are kept. Nothing falls back to any other credential. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
import {refuse} from './core-authority-wire.mjs';

const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const sha=value=>createHash('sha256').update(value).digest('hex');
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};
const posixFile=p=>typeof p==='string'&&p.length<=4096&&p.startsWith('/')&&!p.includes('//')&&!p.split('/').includes('..');

/** The marked candidate credential files (`nativeCandidate`): the control credential reaches only application-authority
 * identity/context/membership, never this route. */
export function reservedCredentialFiles(configuration){
 const candidate=configuration?.nativeCandidate;if(!candidate||typeof candidate!=='object')refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 const files=[candidate.identity?.credentialFile,candidate.taskCapabilityFile,candidate.controlCapabilityFile,candidate.proxyCredentialFile];
 if(files.some(file=>!posixFile(file)))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 return files;
}

/** Async (reads files once to pin candidate digests). Returns `{serviceSecret(), admitBearer(token)}`. */
export async function createArtifactAuthorityCredentials(options){
 let c;try{c=own(options,['configuration','serviceSecretFile'],['readSecret']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const read=c.readSecret??readRuntimeSecret;
 if(typeof read!=='function'||types.isProxy(read)||!posixFile(c.serviceSecretFile))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 const reserved=reservedCredentialFiles(c.configuration);if(reserved.includes(c.serviceSecretFile))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 const forbidden=new Set();
 for(const file of reserved){let token;try{token=tokenOf(await read(file));}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}if(token===null)refuse('ARTIFACT_AUTHORITY_CONFIGURATION');forbidden.add(sha(token));}
 const current=async code=>{let token;try{token=tokenOf(await read(c.serviceSecretFile));}catch{refuse(code);}if(token===null||forbidden.has(sha(token)))refuse(code);return token;};
 await current('ARTIFACT_AUTHORITY_CONFIGURATION');
 return Object.freeze({
  /** The current service secret, re-read per call. */
  serviceSecret:()=>current('UNAVAILABLE'),
  /** The relayed bearer, or UNAVAILABLE. `serviceSecret` is the value just read for the same call. */
  admitBearer(token,serviceSecret){if(typeof token!=='string'||!TOKEN.test(token)||forbidden.has(sha(token))||token===serviceSecret)refuse('UNAVAILABLE');return token;},
 });
}

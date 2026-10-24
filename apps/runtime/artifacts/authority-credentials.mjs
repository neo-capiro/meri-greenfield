import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret as readRuntimeSecret} from '../config.mjs';
import {refuse} from './core-authority-wire.mjs';

const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};
const posixFile=p=>typeof p==='string'&&p.length<=4096&&p.startsWith('/')&&!p.includes('//')&&!p.split('/').includes('..');

/** Reads the control-only Core service secret; bearer provenance stays with the real session relay. Returns `{serviceSecret(), admitBearer(token)}`. */
export async function createArtifactAuthorityCredentials(options){
 let c;try{c=own(options,['serviceSecretFile'],['readSecret']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const read=c.readSecret??readRuntimeSecret;
 if(typeof read!=='function'||types.isProxy(read)||!posixFile(c.serviceSecretFile))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 const current=async code=>{let token;try{token=tokenOf(await read(c.serviceSecretFile));}catch{refuse(code);}if(token===null)refuse(code);return token;};
 await current('ARTIFACT_AUTHORITY_CONFIGURATION');
 return Object.freeze({
  /** The current service secret, re-read per call. */
  serviceSecret:()=>current('UNAVAILABLE'),
  /** The relayed bearer, or UNAVAILABLE. `serviceSecret` is the value just read for the same call. */
  admitBearer(token,serviceSecret){if(typeof token!=='string'||!TOKEN.test(token)||token===serviceSecret)refuse('UNAVAILABLE');return token;},
 });
}

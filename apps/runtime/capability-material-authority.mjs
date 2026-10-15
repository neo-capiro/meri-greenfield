/** File-backed capability-material authority (S2 owner for the per-run issuer's authority port). Material for one issuance key is
 * generated exactly once into an owner-only file under a configured owner-only directory (O_EXCL, 0600, no follow): a second
 * generation for the same key is refused, so a lost acknowledgement is reconciled through `status`, never re-minted. `retrieve`
 * returns the existing material by reference only for the matching grant and only before expiry; `status` reports the issued
 * identity (digest, never the material). The material never enters a receipt, a log or the database. */
import {randomBytes,randomUUID} from 'node:crypto';
import {open,mkdir,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
const fail=code=>{throw Object.assign(Error('CAPABILITY_AUTHORITY_'+code),{code:'CAPABILITY_AUTHORITY_'+code});};
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
export function createFileCapabilityAuthority({directory,now=Date.now}){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.length>4096||typeof now!=='function')fail('CONFIGURATION');
 const pathFor=key=>join(directory,key+'.json'),refFor=key=>'material:'+key,keyOf=ref=>{if(typeof ref!=='string'||!ref.startsWith('material:')||!hex64(ref.slice(9)))fail('REFUSED');return ref.slice(9);};
 const owned=st=>st.uid===process.getuid()&&(st.mode&0o077)===0;
 async function ensureDirectory(){let st;try{st=await lstat(directory);}catch(error){if(error?.code!=='ENOENT')fail('UNAVAILABLE');await mkdir(directory,{mode:0o700});st=await lstat(directory);}if(!st.isDirectory()||!owned(st))fail('DIRECTORY_REFUSED');}
 async function readRecord(key){let handle;try{handle=await open(pathFor(key),constants.O_RDONLY|constants.O_NOFOLLOW);const st=await handle.stat();if(!st.isFile()||!owned(st)||st.size>16384)fail('RECORD_REFUSED');const r=JSON.parse((await handle.readFile()).toString('utf8'));
   const v=own(data(r),['issuanceKey','grantId','capability','expiresAtMs','issuedAtMs']);if(v.issuanceKey!==key||!uuid(v.grantId)||typeof v.capability!=='string'||!/^[A-Za-z0-9_-]{32,128}$/u.test(v.capability)||!Number.isSafeInteger(v.expiresAtMs))fail('RECORD_REFUSED');return v;}
  catch(error){if(error?.code==='ENOENT')return null;if(typeof error?.code==='string'&&error.code.startsWith('CAPABILITY_AUTHORITY_'))throw error;fail('UNAVAILABLE');}finally{await handle?.close();}}
 /** Exactly one generation per issuance key: the record file is created exclusively; an existing record refuses (reconcile through `status`). */
 async function generate(value){const {signal:_g,...rest}=own(value,['issuanceKey','binding','expiresAtMs'],['signal']);const v=data(rest);void _g;if(!hex64(v.issuanceKey)||!v.binding||typeof v.binding!=='object'||hash(v.binding)!==v.issuanceKey||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=now())fail('REFUSED');
  await ensureDirectory();const record={issuanceKey:v.issuanceKey,grantId:randomUUID(),capability:randomBytes(32).toString('base64url'),expiresAtMs:v.expiresAtMs,issuedAtMs:now()};let handle;
  try{handle=await open(pathFor(v.issuanceKey),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await handle.writeFile(JSON.stringify(record));await handle.sync();}
  catch(error){if(error?.code==='EEXIST')fail('ALREADY_GENERATED');fail('UNAVAILABLE');}finally{await handle?.close();}
  return {grantId:record.grantId,capability:record.capability,materialRef:refFor(v.issuanceKey)};}
 async function retrieve(value){const {signal:_r,...rest}=own(value,['materialRef','grantId'],['signal']);const v=data(rest);void _r;const key=keyOf(v.materialRef);if(!uuid(v.grantId))fail('REFUSED');const r=await readRecord(key);
  if(!r||r.grantId!==v.grantId)return {state:'ABSENT'};if(r.expiresAtMs<=now())return {state:'EXPIRED'};return {state:'PRESENT',capability:r.capability};}
 async function status(value){const {signal:_s,...rest}=own(value,['issuanceKey'],['binding','expiresAtMs','signal']);const v=data(rest);void _s;if(!hex64(v.issuanceKey))fail('REFUSED');const r=await readRecord(v.issuanceKey);
  if(!r)return {state:'ABSENT'};if(v.expiresAtMs!==undefined&&r.expiresAtMs!==v.expiresAtMs)fail('REFUSED');return {state:'PRESENT',grantId:r.grantId,capabilitySha256:capabilityDigest(r.capability),materialRef:refFor(v.issuanceKey)};}
 return Object.freeze({generate,retrieve,status,directory});
}

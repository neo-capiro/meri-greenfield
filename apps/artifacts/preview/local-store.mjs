/** Explicit source-local preview record store over an owned root: write-once, one record per artifact version. This is not
 * the deployed store; a durable store needs its own allocated migration (proposal in the lane report). Preview bytes are
 * not stored here: they go through the canonical artifact object port. */
import {mkdir,writeFile,readFile,link,unlink,lstat,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=signal=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');};
const id=value=>{if(typeof value!=='string'||!/^[a-f0-9-]{36}$/iu.test(value))fail('ARTIFACT_ID');return value.toLowerCase();};
const MAX_RECORD_BYTES=65536;

export async function createLocalPreviewStore({root,canonicalSha256}){
 if(typeof root!=='string'||!isAbsolute(root)||typeof canonicalSha256!=='function')fail('ARTIFACT_STORE_CONFIGURATION');
 await mkdir(root,{mode:0o700,recursive:false});let disposed=false;
 const active=()=>{if(disposed)fail('ARTIFACT_STORE_CLOSED');};
 async function readRecord(path){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>MAX_RECORD_BYTES)fail('ARTIFACT_STORE_FILE');return JSON.parse(await readFile(path));}
 return Object.freeze({
  /** The committed record for `versionId`, or null. */
  async read(versionId,signal){active();check(signal);
   try{const record=await readRecord(join(root,id(versionId)+'.json'));check(signal);return record;}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  /** `committed`, or `duplicate` for the identical record; a different record for the same version is ARTIFACT_PREVIEW_CONFLICT. */
  async commit(record,signal){active();check(signal);
   const path=join(root,id(record.versionId)+'.json'),bytes=Buffer.from(JSON.stringify(record));if(bytes.length>MAX_RECORD_BYTES)fail('ARTIFACT_PREVIEW_LIMIT');
   const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,bytes,{flag:'wx',mode:0o600});
   try{await link(temp,path);check(signal);return {status:'committed',versionId:record.versionId,recordSha256:canonicalSha256(record)};}
   catch(e){if(e.code!=='EEXIST')throw e;const old=await readRecord(path);if(canonicalSha256(old)!==canonicalSha256(record))fail('ARTIFACT_PREVIEW_CONFLICT');return {status:'duplicate',versionId:record.versionId,recordSha256:canonicalSha256(record)};}
   finally{await unlink(temp);}},
  async dispose(){active();disposed=true;await rm(root,{recursive:true,force:true});},
 });
}

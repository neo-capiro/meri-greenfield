/** Explicit source-local preview record store over an owned root: write-once, one record per artifact version. This is not
 * the deployed store; a durable store needs its own allocated migration (proposal in the lane report). Preview bytes are
 * not stored here: they go through the canonical artifact object port. */
import {mkdir,open,readFile,rename,lstat,rm,readdir} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=signal=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');};
const id=value=>{if(typeof value!=='string'||!/^[a-f0-9-]{36}$/iu.test(value))fail('ARTIFACT_ID');return value.toLowerCase();};
const MAX_RECORD_BYTES=65536;

export async function createLocalPreviewStore({root,canonicalSha256}){
 if(typeof root!=='string'||!isAbsolute(root)||typeof canonicalSha256!=='function')fail('ARTIFACT_STORE_CONFIGURATION');
 // Reopening an existing root recovers claims; it never deletes or resets them.
 let ownsRoot=false;try{await mkdir(root,{mode:0o700});ownsRoot=true;}catch(e){if(e.code!=='EEXIST')throw e;}
 const dir=await lstat(root);if(!dir.isDirectory()||dir.isSymbolicLink())fail('ARTIFACT_STORE_FILE');let disposed=false;
 const active=()=>{if(disposed)fail('ARTIFACT_STORE_CLOSED');};
 async function readRecord(path){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>MAX_RECORD_BYTES)fail('ARTIFACT_STORE_FILE');return JSON.parse(await readFile(path));}
 /** Atomic directory exclusion is portable to Windows, which may deny hard links. A failed publisher leaves its lock
  * held; nobody steals it or overwrites the final file. Data is synced before atomic publication. */
 async function writeOnce(path,value,signal){
  check(signal);const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>MAX_RECORD_BYTES)fail('ARTIFACT_PREVIEW_LIMIT');
  try{return {created:false,value:await readRecord(path)};}catch(e){if(e.code!=='ENOENT')throw e;}
  const lock=path+'.lock';try{await mkdir(lock,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;
   try{return {created:false,value:await readRecord(path)};}catch(error){if(error.code==='ENOENT')fail('ARTIFACT_PREVIEW_CLAIM_HELD');throw error;}}
  const temp=join(lock,'record.tmp'),file=await open(temp,'wx',0o600);
  try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
  await rename(temp,path);check(signal);return {created:true,value};
 }
 return Object.freeze({
  /** One durable exclusion per source version. Losing or uncertain claims never license another object write. */
  async claim(attempt,signal){active();const saved=await writeOnce(join(root,id(attempt.versionId)+'.claim.json'),attempt,signal);return {claimed:saved.created,claim:saved.value};},
  async recordObject(attempt,object,signal){active();check(signal);const claim=await readRecord(join(root,id(attempt.versionId)+'.claim.json'));
   if(canonicalSha256(claim)!==canonicalSha256(attempt)||object.objectId!==claim.objectId)fail('ARTIFACT_PREVIEW_CLAIM');
   const saved=await writeOnce(join(root,id(attempt.versionId)+'.object.json'),object,signal);
   if(canonicalSha256(saved.value)!==canonicalSha256(object))fail('ARTIFACT_PREVIEW_CONFLICT');},
  /** Retention/recovery inventory, including every possible orphan object allocated before an uncertain effect. */
  async custody(signal){active();check(signal);const out=[];
   for(const name of await readdir(root)){if(!name.endsWith('.claim.json'))continue;const claim=await readRecord(join(root,name));
    let record=null,object=null;try{record=await readRecord(join(root,id(claim.versionId)+'.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    try{object=await readRecord(join(root,id(claim.versionId)+'.object.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    out.push({claim,object,record,state:record?'COMMITTED':'UNKNOWN'});}
   check(signal);return out;},
  /** The committed record for `versionId`, or null. */
  async read(versionId,signal){active();check(signal);
   try{const record=await readRecord(join(root,id(versionId)+'.json'));check(signal);return record;}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  /** `committed`, or `duplicate` for the identical record; a different record for the same version is ARTIFACT_PREVIEW_CONFLICT. */
  async commit(record,signal){active();check(signal);
   const claim=await readRecord(join(root,id(record.versionId)+'.claim.json'));
   if(claim.objectId!==record.preview?.object?.objectId||claim.previewId!==record.previewId||claim.sourceSha256!==record.source?.sha256||claim.tenantId!==record.tenantId||claim.conversationId!==record.conversationId)fail('ARTIFACT_PREVIEW_CLAIM');
   const saved=await writeOnce(join(root,id(record.versionId)+'.json'),record,signal);
   if(canonicalSha256(saved.value)!==canonicalSha256(record))fail('ARTIFACT_PREVIEW_CONFLICT');
   return {status:saved.created?'committed':'duplicate',versionId:record.versionId,recordSha256:canonicalSha256(record)};},
  async dispose(){active();disposed=true;if(ownsRoot)await rm(root,{recursive:true,force:true});},
 });
}

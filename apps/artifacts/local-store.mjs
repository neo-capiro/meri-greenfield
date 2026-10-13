import {mkdir,writeFile,readFile,link,unlink,rename,lstat,rm,rmdir,readdir} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {readLocalReplay} from './local-replay.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=signal=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');};
const id=value=>{if(typeof value!=='string'||!/^[a-f0-9-]{36}$/i.test(value))fail('ARTIFACT_ID');return value;};
async function readRegular(path,max){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>max)fail('ARTIFACT_STORE_FILE');return readFile(path);}

// Explicit source-local store, owned root only. Not the deployed S3/PG adapter.
// A crash after immutable record but before head publication needs reconciliation;
// callers receive ambiguity. Replay requires head/ancestry proof and retained bytes.
export async function createLocalArtifactStore({root,canonicalSha256}){
  if(typeof root!=='string'||!isAbsolute(root)||typeof canonicalSha256!=='function')fail('ARTIFACT_STORE_CONFIGURATION');
  await mkdir(root,{mode:0o700,recursive:false});
  for(const dir of ['objects','versions','heads','locks'])await mkdir(join(root,dir),{mode:0o700});
  let disposed=false;const active=()=>{if(disposed)fail('ARTIFACT_STORE_CLOSED');};
  async function immutable(path,bytes){
    const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,bytes,{flag:'wx',mode:0o600});
    try{await link(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;const old=await readRegular(path,8388608);if(!old.equals(bytes))fail('ARTIFACT_IMMUTABLE_CONFLICT');}finally{await unlink(temp);}
  }
  const objects=Object.freeze({
    async put({objectId,bytes,scopes},signal){active();check(signal);id(objectId);if(!Buffer.isBuffer(bytes)||bytes.length>8388608)fail('ARTIFACT_OBJECT_LIMIT');
      const object={objectId,versionId:sha(bytes),sha256:sha(bytes),bytes:bytes.length,scopes:structuredClone(scopes)};
      await immutable(join(root,'objects',objectId+'.'+object.versionId),bytes);check(signal);return object;},
    async get(object,signal){active();check(signal);id(object.objectId);if(!/^[a-f0-9]{64}$/.test(object.versionId)||object.versionId!==object.sha256)fail('ARTIFACT_OBJECT_VERSION');
      const bytes=await readRegular(join(root,'objects',object.objectId+'.'+object.versionId),8388608);check(signal);if(bytes.length!==object.bytes||sha(bytes)!==object.sha256)fail('ARTIFACT_OBJECT_MISMATCH');return bytes;}
  });
  async function readVersionFile(versionId,signal){active();check(signal);const bytes=await readRegular(join(root,'versions',id(versionId)+'.json'),4194304);check(signal);return bytes;}
  const readVersion=async(versionId,signal)=>JSON.parse(await readVersionFile(versionId,signal));
  const versions=Object.freeze({
    async read(versionId,signal){
      active();check(signal);
      if(typeof versionId==='string')return readVersion(versionId,signal);
      return readLocalReplay(versionId,{readVersion:async value=>{const bytes=await readVersionFile(value,signal);return {record:JSON.parse(bytes),bytes:bytes.length};},
        readHead:async artifactId=>(await readRegular(join(root,'heads',id(artifactId)),100)).toString('utf8'),
        listVersions:()=>readdir(join(root,'versions')),hash:canonicalSha256,check:()=>{active();check(signal);}});
    },
    async commit({version,spec,specSha256,requestSha256,inspection,expectedParentVersionId},signal){
      active();check(signal);id(version.versionId);id(version.artifactId);if(expectedParentVersionId!==null)id(expectedParentVersionId);
      if(specSha256!==canonicalSha256(spec)||version.parentVersionId!==expectedParentVersionId)fail('ARTIFACT_COMMIT_INPUT');
      const lock=join(root,'locks',version.artifactId);try{await mkdir(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')fail('ARTIFACT_COMMIT_BUSY');throw e;}
      const path=join(root,'versions',version.versionId+'.json'),head=join(root,'heads',version.artifactId),record={version,spec,specSha256,requestSha256,inspection};
      try{
        check(signal);let old=null,current=null;
        try{old=JSON.parse(await readRegular(path,4194304));}catch(e){if(e.code!=='ENOENT')throw e;}
        try{current=(await readRegular(head,100)).toString('utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
        if(old){if(canonicalSha256(old)!==canonicalSha256(record)||current!==version.versionId)fail('ARTIFACT_COMMIT_RECONCILIATION_REQUIRED');return {status:'duplicate',versionId:version.versionId,requestSha256,versionSha256:canonicalSha256(version)};}
        if(current!==expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
        await immutable(path,Buffer.from(JSON.stringify(record)));check(signal);
        const temp=head+'.'+randomUUID()+'.tmp';await writeFile(temp,version.versionId,{flag:'wx',mode:0o600});
        try{check(signal);await rename(temp,head);}finally{await rm(temp,{force:true});}
        check(signal);return {status:'committed',versionId:version.versionId,requestSha256,versionSha256:canonicalSha256(version)};
      }finally{await rmdir(lock);}
    }
  });
  return Object.freeze({objects,versions,async dispose(){active();disposed=true;await rm(root,{recursive:true,force:true});}});
}

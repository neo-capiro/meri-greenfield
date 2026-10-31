/** Canonical static material inventory and Linux preflight for control and Temporal workers.
 * No per-run credentials or certificates are materialized. No IO occurs on import. */
import {open,lstat,realpath,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {configurationMaxBytes,validateConfiguration} from './config.mjs';

const root='/run/meri', mode=0o600, maxBytes=32768;
const names=Object.freeze({control:'control.json','temporal-worker':'worker.json','schedule-worker':'schedule-worker.json'});
// The image creates these two upload directories beneath the fixed material root and owns them as the service
// identity. They are admitted only while empty, correctly typed/owned/moded and never removed by material ownership.
const preserved=Object.freeze(['upload-scratch','upload-definitions']);
export const productMaterialPolicy=Object.freeze({directory:root,maxBytes,configurationNames:names,preservedDirectories:preserved});
const plans=new WeakSet();
const hex64=/^[a-f0-9]{64}$/u;
const sameKernelIdentity=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.gid===b.gid;
const refuse=()=>{throw Object.assign(Error('PRODUCT_MATERIAL_REFUSED'),{code:'PRODUCT_MATERIAL_REFUSED'});};
const own=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** True only for an admitted image-owned upload directory: exact name, real directory, same non-root identity,
 * mode 0700, not a symlink/reparse path, and still empty. No other directory name is ever admitted. */
export async function inspectPreservedDirectory(name,uid,gid){
 if(!preserved.includes(name))return null;
 const path=`${root}/${name}`;const flags=constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW;
 let handle,second;
 try{
  // Stable no-follow observation. The admitted object is the one the open handle refers to; the pathname is
  // re-opened after enumeration and must resolve to the SAME kernel object, so a replacement during readdir cannot
  // leave an old handle passing while a different directory is enumerated.
  handle=await open(path,flags,0o700);
  const before=await handle.stat();
  if(!before.isDirectory()||before.isSymbolicLink()||before.uid!==uid||before.gid!==gid||(before.mode&0o7777)!==0o700)return null;
  if(await realpath(path)!==path)return null;
  const entries=await readdir(path);
  second=await open(path,flags,0o700);
  const current=await second.stat();
  if(!current.isDirectory()||current.isSymbolicLink()||current.uid!==uid||current.gid!==gid||(current.mode&0o7777)!==0o700)return null;
  if(!sameKernelIdentity(before,current))return null;
  const after=await handle.stat();
  if(!after.isDirectory()||!sameKernelIdentity(before,after)||(after.mode&0o7777)!==0o700)return null;
  if(entries.length!==0)return null;
  return Object.freeze({dev:current.dev,ino:current.ino,uid:current.uid,gid:current.gid});
 }catch{return null;}finally{await second?.close();await handle?.close();}
}
/** Re-verify the admitted preserved directories are the SAME kernel objects and still empty. */
export async function verifyPreservedSet(admitted,uid,gid){
 if(!(admitted instanceof Map)||admitted.size>preserved.length)refuse();
 for(const [name,expected] of admitted){
  if(!preserved.includes(name))refuse();
  const current=await inspectPreservedDirectory(name,uid,gid);
  if(!current||!sameKernelIdentity(current,expected))refuse();
 }
 // No addition after admission: any preserved directory present in the root must be one that was admitted.
 const entries=await readdir(root);
 for(const name of entries)if(preserved.includes(name)&&!admitted.has(name))refuse();
}

export function parseProductRuntimeUser(value){
 if(typeof value!=='string'||!/^([1-9][0-9]{0,9}):([1-9][0-9]{0,9})$/u.test(value))refuse();
 const [uid,gid]=value.split(':').map(Number);
 if(!Number.isSafeInteger(uid)||!Number.isSafeInteger(gid)||uid>2147483647||gid>2147483647)refuse();
 return {uid,gid};
}
/** Static material is written and read by the same non-root identity. */
export function productMaterialIdentity(role,runtimeUser){
 if(typeof role!=='string'||!Object.hasOwn(names,role))refuse();
 const {uid,gid}=parseProductRuntimeUser(runtimeUser);
 return Object.freeze({uid,gid});
}
function direct(path){
 if(typeof path!=='string'||posix.dirname(path)!==root||posix.basename(path)==='.'||posix.basename(path)==='..'||path.includes('\\')||path.includes('//'))refuse();
 return path;
}

/** Return only paths and file requirements. The caller must separately authenticate the configuration and exact byte hashes. */
export function compileProductMaterialPlan({role,configuration,runtimeUser}){
 if(!Object.hasOwn(names,role)||!own(configuration))refuse();
 const identity=productMaterialIdentity(role,runtimeUser),{uid,gid}=identity,configurationPath=`${root}/${names[role]}`;
 let c;try{c=validateConfiguration(configuration,role);}catch{refuse();}
 if(c.http.hostname!=='0.0.0.0'||c.http.port!==(role==='control'?8080:role==='temporal-worker'?8081:8083))refuse();
 // Static product control must never fall back to the legacy shared listener:
 // the public ALB target reaches 8080 while native capabilities reach 8082.
 if(role==='control'&&(c.privateHttp===undefined||c.agentcore===undefined))refuse();
 const files=new Map([[configurationPath,new Set(['configuration'])]]);
 function add(path,purpose){
  direct(path);if(path===configurationPath)refuse();
  const purposes=files.get(path)??new Set();purposes.add(purpose);files.set(path,purposes);
 }
 add(c.native.capabilityFile,'native-capability');
 add(c.temporal.tls.caFile,'temporal-ca');add(c.temporal.tls.certFile,'temporal-cert');add(c.temporal.tls.keyFile,'temporal-key');
 if(c.native?.serverCaFile!==undefined)add(c.native.serverCaFile,'control-server-ca');
 if(role==='control'||role==='schedule-worker'){
  add(c.database.connectionFile,'database-connection');
  if(role==='schedule-worker'&&c.routines?.enabled===true&&c.routines.core!==undefined)add(c.routines.core.serviceSecretFile,'routines-core-service-secret');
  if(c.downloadLinks?.enabled)add(c.downloadLinks.keyFile,'download-signing-key');
  if(c.reads?.enabled===true){add(c.reads.serviceSecretFile,'reads-service-secret');if(c.reads.readModeServiceSecretFile!==undefined)add(c.reads.readModeServiceSecretFile,'reads-read-mode-service-secret');
  }
 }
 for(const [path,purposes] of files){if(purposes.size>1)refuse();if(path!==configurationPath)direct(path);}
 const dynamicMaterialDirectory=null;

 const requiredFiles=Object.freeze([...files].sort(([a],[b])=>a.localeCompare(b)).map(([path,purposes])=>Object.freeze({path,purposes:Object.freeze([...purposes].sort()),mode:'0600',maxBytes:path===configurationPath?configurationMaxBytes(role):maxBytes})));
 const plan=Object.freeze({schemaVersion:1,role,containerName:role,configurationPath,materialDirectory:root,runtimeUser,uid,gid,
  directoryMode:'0700',requiredFiles,requiresTokenRotation:false,
  dynamicMaterialDirectory});
 plans.add(plan);return plan;
}

/** Read-only task-local preflight. Pins are exact SHA-256s from an independently authenticated shipping owner, never emitted. */
export async function verifyProductMaterial(plan,{expectedSha256ByPath}={}){
 if(!plans.has(plan)||process.platform!=='linux'||typeof process.getuid!=='function'||!own(expectedSha256ByPath))refuse();
 const {uid:ownerUid,gid:ownerGid}=plan;
 if(process.getuid()!==ownerUid||process.getgid()!==ownerGid)refuse();
 const paths=plan.requiredFiles.map(file=>file.path),keys=Object.keys(expectedSha256ByPath);
 if(keys.length!==paths.length||keys.some(key=>!paths.includes(key)||!hex64.test(expectedSha256ByPath[key])))refuse();
 let directory;const admittedSet=new Map();try{directory=await lstat(root);if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==ownerUid||directory.gid!==ownerGid||(directory.mode&0o777)!==0o700||await realpath(root)!==root)refuse();
  const entries=await readdir(root);let owned=0;
  for(const name of entries){const path=`${root}/${name}`;if(paths.includes(path)){owned++;continue;}
   const admitted=await inspectPreservedDirectory(name,ownerUid,ownerGid);if(!admitted)refuse();admittedSet.set(name,admitted);}
  if(owned!==paths.length)refuse();}catch{refuse();}
 let parsed;
 for(const {path,maxBytes} of plan.requiredFiles){
  let handle,bytes;try{
   // A foreign FIFO at an expected path must not block the preflight before fstat can reject it.
   handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=await handle.stat();
   if(!st.isFile()||st.uid!==ownerUid||st.gid!==ownerGid||(st.mode&0o777)!==mode||st.size<1||st.size>maxBytes)refuse();
   bytes=Buffer.alloc(maxBytes+1);let used=0;
   while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,used);if(bytesRead===0)break;used+=bytesRead;}
   const after=await handle.stat();
   if(used!==st.size||used>maxBytes||after.size!==st.size||after.ino!==st.ino||hash(bytes.subarray(0,used))!==expectedSha256ByPath[path])refuse();
   if(path===plan.configurationPath)parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
  }catch{refuse();}finally{bytes?.fill(0);await handle?.close();}
 }
 let actual;try{actual=compileProductMaterialPlan({role:plan.role,configuration:parsed,runtimeUser:plan.runtimeUser});}catch{refuse();}
 if(actual.requiredFiles.length!==plan.requiredFiles.length||actual.requiredFiles.some((file,index)=>file.path!==plan.requiredFiles[index].path||file.purposes.join(',')!==plan.requiredFiles[index].purposes.join(',')))refuse();
 let after;try{after=await lstat(root);}catch{refuse();}
 if(!after.isDirectory()||after.dev!==directory.dev||after.ino!==directory.ino||after.uid!==directory.uid||after.gid!==directory.gid||(after.mode&0o777)!==0o700)refuse();
 // Standalone preflight proves the admitted image directories it observed are the same objects and still empty.
 try{await verifyPreservedSet(admittedSet,ownerUid,ownerGid);}catch{refuse();}
 return Object.freeze({ready:true,role:plan.role,configurationPath:plan.configurationPath,fileCount:paths.length});
}

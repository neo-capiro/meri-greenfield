/** One-shot static material owner for the roles in material-init-plan.mjs. The shipping owner supplies independent immutable pins and an authenticated
 * delivery port. This module issues no credential, trusts no delivery echo, and has no IO on import. */
import {open,mkdir,lstat,realpath,readdir,unlink,rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {compileProductMaterialPlan,verifyProductMaterial,productMaterialPolicy,productMaterialIdentity,inspectPreservedDirectory,verifyPreservedSet} from './material-init-plan.mjs';
import {configurationMaxBytes} from './config.mjs';

const {directory:root,maxBytes,configurationNames,preservedDirectories}=productMaterialPolicy;
const receipts=new WeakMap(),hex64=/^[a-f0-9]{64}$/u;
const fail=code=>{throw Object.assign(Error('STATIC_INIT_'+code),{code:'STATIC_INIT_'+code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=st=>({dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid});
const sameIdentity=(a,b)=>['dev','ino','uid','gid'].every(key=>a[key]===b[key]);
const safeFailure=error=>typeof error?.code==='string'&&/^STATIC_INIT_[A-Z_]+$/u.test(error.code)?error:Object.assign(Error('STATIC_INIT_REFUSED'),{code:'STATIC_INIT_REFUSED'});

/** Pins must come from the independently reviewed task definition, separately from the secret bundle. The contract digest is
 * canonical SHA-256 of these fields with materialContractSha256 omitted. It is correlation, not an issuer signature. */
export function parseStaticProductMaterialExpected(raw){
 try{
  const e=data(own(raw,['schemaVersion','role','runtimeUser','sourceCommit','imageDigest','materialContractSha256','sha256ByPath']));
  // The same non-root service identity writes and reads its files.
  productMaterialIdentity(e.role,e.runtimeUser);
  if(e.schemaVersion!==1||!Object.hasOwn(configurationNames,e.role)||!/^[a-f0-9]{40}$/u.test(e.sourceCommit)||!/^sha256:[a-f0-9]{64}$/u.test(e.imageDigest)||!hex64.test(e.materialContractSha256))fail('EXPECTED_REFUSED');
  const paths=Object.keys(own(e.sha256ByPath,Object.keys(e.sha256ByPath)));
  if(paths.length<1||paths.length>20||!paths.includes(`${root}/${configurationNames[e.role]}`)||paths.some(path=>posix.dirname(path)!==root||path.includes('\\')||path.includes('//')||!hex64.test(e.sha256ByPath[path])))fail('EXPECTED_REFUSED');
  const {materialContractSha256,...contract}=e;
  if(canonicalSha256(contract)!==materialContractSha256)fail('EXPECTED_REFUSED');
  return e;
 }catch{fail('EXPECTED_REFUSED');}
}

function prepared(expected,bundle){
 const decoded=[];
 try{
  const e=parseStaticProductMaterialExpected(expected),raw=own(bundle,['files']);
  // Bound the closed JSON before retaining its snapshot; one Secrets Manager SecretString is at most 65,536 bytes.
  if(!Array.isArray(raw.files)||raw.files.length>20)fail('BUNDLE_REFUSED');
  const b=data(raw);if(Buffer.byteLength(JSON.stringify(b),'utf8')>65536)fail('BUNDLE_REFUSED');
  const paths=Object.keys(e.sha256ByPath),files=new Map(),configurationPath=`${root}/${configurationNames[e.role]}`;
  if(b.files.length!==paths.length)fail('INVENTORY_REFUSED');
  for(const value of b.files){
   const f=own(value,['path','base64']);
   const limit=f.path===configurationPath?configurationMaxBytes(e.role):maxBytes;
   if(!paths.includes(f.path)||files.has(f.path)||typeof f.base64!=='string'||f.base64.length<4||f.base64.length>4*Math.ceil(limit/3))fail('INVENTORY_REFUSED');
   const bytes=Buffer.from(f.base64,'base64');decoded.push(bytes);
   if(bytes.length<1||bytes.length>limit||bytes.toString('base64')!==f.base64||sha(bytes)!==e.sha256ByPath[f.path])fail('CONTENT_REFUSED');
   files.set(f.path,bytes);
  }
  const json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const configuration=json(files.get(configurationPath));
  const plan=compileProductMaterialPlan({role:e.role,configuration,runtimeUser:e.runtimeUser});
  if(plan.requiredFiles.length!==files.size||plan.requiredFiles.some(file=>!files.has(file.path)))fail('INVENTORY_REFUSED');
  return {expected:e,plan,files,clear:()=>decoded.forEach(bytes=>bytes.fill(0))};
 }catch(error){decoded.forEach(bytes=>bytes.fill(0));throw safeFailure(error);}
}
function summary(p){
 const e=p.expected;
 return Object.freeze({ready:true,role:e.role,runtimeUser:e.runtimeUser,sourceCommit:e.sourceCommit,imageDigest:e.imageDigest,
  materialContractSha256:e.materialContractSha256,configurationPath:p.plan.configurationPath,fileCount:p.files.size});
}

/** Pure validation for offline review. Returns no material, expected file digests or parsed credential-bearing configuration. */
export function validateStaticProductDelivery({expected,bundle}){
 const p=prepared(expected,bundle);try{return summary(p);}finally{p.clear();}
}

async function checkedDirectory(state,expectedIdentity){
 const st=await lstat(root),owner=state.owner;
 if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==owner.uid||st.gid!==owner.gid||(st.mode&0o777)!==0o700||await realpath(root)!==root||expectedIdentity&&!sameIdentity(st,expectedIdentity))fail('DIRECTORY_REFUSED');
 return identity(st);
}
async function acquireDirectory(plan){
 // /run is a protected image/volume boundary. Refuse a symlinked ancestor before creating a fresh child.
 if(await realpath(posix.dirname(root))!==posix.dirname(root))fail('DIRECTORY_REFUSED');
 let created=false;
 try{await mkdir(root,{mode:0o700});created=true;}catch(error){if(error?.code!=='EEXIST')throw error;}
 let st;try{st=await lstat(root);}catch(error){if(created)fail('CLEANUP_FAILED');throw error;}
 return {directory:identity(st),created,cleanupOwned:created,files:[],preserved:new Map(),released:false,owner:{uid:plan.uid,gid:plan.gid}};
}
async function writeFile(state,path,bytes,check){
 await checkedDirectory(state,state.directory);check();let handle;
 try{
  handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  const first=await handle.stat(),file={path,...identity(first)};state.files.push(file);
  if(!first.isFile()||first.uid!==state.owner.uid||first.gid!==state.owner.gid||(first.mode&0o777)!==0o600)fail('FILE_REFUSED');
  // A delayed open/stat must not reach a write after the deadline. The empty
  // file is already tracked, so owned-path cleanup removes it.
  check();
  await handle.writeFile(bytes);await handle.sync();
  const after=await handle.stat();
  if(!after.isFile()||!sameIdentity(first,after)||after.size!==bytes.length||(after.mode&0o777)!==0o600||after.nlink!==1)fail('FILE_REFUSED');
  file.bytes=bytes.length;file.sha256=sha(bytes);check();
 }finally{await handle?.close();}
}
async function releaseOwned(state){
 if(state.released)return {removed:0};
 await checkedDirectory(state,state.directory);
 const entries=await readdir(root),files=new Map(state.files.map(file=>[posix.basename(file.path),file]));
 // Classify the complete root: tracked material files, the exact admitted upload directories, nothing else.
 const preserved=[];
 for(const name of entries){
  if(files.has(name))continue;
  if(!preservedDirectories.includes(name))fail('CLEANUP_REFUSED');
  preserved.push(name);
 }
 // The complete tracked owned-file set must be present. A missing tracked file refuses here, before any removal,
 // instead of surfacing later during unlink after earlier files were already removed.
 if(files.size!==state.files.length||entries.length!==files.size+preserved.length)fail('CLEANUP_REFUSED');
 for(const name of files.keys())if(!entries.includes(name))fail('CLEANUP_REFUSED');
 // Validate the whole owned set, then the admitted directories, before removing anything.
 for(const name of entries){
  const file=files.get(name);if(!file)continue;
  const st=await lstat(file.path);
  if(!st.isFile()||st.isSymbolicLink()||!sameIdentity(st,file)||st.nlink!==1)fail('CLEANUP_REFUSED');
  if(file.sha256!==undefined){let handle,bytes;try{
   handle=await open(file.path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
   const current=await handle.stat();
   if(!current.isFile()||!sameIdentity(current,file)||current.size!==file.bytes)fail('CLEANUP_REFUSED');
   bytes=Buffer.alloc(file.bytes+1);let used=0;
   while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,used);if(bytesRead===0)break;used+=bytesRead;}
   const after=await handle.stat();
   if(used!==file.bytes||!sameIdentity(after,file)||after.size!==file.bytes||sha(bytes.subarray(0,used))!==file.sha256)fail('CLEANUP_REFUSED');
  }finally{bytes?.fill(0);await handle?.close();}}
 }
 try{await verifyPreservedSet(state.preserved,state.owner.uid,state.owner.gid);}catch{fail('CLEANUP_REFUSED');}
 await checkedDirectory(state,state.directory);
 for(const file of state.files)await unlink(file.path);
 if(state.created)await rmdir(root);
 state.released=true;return {removed:state.files.length};
}

/** The delivery port is installed only by a trusted shipping composition (for example exact-version ECS secret injection). No
 * ambient network, task metadata, browser input, capability minting or fallback credentials are consulted. */
export async function materializeStaticProductMaterial({expected,delivery,now=Date.now,signal,maxRequestMs=5000}){
 const e=parseStaticProductMaterialExpected(expected);nativeSignal(signal);
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||typeof delivery?.fetch!=='function')fail('CONFIGURATION_REFUSED');
 const {uid,gid}=productMaterialIdentity(e.role,e.runtimeUser);
 if(process.platform!=='linux'||typeof process.getuid!=='function'||process.getuid()!==uid||process.getgid()!==gid)fail('PLATFORM_REFUSED');
 const life=createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>Object.assign(Error('STATIC_INIT_INTERRUPTED'),{code:'STATIC_INIT_INTERRUPTED'})});
 let p,state;
 try{
  const {sha256ByPath:_pins,...request}=e;void _pins;
  p=prepared(e,await life.run(signal=>delivery.fetch({...request,signal})));life.check();
  state=await acquireDirectory(p.plan);
  await checkedDirectory(state,state.directory);
  // The image legitimately owns the two empty upload directories under this fixed root. They are admitted only in
  // that exact form; every other entry, nonempty upload directory, symlink/reparse path, wrong type, owner or mode
  // refuses before any material is written, and none of these directories is ever removed.
  const admitted=new Map();
  for(const name of await readdir(root)){
   if(!preservedDirectories.includes(name))fail('DIRECTORY_NOT_EMPTY');
   const entry=await inspectPreservedDirectory(name,state.owner.uid,state.owner.gid);
   if(!entry)fail('DIRECTORY_REFUSED');
   admitted.set(name,entry);
  }
  // Bind the admitted directory identities for the whole lifecycle (init, verification, cleanup).
  state.preserved=admitted;
  state.cleanupOwned=true;life.check();
  for(const [path,bytes] of p.files)await writeFile(state,path,bytes,life.check);
  await verifyProductMaterial(p.plan,{expectedSha256ByPath:e.sha256ByPath});life.check();
  // No replacement, disappearance or set drift of the admitted image directories between stages.
  try{await verifyPreservedSet(state.preserved,state.owner.uid,state.owner.gid);}catch{fail('DIRECTORY_REFUSED');}
  const receipt=summary(p);receipts.set(receipt,state);
  return Object.freeze({configurationPath:p.plan.configurationPath,receipt});
 }catch(error){
  const failure=safeFailure(error);
  if(state?.cleanupOwned)try{await releaseOwned(state);}catch{throw Object.assign(Error('STATIC_INIT_CLEANUP_FAILED'),{code:'STATIC_INIT_CLEANUP_FAILED',failure:failure.code});}
  throw failure;
 }finally{p?.clear();life.close();}
}

/** Explicit same-process rollback of exactly this init owner's files. ECS owns volume disposal after the one-shot process exits. */
export async function releaseStaticProductMaterial(receipt){
 const state=receipts.get(receipt);if(!state)fail('RECEIPT_REFUSED');
 try{return await releaseOwned(state);}catch{fail('CLEANUP_REFUSED');}
}

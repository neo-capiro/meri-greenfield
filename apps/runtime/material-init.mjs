/** One-shot static material owner for the roles in material-init-plan.mjs. The shipping owner supplies independent immutable pins and an authenticated
 * delivery port. This module issues no credential, trusts no delivery echo, and has no IO on import. */
import {open,mkdir,lstat,lchown,realpath,readdir,unlink,rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {compileProductMaterialPlan,verifyProductMaterial,productMaterialPolicy,productMaterialIdentity} from './material-init-plan.mjs';

const {directory:root,maxBytes,configurationNames,companionConfigurationNames}=productMaterialPolicy;
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
  // Role-bound reader identity: 10001:10001 only for model-proxy, 1000:1000 for fixed Node roles.
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
  const paths=Object.keys(e.sha256ByPath),files=new Map();
  if(b.files.length!==paths.length)fail('INVENTORY_REFUSED');
  for(const value of b.files){
   const f=own(value,['path','base64']);
   if(!paths.includes(f.path)||files.has(f.path)||typeof f.base64!=='string'||f.base64.length<4||f.base64.length>4*Math.ceil(maxBytes/3))fail('INVENTORY_REFUSED');
   const bytes=Buffer.from(f.base64,'base64');decoded.push(bytes);
   if(bytes.length<1||bytes.length>maxBytes||bytes.toString('base64')!==f.base64||sha(bytes)!==e.sha256ByPath[f.path])fail('CONTENT_REFUSED');
   files.set(f.path,bytes);
  }
  const configurationPath=`${root}/${configurationNames[e.role]}`,json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const configuration=json(files.get(configurationPath)),companions={};
  for(const [key,name] of Object.entries(companionConfigurationNames[e.role]??{})){
   if(!files.has(`${root}/${name}`))fail('INVENTORY_REFUSED');companions[key]=json(files.get(`${root}/${name}`));
  }
  const plan=compileProductMaterialPlan({role:e.role,configuration,runtimeUser:e.runtimeUser,...companions});
  if(plan.requiredFiles.length!==files.size||plan.requiredFiles.some(file=>!files.has(file.path)))fail('INVENTORY_REFUSED');
  // A configuration's own {path,sha256} references must name exactly the independently pinned delivered bytes.
  if(Object.entries(plan.requiredSha256ByPath).some(([path,digest])=>e.sha256ByPath[path]!==digest))fail('CONTENT_REFUSED');
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

/** The writer identity owns the directory and files until any handover; for most roles it is the reader. */
const writerOf=plan=>({uid:plan.writerUid,gid:plan.writerGid});
const handsOver=plan=>plan.writerUid!==plan.uid||plan.writerGid!==plan.gid;
async function checkedDirectory(state,expectedIdentity){
 const st=await lstat(root),owner=state.owner;
 if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==owner.uid||st.gid!==owner.gid||(st.mode&0o777)!==0o700||await realpath(root)!==root||expectedIdentity&&!sameIdentity(st,expectedIdentity))fail('DIRECTORY_REFUSED');
 return identity(st);
}
/** Root staging writer only: adopt an existing ECS volume directory (root:root 0755 by default on Fargate, or whatever an
 * image VOLUME seeded) using CAP_CHOWN alone. The directory must be empty after adoption or initialization refuses. */
async function adoptDirectory(plan,before){
 const owner=writerOf(plan);let handle;
 if(before.uid!==owner.uid||before.gid!==owner.gid)await lchown(root,owner.uid,owner.gid);
 try{
  handle=await open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  await handle.chmod(0o700);const st=await handle.stat();
  if(!st.isDirectory()||st.dev!==before.dev||st.ino!==before.ino||st.uid!==owner.uid||st.gid!==owner.gid||(st.mode&0o7777)!==0o700)fail('DIRECTORY_REFUSED');
 }finally{await handle?.close();}
}
async function acquireDirectory(plan){
 // /run is a protected image/volume boundary. Refuse a symlinked ancestor before creating a fresh child.
 if(await realpath(posix.dirname(root))!==posix.dirname(root))fail('DIRECTORY_REFUSED');
 let created=false;
 try{await mkdir(root,{mode:0o700});created=true;}catch(error){if(error?.code!=='EEXIST')throw error;}
 let st;try{st=await lstat(root);}catch(error){if(created)fail('CLEANUP_FAILED');throw error;}
 if(handsOver(plan)){
  if(!st.isDirectory()||st.isSymbolicLink())fail('DIRECTORY_REFUSED');
  // A directory this process just created and could not secure is reported, not silently left behind.
  try{await adoptDirectory(plan,st);}catch(error){if(created)fail('CLEANUP_FAILED');throw error;}
 }
 return {directory:identity(await lstat(root)),created,cleanupOwned:created,files:[],released:false,handedOver:false,plan,owner:writerOf(plan)};
}
/** Final step for a distinct staging writer: give every verified file, then the directory, to the reader identity.
 * Afterwards root without DAC_OVERRIDE cannot read them, so same-process rollback is no longer available. */
async function handOver(state,check){
 const {uid,gid}=state.plan;
 await checkedDirectory(state,state.directory);check();
 state.handedOver=true;
 for(const file of state.files){
  await lchown(file.path,uid,gid);const st=await lstat(file.path);
  if(!st.isFile()||st.isSymbolicLink()||st.dev!==file.dev||st.ino!==file.ino||st.uid!==uid||st.gid!==gid||(st.mode&0o7777)!==0o600||st.nlink!==1||st.size!==file.bytes)fail('HANDOVER_REFUSED');
 }
 await lchown(root,uid,gid);const st=await lstat(root);
 if(!st.isDirectory()||st.isSymbolicLink()||st.dev!==state.directory.dev||st.ino!==state.directory.ino||st.uid!==uid||st.gid!==gid||(st.mode&0o7777)!==0o700)fail('HANDOVER_REFUSED');
 check();
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
 // Handed-over files belong to the reader; the staging writer refuses rather than guessing. ECS disposes the volume.
 if(state.handedOver)fail('CLEANUP_REFUSED');
 await checkedDirectory(state,state.directory);
 const entries=await readdir(root),files=new Map(state.files.map(file=>[posix.basename(file.path),file]));
 if(entries.length!==files.size||entries.some(name=>!files.has(name)))fail('CLEANUP_REFUSED');
 // Validate the whole owned set before removing anything. A replacement or foreign entry is preserved for the task owner.
 for(const name of entries){
  const file=files.get(name),st=await lstat(file.path);
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
 // The process must be the role's writer: the reader itself, or root (CAP_CHOWN only) for model-proxy.
 const {writerUid,writerGid}=productMaterialIdentity(e.role,e.runtimeUser);
 if(process.platform!=='linux'||typeof process.getuid!=='function'||process.getuid()!==writerUid||process.getgid()!==writerGid)fail('PLATFORM_REFUSED');
 const life=createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>Object.assign(Error('STATIC_INIT_INTERRUPTED'),{code:'STATIC_INIT_INTERRUPTED'})});
 let p,state;
 try{
  const {sha256ByPath:_pins,...request}=e;void _pins;
  p=prepared(e,await life.run(signal=>delivery.fetch({...request,signal})));life.check();
  state=await acquireDirectory(p.plan);
  await checkedDirectory(state,state.directory);
  if((await readdir(root)).length!==0)fail('DIRECTORY_NOT_EMPTY');
  state.cleanupOwned=true;life.check();
  for(const [path,bytes] of p.files)await writeFile(state,path,bytes,life.check);
  await verifyProductMaterial(p.plan,{expectedSha256ByPath:e.sha256ByPath});life.check();
  if(handsOver(p.plan))await handOver(state,life.check);
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

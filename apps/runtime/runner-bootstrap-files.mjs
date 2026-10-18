/** Per-run bootstrap file materializer (S3). A trusted delivery port hands the runner its initial capability, configuration and
 * private TLS CA as bytes bound to one exact original run; this module validates the binding, correlates every field with the
 * frozen expected contract (task, revision, expiry, versions, origin, server names, issued-capability digest, protected material
 * reference, bootstrap contract hash and CA digest), composes the complete runner configuration and validates it for the
 * conversation-runner role before writing, writes fresh owner-only files into a directory it alone created, records the owned
 * filesystem identity (device, inode, owner) of the directory and every file, and later removes only that exact instance. A
 * cleanup failure is reported, never swallowed. No credential is read from the environment, no RunTask override, no shared path,
 * no job on import. The capsule format and the DNS/certificate system remain shipping-owned. */
import {open,mkdir,lstat,readdir,unlink,rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {validateConfiguration} from './config.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
const fail=(code,extra)=>{throw Object.assign(Error('RUNNER_BOOTSTRAP_'+code),{code:'RUNNER_BOOTSTRAP_'+code,...extra});};
const files=Object.freeze({capability:{name:'task-capability',maxBytes:8192},config:{name:'runner-config.json',maxBytes:32768},ca:{name:'control-ca.pem',maxBytes:16384}});
const arn=/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u,hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),dnsName=v=>typeof v==='string'&&/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/u.test(v);
const identity=st=>Object.freeze({dev:st.dev,ino:st.ino,uid:st.uid});
const sameIdentity=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid;
/** The frozen expected binding: the exact original run, task, revision, expiry, versions, origin and server names, the issued
 * capability digest and protected material reference, the bootstrap contract hash and the CA digest the owner compiled; never a
 * browser or runtime claim. */
export function parseExpectedBootstrap(value){
 const e=data(own(value,['binding','taskArn','taskRevision','expiresAtMs','versions','origin','san','caSha256','capabilitySha256','materialRef','bootstrapRef']));
 let u;try{u=new URL(e.origin);}catch{fail('EXPECTED_REFUSED');}
 if(!arn.test(e.taskArn)||!Number.isSafeInteger(e.taskRevision)||e.taskRevision<1||!Number.isSafeInteger(e.expiresAtMs)||u.protocol!=='https:'||u.origin!==e.origin||u.pathname!=='/'||!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/u.test(e.origin)||!hex64(e.caSha256)||!hex64(e.capabilitySha256)||!hex64(e.bootstrapRef)||typeof e.materialRef!=='string'||e.materialRef.length<1||e.materialRef.length>1024)fail('EXPECTED_REFUSED');
 if(!Array.isArray(e.san)||!e.san.length||e.san.length>16||!e.san.every(dnsName)||new Set(e.san).size!==e.san.length||!e.san.includes(u.hostname))fail('EXPECTED_REFUSED');
 return e;
}
async function freshDirectory(directory){if(!isAbsolute(directory)||directory.includes('/../')||directory.length>4096)fail('DIRECTORY_REFUSED');try{await lstat(directory);fail('DIRECTORY_EXISTS');}catch(error){if(error?.code!=='ENOENT')throw error;}await mkdir(directory,{mode:0o700});const st=await lstat(directory);if(!st.isDirectory()||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('DIRECTORY_REFUSED');return identity(st);}
async function writeFresh(path,bytes,maxBytes){if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxBytes)fail('FILE_REFUSED');let handle;try{handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await handle.writeFile(bytes);await handle.sync();const st=await handle.stat();if(!st.isFile()||st.size!==bytes.length||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('FILE_REFUSED');return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...identity(st)};}finally{await handle?.close();}}
/** The complete runner configuration for role conversation-runner, composed from the expected contract and the delivered bounds and
 * validated by the same validator the runner applies at load; nothing optional is left for the runner to assume. */
function runnerConfiguration(e,directory,delivered){
 let configuration;
 try{const c=own(delivered,['limits','native','workspace','proxyOrigin'],['sourceEnabled']),n=own(c.native,['maxResponseBytes']);if(c.sourceEnabled!==undefined&&c.sourceEnabled!==true)fail('CONFIG_REFUSED');
  configuration={version:1,profile:'isolated-preview',sourceEnabled:c.sourceEnabled===true,limits:c.limits,native:{origin:e.origin,capabilityFile:join(directory,files.capability.name),loopback:false,maxResponseBytes:n.maxResponseBytes},binding:e.binding,versions:e.versions,workspace:c.workspace,proxyOrigin:c.proxyOrigin,bootstrap:{expiresAtMs:e.expiresAtMs,remote:true},captureOwnsClose:true};
  validateConfiguration(configuration,'conversation-runner');}
 catch(error){fail('CONFIG_REFUSED',{cause:error?.code??error?.message});}
 return configuration;
}
/** Validates the delivery against the expected contract, composes and validates the runner configuration, then writes the three files.
 * Any failure removes what was written; a failed removal is reported as RUNNER_BOOTSTRAP_CLEANUP_FAILED carrying both causes. */
export async function materializeRunnerBootstrap({directory,delivery,expected,now=Date.now,signal,maxRequestMs=5000}){
 nativeSignal(signal);const e=parseExpectedBootstrap(expected);if(typeof delivery?.fetch!=='function')fail('DELIVERY_REFUSED');if(e.expiresAtMs<=now())fail('EXPIRED');
 const life=createOperationLifetime({now,signal,deadlineMs:Math.min(e.expiresAtMs,now()+maxRequestMs),errorFactory:()=>Object.assign(Error('RUNNER_BOOTSTRAP_UNKNOWN'),{code:'RUNNER_BOOTSTRAP_UNKNOWN'})});
 let created=null;const written=[];let receipt=null;
 try{
  const d=data(own(await life.run(signal=>delivery.fetch({binding:e.binding,taskArn:e.taskArn,taskRevision:e.taskRevision,bootstrapRef:e.bootstrapRef,signal})),['binding','taskArn','taskRevision','expiresAtMs','versions','origin','san','capabilitySha256','materialRef','bootstrapRef','capability','config','ca']));life.check();
  if(hash(d.binding)!==hash(e.binding)||d.taskArn!==e.taskArn||d.taskRevision!==e.taskRevision||d.expiresAtMs!==e.expiresAtMs||hash(d.versions)!==hash(e.versions)||d.origin!==e.origin||hash(d.san)!==hash(e.san)||d.capabilitySha256!==e.capabilitySha256||d.materialRef!==e.materialRef||d.bootstrapRef!==e.bootstrapRef)fail('CORRELATION_REFUSED');
  if(typeof d.capability!=='string'||!/^\S{1,8192}$/u.test(d.capability)||capabilityDigest(d.capability)!==e.capabilitySha256)fail('CAPABILITY_REFUSED');
  const ca=Buffer.from(d.ca,'base64');if(createHash('sha256').update(ca).digest('hex')!==e.caSha256)fail('CA_REFUSED');
  const configuration=runnerConfiguration(e,directory,d.config),capability=Buffer.from(d.capability,'utf8'),config=Buffer.from(JSON.stringify(configuration),'utf8');
  created=await freshDirectory(directory);life.check();
  for(const [key,bytes] of [['capability',capability],['config',config],['ca',ca]]){written.push(await writeFresh(join(directory,files[key].name),bytes,files[key].maxBytes));life.check();}
  receipt=Object.freeze({taskArn:e.taskArn,taskRevision:e.taskRevision,expiresAtMs:e.expiresAtMs,bootstrapRef:e.bootstrapRef,capabilitySha256:e.capabilitySha256,materialRef:e.materialRef,san:Object.freeze([...e.san]),directory:Object.freeze({path:directory,...created}),files:Object.freeze(written.map(w=>Object.freeze({path:w.path,bytes:w.bytes,sha256:w.sha256,dev:w.dev,ino:w.ino,uid:w.uid})))});
  return Object.freeze({directory,capabilityFile:written[0].path,configFile:written[1].path,caFile:written[2].path,configuration,receipt});
 }catch(error){
  const code=typeof error?.code==='string'&&error.code.startsWith('RUNNER_BOOTSTRAP_')?error.code:'RUNNER_BOOTSTRAP_UNKNOWN';
  if(created){const partial={directory:{path:directory,...created},files:written.map(w=>({path:w.path,dev:w.dev,ino:w.ino,uid:w.uid}))};try{await releaseRunnerBootstrap({directory,receipt:partial});}catch(cleanup){throw Object.assign(Error('RUNNER_BOOTSTRAP_CLEANUP_FAILED'),{code:'RUNNER_BOOTSTRAP_CLEANUP_FAILED',failure:code,cleanup:cleanup?.code??cleanup?.message});}}
  throw Object.assign(Error(code),{code});
 }
 finally{life.close();}
}
/** Removes exactly the owned instance the receipt names: the directory itself (no link, same device, inode and owner, still private)
 * and the recorded files (regular, same inode and owner); any other entry, link, replacement or identity change refuses before anything
 * is removed. A directory that no longer exists is already released. */
export async function releaseRunnerBootstrap({directory,receipt}){
 if(!isAbsolute(directory))fail('DIRECTORY_REFUSED');const r=own(receipt,['directory','files'],['taskArn','taskRevision','expiresAtMs','bootstrapRef','capabilitySha256','materialRef','san']);const expectedDirectory=own(r.directory,['path','dev','ino','uid']);if(expectedDirectory.path!==directory)fail('DIRECTORY_REFUSED');
 let st;try{st=await lstat(directory);}catch(error){if(error?.code==='ENOENT')return {removed:0};throw error;}
 if(!st.isDirectory()||st.isSymbolicLink()||!sameIdentity(identity(st),expectedDirectory)||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('DIRECTORY_REPLACED');
 const owned=new Map(r.files.map(f=>{const v=own(f,['path','dev','ino','uid'],['bytes','sha256']);if(!Object.values(files).some(x=>join(directory,x.name)===v.path))fail('FOREIGN_ENTRY');return [v.path,v];}));
 const entries=await readdir(directory),paths=[];
 for(const name of entries){const path=join(directory,name),expected=owned.get(path);const fs=await lstat(path);if(!expected||!fs.isFile()||fs.isSymbolicLink()||fs.uid!==process.getuid()||!sameIdentity(identity(fs),expected))fail(expected?'FILE_REPLACED':'FOREIGN_ENTRY');
  // A replacement that reused the inode is caught by content: the recorded size and digest must still match (the partial-cleanup receipt records none).
  if(expected.sha256!==undefined){let handle;try{handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const st=await handle.stat();if(!st.isFile()||st.size!==expected.bytes)fail('FILE_REPLACED');const bytes=await handle.readFile();if(bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)fail('FILE_REPLACED');}finally{await handle?.close();}}
  paths.push(path);}
 for(const path of paths)await unlink(path);await rmdir(directory);return {removed:paths.length};
}

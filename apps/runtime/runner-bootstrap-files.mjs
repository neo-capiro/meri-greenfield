/** Per-run bootstrap file materializer (S3). A trusted delivery port hands the runner its initial capability, configuration and
 * private TLS CA as bytes bound to one exact original run; this module validates the binding, writes fresh owner-only files into
 * a directory it alone created, correlates every field with the expected original task, and later removes only what it wrote.
 * No credential is read from the environment, no RunTask override, no shared path, no job on import. The capsule format and the
 * DNS/certificate system remain shipping-owned; this module consumes plain bytes from the frozen port. */
import {open,mkdir,lstat,readdir,rm,unlink,rmdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(Error('RUNNER_BOOTSTRAP_'+code),{code:'RUNNER_BOOTSTRAP_'+code});};
const files=Object.freeze({capability:{name:'task-capability',maxBytes:8192},config:{name:'runner-config.json',maxBytes:32768},ca:{name:'control-ca.pem',maxBytes:16384}});
const arn=/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u;
/** The frozen expected binding: the exact original run, task and revision the owner compiled, never a browser or runtime claim. */
export function parseExpectedBootstrap(value){
 const e=data(own(value,['binding','taskArn','taskRevision','expiresAtMs','versions','origin','caSha256']));
 if(!arn.test(e.taskArn)||!Number.isSafeInteger(e.taskRevision)||e.taskRevision<1||!Number.isSafeInteger(e.expiresAtMs)||typeof e.origin!=='string'||!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/u.test(e.origin)||typeof e.caSha256!=='string'||!/^[a-f0-9]{64}$/u.test(e.caSha256))fail('EXPECTED_REFUSED');
 return e;
}
async function freshDirectory(directory){if(!isAbsolute(directory)||directory.includes('/../')||directory.length>4096)fail('DIRECTORY_REFUSED');try{await lstat(directory);fail('DIRECTORY_EXISTS');}catch(error){if(error?.code!=='ENOENT')throw error;}await mkdir(directory,{mode:0o700});const st=await lstat(directory);if(!st.isDirectory()||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('DIRECTORY_REFUSED');}
async function writeFresh(path,bytes,maxBytes){if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxBytes)fail('FILE_REFUSED');let handle;try{handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await handle.writeFile(bytes);await handle.sync();const st=await handle.stat();if(!st.isFile()||st.size!==bytes.length||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('FILE_REFUSED');}finally{await handle?.close();}return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
/** Validates the delivery against the expected binding, then writes the three files. Any failure removes what was written. */
export async function materializeRunnerBootstrap({directory,delivery,expected,now=Date.now,signal,maxRequestMs=5000}){
 nativeSignal(signal);const e=parseExpectedBootstrap(expected);if(typeof delivery?.fetch!=='function')fail('DELIVERY_REFUSED');if(e.expiresAtMs<=now())fail('EXPIRED');
 const life=createOperationLifetime({now,signal,deadlineMs:Math.min(e.expiresAtMs,now()+maxRequestMs),errorFactory:()=>Object.assign(Error('RUNNER_BOOTSTRAP_UNKNOWN'),{code:'RUNNER_BOOTSTRAP_UNKNOWN'})});
 let created=false;const written=[];
 try{
  const d=data(own(await life.run(signal=>delivery.fetch({binding:e.binding,taskArn:e.taskArn,taskRevision:e.taskRevision,signal})),['binding','taskArn','taskRevision','expiresAtMs','versions','origin','capability','config','ca']));life.check();
  if(hash(d.binding)!==hash(e.binding)||d.taskArn!==e.taskArn||d.taskRevision!==e.taskRevision||d.expiresAtMs!==e.expiresAtMs||hash(d.versions)!==hash(e.versions)||d.origin!==e.origin)fail('CORRELATION_REFUSED');
  const ca=Buffer.from(d.ca,'base64'),capability=Buffer.from(d.capability,'utf8'),config=Buffer.from(JSON.stringify(d.config),'utf8');
  if(createHash('sha256').update(ca).digest('hex')!==e.caSha256)fail('CA_REFUSED');if(!/^\S{1,8192}$/u.test(d.capability))fail('CAPABILITY_REFUSED');
  const parsed=own(d.config,['binding','versions','bootstrap','proxyOrigin','workspace'],['captureOwnsClose']);if(hash(parsed.binding)!==hash(e.binding)||parsed.bootstrap?.expiresAtMs!==e.expiresAtMs)fail('CONFIG_REFUSED');
  await freshDirectory(directory);created=true;life.check();
  for(const [key,bytes] of [['capability',capability],['config',config],['ca',ca]]){written.push(await writeFresh(join(directory,files[key].name),bytes,files[key].maxBytes));life.check();}
  return Object.freeze({directory,capabilityFile:written[0].path,configFile:written[1].path,caFile:written[2].path,receipt:Object.freeze({taskArn:e.taskArn,taskRevision:e.taskRevision,expiresAtMs:e.expiresAtMs,files:Object.freeze(written.map(w=>({path:w.path,bytes:w.bytes,sha256:w.sha256})))})});
 }catch(error){if(created)await releaseRunnerBootstrap({directory}).catch(()=>{});if(typeof error?.code==='string'&&error.code.startsWith('RUNNER_BOOTSTRAP_'))throw error;fail('UNKNOWN');}
 finally{life.close();}
}
/** Removes only the three owned files and the owned directory; refuses links or foreign entries instead of deleting them. */
export async function releaseRunnerBootstrap({directory}){
 if(!isAbsolute(directory))fail('DIRECTORY_REFUSED');let entries;try{entries=await readdir(directory);}catch(error){if(error?.code==='ENOENT')return {removed:0};throw error;}
 const owned=new Set(Object.values(files).map(f=>f.name)),paths=[];
 // Validate every entry before removing any: a foreign entry or a link anywhere leaves the directory untouched.
 for(const name of entries){const path=join(directory,name),st=await lstat(path);if(!owned.has(name)||!st.isFile()||st.uid!==process.getuid())fail('FOREIGN_ENTRY');paths.push(path);}
 for(const path of paths)await unlink(path);await rmdir(directory);return {removed:paths.length};
}

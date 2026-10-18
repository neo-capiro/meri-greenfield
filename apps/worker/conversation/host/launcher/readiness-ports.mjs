// @ts-check
/** Adapter for the canonical no-model SDK Bash readiness check. Both bubblewrap namespace probes and the SDK CLI
 * startup use the same D005 native preexec SDK cgroup/network path. It never calls the base host's runProbe or
 * direct SDK child launch. The caller's makeLauncher must construct sdkMode:'readiness' with the shared launch gate,
 * exact host pins, and an onSdkPrepared observer armed before GO. */
import {createHostPorts} from '../../sandbox-readiness/host-probes.mjs';
import {chmodSync,chownSync,lstatSync,realpathSync} from 'node:fs';
import {dirname} from 'node:path';

const fail=()=>{throw Object.assign(new Error('HOST_READINESS_PORT_REFUSED'),{code:'HOST_READINESS_PORT_REFUSED'});};
const TEMP=/^\/tmp\/meri-sandbox-readiness-[A-Za-z0-9]{6}\/(workspace|config)-[A-Za-z0-9]{6}$/u;
const uid=value=>Number.isSafeInteger(value)&&value>=1000&&value<=65533;
/** The trusted host creates these directories as root. Make only this run's root traversable by the SDK group,
 * and each child privately owned by the SDK UID; never make them world-readable or writable. */
export function prepareSdkReadinessDirectory(path,sdkUid,sdkGid,
 fs={realpath:realpathSync,stat:lstatSync,chown:chownSync,chmod:chmodSync}){
 if(typeof path!=='string'||!TEMP.test(path)||!uid(sdkUid)||!uid(sdkGid)||fs.realpath(path)!==path)fail();
 const root=dirname(path),parent=fs.stat(root),child=fs.stat(path);
 if(!parent.isDirectory()||!child.isDirectory()||
  (parent.uid!==0||![0,sdkGid].includes(parent.gid)||![0o700,0o710].includes(parent.mode&0o777))||
  (child.uid!==0||child.gid!==0||(child.mode&0o777)!==0o700))fail();
 fs.chown(root,0,sdkGid);fs.chmod(root,0o710);
 fs.chown(path,sdkUid,sdkGid);fs.chmod(path,0o700);
 const p=fs.stat(root),c=fs.stat(path);
 if(p.uid!==0||p.gid!==sdkGid||(p.mode&0o777)!==0o710||
  c.uid!==sdkUid||c.gid!==sdkGid||(c.mode&0o777)!==0o700)fail();
 return path;
}
export async function createConfinedReadinessPorts({pathEnv,sdkUid,sdkGid,makeLauncher,
 createBasePorts=createHostPorts,prepareDirectory=prepareSdkReadinessDirectory}={}){
 if(typeof pathEnv!=='string'||!uid(sdkUid)||!uid(sdkGid)||typeof makeLauncher!=='function'||
  typeof createBasePorts!=='function'||typeof prepareDirectory!=='function')fail();
 const base=await createBasePorts({pathEnv});let launcher,client,bwrap,closed=false,closing,queryMade=false;
 try{
  if(typeof base?.findExecutable!=='function'||typeof base?.query!=='function'||typeof base?.close!=='function'||
   typeof base?.exists!=='function'||typeof base?.makeTempDir!=='function'||typeof base?.removeDir!=='function'||
   typeof base?.sdkVersion!=='string'||typeof base?.nodePath!=='string')fail();
  bwrap=base.findExecutable('bwrap');const socat=base.findExecutable('socat');
  if(typeof bwrap!=='string'||typeof socat!=='string')fail();
  launcher=await makeLauncher({probeCommand:bwrap,probeNodePath:base.nodePath});
  if(typeof launcher?.runReadinessProbe!=='function'||typeof launcher?.createSdkProcessClient!=='function'||typeof launcher?.close!=='function')fail();
 }catch(error){try{await launcher?.close?.();}catch{}try{await base?.close?.();}catch{}throw error;}
 const close=()=>closing??=(async()=>{closed=true;const errors=[];
  try{await client?.close?.();}catch(error){errors.push(error);}
  try{await launcher.close();}catch(error){errors.push(error);}
  try{await base.close();}catch(error){errors.push(error);}
  if(errors.length)fail();})();
 return Object.freeze({findExecutable:base.findExecutable,exists:base.exists,
  makeTempDir(label){if(closed||!['workspace','config'].includes(label))fail();
   const path=base.makeTempDir(label);
   try{if(prepareDirectory(path,sdkUid,sdkGid)!==path)fail();return path;}
   catch(error){try{base.removeDir(path);}catch{}throw error;}},
  removeDir:base.removeDir,sdkVersion:base.sdkVersion,nodePath:base.nodePath,pathEnv,
  async runProbe(command,args){if(closed||command!==bwrap)fail();return launcher.runReadinessProbe(command,args);},
  query({prompt,options}){
   if(closed||queryMade||!options||typeof options!=='object'||Object.hasOwn(options,'spawnClaudeCodeProcess'))fail();
   queryMade=true;client=launcher.createSdkProcessClient();let started;
   const sdk=base.query({prompt,options:{...options,spawnClaudeCodeProcess(descriptor){
    const process=client.spawnClaudeCodeProcess(descriptor);
    started=Promise.resolve().then(()=>client.startPreparedProcess());started.catch(()=>{});
    return process;}}});
   if(typeof sdk?.initializationResult!=='function'||typeof sdk?.close!=='function'||typeof sdk?.[Symbol.asyncIterator]!=='function')fail();
   return Object.freeze({
    async initializationResult(){const result=await sdk.initializationResult();
     if(!started)fail();
     await started;return result;},
    [Symbol.asyncIterator](){return sdk[Symbol.asyncIterator]();},
    close(){try{sdk.close();}finally{void client.close().catch(()=>{});}},
   });
  },close});
}

/** Canonical static control/poller material inventory and Linux preflight.
 * Runner material belongs to runner-bootstrap-files.mjs. No IO occurs on import. */
import {open,lstat,realpath,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {validateConfiguration} from './config.mjs';

const root='/run/meri', mode=0o600, maxBytes=32768;
const names=Object.freeze({control:'control.json','temporal-worker':'worker.json'});
export const productMaterialPolicy=Object.freeze({directory:root,maxBytes,configurationNames:names});
const plans=new WeakSet();
const hex64=/^[a-f0-9]{64}$/u;
const refuse=()=>{throw Object.assign(Error('PRODUCT_MATERIAL_REFUSED'),{code:'PRODUCT_MATERIAL_REFUSED'});};
const own=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function parseProductRuntimeUser(value){
 if(typeof value!=='string'||!/^([1-9][0-9]{0,9}):([1-9][0-9]{0,9})$/u.test(value))refuse();
 const [uid,gid]=value.split(':').map(Number);
 if(!Number.isSafeInteger(uid)||!Number.isSafeInteger(gid)||uid>2147483647||gid>2147483647)refuse();
 return {uid,gid};
}
function direct(path){
 if(typeof path!=='string'||posix.dirname(path)!==root||posix.basename(path)==='.'||posix.basename(path)==='..'||path.includes('\\')||path.includes('//'))refuse();
 return path;
}

/** Return only paths and file requirements. The caller must separately authenticate the configuration and exact byte hashes. */
export function compileProductMaterialPlan({role,configuration,runtimeUser}){
 if(!Object.hasOwn(names,role)||!own(configuration))refuse();
 const {uid,gid}=parseProductRuntimeUser(runtimeUser);
 let c;try{c=validateConfiguration(configuration,role);}catch{refuse();}
 if(c.http.hostname!=='0.0.0.0'||c.http.port!==(role==='control'?8080:8081))refuse();
 // Static product control must never fall back to the legacy shared listener:
 // the public ALB target reaches 8080 while native capabilities reach 8082.
 if(role==='control'&&(c.privateHttp===undefined||c.taskRouter?.enabled!==true))refuse();
 const configurationPath=`${root}/${names[role]}`,files=new Map([[configurationPath,new Set(['configuration'])]]);
 function add(path,purpose){
  direct(path);if(path===configurationPath)refuse();
  const purposes=files.get(path)??new Set();purposes.add(purpose);files.set(path,purposes);
 }
 add(c.native.capabilityFile,'native-capability');
 add(c.temporal.tls.caFile,'temporal-ca');add(c.temporal.tls.certFile,'temporal-cert');add(c.temporal.tls.keyFile,'temporal-key');
 if(c.temporal.authorization)add(c.temporal.authorization.tokenFile,'temporal-authorization-token');
 if(role==='control'){
  add(c.database.connectionFile,'database-connection');
  if(c.downloadLinks?.enabled)add(c.downloadLinks.keyFile,'download-signing-key');
  if(c.nativeCandidate){
   add(c.nativeCandidate.identity.credentialFile,'identity-capability');
   add(c.nativeCandidate.taskCapabilityFile,'task-capability');
   add(c.nativeCandidate.controlCapabilityFile,'control-capability');
   add(c.nativeCandidate.proxyCredentialFile,'proxy-capability');
  }
  if(c.taskRouter?.enabled)add(c.taskRouter.runnerCaFile,'runner-ca');
 }
 const dynamicMaterialDirectory=c.nativeCandidate?.multiRun?.materialDirectory??null;
 if(dynamicMaterialDirectory!==null){const path=posix.normalize(dynamicMaterialDirectory);if(!posix.isAbsolute(path)||path===root||path.startsWith(root+'/'))refuse();}
 for(const [path,purposes] of files){
  if(purposes.size>1&&!(purposes.size===2&&purposes.has('native-capability')&&purposes.has('control-capability')))refuse();
  if(path!==configurationPath)direct(path);
 }
 const requiredFiles=Object.freeze([...files].sort(([a],[b])=>a.localeCompare(b)).map(([path,purposes])=>Object.freeze({path,purposes:Object.freeze([...purposes].sort()),mode:'0600',maxBytes})));
 const plan=Object.freeze({schemaVersion:1,role,containerName:role,configurationPath,materialDirectory:root,runtimeUser,uid,gid,
  directoryMode:'0700',requiredFiles,requiresTokenRotation:!!c.temporal.authorization,
  dynamicMaterialDirectory});
 plans.add(plan);return plan;
}

/** Read-only task-local preflight. Pins are exact SHA-256s from an independently authenticated shipping owner, never emitted. */
export async function verifyProductMaterial(plan,{expectedSha256ByPath}={}){
 if(!plans.has(plan)||process.platform!=='linux'||typeof process.getuid!=='function'||process.getuid()!==plan.uid||process.getgid()!==plan.gid||!own(expectedSha256ByPath))refuse();
 const paths=plan.requiredFiles.map(file=>file.path),keys=Object.keys(expectedSha256ByPath);
 if(keys.length!==paths.length||keys.some(key=>!paths.includes(key)||!hex64.test(expectedSha256ByPath[key])))refuse();
 let directory;try{directory=await lstat(root);if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==plan.uid||directory.gid!==plan.gid||(directory.mode&0o777)!==0o700||await realpath(root)!==root)refuse();
  const entries=await readdir(root);if(entries.length!==paths.length||entries.some(name=>!paths.includes(`${root}/${name}`)))refuse();}catch{refuse();}
 let parsed;
 for(const {path} of plan.requiredFiles){
  let handle,bytes;try{
   // A foreign FIFO at an expected path must not block the preflight before fstat can reject it.
   handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=await handle.stat();
   if(!st.isFile()||st.uid!==plan.uid||st.gid!==plan.gid||(st.mode&0o777)!==mode||st.size<1||st.size>maxBytes)refuse();
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
 return Object.freeze({ready:true,role:plan.role,configurationPath:plan.configurationPath,fileCount:paths.length});
}

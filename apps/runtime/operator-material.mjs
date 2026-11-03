/** One-shot fixed operator volume. Ordinary /run/meri inventory remains closed. */
import {open,lstat,realpath,readdir,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {operatorCallbackConfiguration} from './operator-callback-configuration.mjs';
import {operatorControlConfiguration} from './operator-control-configuration.mjs';
export const OPERATOR_DIRECTORY='/run/meri-operator';
export const OPERATOR_PATHS=Object.freeze({control:`${OPERATOR_DIRECTORY}/control.json`,'temporal-worker':`${OPERATOR_DIRECTORY}/callback.json`,agentcore:`${OPERATOR_DIRECTORY}/callback.json`});
export const operatorMaterialEnvironment=Object.freeze({expected:'MERI_OPERATOR_MATERIAL_EXPECTED',bundle:'MERI_OPERATOR_MATERIAL_BUNDLE'});
const sha=b=>createHash('sha256').update(b).digest('hex'),fail=()=>{throw Error('OPERATOR_MATERIAL_REFUSED');};
const same=(a,b)=>['dev','ino','uid','gid'].every(k=>a[k]===b[k]);
export function operatorMaterialExpected(raw){
 const e=data(own(raw,['role','sourceCommit','imageDigest','sha256ByPath']));
 if(!Object.hasOwn(OPERATOR_PATHS,e.role)||!/^[a-f0-9]{40}$/u.test(e.sourceCommit)||!/^sha256:[a-f0-9]{64}$/u.test(e.imageDigest))fail();
 own(e.sha256ByPath,[OPERATOR_PATHS[e.role]]);
 if(!/^[a-f0-9]{64}$/u.test(e.sha256ByPath[OPERATOR_PATHS[e.role]]))fail();
 return e;
}
export function composeOperatorMaterial({role,sourceCommit,imageDigest,descriptor}){
 const path=OPERATOR_PATHS[role],bytes=Buffer.from(JSON.stringify(descriptor));
 const expected=operatorMaterialExpected({role,sourceCommit,imageDigest,sha256ByPath:{[path]:sha(bytes)}});
 const bundle={files:[{path,base64:bytes.toString('base64')}]};validateOperatorMaterial({expected,bundle});return {expected,bundle};
}
export function validateOperatorMaterial({expected,bundle}){
 const e=operatorMaterialExpected(expected),b=own(bundle,['files']);
 if(!Array.isArray(b.files)||b.files.length!==1)fail();
 const f=own(b.files[0],['path','base64']);
 if(f.path!==OPERATOR_PATHS[e.role]||typeof f.base64!=='string'||f.base64.length>43692)fail();
 const bytes=Buffer.from(f.base64,'base64');
 if(bytes.length<1||bytes.length>32768||bytes.toString('base64')!==f.base64||sha(bytes)!==e.sha256ByPath[f.path])fail();
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(e.role==='control'){
  if(operatorControlConfiguration(value).sourceCommit!==e.sourceCommit)fail();
 }else operatorCallbackConfiguration(value);
 return {expected:e,path:f.path,bytes};
}
/** Init alone has a writable mount; the app gets the same volume read-only.
 * A preexisting file refuses. This does not restore a previous process's capability. */
export async function materializeOperatorMaterial(delivery){
 const p=validateOperatorMaterial(delivery);let file,handle,directory;
 try{
  if(process.platform!=='linux'||process.getuid()!==1000||process.getgid()!==1000)fail();
  directory=await lstat(OPERATOR_DIRECTORY);
  const check=async()=>{const s=await lstat(OPERATOR_DIRECTORY);if(!s.isDirectory()||s.isSymbolicLink()||!same(s,directory)||s.uid!==1000||s.gid!==1000||(s.mode&0o7777)!==0o700||await realpath(OPERATOR_DIRECTORY)!==OPERATOR_DIRECTORY)fail();};
  await check();if((await readdir(OPERATOR_DIRECTORY)).length)fail();
  handle=await open(p.path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  file=await handle.stat();if(!file.isFile()||file.uid!==1000||file.gid!==1000||file.nlink!==1||(file.mode&0o7777)!==0o600)fail();
  await check();await handle.writeFile(p.bytes);await handle.sync();
  const end=await handle.stat();if(!same(end,file)||end.size!==p.bytes.length||end.nlink!==1||(end.mode&0o7777)!==0o600)fail();
  await handle.close();handle=undefined;await check();
  const actual=await lstat(p.path);if(!actual.isFile()||!same(actual,file)||actual.size!==p.bytes.length||actual.nlink!==1||(actual.mode&0o7777)!==0o600||(await readdir(OPERATOR_DIRECTORY)).join(',')!==p.path.split('/').at(-1))fail();
  return {ready:true,role:p.expected.role,fileCount:1};
 }catch(error){
  await handle?.close();handle=undefined;
  if(file){const parent=await lstat(OPERATOR_DIRECTORY).catch(()=>null),actual=await lstat(p.path).catch(()=>null);if(!parent||!same(parent,directory)||!actual||!actual.isFile()||!same(actual,file)||actual.nlink!==1)throw Error('OPERATOR_MATERIAL_CLEANUP_UNKNOWN');await unlink(p.path);}
  throw error;
 }finally{p.bytes.fill(0);await handle?.close();}
}
export async function runOperatorMaterialInit(environment=process.env){
 let expected,bundle;
 try{
  const e=environment[operatorMaterialEnvironment.expected],b=environment[operatorMaterialEnvironment.bundle];
  delete environment[operatorMaterialEnvironment.bundle];
  if(typeof e!=='string'||Buffer.byteLength(e)>2048||typeof b!=='string'||Buffer.byteLength(b)>65536)fail();
  expected=JSON.parse(e);bundle=JSON.parse(b);return await materializeOperatorMaterial({expected,bundle});
 }finally{expected=undefined;bundle=undefined;}
}
/** Public callback descriptor only. Fixed bounded pieces fit CloudFormation's
 * per-value environment limit; no credential or activation selector is carried. */
export function operatorAgentCoreEnvironment(delivery){
 const p=validateOperatorMaterial(delivery);if(p.expected.role!=='agentcore')fail();
 const text=JSON.stringify(delivery.bundle),parts=text.match(/[\s\S]{1,1900}/gu);
 if(!parts||parts.length>24)fail();
 return {[operatorMaterialEnvironment.expected]:JSON.stringify(p.expected),MERI_OPERATOR_MATERIAL_PARTS:String(parts.length),
  ...Object.fromEntries(parts.map((v,i)=>[`MERI_OPERATOR_MATERIAL_PART_${i}`,v]))};
}
export async function runOperatorAgentCoreMaterial(environment=process.env){
 const count=Number(environment.MERI_OPERATOR_MATERIAL_PARTS),parts=[];
 if(!Number.isSafeInteger(count)||count<1||count>24||String(count)!==environment.MERI_OPERATOR_MATERIAL_PARTS)fail();
 if(Object.keys(environment).filter(k=>k.startsWith('MERI_OPERATOR_MATERIAL_PART_')).length!==count)fail();
 for(let i=0;i<count;i++){const key=`MERI_OPERATOR_MATERIAL_PART_${i}`,value=environment[key];delete environment[key];if(typeof value!=='string'||value.length<1||value.length>1900)fail();parts.push(value);}
 delete environment.MERI_OPERATOR_MATERIAL_PARTS;
 return runOperatorMaterialInit({[operatorMaterialEnvironment.expected]:environment[operatorMaterialEnvironment.expected],[operatorMaterialEnvironment.bundle]:parts.join('')});
}

/** The serving source commit, from the material envelope to control's liveness document. The init container already proves the
 * envelope's `sourceCommit`/`imageDigest` pins (material-init.mjs) and owns the task-local directory that hands control its
 * composite CA bundle (control-ca-bundle.mjs); it writes this receipt there, beside the bundle, with the pins only and no material.
 * Control reads it once at startup and names the commit on `/health/live`, so a frontend binds its observations to the serving
 * source without a per-cut deployment input. The receipt is informational: absent, unreadable or malformed reads as "none", never
 * as a startup refusal. No IO occurs on import. */
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {CONTROL_NODE_CA_DIRECTORY} from './control-ca-bundle.mjs';

export const MATERIAL_RECEIPT_SCHEMA='meri.material-receipt/1';
export const MATERIAL_RECEIPT_FILE=CONTROL_NODE_CA_DIRECTORY+'/material-receipt.json';
const roles=Object.freeze(['control','schedule-worker']),commit=/^[a-f0-9]{40}$/u,digest=/^sha256:[a-f0-9]{64}$/u,maxBytes=1024;
const fail=()=>{throw Object.assign(Error('STATIC_INIT_RECEIPT_REFUSED'),{code:'STATIC_INIT_RECEIPT_REFUSED'});};

/** Pure: the exact document init writes from the parsed expected envelope. */
export function materialReceiptDocument(expected){
 if(typeof expected!=='object'||expected===null||!roles.includes(expected.role)||!commit.test(expected.sourceCommit??'')||!digest.test(expected.imageDigest??''))fail();
 return Object.freeze({schema:MATERIAL_RECEIPT_SCHEMA,role:expected.role,sourceCommit:expected.sourceCommit,imageDigest:expected.imageDigest});
}
/** Pure: the exact document or null; a foreign key, schema or pin shape is not a receipt. */
export function parseMaterialReceipt(text){
 try{
  const value=JSON.parse(text);
  if(typeof value!=='object'||value===null||Array.isArray(value)||Object.keys(value).sort().join(',')!=='imageDigest,role,schema,sourceCommit'||value.schema!==MATERIAL_RECEIPT_SCHEMA)return null;
  return materialReceiptDocument(value);
 }catch{return null;}
}

const owner=()=>{if(process.platform!=='linux'||process.getuid?.()!==1000||process.getgid?.()!==1000)fail();return {uid:1000,gid:1000};};

/** Called by init after the composite CA bundle exists, so the directory is already the init owner's. */
export async function materializeMaterialReceipt({expected}){
 const identity=owner(),bytes=Buffer.from(JSON.stringify(materialReceiptDocument(expected)),'utf8');
 const st=await lstat(CONTROL_NODE_CA_DIRECTORY);
 if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==identity.uid||st.gid!==identity.gid||(st.mode&0o7777)!==0o700||await realpath(CONTROL_NODE_CA_DIRECTORY)!==CONTROL_NODE_CA_DIRECTORY)fail();
 let handle;
 try{
  handle=await open(MATERIAL_RECEIPT_FILE,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  const file=await handle.stat();if(!file.isFile()||file.uid!==identity.uid||file.gid!==identity.gid||(file.mode&0o7777)!==0o600||file.nlink!==1)fail();
  await handle.writeFile(bytes);await handle.sync();
 }finally{await handle?.close();}
 return Object.freeze({ready:true,path:MATERIAL_RECEIPT_FILE,bytes:bytes.length});
}

/** Control's one startup read. Never throws: a missing, foreign-owned, oversized or malformed file is simply no receipt. */
export async function readMaterialReceipt(){
 let handle;
 try{
  const identity=owner();
  handle=await open(MATERIAL_RECEIPT_FILE,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const st=await handle.stat();
  if(!st.isFile()||st.uid!==identity.uid||st.gid!==identity.gid||(st.mode&0o7777)!==0o600||st.nlink!==1||st.size<1||st.size>maxBytes)return null;
  const bytes=Buffer.alloc(st.size+1);let used=0;
  while(used<bytes.length){const result=await handle.read(bytes,used,bytes.length-used,used);if(!result.bytesRead)break;used+=result.bytesRead;}
  if(used!==st.size)return null;
  return parseMaterialReceipt(bytes.subarray(0,used).toString('utf8'));
 }catch{return null;}
 finally{await handle?.close();}
}

/** Control-only Node trust material. Init owns the derived file; ECS owns its task-local tmp volume.
 * Keep the image's locked RDS bytes intact and append only the configuration-pinned private server CA.
 * NODE_EXTRA_CA_CERTS is read before the application starts. No IO occurs on import. */
import {createHash,X509Certificate} from 'node:crypto';
import {constants} from 'node:fs';
import {open,mkdir,lstat,realpath,unlink,rmdir} from 'node:fs/promises';
import rdsLock from './certs/rds-global-bundle.lock.json' with {type:'json'};

export const CONTROL_NODE_CA_DIRECTORY='/tmp/meri-control-ca';
export const CONTROL_NODE_CA_FILE=CONTROL_NODE_CA_DIRECTORY+'/ca-bundle.pem';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Object.assign(Error('STATIC_INIT_CONTROL_CA_REFUSED'),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});};
const hex=/^[a-f0-9]{64}$/u;
const certificate=/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/u;
const maxPrivateBytes=16384,maxBundleBytes=rdsLock.bytes+maxPrivateBytes+1;

function privateAnchor(c){
 const file=c.taskRouter?.poststart?.controlCaFile,sha256=c.temporal?.issuerBootstrap?.configuration?.serverCaSha256;
 if(c.taskRouter?.poststart?.enabled!==true||typeof file!=='string'||!/^\/run\/meri\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.pem$/u.test(file)||!hex.test(sha256??''))fail();
 return {file,sha256};
}
export function productControlTrustsCompositeCa(environment=process.env){return environment.NODE_EXTRA_CA_CERTS===CONTROL_NODE_CA_FILE;}

/** Pure byte composition shared by init and the startup readback. Private-key material, extra certificates and foreign pins refuse. */
export function compileControlCaBundle({rdsBundle,privateCa,serverCaSha256}){
 if(!Buffer.isBuffer(rdsBundle)||rdsBundle.length!==rdsLock.bytes||hash(rdsBundle)!==rdsLock.sha256||
    !Buffer.isBuffer(privateCa)||privateCa.length<1||privateCa.length>maxPrivateBytes||!certificate.test(privateCa.toString('utf8'))||!hex.test(serverCaSha256??''))fail();
 let cert;try{cert=new X509Certificate(privateCa);}catch{fail();}
 if(!cert.ca||hash(cert.raw)!==serverCaSha256)fail();
 return Buffer.concat([rdsBundle,Buffer.from('\n'),privateCa]);
}

const owner=()=>{if(process.platform!=='linux'||process.getuid?.()!==1000||process.getgid?.()!==1000)fail();return {uid:1000,gid:1000};};
async function read(path,max,{uid,gid,mode}){
 let handle;try{
  handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=await handle.stat();
  if(!st.isFile()||st.uid!==uid||st.gid!==gid||(st.mode&0o7777)!==mode||st.nlink!==1||st.size<1||st.size>max)fail();
  const bytes=Buffer.alloc(st.size+1);let used=0;
  while(used<bytes.length){const result=await handle.read(bytes,used,bytes.length-used,used);if(!result.bytesRead)break;used+=result.bytesRead;}
  const after=await handle.stat();if(used!==st.size||after.size!==st.size||after.ino!==st.ino||after.dev!==st.dev)fail();
  return bytes.subarray(0,used);
 }finally{await handle?.close();}
}
async function inputs(configuration,identity){
 const anchor=privateAnchor(configuration),[rdsBundle,privateCa]=await Promise.all([
  read(rdsLock.imagePath,rdsLock.bytes,{uid:0,gid:0,mode:0o444}),read(anchor.file,maxPrivateBytes,{...identity,mode:0o600})]);
 return {anchor,privateCa,bundle:compileControlCaBundle({rdsBundle,privateCa,serverCaSha256:anchor.sha256})};
}
async function directory(identity){
 const st=await lstat(CONTROL_NODE_CA_DIRECTORY);
 if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==identity.uid||st.gid!==identity.gid||(st.mode&0o7777)!==0o700||await realpath(CONTROL_NODE_CA_DIRECTORY)!==CONTROL_NODE_CA_DIRECTORY)fail();
 return st;
}

/** Called only after canonical static material delivery succeeded; independent expected pins bind both reread files. */
export async function materializeControlCaBundle({configurationPath,expected}){
 const identity=owner();if(expected.role!=='control'||configurationPath!=='/run/meri/control.json')fail();
 const configurationBytes=await read(configurationPath,32768,{...identity,mode:0o600});
 if(hash(configurationBytes)!==expected.sha256ByPath[configurationPath])fail();
 const {anchor,privateCa,bundle}=await inputs(JSON.parse(configurationBytes.toString('utf8')),identity);
 if(hash(privateCa)!==expected.sha256ByPath[anchor.file]||await realpath('/tmp')!=='/tmp')fail();
 let created,createdDirectory=false,handle,file;
 try{
  await mkdir(CONTROL_NODE_CA_DIRECTORY,{mode:0o700});createdDirectory=true;created=await directory(identity);
  handle=await open(CONTROL_NODE_CA_FILE,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  file=await handle.stat();if(!file.isFile()||file.uid!==identity.uid||file.gid!==identity.gid||(file.mode&0o7777)!==0o600||file.nlink!==1)fail();
  await handle.writeFile(bundle);await handle.sync();await handle.close();handle=undefined;
  const written=await read(CONTROL_NODE_CA_FILE,maxBundleBytes,{...identity,mode:0o600});
  if(!written.equals(bundle))fail();
  return Object.freeze({ready:true,path:CONTROL_NODE_CA_FILE,sha256:hash(bundle),bytes:bundle.length});
 }catch(error){
  try{await handle?.close();}catch{}handle=undefined;
  try{
   if(createdDirectory&&!created)fail(); // Ownership could not be established: leave it for ECS volume disposal and report unknown cleanup.
   if(created){const current=await directory(identity);if(current.dev!==created.dev||current.ino!==created.ino)fail();
    if(file){const currentFile=await lstat(CONTROL_NODE_CA_FILE);if(currentFile.dev!==file.dev||currentFile.ino!==file.ino||!currentFile.isFile()||currentFile.nlink!==1)fail();await unlink(CONTROL_NODE_CA_FILE);}
    await rmdir(CONTROL_NODE_CA_DIRECTORY);}
  }catch{throw Object.assign(Error('STATIC_INIT_CLEANUP_FAILED'),{code:'STATIC_INIT_CLEANUP_FAILED'});}
  throw error;
 }finally{await handle?.close();}
}

/** Before control allocates resources, prove the shared output is present and still contains exactly both trust inputs. */
export async function verifyControlCaBundle(configuration,{environment=process.env}={}){
 if(!productControlTrustsCompositeCa(environment))fail();const identity=owner();await directory(identity);
 const [{bundle},actual]=await Promise.all([inputs(configuration,identity),read(CONTROL_NODE_CA_FILE,maxBundleBytes,{...identity,mode:0o600})]);
 if(!actual.equals(bundle))fail();return true;
}

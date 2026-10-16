/** Per-task owner-only TLS files beside the existing bootstrap file materializer.
 * No path is accepted from the network reply; local paths are selected here. */
import {open,mkdir,lstat,readdir,unlink,rmdir,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute,normalize,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileRunnerTlsServerMaterial} from './native-authority/runner-tls-server.mjs';
import {releaseRunnerBootstrap} from './runner-bootstrap-files.mjs';
const fail=()=>{throw Object.assign(Error('RUNNER_POSTSTART_REFUSED'),{code:'RUNNER_POSTSTART_REFUSED'});};
const names=Object.freeze({ca:'runner-ca.pem',cert:'runner-cert.pem',key:'runner-key.pem',candidate:'candidate.json',metadata:'metadata.json'});
const id=s=>({dev:s.dev,ino:s.ino,uid:s.uid}),same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid;
function root(path){if(typeof path!=='string'||!isAbsolute(path)||normalize(path)!==path||path.endsWith('/')||path.includes('/../')||path.length>4096||typeof process.getuid!=='function'||process.getuid()===0)fail();}
async function fresh(path){root(path);const parent=dirname(path),parentStat=await lstat(parent);if(!parentStat.isDirectory()||parentStat.isSymbolicLink()||await realpath(parent)!==parent)fail();await mkdir(path,{mode:0o700});const stat=await lstat(path);if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o077)!==0)fail();return id(stat);}
async function write(path,bytes){if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>65536)fail();let file;try{file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await file.writeFile(bytes);await file.sync();const stat=await file.stat();if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)!==0||stat.size!==bytes.length)fail();return {path,...id(stat),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}finally{await file?.close();}}
function base64(value,max){if(typeof value!=='string'||value.length>Math.ceil(max/3)*4)fail();const bytes=Buffer.from(value,'base64');if(bytes.length<1||bytes.length>max||bytes.toString('base64')!==value)fail();return bytes;}
/** The caller created `directory` fresh and owns it. A failed write stays visible
 * for exact-identity cleanup; no recursive deletion or path supplied by a reply. */
export async function writeRunnerPoststartTls({directory,original,tls,keyPem,metadata,now=Date.now}){
 const t=own(tls,['zone','ca','cert','candidate']),candidate=t.candidate,ca=base64(t.ca,16384),cert=base64(t.cert,32768),key=Buffer.from(keyPem,'utf8');
 compileRunnerTlsServerMaterial({original,candidate,metadata,ca,cert,key,zone:t.zone,now});
 const parent=join(directory,'tls'),parentId=await fresh(parent),files=[];
 try{
  for(const [name,bytes] of [['ca',ca],['cert',cert],['key',key],['candidate',Buffer.from(JSON.stringify(candidate))],['metadata',Buffer.from(JSON.stringify(metadata))]])files.push(await write(join(parent,names[name]),bytes));
  return Object.freeze({descriptor:Object.freeze({zone:t.zone,caFile:join(parent,names.ca),certFile:join(parent,names.cert),keyFile:join(parent,names.key),candidateFile:join(parent,names.candidate),metadataFile:join(parent,names.metadata)}),receipt:Object.freeze({directory:{path:parent,...parentId},files})});
 }catch(error){try{await releaseDirectory({directory:{path:parent,...parentId},files},Object.values(names).map(name=>join(parent,name)));}catch{throw Object.assign(Error('RUNNER_POSTSTART_CLEANUP_UNKNOWN'),{code:'RUNNER_POSTSTART_CLEANUP_UNKNOWN'});}throw error;}
}
async function releaseDirectory(receipt,allowed){const r=own(receipt,['directory','files']),dir=own(r.directory,['path','dev','ino','uid']);root(dir.path);const stat=await lstat(dir.path);if(!stat.isDirectory()||stat.isSymbolicLink()||!same(id(stat),dir)||stat.uid!==process.getuid()||(stat.mode&0o077)!==0)fail();const expected=new Map();for(const file of r.files){const f=own(file,['path','dev','ino','uid','bytes','sha256']);if(!allowed.includes(f.path)||expected.has(f.path))fail();expected.set(f.path,f);}
 const entries=await readdir(dir.path);if(entries.length!==r.files.length)fail();
 for(const name of entries){const path=join(dir.path,name),f=expected.get(path);if(!f)fail();const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||!same(id(s),f)||s.size!==f.bytes||s.uid!==process.getuid()||(s.mode&0o077)!==0)fail();let handle;try{handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const actual=await handle.stat();if(!same(id(actual),f)||actual.size!==f.bytes)fail();const bytes=await handle.readFile();if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)fail();}finally{await handle?.close();}}
 for(const name of entries)await unlink(join(dir.path,name));await rmdir(dir.path);
}
export async function releaseRunnerPoststart({directory,receipt}){
 root(directory);const r=own(receipt,['root','bootstrap','tls']),rootId=own(r.root,['path','dev','ino','uid']);if(rootId.path!==directory)fail();const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||!same(id(stat),rootId)||stat.uid!==process.getuid()||(stat.mode&0o077)!==0)fail();
 if(r.bootstrap)await releaseRunnerBootstrap({directory:join(directory,'bootstrap'),receipt:r.bootstrap});
 if(r.tls)await releaseDirectory(r.tls,Object.values(names).map(name=>join(directory,'tls',name)));
 if((await readdir(directory)).length)fail();await rmdir(directory);
}
export async function createRunnerPoststartDirectory(directory){return fresh(directory);}

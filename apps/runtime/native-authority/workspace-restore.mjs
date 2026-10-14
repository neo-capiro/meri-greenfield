/** Exclusive quiesced task workspace byte restoration; borrowed directory retained. */
import * as fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),fail=()=>{throw Error('WORKSPACE_RESTORE_REFUSED');},identity=s=>`${s.dev}:${s.ino}:${s.mode}:${s.nlink}`;
function directory(p){const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink()||fs.realpathSync(p)!==p)fail();return s;}
export function restoreWorkspaceBytes({workspace,manifest,files,check}){
 assertWorkspacePaths(manifest);const original=directory(workspace),anchor=`${original.dev}:${original.ino}:${original.mode}`;if(fs.readdirSync(workspace).length)fail();const created=[];
 try{for(let i=0;i<manifest.entries.length;i++){check();const entry=manifest.entries[i],bytes=files[i];if(!Buffer.isBuffer(bytes)||bytes.length!==entry.object.bytes||sha(bytes)!==entry.object.sha256)fail();
  let parent=workspace;for(const part of entry.path.split('/').slice(0,-1)){parent=path.join(parent,part);if(!fs.existsSync(parent)){fs.mkdirSync(parent,{mode:0o700});created.push({path:parent,directory:true,identity:identity(directory(parent))});}else directory(parent);}
  const target=path.join(workspace,entry.path),fd=fs.openSync(target,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,entry.executable?0o700:0o600);
  try{created.push({path:target,directory:false,identity:identity(fs.fstatSync(fd))});fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 }
 check();const final=directory(workspace);if(`${final.dev}:${final.ino}:${final.mode}`!==anchor)fail();verifyWorkspaceBytes({workspace,manifest,check});
 }catch(error){let cleanupComplete=true;for(const row of created.reverse()){try{if(identity(fs.lstatSync(row.path))!==row.identity)fail();if(row.directory)fs.rmdirSync(row.path);else fs.unlinkSync(row.path);}catch{cleanupComplete=false;}}
  throw Object.assign(Error('WORKSPACE_RESTORE_UNKNOWN'),{code:'WORKSPACE_RESTORE_UNKNOWN',cleanupComplete});}
}
export function verifyWorkspaceBytes({workspace,manifest,check}){
 assertWorkspacePaths(manifest);directory(workspace);const wanted=new Set(manifest.entries.map(e=>e.path)),directories=new Set(),found=[];
 for(const e of manifest.entries){const parts=e.path.split('/');for(let n=1;n<parts.length;n++)directories.add(parts.slice(0,n).join('/'));}
 const visit=(dir,relative='')=>{for(const name of fs.readdirSync(dir)){check();const rel=relative?`${relative}/${name}`:name,p=path.join(dir,name),s=fs.lstatSync(p);if(s.isDirectory()&&!s.isSymbolicLink()){if(!directories.has(rel))fail();directory(p);visit(p,rel);}else {if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||fs.realpathSync(p)!==p||!wanted.has(rel))fail();found.push(rel);}}};visit(workspace);
 if(found.length!==wanted.size)fail();for(const e of manifest.entries){check();const p=path.join(workspace,e.path),before=fs.lstatSync(p);if(before.size!==e.object.bytes||before.size>8*1024*1024)fail();const fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{if(identity(fs.fstatSync(fd))!==identity(before))fail();const bytes=fs.readFileSync(fd);if(bytes.length!==e.object.bytes||sha(bytes)!==e.object.sha256||!!(before.mode&0o111)!==e.executable||identity(fs.fstatSync(fd))!==identity(before))fail();}finally{fs.closeSync(fd);}}
}

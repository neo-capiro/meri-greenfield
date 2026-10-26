/** Exclusive quiesced workspace byte restoration; the caller retains its directory. */
import * as fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {captureWorkspaceBytes} from './workspace-capture.mjs';
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
 assertWorkspacePaths(manifest);const rows=captureWorkspaceBytes({workspace,check}),found=new Map(rows.map(row=>[row.path,row]));
 if(rows.length!==manifest.entries.length)fail();for(const entry of manifest.entries){check();const row=found.get(entry.path);
  if(!row||row.bytes!==entry.object.bytes||row.sha256!==entry.object.sha256||row.executable!==entry.executable)fail();}
}
/** An uncommitted local tree is never erased: each entry moves to a retained directory beside the workspace, which is
 * left empty so the next restore owns a quiesced tree again instead of refusing a stale one. The workspace keeps its
 * own directory and inode, the identity the owned runtime session and the SDK project key are pinned to. */
export function retainWorkspaceBytes({workspace,check}){
 const before=directory(workspace);if(!fs.readdirSync(workspace).length)return Object.freeze({retained:false});
 const retained=retainedDirectory(workspace);
 for(const name of fs.readdirSync(workspace)){check();fs.renameSync(path.join(workspace,name),path.join(retained,name));}
 check();if(fs.readdirSync(workspace).length)fail();const after=directory(workspace);if(after.dev!==before.dev||after.ino!==before.ino)fail();
 return Object.freeze({retained:true,retainedPath:retained});
}
/** One directory per retained tree, beside the tree it holds, so an earlier retention is never overwritten. */
function retainedDirectory(workspace){
 for(let n=0;n<1000;n++){const candidate=n?`${workspace}.uncommitted.${n}`:`${workspace}.uncommitted`;
  try{fs.mkdirSync(candidate,{mode:0o700});}catch(error){if(error?.code==='EEXIST')continue;fail();}
  directory(candidate);return candidate;}
 fail();
}

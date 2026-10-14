/** Stable bounded source bytes inside the original task's borrowed workspace. */
import * as fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Error('WORKSPACE_CAPTURE_REFUSED');},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=s=>`${s.dev}:${s.ino}:${s.mode}:${s.nlink}:${s.uid}:${s.gid}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
const anchor=s=>`${s.dev}:${s.ino}:${s.mode}:${s.uid}:${s.gid}`;
function directory(p){const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink()||fs.realpathSync(p)!==p)fail();return s;}
export function createWorkspaceCapture(configuration){
 const c=own(configuration,['workspace','expiresAtMs'],['now']),now=c.now??Date.now;
 if(typeof c.workspace!=='string'||!path.isAbsolute(c.workspace)||path.resolve(c.workspace)!==c.workspace||c.workspace==='/'||typeof now!=='function'||!Number.isSafeInteger(c.expiresAtMs))fail();
 return Object.freeze({capture(value={}){
  const {signal}=own(value,[],['signal']);nativeSignal(signal);const check=()=>{if(signal?.aborted||now()>=c.expiresAtMs)fail();};check();
  const ancestors=[];for(let p=c.workspace;;p=path.dirname(p)){check();ancestors.push([p,anchor(directory(p))]);if(path.dirname(p)===p)break;}
  let total=0,members=0;const rows=[],observed=[],names=new Set();
  function visit(dir,relative='',depth=0){check();const before=directory(dir),membersBefore=fs.readdirSync(dir).sort();check();if(relative&&!membersBefore.length)fail();
   if(depth>12)fail();for(const name of membersBefore){check();if(++members>512||name.length>128||name.normalize('NFC')!==name||/[\\\x00-\x1f\x7f:]/u.test(name)||name==='.'||name==='..')fail();
    const rel=relative?relative+'/'+name:name;if(rel.length>4096||names.has(rel.toLowerCase()))fail();names.add(rel.toLowerCase());const p=path.join(dir,name),s=fs.lstatSync(p);check();
    if(s.isDirectory()&&!s.isSymbolicLink()){visit(p,rel,depth+1);continue;}
    if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||fs.realpathSync(p)!==p||rows.length>=256||s.size>8*1024*1024||total+s.size>32*1024*1024)fail();check();
    const fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);let bytes;
    try{check();if(identity(fs.fstatSync(fd))!==identity(s))fail();bytes=Buffer.alloc(s.size);let offset=0;
     while(offset<bytes.length){check();const n=fs.readSync(fd,bytes,offset,Math.min(65536,bytes.length-offset),offset);check();if(!n)fail();offset+=n;}
     if(identity(fs.fstatSync(fd))!==identity(s)||identity(fs.lstatSync(p))!==identity(s))fail();check();
    }finally{fs.closeSync(fd);}check();total+=bytes.length;observed.push([p,identity(s)]);rows.push({path:rel,executable:!!(s.mode&0o111),bytes:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')});
   }
   check();if(identity(directory(dir))!==identity(before)||JSON.stringify(fs.readdirSync(dir).sort())!==JSON.stringify(membersBefore))fail();check();observed.push([dir,identity(before)]);
  }
  visit(c.workspace);for(const [p,wanted]of observed){check();if(identity(fs.lstatSync(p))!==wanted)fail();check();}for(const [p,wanted]of ancestors){check();if(anchor(directory(p))!==wanted)fail();check();}
  return rows;
 }});
}

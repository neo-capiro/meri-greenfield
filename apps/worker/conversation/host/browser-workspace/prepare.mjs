// @ts-check
/** Trusted, synchronous pre-start creation of the private browser state tree. No SDK or browser child may have
 * started when this runs. The native launcher reopens every directory through pinned FDs before browser preexec. */
import * as realFs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {posix} from 'node:path';
import {browserPaths} from '../../browser/workspace.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_BROWSER_WORKSPACE_PREP_REFUSED'),
 {code:'HOST_BROWSER_WORKSPACE_PREP_REFUSED'});};
const validId=value=>Number.isSafeInteger(value)&&value>=1000&&value<=65533;
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const fdPath=(fd,name='')=>`/proc/self/fd/${fd}${name?`/${name}`:''}`;
const dir=stat=>stat.isDirectory()&&!stat.isSymbolicLink();
const bits=stat=>stat.mode&0o7777;
const rootAncestor=stat=>dir(stat)&&stat.uid===0&&(bits(stat)&0o022)===0&&
 (bits(stat)&0o001)===1;
const exact=({stat,uid,gid,mode,dev})=>dir(stat)&&stat.uid===uid&&stat.gid===gid&&
 bits(stat)===mode&&stat.dev===dev;
const names=(fs,fd)=>fs.readdirSync(fdPath(fd)).sort();
const only=(fs,fd,expected)=>{const actual=names(fs,fd);if(actual.length!==expected.length||
 actual.some((name,index)=>name!==expected[index]))fail();};
const absent=(fs,path)=>{try{fs.lstatSync(path);return false;}catch(error){if(error?.code==='ENOENT')return true;throw error;}};
const openDir=(fs,path)=>fs.openSync(path,realFs.constants.O_RDONLY|realFs.constants.O_DIRECTORY|
 realFs.constants.O_NOFOLLOW);
const verify=(fs,fd,expected)=>{const stat=fs.fstatSync(fd);if(!exact({stat,...expected}))fail();return stat;};

/** Use only from the host-root bootstrap. `system` is a synthetic-test seam kept outside the production export. */
export function prepareBrowserWorkspaceWithSystem({cwd,conversationId,sdkUid,sdkGid,browserUid,browserGid},
 {fs,identity,nonce}){
 if(typeof cwd!=='string'||!posix.isAbsolute(cwd)||posix.resolve(cwd)!==cwd||/[\0\n]/u.test(cwd)||
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u.test(conversationId)||
  !cwd.endsWith(`/${conversationId}`)||
  ![sdkUid,sdkGid,browserUid,browserGid].every(validId)||
  sdkUid===browserUid||sdkGid===browserGid||typeof nonce!=='function'||!fs)fail();
 const credentials=identity();if(credentials.uid!==0||credentials.euid!==0||
  credentials.gid!==0||credentials.egid!==0)fail();
 const fds=[];let stage,rootFd,stageCreated=false,renamed=false;
 const opened=path=>{const fd=openDir(fs,path);fds.push(fd);return fd;};
 try{
  // Walk from a pinned root FD. Every ancestor is root owned, immutable to tool UIDs, and searchable by browserUid.
  let parent=opened('/');if(!rootAncestor(fs.fstatSync(parent)))fail();
  const segments=cwd.slice(1).split('/');
  for(const segment of segments.slice(0,-1)){
   parent=opened(fdPath(parent,segment));if(!rootAncestor(fs.fstatSync(parent)))fail();
  }
  const parentStat=fs.fstatSync(parent),name=segments.at(-1),cwdPath=fdPath(parent,name);
  if(!name)fail();
  if(absent(fs,cwdPath)){
   fs.mkdirSync(cwdPath,{mode:0o700});rootFd=opened(cwdPath);
   verify(fs,rootFd,{uid:0,gid:0,mode:0o700,dev:parentStat.dev});
   fs.fchownSync(rootFd,0,sdkGid);fs.fchmodSync(rootFd,0o1770);
  }else rootFd=opened(cwdPath);
  const original=verify(fs,rootFd,{uid:0,gid:sdkGid,mode:0o1770,dev:parentStat.dev});
  const before=names(fs,rootFd),stateName='.browser';
  // A crash can leave a browser-owned staging tree. Never classify that orphan as SDK source or let normal
  // browser-state disposal report success while private data remains under a second name.
  if(before.some(entry=>entry.startsWith('.browser-prep-')))fail();
  if(!before.includes(stateName)){
   stage=`.browser-prep-${nonce()}`;
   if(!/^\.browser-prep-[0-9a-f]{32}$/u.test(stage))fail();
   const stagePath=fdPath(rootFd,stage);
   fs.mkdirSync(stagePath,{mode:0o700});
   stageCreated=true;
   const stageFd=opened(stagePath);
   verify(fs,stageFd,{uid:0,gid:0,mode:0o700,dev:original.dev});
   for(const childName of ['home','output','profile']){
    const path=fdPath(stageFd,childName);fs.mkdirSync(path,{mode:0o700});
    const childFd=opened(path);verify(fs,childFd,{uid:0,gid:0,mode:0o700,dev:original.dev});
    fs.fchownSync(childFd,browserUid,browserGid);fs.fchmodSync(childFd,0o700);
    verify(fs,childFd,{uid:browserUid,gid:browserGid,mode:0o700,dev:original.dev});
    only(fs,childFd,[]);
   }
   only(fs,stageFd,['home','output','profile']);
   fs.fchownSync(stageFd,browserUid,browserGid);fs.fchmodSync(stageFd,0o700);
   verify(fs,stageFd,{uid:browserUid,gid:browserGid,mode:0o700,dev:original.dev});
   only(fs,rootFd,[...before,stage].sort());
   if(!absent(fs,fdPath(rootFd,stateName)))fail();
   fs.renameSync(stagePath,fdPath(rootFd,stateName));renamed=true;
  }
  const stateFd=opened(fdPath(rootFd,stateName));
  const state=verify(fs,stateFd,{uid:browserUid,gid:browserGid,mode:0o700,dev:original.dev});
  only(fs,stateFd,['home','output','profile']);
  for(const childName of ['home','output','profile']){
   const childFd=opened(fdPath(stateFd,childName));
   verify(fs,childFd,{uid:browserUid,gid:browserGid,mode:0o700,dev:original.dev});
  }
  only(fs,rootFd,before.includes(stateName)?before:[...before,stateName].sort());
  if(!same(original,fs.fstatSync(rootFd))||!same(state,fs.fstatSync(stateFd))||
   !same(parentStat,fs.fstatSync(parent)))fail();
  return Object.freeze({cwd,paths:browserPaths(cwd),cwdInode:String(original.ino),
   stateInode:String(state.ino)});
 }catch{
  // A failed attempt cannot authorize a launch. Remove only our unrenamed staging directory; leave all other
  // state for host destruction rather than following a possibly changed path or deleting prior user material.
  if(stageCreated&&rootFd!==undefined&&!renamed)try{fs.rmSync(fdPath(rootFd,stage),{recursive:true,force:true});}catch{}
  fail();
 }finally{for(const fd of fds.reverse())try{fs.closeSync(fd);}catch{}}
}

export function prepareBrowserWorkspace(input){
 return prepareBrowserWorkspaceWithSystem(input,{fs:realFs,
  identity:()=>({uid:process.getuid(),euid:process.geteuid(),gid:process.getgid(),egid:process.getegid()}),
  nonce:()=>randomBytes(16).toString('hex')});
}

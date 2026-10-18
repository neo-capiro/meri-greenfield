/** Synthetic dirfd filesystem. No chown, SDK, browser, namespace, cloud or model call is made. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../browser/test/fixtures.mjs';
import {prepareBrowserWorkspace,prepareBrowserWorkspaceWithSystem} from './prepare.mjs';

const cwd=`/workspace/conversations/${binding.conversationId}`;
const args={cwd,conversationId:binding.conversationId,sdkUid:24001,sdkGid:24001,
 browserUid:24002,browserGid:24002};
const refused=error=>error?.code==='HOST_BROWSER_WORKSPACE_PREP_REFUSED';
const directory=(uid=0,gid=0,mode=0o755,ino=1)=>({uid,gid,mode,dev:1,ino,
 children:new Map(),isDirectory(){return true;},isSymbolicLink(){return false;}});

function fixture(){
 const root=directory(),workspace=directory(0,0,0o755,2),conversations=directory(0,0,0o711,3);
 root.children.set('workspace',workspace);workspace.children.set('conversations',conversations);
 const fds=new Map();let nextFd=10,nextIno=4,failRename=false,stageCollision=false;
 const lookup=path=>{
  const fdMatch=/^\/proc\/self\/fd\/(\d+)(?:\/(.*))?$/u.exec(path);
  let node=fdMatch?fds.get(Number(fdMatch[1])):root;
  if(!node)throw Object.assign(Error('missing fd'),{code:'EBADF'});
  const segments=(fdMatch?fdMatch[2]??'':path.slice(1)).split('/').filter(Boolean);
  for(const segment of segments){node=node.children?.get(segment);if(!node)throw Object.assign(Error('missing path'),{code:'ENOENT'});}
  return node;
 };
 const parent=path=>{const slash=path.lastIndexOf('/');return [lookup(path.slice(0,slash)||'/'),path.slice(slash+1)];};
 const stat=node=>({...node});
 const fs={
  openSync(path){const node=lookup(path);if(!node.children)throw Object.assign(Error('not dir'),{code:'ENOTDIR'});
   const fd=nextFd++;fds.set(fd,node);return fd;},
  closeSync(fd){fds.delete(fd);},fstatSync(fd){return stat(fds.get(fd));},lstatSync(path){return stat(lookup(path));},
  readdirSync(path){return [...lookup(path).children.keys()];},
  mkdirSync(path,{mode}){const [node,name]=parent(path);
   if(stageCollision&&name.startsWith('.browser-prep-')){
    node.children.set(name,directory(args.sdkUid,args.sdkGid,0o700,nextIno++));
    throw Object.assign(Error('exists'),{code:'EEXIST'});
   }
   if(node.children.has(name))throw Error('exists');
   node.children.set(name,directory(0,0,mode,nextIno++));},
  fchownSync(fd,uid,gid){Object.assign(fds.get(fd),{uid,gid});},
  fchmodSync(fd,mode){fds.get(fd).mode=mode;},
  renameSync(from,to){if(failRename)throw Error('rename failed');const [source,name]=parent(from),[target,next]=parent(to);
   if(target.children.has(next))throw Error('target present');target.children.set(next,source.children.get(name));source.children.delete(name);},
  rmSync(path){const [node,name]=parent(path);node.children.delete(name);},
 };
 const system={fs,identity:()=>({uid:0,euid:0,gid:0,egid:0}),nonce:()=>`a`.repeat(32)};
 return {root,workspace,conversations,fs,system,lookup,setFailRename(){failRename=true;},
  setStageCollision(){stageCollision=true;}};
}

test('prepares one browser-private state tree before SDK start and accepts exact empty replay',()=>{
 const f=fixture();const first=prepareBrowserWorkspaceWithSystem(args,f.system);
 assert.equal(first.cwd,cwd);assert.equal(first.cwdInode,'4');assert.equal(first.stateInode,'5');
 const original=f.lookup(cwd),state=f.lookup(`${cwd}/.browser`);
 assert.deepEqual([original.uid,original.gid,original.mode],[0,args.sdkGid,0o1770]);
 assert.deepEqual([state.uid,state.gid,state.mode],[args.browserUid,args.browserGid,0o700]);
 assert.deepEqual([...original.children.keys()],['.browser']);
 assert.deepEqual([...state.children.keys()].sort(),['home','output','profile']);
 for(const name of state.children.keys()){
  const child=f.lookup(`${cwd}/.browser/${name}`);
  assert.deepEqual([child.uid,child.gid,child.mode,child.children.size],[args.browserUid,args.browserGid,0o700,0]);
 }
 assert.deepEqual(prepareBrowserWorkspaceWithSystem(args,f.system),first);
});

test('preserves existing source files while preparing and rechecking browser state',()=>{
 const f=fixture(),original=directory(0,args.sdkGid,0o1770,20),file={uid:args.sdkUid,gid:args.sdkGid,
  mode:0o644,dev:1,ino:21,isDirectory(){return false;},isSymbolicLink(){return false;}};
 original.children.set('source.txt',file);f.conversations.children.set(binding.conversationId,original);
 const result=prepareBrowserWorkspaceWithSystem(args,f.system);
 assert.equal(result.cwdInode,'20');assert.equal(f.lookup(`${cwd}/source.txt`),file);
 assert.deepEqual([...original.children.keys()].sort(),['.browser','source.txt']);
 assert.deepEqual(prepareBrowserWorkspaceWithSystem(args,f.system),result);
 assert.equal(f.lookup(`${cwd}/source.txt`),file);
});

test('accepts browser profile data across turns of one conversation without inspecting its contents',()=>{
 const f=fixture(),first=prepareBrowserWorkspaceWithSystem(args,f.system);
 const profile=f.lookup(`${cwd}/.browser/profile`);
 const cookie={uid:args.browserUid,gid:args.browserGid,mode:0o600,dev:1,ino:100};
 profile.children.set('Cookies',cookie);
 assert.deepEqual(prepareBrowserWorkspaceWithSystem(args,f.system),first);
 assert.equal(profile.children.get('Cookies'),cookie);
});

test('refuses mutable parent and wrong private directory ownership or mode',()=>{
 for(const mutate of [
  f=>{f.workspace.mode=0o777;},
  f=>{f.conversations.isSymbolicLink=()=>true;},
  f=>{const dir=directory(0,args.sdkGid,0o1770,20);dir.children.set('.browser-prep-orphan',directory(args.browserUid,args.browserGid,0o700,21));
   f.conversations.children.set(binding.conversationId,dir);},
  f=>{prepareBrowserWorkspaceWithSystem(args,f.system);f.lookup(`${cwd}/.browser`).uid=args.sdkUid;},
  f=>{prepareBrowserWorkspaceWithSystem(args,f.system);f.lookup(`${cwd}/.browser`).isSymbolicLink=()=>true;},
  f=>{prepareBrowserWorkspaceWithSystem(args,f.system);f.lookup(`${cwd}/.browser/output`).mode=0o755;},
  f=>{prepareBrowserWorkspaceWithSystem(args,f.system);f.lookup(cwd).mode=0o777;},
 ]){
  const f=fixture();mutate(f);assert.throws(()=>prepareBrowserWorkspaceWithSystem(args,f.system),refused);
 }
});

test('failed stage attach removes only new staging content and never grants a private-state receipt',()=>{
 const f=fixture();f.setFailRename();
 assert.throws(()=>prepareBrowserWorkspaceWithSystem(args,f.system),refused);
 assert.deepEqual([...f.lookup(cwd).children.keys()],[]);
 assert.throws(()=>f.lookup(`${cwd}/.browser`),error=>error?.code==='ENOENT');
});

test('racing stage-name collision is never removed as if created by this preparer',()=>{
 const f=fixture();f.setStageCollision();
 assert.throws(()=>prepareBrowserWorkspaceWithSystem(args,f.system),refused);
 const entry=f.lookup(`${cwd}/.browser-prep-${'a'.repeat(32)}`);
 assert.equal(entry.uid,args.sdkUid);
});

test('non-root or noncanonical caller is refused before any workspace mutation',()=>{
 const f=fixture();
 for(const bad of [{...args,cwd:`${cwd}/../${binding.conversationId}`},{...args,browserUid:args.sdkUid},
  {...args,conversationId:'other'}])assert.throws(()=>prepareBrowserWorkspaceWithSystem(bad,f.system),refused);
 assert.deepEqual([...f.conversations.children.keys()],[]);
 assert.throws(()=>prepareBrowserWorkspaceWithSystem(args,{...f.system,identity:()=>({uid:1000,euid:1000,gid:1000,egid:1000})}),refused);
 assert.deepEqual([...f.conversations.children.keys()],[]);
 if(process.geteuid()!==0)assert.throws(()=>prepareBrowserWorkspace(args),refused);
});

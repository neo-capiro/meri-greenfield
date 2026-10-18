import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {initializeRunnerWorkspace} from '../runner-workspace.mjs';
import {workspaceFixture,runtimeIdentity} from './runner-workspace-fixture.mjs';
const run=(f,extra={})=>initializeRunnerWorkspace({configuration:f.configuration,original:f.original,...extra},f.dependencies);
const creates=f=>f.events.filter(([operation])=>operation==='mkdir');

test('an empty task mount gains exactly its bound private child and closes no-follow directory handles',async()=>{
 const f=workspaceFixture();assert.deepEqual([...f.directories.keys()],['/workspace']);
 const receipt=await run(f),child=f.directories.get(f.configuration.workspace);
 assert.equal(receipt.path,f.configuration.workspace);assert.equal(receipt.ino,child.ino);assert.equal(child.mode&0o7777,0o700);assert.equal(child.uid,1000);assert.equal(child.gid,1000);
 assert.deepEqual(creates(f),[['mkdir',f.configuration.workspace,{mode:0o700}]]);
 for(const [,path,flags]of f.events.filter(([operation])=>operation==='open')){assert.ok(['/workspace',receipt.path].includes(path));assert.equal(flags,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);}
 assert.equal(f.events.filter(([operation])=>operation==='close').length,2);
 await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(f.directories.get(receipt.path),child,'existing task data is never adopted or deleted');
});

test('wrong bindings, versions, roots, aliases and platform identities refuse before filesystem writes',async()=>{
 const changes=[f=>{f.configuration={...f.configuration,binding:{...f.configuration.binding,runId:'11111111-1111-4111-8111-111111111111'}};},
  f=>{f.configuration={...f.configuration,versions:{...f.configuration.versions,cli:'0.0.0'}};},
  ...['/tmp/','/workspace/../workspace/','/workspace//','/workspace/other/'].map(root=>f=>{f.configuration={...f.configuration,workspace:root+f.configuration.binding.conversationId};}),
  ...[{uid:0},{uid:undefined},{gid:-1},{platform:'win32'}].map(change=>f=>{f.dependencies={...f.dependencies,runtimeIdentity:{...runtimeIdentity,...change}};})];
 for(const change of changes){const f=workspaceFixture();change(f);await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(creates(f).length,0);}
});

test('missing, foreign, permissive, special-mode, linked or aliased mount roots refuse before creating a child',async()=>{
 const changes=[f=>f.directories.delete('/workspace'),f=>f.aliases.set('/workspace','/other'),
  ...[{uid:1001},{gid:1001},{mode:0o40755},{mode:0o41700},{isSymbolicLink:()=>true},{isDirectory:()=>false}].map(change=>f=>Object.assign(f.directories.get('/workspace'),change))];
 for(const change of changes){const f=workspaceFixture();change(f);await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(creates(f).length,0);}
});

test('existing regular, linked, foreign and permissive targets are preserved without chmod, chown or recursive removal',async()=>{
 for(const extra of [{},{uid:1001},{mode:0o40755},{isSymbolicLink:()=>true},{isDirectory:()=>false}]){const f=workspaceFixture(),target=f.stat(extra);f.directories.set(f.configuration.workspace,target);
  await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_REFUSED'});assert.strictEqual(f.directories.get(f.configuration.workspace),target);assert.equal(f.events.some(([operation])=>operation==='rmdir'),false);}
});

test('cancellation after creation rolls back only the exact empty child and closes handles',async()=>{
 const f=workspaceFixture(),controller=new AbortController(),mkdir=f.fs.mkdir;f.fs.mkdir=async(...args)=>{await mkdir(...args);controller.abort();};
 await assert.rejects(run(f,{signal:controller.signal}),{code:'RUNNER_WORKSPACE_REFUSED'});
 assert.deepEqual([...f.directories.keys()],['/workspace']);assert.deepEqual(f.events.filter(([operation])=>operation==='rmdir'),[['rmdir',f.configuration.workspace]]);
 assert.equal(f.events.filter(([operation])=>operation==='close').length,1);
 const before=workspaceFixture();await assert.rejects(run(before,{signal:controller.signal}),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(creates(before).length,0);
});

test('startup and original deadlines refuse before writes or roll back the exact new empty child',async()=>{
 const expired=workspaceFixture();await assert.rejects(run(expired,{now:()=>expired.original.expiresAtMs}),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(creates(expired).length,0);
 const f=workspaceFixture(),deadlineMs=Date.now()+1000;let now=deadlineMs-1;const mkdir=f.fs.mkdir;
 f.fs.mkdir=async(...args)=>{await mkdir(...args);now=deadlineMs;};
 await assert.rejects(run(f,{deadlineMs,now:()=>now}),{code:'RUNNER_WORKSPACE_REFUSED'});assert.deepEqual([...f.directories.keys()],['/workspace']);
 const capped=workspaceFixture();await assert.rejects(run(capped,{deadlineMs:capped.original.expiresAtMs+10000,now:()=>capped.original.expiresAtMs}),{code:'RUNNER_WORKSPACE_REFUSED'});assert.equal(creates(capped).length,0);
});

test('changed parent identity, replaced child or populated child refuses cleanup and preserves uncertain data',async()=>{
 for(const mutation of ['parent','child','populated']){const f=workspaceFixture(),open=f.fs.open;
  f.fs.open=async(path,...args)=>{const handle=await open(path,...args);if(path===f.configuration.workspace){
   if(mutation==='parent')f.directories.set('/workspace',f.stat());
   if(mutation==='child')f.directories.set(path,f.stat());
   if(mutation==='populated'){f.directories.set(path+'/keep',f.stat({isDirectory:()=>false}));throw Error('synthetic open failure');}
  }return handle;};
  await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_CLEANUP_UNKNOWN'});assert.ok(f.directories.has(f.configuration.workspace));
  if(mutation==='populated')assert.ok(f.directories.has(f.configuration.workspace+'/keep'));
 }
});

test('postcreation ownership, mode, symlink or canonical-path failures stay closed and never delete an unproven target',async()=>{
 for(const change of [{uid:1001},{gid:1001},{mode:0o40755},{isSymbolicLink:()=>true},{isDirectory:()=>false},{alias:true}]){const f=workspaceFixture(),mkdir=f.fs.mkdir;
  f.fs.mkdir=async(...args)=>{await mkdir(...args);if(change.alias)f.aliases.set(f.configuration.workspace,'/other');else Object.assign(f.directories.get(f.configuration.workspace),change);};
  await assert.rejects(run(f),{code:'RUNNER_WORKSPACE_CLEANUP_UNKNOWN'});assert.ok(f.directories.has(f.configuration.workspace));assert.equal(f.events.some(([operation])=>operation==='rmdir'),false);
 }
});

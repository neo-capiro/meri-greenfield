import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,link,unlink,realpath,chmod,symlink} from 'node:fs/promises';
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createNativeFiles,prepareNativeTaskDirectory,nativeTaskDirectory} from '../native-files.mjs';
import {assertNativeFileUpload,assertNativeFileState,nativeFileSha256} from '../../../../packages/contracts/runtime-0.2/files.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision:'synthetic-policy'}];
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'meri-native-files-')));t.after(()=>rm(root,{recursive:true,force:true}));let clock=1000;
 async function tree(name){const workspace=join(root,name+'-workspace'),sdkConfigDirectory=join(root,name+'-config');await mkdir(workspace,{mode:0o700});await mkdir(sdkConfigDirectory,{mode:0o700});const taskDirectory=await prepareNativeTaskDirectory(sdkConfigDirectory);
  return {workspace,sdkConfigDirectory,taskDirectory,owner:createNativeFiles({workspace,sdkConfigDirectory,expiresAtMs:2000,now:()=>clock})};}
 return {root,tree,clock:value=>{clock=value;}};
}
function retained(upload){let n=10;const convert=rows=>rows.map(r=>({path:r.path,kind:'file',executable:r.executable,object:{objectId:id(n++),versionId:'synthetic-version-1',sha256:r.sha256,bytes:r.bytes,scopes}}));
 return {workspace:{contractVersion:'0.1.0',manifestId:id(9),binding,logicalCwd:'/workspace/conversation',entries:convert(upload.files),scopes,createdAt:'2026-10-24T00:00:00.000Z'},tasks:convert(upload.taskFiles)};}
const bytes=rows=>rows.map(r=>Buffer.from(r.base64,'base64'));
const raw=(path,value,executable=false)=>{const b=Buffer.from(value);return {path,executable,bytes:b.length,sha256:nativeFileSha256(b),base64:b.toString('base64')};};
test('native workspace, Task JSON and high-water mark survive cold restore and exact warm verification; fork does not mutate source',async t=>{
 const f=await fixture(t),source=await f.tree('source'),target=await f.tree('target');await mkdir(join(source.workspace,'outputs'));await mkdir(join(source.workspace,'scratch','empty'),{recursive:true});
 const binary=Buffer.from([0,255,10,13]);await writeFile(join(source.workspace,'outputs','result.bin'),binary);
 const task='{"id":"7","status":"pending","opaqueFuture":{"keep":[null,42]}}\n';await writeFile(join(source.taskDirectory,'7.json'),task);await writeFile(join(source.taskDirectory,'.highwatermark'),'12');await writeFile(join(source.taskDirectory,'.lock'),'');
 const captured=source.owner.capture(),state=retained(captured);assertNativeFileState(state,{binding,scopes});
 await target.owner.restore({state,files:bytes(captured.files),taskFiles:bytes(captured.taskFiles)});
 assert.deepEqual(await readFile(join(target.workspace,'outputs','result.bin')),binary);assert.equal(await readFile(join(target.taskDirectory,'7.json'),'utf8'),task);assert.equal(await readFile(join(target.taskDirectory,'.highwatermark'),'utf8'),'12');
 await mkdir(join(target.workspace,'scratch','empty'),{recursive:true});await mkdir(join(target.taskDirectory,'empty'));await target.owner.restore({state,files:bytes(captured.files),taskFiles:bytes(captured.taskFiles)});assert.deepEqual(source.owner.capture(),captured);
 await writeFile(join(target.taskDirectory,'7.json'),'changed');assert.equal(await readFile(join(source.taskDirectory,'7.json'),'utf8'),task);
 await assert.rejects(target.owner.restore({state,files:bytes(captured.files),taskFiles:bytes(captured.taskFiles)}),/WORKSPACE_RESTORE/);
});
test('empty native trees are valid without manufacturing an SDK task or transcript',async t=>{const f=await fixture(t),source=await f.tree('source'),target=await f.tree('target');const captured=source.owner.capture();assert.deepEqual(captured,{files:[],taskFiles:[]});await target.owner.restore({state:retained(captured),files:[],taskFiles:[]});assert.deepEqual(await readdir(target.workspace),[]);assert.deepEqual(await readdir(target.taskDirectory),[]);});
test('warm empty directory verification accepts the retained empty manifest without clearing local directories',async t=>{const f=await fixture(t),target=await f.tree('target');await mkdir(join(target.workspace,'scratch','empty'),{recursive:true});await target.owner.restore({state:retained({files:[],taskFiles:[]}),files:[],taskFiles:[]});assert.deepEqual(await readdir(join(target.workspace,'scratch','empty')),[]);});
test('nested empty directories survive warm verification while cold restore keeps an empty file manifest',async t=>{const f=await fixture(t),source=await f.tree('source'),target=await f.tree('target');await mkdir(join(source.workspace,'scratch','empty'),{recursive:true});await mkdir(join(source.taskDirectory,'empty'));const captured=source.owner.capture(),state=retained(captured);assert.deepEqual(captured,{files:[],taskFiles:[]});await source.owner.restore({state,files:[],taskFiles:[]});assert.deepEqual(await readdir(join(source.workspace,'scratch','empty')),[]);await target.owner.restore({state,files:[],taskFiles:[]});assert.deepEqual(await readdir(target.workspace),[]);await writeFile(join(source.workspace,'scratch','empty','unexpected'),'keep');await assert.rejects(source.owner.restore({state,files:[],taskFiles:[]}),/WORKSPACE_RESTORE_REFUSED/);assert.equal(await readFile(join(source.workspace,'scratch','empty','unexpected'),'utf8'),'keep');});
for(const mutation of ['workspace-hash','task-hash','task-count'])test(`restore ${mutation} refusal leaves both fresh trees empty`,async t=>{const f=await fixture(t),target=await f.tree('target'),captured={files:[raw('answer','hello')],taskFiles:[raw('1.json','{}')]},state=retained(captured),files=bytes(captured.files),taskFiles=bytes(captured.taskFiles);if(mutation==='workspace-hash')files[0]=Buffer.from('wrong');if(mutation==='task-hash')taskFiles[0]=Buffer.from('[]');if(mutation==='task-count')taskFiles.pop();await assert.rejects(target.owner.restore({state,files,taskFiles}));assert.deepEqual(await readdir(target.workspace),[]);assert.deepEqual(await readdir(target.taskDirectory),[]);});
test('warm workspace divergence refuses without erasing unjournaled output',async t=>{const f=await fixture(t),target=await f.tree('target');await writeFile(join(target.workspace,'late-output'),'preserve');await assert.rejects(target.owner.restore({state:retained({files:[],taskFiles:[]}),files:[],taskFiles:[]}));assert.equal(await readFile(join(target.workspace,'late-output'),'utf8'),'preserve');});
test('a run that never recorded its cwd retains those bytes beside the workspace, leaves the owned directory empty and keeps its identity',async t=>{
 const f=await fixture(t),target=await f.tree('target'),cleanup={deadlineMs:1500};await mkdir(join(target.workspace,'outputs'));await mkdir(join(target.workspace,'scratch','empty'),{recursive:true});await writeFile(join(target.workspace,'outputs','late-output'),'preserve');
 const before=fs.lstatSync(target.workspace),retainedDirectory=`${target.workspace}.uncommitted`;
 assert.deepEqual(target.owner.retain(cleanup),{retained:true,retainedPath:retainedDirectory});
 assert.deepEqual(await readdir(target.workspace),[],'the next strict restore owns an empty directory, so no stale tree is verified');
 assert.equal(await readFile(join(retainedDirectory,'outputs','late-output'),'utf8'),'preserve','every uncommitted byte is retained, never erased');
 assert.deepEqual(await readdir(join(retainedDirectory,'scratch','empty')),[],'empty directories move with their tree');
 const after=fs.lstatSync(target.workspace);assert.equal(after.dev,before.dev);assert.equal(after.ino,before.ino,'the workspace keeps the directory identity the owned runtime session pinned');
 assert.deepEqual(target.owner.retain(cleanup),{retained:false},'an empty tree creates no second retained directory');
 assert.deepEqual((await readdir(f.root)).filter(name=>name.includes('.uncommitted')),['target-workspace.uncommitted']);
 await writeFile(join(target.workspace,'again'),'second');assert.deepEqual(target.owner.retain(cleanup),{retained:true,retainedPath:`${target.workspace}.uncommitted.1`});
 assert.equal(await readFile(join(retainedDirectory,'outputs','late-output'),'utf8'),'preserve','an earlier retention is never overwritten');
 const source=await f.tree('source');await writeFile(join(source.workspace,'notes.md'),'committed');const captured=source.owner.capture();
 await target.owner.restore({state:retained({files:captured.files,taskFiles:[]}),files:bytes(captured.files),taskFiles:[]});
 assert.equal(await readFile(join(target.workspace,'notes.md'),'utf8'),'committed','the next run restores the durable state into the quiesced tree instead of refusing the stale one');
 assert.deepEqual(await readdir(target.workspace),['notes.md']);
});
test('a cancelled or expired cleanup refuses before creating anything and leaves the uncommitted tree exactly as it found it',async t=>{
 const f=await fixture(t),target=await f.tree('target');await writeFile(join(target.workspace,'pending.txt'),'synthetic');
 const cancelled=new AbortController();cancelled.abort();
 assert.throws(()=>target.owner.retain({signal:cancelled.signal,deadlineMs:1500}),/NATIVE_FILES_REFUSED/,'an already-cancelled cleanup never moves uncommitted bytes');
 assert.throws(()=>target.owner.retain(),/NATIVE_FILES_REFUSED/,'the cleanup deadline is explicit: a caller without one is refused');
 f.clock(1500);assert.throws(()=>target.owner.retain({deadlineMs:1500}),/NATIVE_FILES_REFUSED/,'an expired cleanup deadline refuses before any move');
 assert.deepEqual(await readdir(target.workspace),['pending.txt'],'a refused cleanup leaves the uncommitted tree untouched');
 assert.deepEqual((await readdir(f.root)).filter(name=>name.includes('.uncommitted')),[],'and creates no retained directory');
 f.clock(1000);assert.deepEqual(target.owner.retain({deadlineMs:1500}),{retained:true,retainedPath:`${target.workspace}.uncommitted`},'the same tree is retained once the cleanup is live');
 assert.equal(await readFile(join(target.workspace+'.uncommitted','pending.txt'),'utf8'),'synthetic');
});
test('retention beyond the numbered slots preserves earlier evidence and still empties the workspace',async t=>{
 const f=await fixture(t),target=await f.tree('target');
 for(let n=0;n<1000;n++)await mkdir(target.workspace+'.uncommitted'+(n?'.'+n:''));
 await writeFile(target.workspace+'.uncommitted/earlier.txt','preserved');await writeFile(join(target.workspace,'pending.txt'),'new evidence');
 const result=target.owner.retain({deadlineMs:1500});assert.equal(result.retained,true);assert.ok(result.retainedPath.startsWith(target.workspace+'.uncommitted-'));
 assert.equal(await readFile(join(result.retainedPath,'pending.txt'),'utf8'),'new evidence');
 assert.equal(await readFile(target.workspace+'.uncommitted/earlier.txt','utf8'),'preserved');assert.deepEqual(await readdir(target.workspace),[]);
});
test('warm executable mismatch refuses without changing the file',async t=>{const f=await fixture(t),target=await f.tree('target'),file=join(target.workspace,'answer');await writeFile(file,'retained',{mode:0o600});const captured=target.owner.capture(),state=retained(captured);await chmod(file,0o700);await assert.rejects(target.owner.restore({state,files:bytes(captured.files),taskFiles:[]}),/WORKSPACE_RESTORE_REFUSED/);assert.equal(await readFile(file,'utf8'),'retained');});
test('warm empty manifest refuses an outside directory symlink without following it',async t=>{const f=await fixture(t),target=await f.tree('target'),outside=join(f.root,'outside');await mkdir(outside);await writeFile(join(outside,'secret'),'protected');await symlink(outside,join(target.workspace,'empty'),'dir');await assert.rejects(target.owner.restore({state:retained({files:[],taskFiles:[]}),files:[],taskFiles:[]}),/WORKSPACE_CAPTURE_REFUSED/);assert.equal(await readFile(join(outside,'secret'),'utf8'),'protected');});
test('warm verification refuses a directory changed during observation without erasing the late file',async t=>{const f=await fixture(t),target=await f.tree('target'),empty=join(target.workspace,'empty');await mkdir(empty);const read=fs.readdirSync;let changed=false;fs.readdirSync=(p,...args)=>{const result=read(p,...args);if(p===empty&&!changed){changed=true;fs.writeFileSync(join(empty,'late'),'preserve');}return result;};syncBuiltinESMExports();try{await assert.rejects(target.owner.restore({state:retained({files:[],taskFiles:[]}),files:[],taskFiles:[]}),/WORKSPACE_CAPTURE_REFUSED/);}finally{fs.readdirSync=read;syncBuiltinESMExports();}assert.equal(await readFile(join(empty,'late'),'utf8'),'preserve');});
test('captured task directory rejects a credential filename and hardlink',async t=>{const f=await fixture(t),s=await f.tree('source');await writeFile(join(s.taskDirectory,'credentials.json'),'not-a-task');assert.throws(()=>s.owner.capture(),/NATIVE_FILES_REFUSED/);await unlink(join(s.taskDirectory,'credentials.json'));const external=join(f.root,'outside');await writeFile(external,'protected');await link(external,join(s.taskDirectory,'1.json'));assert.throws(()=>s.owner.capture(),/WORKSPACE_CAPTURE_REFUSED/);assert.equal(await readFile(external,'utf8'),'protected');});
test('capture and restore reject expired or cancelled lifetime; nesting config in cwd refuses',async t=>{const f=await fixture(t),s=await f.tree('source'),a=new AbortController();a.abort();assert.throws(()=>s.owner.capture({signal:a.signal}));await assert.rejects(s.owner.restore({state:retained({files:[],taskFiles:[]}),files:[],taskFiles:[],signal:a.signal}));f.clock(2000);assert.throws(()=>s.owner.capture());assert.throws(()=>createNativeFiles({workspace:s.workspace,sdkConfigDirectory:join(s.workspace,'config'),expiresAtMs:3000}));assert.equal(nativeTaskDirectory(s.sdkConfigDirectory),join(s.sdkConfigDirectory,'tasks','meri'));});
for(const [name,change] of [
 ['traversal',v=>{v.files[0].path='../outside';}],['duplicate alias',v=>{v.files.push({...v.files[0],path:'ANSWER'});}],
 ['task traversal',v=>{v.taskFiles[0].path='../1.json';}],['task executable',v=>{v.taskFiles[0].executable=true;}],
 ['unknown task file',v=>{v.taskFiles[0].path='.credentials.json';}],['base64 mismatch',v=>{v.files[0].base64='!!!!';}],
 ['count across both trees',v=>{v.taskFiles=Array.from({length:256},(_,i)=>raw(`${i+1}.json`,'{}'));}],
 ['file size bound',v=>{v.files[0].bytes=8388609;}]
])test(`native upload rejects ${name} before storage`,()=>{const v={files:[raw('answer','abc')],taskFiles:[raw('1.json','{}')]};change(v);assert.throws(()=>assertNativeFileUpload(v),/NATIVE_FILES_REFUSED/);});
for(const mutate of [v=>{v.tasks[0].object.scopes=[{...scopes[0],tenantId:'foreign'}];},v=>{v.workspace.binding={...binding,actorId:'foreign'};},v=>{v.tasks[0].object.versionId='pending';},v=>{v.workspace.entries[0].path='/absolute';}])test('native stored references reject changed owner, scope or non-durable object',()=>{const state=retained({files:[raw('answer','abc')],taskFiles:[raw('1.json','{}')]});mutate(state);assert.throws(()=>assertNativeFileState(state,{binding,scopes}));});

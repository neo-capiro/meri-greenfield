import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile,stat,readdir,symlink} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {createNativeCheckpointRestorer} from '../native-restorer.mjs';
import {continuationFixture,id,NOW} from '../../../worker/conversation/continuation/test/fixtures.mjs';import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function setup(t,mode='resume'){
 const root=await mkdtemp(join(tmpdir(),'meri-restore-author-'));t.after(()=>rm(root,{recursive:true,force:true}));const workspace=join(root,'workspace');await mkdir(workspace,{mode:0o700});
 const f=continuationFixture(mode),cp=f.continuation.checkpoint,blobs=new Map(),payloads=[Buffer.from('literal workspace bytes\n'),Buffer.from('#!/bin/sh\nexit 0\n')],transcripts=[{entries:[{type:'system',opaque:{future:['retained',null,7]}},{type:'user',uuid:id(80),message:{role:'user',content:'original'}}]},{subpath:'subagents/agent-original',entries:[{type:'assistant',opaque:true}]}];
 const ref=(bytes,n)=>{const r={objectId:id(n),versionId:'immutable-source-v1',sha256:sha(bytes),bytes:bytes.length,scopes:cp.scopes};blobs.set(r.objectId,bytes);return r;};
 cp.workspace.entries=payloads.map((bytes,i)=>({path:i===0?'folder/note.txt':'run.sh',kind:'file',object:ref(bytes,81+i),executable:i===1}));cp.workspaceSha256=hash(cp.workspace);cp.opaqueSession=ref(Buffer.from(JSON.stringify(transcripts)),83);f.continuation.checkpointSha256=hash(cp);
 let saved=null,claims=0,effects=0,lost=false,failCommit=false,revalidations=0,revoked=false;
 const journal={async read(){return {record:saved};},async claim(input,check){check();claims++;if(saved)return {record:saved,dispatch:false};saved={...input,state:'CLAIMED',receipt:null};if(lost)throw Error('synthetic-lost-commit-ack');return {record:saved,dispatch:true};},async record(input,check){check();if(failCommit&&input.state==='RESTORED')throw Error('synthetic-lost-restored-ack');saved={...saved,...input};effects++;return {record:saved};}};
 const objects={async get(ref){return Buffer.from(blobs.get(ref.objectId));}},config={journal,objects,workspace,expiresAtMs:NOW+10000,now:()=>NOW},context={...f.target,continuation:f.continuation},input={...context,restoreKey:hash(context),revalidate:async()=>{revalidations++;if(revoked)throw Error('synthetic-revoked');}};
 return {root,workspace,f,cp,blobs,payloads,transcripts,config,input,journal,state:()=>({saved,claims,effects,revalidations}),loseAck:()=>{lost=true;},failCommit:()=>{failCommit=true;},revoke:()=>{revoked=true;}};
}
for(const mode of ['resume','fork'])test(`${mode}: restores actual immutable workspace bytes and exact opaque SDK snapshot; replay has no writes`,async t=>{
 const x=await setup(t,mode),owner=createNativeCheckpointRestorer(x.config),result=await owner.restore(x.input);
 assert.deepEqual(await readFile(join(x.workspace,'folder/note.txt')),x.payloads[0]);assert.deepEqual(await readFile(join(x.workspace,'run.sh')),x.payloads[1]);assert.equal((await stat(join(x.workspace,'run.sh'))).mode&0o111,0o100);
 assert.equal(result.sdkSessionKey.sessionId,mode==='resume'?x.cp.sessionId:x.f.continuation.targetSessionId);assert.equal(x.state().saved.state,'RESTORED');assert.equal(x.state().claims,1);
 const before=await stat(join(x.workspace,'folder/note.txt')),second=await owner.restore(x.input),after=await stat(join(x.workspace,'folder/note.txt'));assert.equal(after.ino,before.ino);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(x.state().claims,1);assert.equal(x.state().effects,1);assert.notEqual(result.restoreReceipt.verificationId,second.restoreReceipt.verificationId);
 const source=await owner.snapshot(x.input);assert.deepEqual(source.transcripts,x.transcripts);assert.equal(source.key.sessionId,x.cp.sessionId,'fork source read retains original session identity');
});
test('lost durable claim acknowledgement never writes bytes or dispatches on replay',async t=>{
 const x=await setup(t);x.loseAck();const owner=createNativeCheckpointRestorer(x.config);await assert.rejects(owner.restore(x.input));assert.deepEqual(await readdir(x.workspace),[]);assert.equal(x.state().saved.state,'CLAIMED');await assert.rejects(owner.restore(x.input));assert.equal(x.state().claims,1);
});
test('uncertain restored acknowledgement leaves UNKNOWN and cannot retry original writes',async t=>{
 const x=await setup(t);x.failCommit();const owner=createNativeCheckpointRestorer(x.config);await assert.rejects(owner.restore(x.input));assert.equal(x.state().saved.state,'UNKNOWN');const before=await stat(join(x.workspace,'run.sh'));await assert.rejects(owner.restore(x.input));assert.equal((await stat(join(x.workspace,'run.sh'))).ino,before.ino);assert.equal(x.state().claims,1);
});
test('corrupted immutable object refuses before durable claim or filesystem effect',async t=>{
 const x=await setup(t);x.blobs.set(x.cp.workspace.entries[0].object.objectId,Buffer.from('changed'));await assert.rejects(createNativeCheckpointRestorer(x.config).restore(x.input));assert.equal(x.state().claims,0);assert.deepEqual(await readdir(x.workspace),[]);
});
test('native-file bundle is never interpreted as a SessionStore snapshot',async t=>{
 const x=await setup(t),bytes=Buffer.from(JSON.stringify({format:'meri-native-session-files-v1',files:[]}));x.blobs.set(x.cp.opaqueSession.objectId,bytes);Object.assign(x.cp.opaqueSession,{sha256:sha(bytes),bytes:bytes.length});x.f.continuation.checkpointSha256=hash(x.cp);x.input.restoreKey=hash({...x.f.target,continuation:x.f.continuation});await assert.rejects(createNativeCheckpointRestorer(x.config).restore(x.input));assert.equal(x.state().claims,0);assert.deepEqual(await readdir(x.workspace),[]);
});
test('admission revoked after object reads refuses before workspace effects',async t=>{
 const x=await setup(t),get=x.config.objects.get;x.config.objects.get=async ref=>{const result=await get(ref);x.revoke();return result;};await assert.rejects(createNativeCheckpointRestorer(x.config).restore(x.input));assert.equal(x.state().claims,0);assert.deepEqual(await readdir(x.workspace),[]);
});
test('replay detects modified workspace and additional directory without rewriting them',async t=>{
 const x=await setup(t),owner=createNativeCheckpointRestorer(x.config);await owner.restore(x.input);await writeFile(join(x.workspace,'folder/note.txt'),'changed');await assert.rejects(owner.restore(x.input));assert.equal(await readFile(join(x.workspace,'folder/note.txt'),'utf8'),'changed');assert.equal(x.state().claims,1);
});
test('snapshot read detects actual workspace byte changes without rewriting caller changes',async t=>{
 const x=await setup(t),owner=createNativeCheckpointRestorer(x.config);await owner.restore(x.input);await writeFile(join(x.workspace,'folder/note.txt'),'changed before snapshot');await assert.rejects(owner.snapshot(x.input));assert.equal(await readFile(join(x.workspace,'folder/note.txt'),'utf8'),'changed before snapshot');assert.equal(x.state().saved.state,'RESTORED');assert.equal(x.state().claims,1);assert.equal(x.state().effects,1);
});
test('workspace alias cannot receive restoration and borrowed sibling remains intact',async t=>{
 const x=await setup(t),sibling=join(x.root,'sibling');await mkdir(sibling);await symlink(sibling,join(x.root,'alias'));x.f.continuation.checkpointSha256=hash(x.cp);x.input.restoreKey=hash({...x.f.target,continuation:x.f.continuation});await assert.rejects(createNativeCheckpointRestorer({...x.config,workspace:join(x.root,'alias')}).restore(x.input));assert.deepEqual(await readdir(sibling),[]);assert.equal(x.state().saved.state,'UNKNOWN');
});

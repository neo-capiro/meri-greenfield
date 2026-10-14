import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {createNativeCheckpointRestorer} from '../../../../../apps/runtime/native-authority/native-restorer.mjs';
import {continuationFixture,id,NOW} from '../../../../../apps/worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'meri-independent-bootstrap-'));t.after(()=>rm(root,{recursive:true,force:true}));const workspace=join(root,'workspace');await mkdir(workspace,{mode:0o700});
 const f=continuationFixture('fork'),cp=f.continuation.checkpoint,blobs=new Map(),original=Buffer.from('original immutable checkpoint bytes\n');
 const object=(bytes,n)=>{const ref={objectId:id(n),versionId:'independent-v1',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,scopes:cp.scopes};blobs.set(ref.objectId,bytes);return ref;};
 cp.workspace.entries=[{path:'checkpoint.txt',kind:'file',object:object(original,800),executable:false}];cp.workspaceSha256=hash(cp.workspace);cp.opaqueSession=object(Buffer.from(JSON.stringify([{entries:[{type:'system',opaque:{future:[null,42,'preserved']}}]}])),801);f.continuation.checkpointSha256=hash(cp);
 let record=null,claims=0;const journal={async read(){return {record:structuredClone(record)};},async claim(intent){claims++;assert.equal(record,null);record={...intent,state:'CLAIMED',receipt:null};return {record:structuredClone(record),dispatch:true};},async record(value){record={...record,...value};return {record:structuredClone(record)};}};
 const context={...f.target,continuation:f.continuation},input={...context,restoreKey:hash(context),async revalidate(){}},owner=createNativeCheckpointRestorer({journal,objects:{async get(ref){return Buffer.from(blobs.get(ref.objectId));}},workspace,expiresAtMs:NOW+5000,now:()=>NOW});
 return {workspace,original,blobs,cp,input,owner,claims:()=>claims};
}
test('snapshot bootstrap rechecks restored workspace and never accepts tampering or rewrites it',async t=>{const f=await fixture(t);await f.owner.restore(f.input);await writeFile(join(f.workspace,'checkpoint.txt'),'tampered after receipt');await assert.rejects(f.owner.snapshot(f.input));assert.equal(await readFile(join(f.workspace,'checkpoint.txt'),'utf8'),'tampered after receipt');assert.equal(f.claims(),1);});
test('durable restored state cannot promote changed opaque source bytes into SDK snapshot',async t=>{const f=await fixture(t);await f.owner.restore(f.input);f.blobs.set(f.cp.opaqueSession.objectId,Buffer.from('changed'));await assert.rejects(f.owner.snapshot(f.input));assert.deepEqual(await readFile(join(f.workspace,'checkpoint.txt')),f.original);assert.equal(f.claims(),1);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createNativeCheckpointRestorer} from '../native-restorer.mjs';
import {createNativeContinuationRuntime} from '../continuation-runtime.mjs';
import {buildNextTurnOptions} from '../../../worker/conversation/continuation/next-turn-options.mjs';
import {buildContinuationOptions} from '../../../worker/conversation/continuation/options.mjs';
import {continuationFixture,id,NOW} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,mode='resume'){
 const workspace=await mkdtemp(join(tmpdir(),'meri-next-turn-'));t.after(()=>rm(workspace,{recursive:true,force:true}));
 const f=continuationFixture(mode),target=f.target,cp=f.continuation.checkpoint;
 target.request.prompt='A different second prompt, using the restored first-turn report';
 const bytes=Buffer.from('First prompt produced these exact report bytes.\n'),transcripts=[{entries:[{type:'user',uuid:id(80),message:{role:'user',content:target.sourceRequest.prompt}},{type:'assistant',opaque:{retained:true}}]}],objects=new Map();
 const ref=(bytes,n)=>{const r={objectId:id(n),versionId:'immutable-v1',sha256:sha(bytes),bytes:bytes.length,scopes:cp.scopes};objects.set(r.objectId,bytes);return r;};
 cp.workspace.entries=[{path:'report.txt',kind:'file',object:ref(bytes,81),executable:false}];cp.workspaceSha256=hash(cp.workspace);cp.opaqueSession=ref(Buffer.from(JSON.stringify(transcripts)),82);f.continuation.checkpointSha256=hash(cp);
 const nextTurn={checkpoint:cp,checkpointSha256:hash(cp),sourceRequestSha256:hash(target.sourceRequest),contextSha256:f.contextSha256,sourceRequest:target.sourceRequest,targetBinding:target.binding,resumeSessionAt:id(80)};
 let record=null,claims=0,writes=0,failCommit=false,ambiguous=false,onWrite=()=>{};
 // Same canonical claim/read/record fixture interface as native-restorer controls.
 const journal={async read(){return {record};},async claim(input,check){check();claims++;if(record)return {record,dispatch:false};record={...input,state:'CLAIMED',receipt:null};return {record,dispatch:true};},async record(input,check){check();if(failCommit&&input.state==='RESTORED')throw Error('lost restored COMMIT acknowledgement');record={...record,...input};return {record};}};
 const run={binding:target.binding,versions:target.versions,scopes:target.scopes,state:'queued'},authority={scopes:target.scopes,selectedClientId:target.scopes[0].resourceId,policyRevision:target.scopes[0].policyRevision};
 // Exercise configured physical owner with genuine temp-file writes on Windows,
 // without claiming POSIX mode/symlink controls or PostgreSQL durability.
 const receipt=input=>({binding:input.binding,restoreKey:input.restoreKey,workspaceSha256:input.workspaceSha256,checkedAtMs:NOW,expiresAtMs:NOW+5000});
 const workspaceOwner={async restore(input){assert.deepEqual(await readdir(workspace),[]);for(let i=0;i<input.manifest.entries.length;i++){const entry=input.manifest.entries[i],file=input.files[i];assert.equal(entry.path,'report.txt');await writeFile(join(workspace,entry.path),Buffer.from(file.base64,'base64'),{flag:'wx'});writes++;}onWrite();return receipt(input);},async verify(input){assert.deepEqual(await readdir(workspace),['report.txt']);assert.deepEqual(await readFile(join(workspace,'report.txt')),bytes);return receipt(input);}};
 const restorer=createNativeCheckpointRestorer({journal,objects:{async get(ref){return Buffer.from(objects.get(ref.objectId));}},workspace:'/workspace/conversation',workspaceOwner,expiresAtMs:NOW+5000,now:()=>NOW});
 const store={async read(){return {run,request:target.request};},lifecycle:{async execution(){return ambiguous?{continuation:f.continuation,sourceRequest:target.sourceRequest}:null;}},nextRuns:{async execution(input,check){check();assert.deepEqual(input,{binding:target.binding,scopes:authority.scopes,selectedClientId:authority.selectedClientId});return {nextTurn};}}};
 const verifier={async verify({binding,operation,inputSha256}){return {binding,operation,inputSha256,identityCredential:'synthetic',...authority,authorizationDecisionId:'synthetic',checkedAtMs:NOW,expiresAtMs:NOW+10000};}};
 const runtime=createNativeContinuationRuntime({store,verifier,taskCapability:'synthetic-task',restorer,now:()=>NOW});
 return {f,target,nextTurn,workspace,bytes,transcripts,runtime,restorer,run,authority,input:{...target,nextTurn},state:()=>({record,claims,writes}),failCommit:()=>{failCommit=true;},ambiguous:()=>{ambiguous=true;},onWrite:fn=>{onWrite=fn;}};
}
test('two different prompts restore actual first-turn workspace bytes and exact SDK snapshot; replay does not rewrite',async t=>{
 const x=await fixture(t);assert.notEqual(x.target.request.prompt,x.target.sourceRequest.prompt);
 assert.deepEqual(buildNextTurnOptions(x.nextTurn,x.target),{resume:x.nextTurn.checkpoint.sessionId,resumeSessionAt:id(80)});
 assert.throws(()=>buildContinuationOptions(x.f.continuation,x.target),/CONTINUATION_PIN_REFUSED/,'lifecycle still requires identical prompts');
 const restored=await x.runtime.prepare(x.input);assert.equal(restored.sdkSessionKey.sessionId,x.nextTurn.checkpoint.sessionId);assert.deepEqual(await readFile(join(x.workspace,'report.txt')),x.bytes);
 const snapshot=await x.runtime.readSnapshot({credential:'synthetic-task',request:{binding:x.target.binding}});assert.deepEqual(snapshot.transcripts,x.transcripts);assert.equal(snapshot.transcripts[0].entries[0].message.content,x.target.sourceRequest.prompt);
 const before=await stat(join(x.workspace,'report.txt'));await x.runtime.prepare(x.input);assert.equal((await stat(join(x.workspace,'report.txt'))).mtimeMs,before.mtimeMs);assert.equal(x.state().writes,1);assert.equal(x.state().claims,1);
});
for(const field of ['targetBinding','sourceRequestSha256','contextSha256','checkpointSha256','resumeSessionAt'])test(`next-turn ${field} substitution refuses before any physical effect`,async t=>{
 const x=await fixture(t),input=structuredClone(x.input);input.nextTurn[field]=field==='targetBinding'?{...input.nextTurn.targetBinding,workerId:id(99)}:field==='resumeSessionAt'?'invalid':'f'.repeat(64);
 await assert.rejects(x.runtime.prepare(input));assert.equal(x.state().writes,0);assert.equal(x.state().claims,0);
});
for(const mutation of ['identity','conversation','request-id','context','version','scope','source-prompt'])test(`canonical next-turn ${mutation} drift refuses`,async t=>{
 const x=await fixture(t);if(mutation==='identity')x.nextTurn.targetBinding.actorId='other';if(mutation==='conversation')x.nextTurn.targetBinding.conversationId=id(99);
 if(mutation==='request-id')x.target.request.requestId=x.target.sourceRequest.requestId;if(mutation==='context')x.target.request.skill=null;if(mutation==='version')x.target.versions.sdk='0.0.0';if(mutation==='scope')x.authority.scopes=[];if(mutation==='source-prompt')x.nextTurn.sourceRequest.prompt='rewritten source';
 await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().writes,0);
});
test('lifecycle and next-turn lineage cannot coexist',async t=>{const x=await fixture(t);x.ambiguous();await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().writes,0);});
for(const change of ['cancel','selected-client','policy'])test(`authority ${change} change after physical restore becomes UNKNOWN and cannot redispatch`,async t=>{
 const x=await fixture(t);x.onWrite(()=>{if(change==='cancel')x.run.state='cancelled';if(change==='selected-client')x.authority.selectedClientId=id(99);if(change==='policy')x.authority.policyRevision='revised';});
 await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().record.state,'UNKNOWN');await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().writes,1);assert.equal(x.state().claims,1);
});
test('uncertain completion of physical restore remains UNKNOWN and cannot repeat byte writes',async t=>{const x=await fixture(t);x.failCommit();await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().record.state,'UNKNOWN');await assert.rejects(x.runtime.prepare(x.input));assert.equal(x.state().writes,1);assert.equal(x.state().claims,1);});
test('direct physical owner rejects both lineage kinds even with matching restoreKey',async t=>{const x=await fixture(t),context={...x.target,nextTurn:x.nextTurn,continuation:x.f.continuation};await assert.rejects(x.restorer.restore({...context,restoreKey:hash(context),revalidate:async()=>{}}));assert.equal(x.state().writes,0);});

for(const mode of ['resume','fork'])test(`shared physical restorer preserves lifecycle ${mode} session identity and actual bytes`,async t=>{const x=await fixture(t,mode);x.target.request.prompt=x.target.sourceRequest.prompt;const context={...x.target,continuation:x.f.continuation},input={...context,restoreKey:hash(context),revalidate:async()=>{}};const restored=await x.restorer.restore(input);assert.equal(restored.sdkSessionKey.sessionId,mode==='fork'?x.f.continuation.targetSessionId:x.nextTurn.checkpoint.sessionId);assert.deepEqual(await readFile(join(x.workspace,'report.txt')),x.bytes);assert.deepEqual((await x.restorer.snapshot(input)).transcripts,x.transcripts);assert.equal(x.state().writes,1);});

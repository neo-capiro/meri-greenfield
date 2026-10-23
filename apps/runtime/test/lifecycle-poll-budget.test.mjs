// A remote runner's durable control poll crosses control's full task authorization (several authority verifies, live
// ~1s each), so one runner/next-controls exchange can take longer than the native client's 3s default. Live 2026-10-20 08:26Z
// the first poll after the SDK's init message hit that default and failed the run at activity-stream (LIFECYCLE_EXECUTION_UNKNOWN).
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {compileNativeTaskPlan} from '../native-authority/task-allocator.mjs';
import {continuationFixture} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
const origin='https://native.synthetic.invalid',credential='synthetic-task-capability',pollMs=3200;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
const lifecycleOperations=['runner/next-controls','runner/claim-control','runner/ack-control','runner/record-checkpoint'];

test('lifecycle control exchanges accept the lease-bounded session allowance; without it the 3s default still applies',async()=>{
 let at=Date.now();const start=at,client=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:131072},credential,fetch:async()=>{at=start+3500;return Response.json({ok:true});},now:()=>at});
 for(const operation of lifecycleOperations){
  at=start;assert.deepEqual(await client.call(operation,{},{maxRequestMs:23000,deadlineMs:start+23000}),{ok:true});
  at=start;await assert.rejects(client.call(operation,{}),/DEADLINE/);
 }
});

// The runner's SDK directories must be uid-owned 0700 directories, so the composed runner only runs on POSIX.
test('a durable control poll slower than the 3s native default keeps the session allowance and the run completes',{skip:process.platform==='win32',timeout:20000},async()=>{
 const f=continuationFixture('resume'),{target}=f;target.sourceRequest.skill=null;
 const binding=f.binding,request=target.sourceRequest,sessionId=f.continuation.checkpoint.sessionId,state={polls:[],completions:0,accounting:0};
 const saved={run:{binding,versions:target.versions,scopes:target.scopes,state:'queued',createdAt:new Date().toISOString(),policyRevision:target.scopes[0].policyRevision},request,model:{...SDK_MODEL_CONFIGURATION,maxTurns:2,maxCostMicroUSD:2000000}};
 const parent=await mkdtemp(join(tmpdir(),'meri-lifecycle-poll-'));await chmod(parent,0o700);
 const runtime={binding,versions:target.versions,deadlineMs:Date.now()+60000,maxOutputBytes:1024};
 const preparationIntent={workspace:join(parent,'workspaces',binding.conversationId),configParentDirectory:parent,secureStorageDirectory:join(parent,'secure'),
  imageSha256:target.versions.imageDigest.slice(7),runnerSha256:'c'.repeat(64),authoritySha256:'e'.repeat(64)};
 const {original}=compileNativeTaskPlan({runtime:{...runtime,deadlineMs:Date.now()+900000},plan:{},preparationIntent}),answered=Promise.withResolvers();
 const operations={
  'runner/load':()=>saved,'runner/publish':input=>{if(input.event?.data?.state==='completed')state.completions++;return {};},'runner/runtime':()=>runtime,
  'runner/record-usage':()=>{state.accounting++;return {status:'unavailable',reason:'missing-result-usage',replayed:false};},
  async 'runner/next-controls'(input,signal){const started=Date.now();await delay(pollMs,signal);state.polls.push(Date.now()-started);answered.resolve();return {controls:[],nextControlSequence:input.after??0};}};
 const fetchImpl=async(url,init)=>{const operation=url.slice((origin+'/v1/').length),handler=operations[operation];if(!handler)throw Error('unexpected '+operation);return Response.json(await handler(JSON.parse(init.body),init.signal));};
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:4194304},credential,fetch:fetchImpl,loadMaxRequestMs:23000});
 const execute=assembleConversationRunner({configuration:{binding,versions:target.versions,workspace:preparationIntent.workspace,
  limits:{requestMs:25000,shutdownMs:10000},remoteTask:{original,preparationIntent}},native,credentialForBinding:async()=>'synthetic-current-task-capability',
  query(args){return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:sessionId};await args.prompt[Symbol.asyncIterator]().next();await answered.promise;yield {type:'result',subtype:'success',is_error:false};},async interrupt(){return {still_queued:[]};},close(){}};}});
 try{
  assert.deepEqual(await execute({binding}),{state:'completed'});
  assert.ok(state.polls[0]>=pollMs-50,'the first control poll was answered after more than 3s');assert.equal(state.completions,1);assert.equal(state.accounting,1);
 }finally{await rm(parent,{recursive:true,force:true});}
});

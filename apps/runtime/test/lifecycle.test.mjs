import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {withRunnerDiagnostics} from '../runner-runtime-diagnostics.mjs';
import {withoutDetail} from './runner-diagnostic-lines.mjs';
import {continuationFixture,id} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
/** `controlDelayMs` routes every call through the real native capability client and makes control spend that long on the first
 * `slowCalls` calls of `slowOperation` (default: every next-controls); `product` adds the product runner's remote task: its lease-derived startup budget (requestMs 25000, a 900 s
 * original) and an admitted preparation intent whose private SDK directories live under a temporary root (POSIX only). */
function fixture({action='steer',mode,captureRefused=false,restoreChanged=false,controlDelayMs,slowOperation='runner/next-controls',slowCalls=Infinity,product=false}={}){
 const f=continuationFixture(mode??'resume'),{target}=f;target.sourceRequest.skill=null;target.request.skill=null;f.continuation.contextSha256=canonicalSha256({window:null,skill:null,scopes:target.scopes});f.continuation.sourceRequestSha256=canonicalSha256(target.sourceRequest);
 const binding=mode?target.binding:f.binding,request=mode?target.request:target.sourceRequest,sessionId=mode==='fork'?f.continuation.targetSessionId:f.continuation.checkpoint.sessionId;
 const saved={run:{binding,versions:target.versions,scopes:target.scopes,state:'queued',createdAt:new Date().toISOString(),policyRevision:target.scopes[0].policyRevision},request,...(mode?{continuation:f.continuation,sourceRequest:target.sourceRequest}:{})};
 const command={controlId:id(101),action,binding,contextSha256:f.continuation.contextSha256,...(action==='steer'?{prompt:'Literal steering /text @file'}:{})},entry={controlSequence:1,commandSha256:canonicalSha256(command),command};
 const state={calls:0,closes:0,interrupts:0,acks:[],records:0,runtime:null,wire:[]},stop=Promise.withResolvers();let emitted=false;
 const native={async call(operation,input){state.wire.push(input);assert.equal(Object.hasOwn(input,'credential'),false);assert.equal(canonicalSha256(input.binding),canonicalSha256(binding));
  if(operation==='runner/load')return saved;if(operation==='runner/publish')return {};
  if(operation==='runner/runtime'){state.runtime=input;const r={binding,versions:target.versions,proxyUrl:'https://proxy.example.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:Date.now()+(controlDelayMs===undefined?2000:60000),maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:1024};if(mode){r.restoreReceipt={verificationId:id(104),binding,checkpointId:f.continuation.checkpoint.checkpointId,checkpointSha256:f.continuation.checkpointSha256,workspaceSha256:f.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,scopes:target.scopes,contextSha256:f.continuation.contextSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+1500};if(restoreChanged)r.restoreReceipt.contextSha256='e'.repeat(64);}return r;}
  // A read never consumes: a PENDING control is returned until it is claimed, as in the control journal.
  if(operation==='runner/next-controls'){const controls=emitted||mode?[]:[entry];return {controls,nextControlSequence:controls.length?1:input.after??0};}
  if(operation==='runner/claim-control'){emitted=true;return {claimed:true,control:entry};}if(operation==='runner/ack-control'){state.acks.push(input.input);return {};}
  if(operation==='runner/checkpoint/capture'||operation==='runner/checkpoint/complete'){if(operation==='runner/checkpoint/complete')state.completions=(state.completions??0)+1;if(captureRefused)throw Error('native capture unavailable');const cp=structuredClone(f.continuation.checkpoint);cp.binding=binding;cp.workspace.binding=binding;cp.workspaceSha256=canonicalSha256(cp.workspace);cp.sessionId=sessionId;return {checkpoint:cp,checkpointSha256:canonicalSha256(cp),sourceRequestSha256:canonicalSha256(request),contextSha256:f.continuation.contextSha256,sessionId,resumeSessionAt:null,verificationId:id(103),workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+1500};}
  if(operation==='runner/record-checkpoint'){state.records++;return {controlId:command.controlId,intent:'pause',sourceBinding:binding,inputSha256:entry.commandSha256,state:'APPLIED',checkpointId:input.input.checkpointId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};}throw Error('unexpected '+operation);
 }};
 const client=controlDelayMs===undefined?native:createNativeCapabilityClient({configuration:{origin:'https://native.example.invalid',maxResponseBytes:131072},credential:'synthetic-runner-capability',
  fetch:async(url,init)=>{const operation=new URL(url).pathname.slice('/v1/'.length);if(operation===slowOperation&&slowCalls-->0)await new Promise(resolve=>setTimeout(resolve,controlDelayMs));
   return Response.json(await native.call(operation,JSON.parse(init.body)));}});
 const root=product?mkdtempSync(join(tmpdir(),'meri-lifecycle-product-')):null;if(root)mkdirSync(join(root,'config'),{mode:0o700});
 const remoteTask=product?{original:{binding,versions:target.versions,executionKey:canonicalSha256(binding),executionId:canonicalSha256(binding),planSha256:'b'.repeat(64),expiresAtMs:Date.now()+900000},
  preparationIntent:{workspace:join(root,binding.conversationId),configParentDirectory:join(root,'config'),secureStorageDirectory:join(root,'secure'),
   launchTemplate:{command:'/opt/claude',args:[],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:join(root,'secure')}},executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),
   runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'f'.repeat(64)}}:undefined;
 const execute=assembleConversationRunner({configuration:{binding,versions:target.versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid',
  ...(product?{limits:{requestMs:25000,shutdownMs:1000},remoteTask}:{})},native:client,credentialForBinding:async()=> 'synthetic-current-task-capability',query(args){state.calls++;state.options=args.options;return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:sessionId};const iterator=args.prompt[Symbol.asyncIterator]();await iterator.next();if(!mode&&action==='steer'){const message=(await iterator.next()).value;yield message;}if(!mode&&action==='pause'){await stop.promise;return;}yield {type:'result',subtype:'success',is_error:false};},async interrupt(){state.interrupts++;return {still_queued:[]};},close(){state.closes++;stop.resolve();}};}});
 return {execute,state,binding,saved,command,cleanup:()=>{if(root)rmSync(root,{recursive:true,force:true});}};
}
test('runner lifecycle reuses canonical claim/UUID echo ACK over fixed task-capability facade',async()=>{const f=fixture();assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});assert.equal(f.state.calls,1);assert.equal(f.state.closes,1);assert.equal(f.state.completions,1);assert.deepEqual(f.state.acks,[{controlId:f.command.controlId,commandSha256:canonicalSha256(f.command),outcome:'APPLIED',sdkUserMessageId:f.command.controlId}]);});
test('native checkpoint readback permits ordinary pause and source capture refusal never reports paused',async()=>{const f=fixture({action:'pause'});assert.deepEqual(await f.execute({binding:f.binding}),{state:'paused'});assert.equal(f.state.records,1);assert.equal(f.state.completions,undefined);assert.equal(f.state.interrupts,1);const denied=fixture({action:'pause',captureRefused:true});await assert.rejects(denied.execute({binding:denied.binding}));assert.equal(denied.state.records,0);assert.equal(denied.state.acks[0].outcome,'UNKNOWN');});
for(const mode of ['resume','fork'])test(`runner ${mode} forwards exact retained context and supported SDK restoration options`,async()=>{const f=fixture({mode});assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});assert.equal(canonicalSha256(f.state.runtime.continuation),canonicalSha256(f.saved.continuation));assert.equal(canonicalSha256(f.state.runtime.sourceRequest),canonicalSha256(f.saved.sourceRequest));assert.equal(canonicalSha256(f.state.runtime.scopes),canonicalSha256(f.saved.run.scopes));assert.equal(f.state.options.resume,f.saved.continuation.checkpoint.sessionId);assert.equal(f.state.options.forkSession,mode==='fork'?true:undefined);});
test('runner native restore substitution refuses the single SDK query',async()=>{const f=fixture({mode:'resume',restoreChanged:true});await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.calls,0);});

// Live 20 October (06:37Z, 08:26Z, 10:26Z): the first control poll after system/init outlived its allowance (the 3 s default, then
// the 23 s session allowance), and the lifecycle pump turned that DEADLINE into LIFECYCLE_EXECUTION_UNKNOWN at activity-stream.
// A control-page read that did not answer now counts as no controls; claims, acks and checkpoints stay fatal.
const diagnosed=async f=>{const lines=[];const outcome=await withRunnerDiagnostics(()=>f.execute({binding:f.binding}),{write:line=>lines.push(line)}).then(value=>({value}),error=>({error}));return {lines,...outcome};};
test('a control poll slower than the native client default counts as no controls, and the next poll applies the steer',async()=>{
 const f=fixture({controlDelayMs:3200,slowCalls:1}),{lines,value}=await diagnosed(f);
 assert.deepEqual(value,{state:'completed'});assert.deepEqual(lines,[]);
 assert.deepEqual(f.state.acks,[{controlId:f.command.controlId,commandSha256:canonicalSha256(f.command),outcome:'APPLIED',sdkUserMessageId:f.command.controlId}]);
});
test('a control claim slower than the native client default still fails the run at activity-stream with its cause',async()=>{
 const f=fixture({controlDelayMs:3200,slowOperation:'runner/claim-control'}),{lines,error}=await diagnosed(f);
 assert.equal(error?.code,'EXECUTION_FAILED');
 assert.equal(withoutDetail(lines[0]),'RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=LIFECYCLE_EXECUTION_UNKNOWN class=ERROR exit=none signal=none\n');
 assert.match(lines[0],/ cause=DEADLINE msg=a6073a611574 site=activity-lifecycle\.mjs:\d+:\d+/u);
 assert.deepEqual(f.state.acks,[]);
});
test('the product runner gives lifecycle control calls the session allowance, so the same slow control poll completes',{skip:process.platform==='win32'&&'POSIX ownership of the SDK directories'},async t=>{
 const f=fixture({controlDelayMs:3200,product:true});t.after(f.cleanup);const {lines,value}=await diagnosed(f);
 assert.deepEqual(value,{state:'completed'});assert.deepEqual(lines,[]);
 assert.deepEqual(f.state.acks,[{controlId:f.command.controlId,commandSha256:canonicalSha256(f.command),outcome:'APPLIED',sdkUserMessageId:f.command.controlId}]);
 assert.equal(f.state.completions,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {continuationFixture,id} from '../continuation/test/fixtures.mjs';
import {LIFECYCLE_READ_BACKOFF_MS,LIFECYCLE_READ_UNAVAILABLE_LIMIT,lifecycleReadBackoffMs} from '../continuation/activity-lifecycle.mjs';
const success={type:'result',subtype:'success',is_error:false};
function fixture({action='steer',mode,echo=true,claim=true,corrupt,echoChange,entryChange,park=false,runtimeMs=1500}={}) {
 const f=continuationFixture(mode??'resume'),{target}=f;
 target.sourceRequest.skill=null;target.request.skill=null;
 const contextSha256=canonicalSha256({window:null,skill:null,scopes:target.scopes});
 f.continuation.contextSha256=contextSha256;f.continuation.sourceRequestSha256=canonicalSha256(target.sourceRequest);
 const binding=mode?target.binding:f.binding,request=mode?target.request:target.sourceRequest,sessionId=mode==='fork'?f.continuation.targetSessionId:f.continuation.checkpoint.sessionId;
 const saved={run:{binding,versions:target.versions,scopes:target.scopes,state:'queued',createdAt:new Date().toISOString(),policyRevision:target.scopes[0].policyRevision},request,
  ...(mode?{continuation:f.continuation,sourceRequest:target.sourceRequest}:{})};
 const command={controlId:id(101),action,binding,contextSha256,...(action==='steer'?{prompt:'Literal /command @file text'}:action==='waitForApproval'?{proposalId:id(102),proposalSha256:'d'.repeat(64)}:{})};
 const entry={controlSequence:1,commandSha256:canonicalSha256(command),command};if(entryChange)entryChange(entry);
 const state={calls:0,closed:0,interrupts:0,acks:[],events:[],messages:[],claims:0,records:0};let emitted=false;const stop=Promise.withResolvers(),started=Promise.withResolvers();
 const runOwner={async load(){return saved;},async append({event}){state.events.push(event);},
  async nextControls(){await started.promise;if(emitted)return [];emitted=true;return mode?[]:[entry];},
  async claimControl(){state.claims++;return claim?{claimed:true,control:entry}:{claimed:false,receipt:{state:'UNKNOWN'}};},
  async ackControl({input}){state.acks.push(input);},async recordCheckpoint({input}){state.records++;return {controlId:command.controlId,intent:action==='pause'?'pause':'approval.wait',sourceBinding:binding,inputSha256:entry.commandSha256,state:'APPLIED',checkpointId:input.checkpointId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};}};
 const captureCheckpoint=async()=>{const cp=structuredClone(f.continuation.checkpoint);cp.binding=binding;cp.workspace.binding=binding;cp.workspaceSha256=canonicalSha256(cp.workspace);cp.sessionId=sessionId;
  const r={checkpoint:cp,checkpointSha256:canonicalSha256(cp),sourceRequestSha256:canonicalSha256(request),contextSha256,sessionId,resumeSessionAt:null,verificationId:id(103),workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000};if(corrupt)corrupt(r,'capture');return r;};
 const prepareRuntime=async args=>{state.prepare=args;const runtime={binding,versions:target.versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+runtimeMs,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024};
  if(mode){runtime.restoreReceipt={verificationId:id(104),binding,checkpointId:f.continuation.checkpoint.checkpointId,checkpointSha256:f.continuation.checkpointSha256,workspaceSha256:f.continuation.checkpoint.workspaceSha256,opaqueSessionSha256:f.continuation.checkpoint.opaqueSession.sha256,scopes:target.scopes,contextSha256,sourceRequestSha256:f.continuation.sourceRequestSha256,checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000};if(corrupt)corrupt(runtime.restoreReceipt,'restore');}return runtime;};
 const query=args=>{state.calls++;state.options=args.options;return {async *[Symbol.asyncIterator](){
  yield {type:'system',subtype:'init',session_id:sessionId};const iter=args.prompt[Symbol.asyncIterator]();state.messages.push((await iter.next()).value);started.resolve();
  if(!mode&&claim&&action==='steer'){state.messages.push((await iter.next()).value);if(echo){const m=structuredClone(state.messages[1]);if(echoChange)echoChange(m);yield m;}}
  if(!mode&&action!=='steer'){await stop.promise;return;}
  yield success;if(park)await new Promise(()=>{});
 },async interrupt(){state.interrupts++;return {still_queued:[]};},close(){state.closed++;stop.resolve();}};};
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner,prepareRuntime,query,lifecycle:{...{pollMs:100},captureCheckpoint,pollMs:5}});
 return {state,execute,binding,entry,saved,runOwner,captureCheckpoint,prepareRuntime,query,sessionId};
}
test('actual activity streams literal composed UUID inputs, claims once, observes exact echo and closes terminal input',async()=>{const f=fixture({park:true});assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});assert.equal(f.state.calls,1);assert.equal(f.state.closed,1);assert.equal(f.state.claims,1);assert.equal(f.state.messages[0].uuid,f.saved.request.requestId);assert.equal(f.state.messages[1].client_composed,true);assert.equal(f.state.messages[1].message.content,f.entry.command.prompt);assert.deepEqual(f.state.acks,[{controlId:f.entry.command.controlId,commandSha256:f.entry.commandSha256,outcome:'APPLIED',sdkUserMessageId:f.entry.command.controlId}]);});
test('terminal result never acknowledges an unobserved steering UUID and never repeats UNKNOWN delivery',async()=>{const f=fixture({echo:false});await f.execute({binding:f.binding});assert.deepEqual(f.state.acks,[{controlId:f.entry.command.controlId,commandSha256:f.entry.commandSha256,outcome:'UNKNOWN'}]);assert.equal(f.state.claims,1);});
test('durable claimed-false barrier prevents SDK control input',async()=>{const f=fixture({claim:false});await f.execute({binding:f.binding});assert.equal(f.state.messages.length,1);assert.deepEqual(f.state.acks,[]);});
for(const action of ['pause','waitForApproval'])test(`${action}: SDK interrupt/close followed by trusted checkpoint record holds run without terminal event`,async()=>{const f=fixture({action});assert.deepEqual(await f.execute({binding:f.binding}),{state:action==='pause'?'paused':'waiting-for-approval'});assert.equal(f.state.interrupts,1);assert.equal(f.state.closed,1);assert.equal(f.state.records,1);assert.deepEqual(f.state.acks,[]);assert.deepEqual(f.state.events.filter(e=>e.type==='run.status').map(e=>e.data.state),['starting','running']);});
for(const mode of ['resume','fork'])test(`${mode}: actual activity passes pinned native restore before one supported SDK query`,async()=>{const f=fixture({mode});await f.execute({binding:f.binding});assert.equal(f.state.prepare.continuation.mode,mode);assert.equal(f.state.options.resume,f.saved.continuation.checkpoint.sessionId);assert.equal(f.state.options.forkSession,mode==='fork'?true:undefined);assert.equal(f.state.options.sessionId,mode==='fork'?f.saved.continuation.targetSessionId:undefined);assert.deepEqual(f.state.options.settingSources,[]);assert.deepEqual(f.state.options.tools,[]);assert.equal(f.state.options.permissionMode,'default');assert.equal(f.state.closed,1);});
for(const key of ['checkpointSha256','workspaceSha256','opaqueSessionSha256','contextSha256','sourceRequestSha256','binding','scopes','checkedAtMs','expiresAtMs'])test(`native restore ${key} substitution refuses before SDK`,async()=>{const f=fixture({mode:'resume',corrupt(r,stage){if(stage!=='restore')return;r[key]=key==='binding'?{...r.binding,workerId:id(200)}:key==='scopes'?[]:key==='checkedAtMs'?0:key==='expiresAtMs'?0:'e'.repeat(64);}});await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.calls,0);});
for(const key of ['checkpointSha256','workspaceReadbackSha256','opaqueSessionReadbackSha256','sourceRequestSha256','contextSha256','sessionId','checkedAtMs','expiresAtMs'])test(`native capture ${key} substitution refuses checkpoint ACK, retains UNKNOWN and fails the hold explicitly`,async()=>{const f=fixture({action:'pause',corrupt(r,stage){if(stage!=='capture')return;r[key]=key==='checkedAtMs'||key==='expiresAtMs'?0:key==='sessionId'?id(200):'e'.repeat(64);}});await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.records,0);assert.equal(f.state.acks[0].outcome,'UNKNOWN');assert.deepEqual(f.state.events.filter(e=>['completed','failed'].includes(e.data.state)).map(e=>e.data),[{state:'failed',reasonCode:'HOLD_CHECKPOINT_FAILED'}]);});
test('invalid lifecycle ports fail before invoking SDK',()=>{const f=fixture();assert.throws(()=>createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:{load:f.runOwner.load,append:f.runOwner.append},prepareRuntime:f.prepareRuntime,query:f.query,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint}}));assert.equal(f.state.calls,0);});
for(const [name,change] of Object.entries({uuid:m=>m.uuid=id(300),replay:m=>m.isReplay=true,subagent:m=>m.parent_tool_use_id='tool_child'}))test(`SDK ${name} echo cannot acknowledge this dispatched control`,async()=>{const f=fixture({echoChange:change});await f.execute({binding:f.binding});assert.equal(f.state.acks.length,1);assert.equal(f.state.acks[0].outcome,'UNKNOWN');});
for(const [name,change] of Object.entries({text:m=>m.message.content='Changed',session:m=>m.session_id=id(300)}))test(`SDK ${name} echo substitution refuses APPLIED`,async()=>{const f=fixture({echoChange:change});await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.acks[0].outcome,'UNKNOWN');assert.equal(f.state.closed,1);});
for(const [name,change] of Object.entries({hash:e=>e.commandSha256='e'.repeat(64),binding:e=>{e.command.binding={...e.command.binding,attemptId:id(300)};e.commandSha256=canonicalSha256(e.command);},context:e=>{e.command.contextSha256='e'.repeat(64);e.commandSha256=canonicalSha256(e.command);},sequence:e=>e.controlSequence=0}))test(`journal ${name} substitution refuses before claim/delivery`,async()=>{const f=fixture({entryChange:change});await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.claims,0);assert.equal(f.state.messages.length,1);assert.equal(f.state.closed,1);});
test('parked current-authority control read is bounded and closes the single owned query on cancellation',async()=>{const f=fixture();f.runOwner.nextControls=()=>new Promise(()=>{});const abort=new AbortController();setTimeout(()=>abort.abort(),15);await assert.rejects(f.execute({binding:f.binding,signal:abort.signal}),/EXECUTION_STOPPED/);assert.equal(f.state.calls,1);assert.equal(f.state.closed,1);assert.equal(f.state.claims,0);});
test('checkpoint persistence refusal never claims a paused run and fails the hold explicitly',async()=>{const f=fixture({action:'pause'});f.runOwner.recordCheckpoint=async()=>{throw Error('synthetic current authority refusal');};await assert.rejects(f.execute({binding:f.binding}));assert.equal(f.state.acks[0].outcome,'UNKNOWN');assert.equal(f.state.events.some(e=>e.data.state==='completed'),false);assert.deepEqual(f.state.events.at(-1).data,{state:'failed',reasonCode:'HOLD_CHECKPOINT_FAILED'});});

test('SDK failure before init closes promptly without waiting for an unused control reader',async()=>{
 const f=fixture(),started=Date.now();let closed=0;
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint},query(){return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'mirror_error',error:'synthetic'};},close(){closed++;}};}});
 await assert.rejects(execute({binding:f.binding}),/EXECUTION_FAILED/);assert.equal(closed,1);assert(Date.now()-started<500);assert.equal(f.state.claims,0);
});

test('a display publication refused by a hold the reader has not yet seen is fenced, claimed once and settled through the checkpoint',async()=>{
 const f=fixture({action:'pause'});let hold=false,emitted=false,refused=0,claims=0;const stop=Promise.withResolvers(),claim=f.runOwner.claimControl;
 // The remote runner maps every native refusal to NATIVE_UNAVAILABLE, so the fence cannot depend on a RUN_HELD code.
 f.runOwner.nextControls=async()=>{if(!hold||emitted)return [];emitted=true;return [f.entry];};
 f.runOwner.claimControl=async args=>{claims++;return claim(args);};
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){hold=true;refused++;throw Object.assign(Error('NATIVE_UNAVAILABLE'),{code:'NATIVE_UNAVAILABLE'});}f.state.events.push(event);};
 const text=(id,t)=>({type:'assistant',parent_tool_use_id:null,message:{id,content:[{type:'text',text:t},{type:'text',text:t+' again'}]}});
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},query(){return {async *[Symbol.asyncIterator](){
  yield {type:'system',subtype:'init',session_id:f.sessionId};yield text('m1','refused');yield text('m2','suppressed');await stop.promise;},async interrupt(){f.state.interrupts++;return {still_queued:[]};},close(){f.state.closed++;stop.resolve();}};}});
 assert.deepEqual(await execute({binding:f.binding}),{state:'paused'});
 assert.equal(refused,1,'no further display publication after the first refusal');assert.equal(claims,1);assert.equal(f.state.records,1);assert.equal(f.state.interrupts,1);
 assert.deepEqual(f.state.events.map(e=>e.data.state),['starting','running']);
});

// A control-page read that did not answer (control's ~80 serial Core rechecks outlasting the read allowance) is "no controls this
// tick"; only that read is skippable.
const unanswered=code=>Object.assign(Error(code),{code});
for(const code of ['DEADLINE','NATIVE_UNAVAILABLE'])test(`a control read that ended ${code} counts as no controls, and a later read still claims and applies the steer`,async()=>{
 const f=fixture({park:true}),read=f.runOwner.nextControls;let reads=0;
 f.runOwner.nextControls=async args=>{if(++reads===1)throw unanswered(code);return read(args);};
 assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});
 assert(reads>=2);assert.equal(f.state.claims,1);assert.equal(f.state.messages[1].message.content,'Literal /command @file text');
 assert.deepEqual(f.state.acks.map(a=>a.outcome),['APPLIED']);
});
test('control not answering in time is never fatal by count; reads back off 0.5, 1, 2 s and the steer still applies',async()=>{
 const f=fixture({park:true,runtimeMs:10000}),read=f.runOwner.nextControls,at=[];
 f.runOwner.nextControls=async args=>{at.push(Date.now());if(at.length<=3)throw unanswered('DEADLINE');return read(args);};
 assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});
 const gaps=at.slice(1,4).map((t,i)=>t-at[i]);
 for(const [i,gap] of gaps.entries())assert(gap>=lifecycleReadBackoffMs(i+1)-20&&gap<lifecycleReadBackoffMs(i+1)+400,JSON.stringify(gaps));
 assert.equal(f.state.claims,1);
});
test('NATIVE_UNAVAILABLE reads are skipped at most twice in a row, so a refusal still ends the run on the third',async()=>{
 const f=fixture({runtimeMs:10000});let reads=0;
 f.runOwner.nextControls=async()=>{reads++;throw unanswered('NATIVE_UNAVAILABLE');};
 await assert.rejects(f.execute({binding:f.binding}));
 assert.equal(reads,LIFECYCLE_READ_UNAVAILABLE_LIMIT+1);assert.equal(f.state.claims,0);
 assert.equal(f.state.events.some(e=>e.data?.state==='completed'),false);
});
test('the read backoff is capped and never grows past five seconds',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(lifecycleReadBackoffMs),[500,1000,2000,4000,5000,5000]);
 for(let missed=1;missed<=10000;missed++)assert(lifecycleReadBackoffMs(missed)<=LIFECYCLE_READ_BACKOFF_MS.max);
});
for(const [name,port] of [['claim','claimControl'],['ack','ackControl']])test(`a ${name} that does not answer stays fatal`,async()=>{
 const f=fixture({park:true});f.runOwner[port]=async()=>{throw unanswered('DEADLINE');};
 await assert.rejects(f.execute({binding:f.binding}));
 assert.equal(f.state.events.some(e=>e.data?.state==='completed'),false);
});
test('a fenced read that does not answer stays fatal: a refused publication must find its hold',async()=>{
 const f=fixture({action:'pause'});let hold=false,claims=0;const stop=Promise.withResolvers();
 f.runOwner.nextControls=async()=>{if(hold)throw unanswered('DEADLINE');return [];};
 f.runOwner.claimControl=async()=>{claims++;throw Error('no claim expected');};
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){hold=true;throw unanswered('NATIVE_UNAVAILABLE');}f.state.events.push(event);};
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},query(){return {async *[Symbol.asyncIterator](){
  yield {type:'system',subtype:'init',session_id:f.sessionId};yield {type:'assistant',parent_tool_use_id:null,message:{id:'m1',content:[{type:'text',text:'refused'}]}};await stop.promise;},async interrupt(){return {still_queued:[]};},close(){stop.resolve();}};}});
 await assert.rejects(execute({binding:f.binding}));
 assert.equal(claims,0);assert.equal(f.state.records,0);
});

// Delta coalescing (activity.mjs foldDeltas): the SDK is read ahead while a publication is in flight, so these pin that a refusal,
// a hold and a lifecycle failure still end all display output, and that nothing is read past the result, exactly as when every
// delta was its own publication.
const streamed=(f,count,stop)=>({async *[Symbol.asyncIterator](){
 yield {type:'system',subtype:'init',session_id:f.sessionId};
 yield {type:'stream_event',parent_tool_use_id:null,event:{type:'message_start',message:{id:'m1'}}};
 yield {type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_start',index:0,content_block:{type:'text',text:''}}};
 for(let i=0;i<count;i++)yield {type:'stream_event',parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:`w${i} `}}};
 await stop.promise;},async interrupt(){f.state.interrupts++;return {still_queued:[]};},close(){f.state.closed++;stop.resolve();}});
test('a refused publication of streamed deltas fences: the deltas read ahead are never published and the hold settles',async()=>{
 const f=fixture({action:'pause'});let hold=false,emitted=false,refused=0;const stop=Promise.withResolvers();
 f.runOwner.nextControls=async()=>{if(!hold||emitted)return [];emitted=true;return [f.entry];};
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){hold=true;refused++;throw unanswered('NATIVE_UNAVAILABLE');}f.state.events.push(event);};
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},query:()=>streamed(f,20,stop)});
 assert.deepEqual(await execute({binding:f.binding}),{state:'paused'});
 assert.equal(refused,1,'one refused publication, then nothing');assert.equal(f.state.claims,1);assert.equal(f.state.records,1);
 assert.deepEqual(f.state.events.map(e=>e.data.state),['starting','running']);
});
test('a hold claimed while a delta publication is in flight ends display output: nothing read ahead is folded or published',async()=>{
 const f=fixture({action:'pause'});let gate=false,emitted=false;const stop=Promise.withResolvers(),published=[];
 f.runOwner.nextControls=async()=>{if(!gate||emitted)return [];emitted=true;return [f.entry];};
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){published.push(event.data.text);
   if(published.length===1){gate=true;while(f.state.claims===0)await new Promise(resolve=>setTimeout(resolve,5));await new Promise(resolve=>setTimeout(resolve,20));}}
  f.state.events.push(event);};
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},query:()=>streamed(f,20,stop)});
 assert.deepEqual(await execute({binding:f.binding}),{state:'paused'});
 assert.deepEqual(published,['w0 '],'only the publication in flight when the hold was claimed');assert.equal(f.state.records,1);
});
test('a lifecycle failure while a delta publication is in flight ends the run: nothing read meanwhile is published',async()=>{
 const f=fixture({action:'pause'});let gate=false,refused=false;const stop=Promise.withResolvers(),published=[];
 f.runOwner.nextControls=async()=>{if(!gate)return [];refused=true;return {page:'refused'};};
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){published.push(event.data.text);
   if(published.length===1){gate=true;while(!refused)await new Promise(resolve=>setTimeout(resolve,5));await new Promise(resolve=>setTimeout(resolve,20));}}
  f.state.events.push(event);};
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},query:()=>streamed(f,20,stop)});
 await assert.rejects(execute({binding:f.binding}),/EXECUTION_FAILED/);
 assert.deepEqual(published,['w0 '],'only the publication in flight when the control reader failed');assert.equal(f.state.events.at(-1).data.state,'failed');
});
test('with a lifecycle the SDK is never read past the result, though it arrived while a publication was in flight',async()=>{
 const f=fixture({action:'pause'});let reads=0;const published=[];
 f.runOwner.nextControls=async()=>[];
 f.runOwner.append=async({event})=>{if(event.type==='message.delta'){published.push(event.data.text);await new Promise(resolve=>setTimeout(resolve,30));}f.state.events.push(event);};
 const event=e=>({type:'stream_event',parent_tool_use_id:null,event:e}),text=t=>event({type:'content_block_delta',index:0,delta:{type:'text_delta',text:t}});
 const frames=[{type:'system',subtype:'init',session_id:f.sessionId},event({type:'message_start',message:{id:'m1'}}),event({type:'content_block_start',index:0,content_block:{type:'text',text:''}}),
  ...['w0 ','w1 ','w2 '].map(text),event({type:'content_block_stop',index:0}),{type:'assistant',parent_tool_use_id:null,message:{id:'m1',content:[{type:'text',text:'w0 w1 w2 '}]}},success];
 // After its result the SDK waits for input that never comes, as it does while the input is kept open.
 const sdk=(async function*(){yield* frames;await new Promise(()=>{});})();
 const execute=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner:f.runOwner,prepareRuntime:f.prepareRuntime,lifecycle:{...{pollMs:100},captureCheckpoint:f.captureCheckpoint,pollMs:5},
  query:()=>({[Symbol.asyncIterator]:()=>({next:()=>{reads++;return sdk.next();}}),async interrupt(){return {still_queued:[]};},close(){}})});
 assert.deepEqual(await execute({binding:f.binding}),{state:'completed'});
 assert.deepEqual(published,['w0 ','w1 w2 ']);assert.equal(reads,frames.length,'one read per message and none past the result');
});

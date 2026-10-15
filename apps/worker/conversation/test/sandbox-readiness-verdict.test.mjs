/** Readiness verdict over every observed SDK frame (dot P2a-R1): scripted query ports drive each ordering of
 * initialisation, result frames, iterator failures and the deliberate shutdown. No SDK process and no model request;
 * synthetic control-flow evidence only, not sandbox qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {checkSandboxReadiness,toBashSandboxAttestation} from '../sandbox-readiness/readiness.mjs';
const SANDBOX_UNAVAILABLE='Sandbox required but unavailable: sandbox is enabled but could not start';
const errorResult={type:'result',subtype:'error_during_execution',is_error:true,num_turns:0,total_cost_usd:0,errors:[SANDBOX_UNAVAILABLE]};
const successUsage={type:'result',subtype:'success',is_error:false,num_turns:1,total_cost_usd:0.01,result:'x'};
const abortError=()=>Object.assign(Error('aborted'),{name:'AbortError'});
/** Scripted SDK query.
 * - `order`: 'init-first' resolves initialisation before any frame is yielded; 'frames-first' yields every frame and
 *   only then resolves initialisation (or leaves it pending when `init` is 'hang').
 * - `init`: 'resolve' | 'reject' | 'hang'.
 * - `after`: what the iterator does once its frames are out: 'wait' (until close), or 'end' / 'throw' a few ms later.
 * - `onClose`: how a waiting iterator reacts to close(): 'end', 'abort' (AbortError), 'throw', 'hang' or a frame list
 *   yielded during the shutdown before ending. `closeThrows` makes close() itself throw. */
function scripted({order='init-first',init='resolve',frames=[],after='wait',onClose='end',closeThrows=false}={},seen){
 return args=>{seen.args=args;let wake;const closed=new Promise(r=>{wake=r;});let initDone;const initialised=new Promise(r=>{initDone=r;});
  (async()=>{for await(const m of args.prompt)seen.userMessages=(seen.userMessages??0)+1;})();
  const initialization=init==='hang'?new Promise(()=>{}):init==='reject'?initialised.then(()=>Promise.reject(Error(`Claude Code returned an error result: ${SANDBOX_UNAVAILABLE}`))):initialised.then(()=>({}));
  if(order==='init-first')initDone();
  return {initializationResult:()=>initialization,
   close(){seen.closed=(seen.closed??0)+1;wake();if(closeThrows)throw Error('close failed');},
   async *[Symbol.asyncIterator](){
    if(order==='init-first')await initialization.catch(()=>{});
    for(const f of frames){await null;yield f;}
    if(order==='frames-first'){initDone();await null;}
    if(after!=='wait')await new Promise(r=>setTimeout(r,5)); // inside the quiet window, after initialisation was observed
    if(after==='end')return;if(after==='throw')throw Error('stream broke after initialisation');
    await closed;
    if(onClose==='abort')throw abortError();if(onClose==='throw')throw Error('unexpected failure while closing');if(onClose==='hang')await new Promise(()=>{});
    if(Array.isArray(onClose))for(const f of onClose)yield f;}};};
}
function ports(script={},{removeFails=false}={}){
 const seen={dirs:[],removed:[]};
 return {seen,ports:{findExecutable:name=>`/usr/bin/${name}`,runProbe:async()=>true,exists:()=>false,
  makeTempDir:label=>{const d=`/tmp/readiness/${label}-${seen.dirs.length}`;seen.dirs.push(d);return d;},removeDir:d=>{if(removeFails)throw Error('EBUSY');seen.removed.push(d);},
  query:typeof script==='function'?script:scripted(script,seen),sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin'}};
}
const run=(p)=>checkSandboxReadiness(p,{deadlineMs:500,observeMs:20,cleanupMs:200});
/** Every negative: not ready, no available attestation even with the outer boundary asserted, no user message, closed and cleaned. */
async function refuses(script,expected,{removeFails=false}={}){
 const {ports:p,seen}=ports(script,{removeFails});const r=await run(p);
 assert.equal(r.ready,false,JSON.stringify(r.sdkStartup));assert.notEqual(r.sdkStartup.status,'ready');
 for(const [k,v] of Object.entries(expected))assert.deepEqual(r.sdkStartup[k],v,`${k}: ${JSON.stringify(r.sdkStartup)}`);
 for(const outerIsolationBoundary of [false,true])assert.equal(toBashSandboxAttestation(r,{outerIsolationBoundary}).available,false);
 assert.equal(seen.userMessages,undefined);assert.equal(r.sdkStartup.userMessagesSent,0);
 if(typeof script!=='function')assert.equal(seen.closed,1,'the query is closed exactly once');
 if(!removeFails)assert.deepEqual(seen.removed.sort(),seen.dirs.sort());
 return r;
}

test('positive control: a clean initialised stream with no result, closed deliberately, is ready and attests available',async()=>{
 for(const script of [{},{frames:[{type:'system',subtype:'init'}]},{onClose:'abort'}]){
  const {ports:p,seen}=ports(script);const r=await run(p);
  assert.deepEqual(r.sdkStartup,{status:'ready',reasonCode:null,userMessagesSent:0,modelTurns:0,costUsd:0,messagesObserved:script.frames?.length??0,resultsObserved:0,initialized:true,shutdown:'clean'},JSON.stringify(script));
  assert.equal(r.ready,true);assert.equal(toBashSandboxAttestation(r,{outerIsolationBoundary:false}).available,true);assert.equal(seen.closed,1);assert.deepEqual(seen.removed.sort(),seen.dirs.sort());
 }
});

test('reviewer case 1: initialisation then a success result reporting a model turn and cost refuses',async()=>{
 await refuses({frames:[successUsage]},{status:'refused',reasonCode:'READINESS_MODEL_TURN_OBSERVED',modelTurns:1,costUsd:0.01,resultsObserved:1,initialized:true});
});

test('reviewer case 2: initialisation then error_during_execution "Sandbox required but unavailable" refuses',async()=>{
 await refuses({frames:[errorResult]},{status:'refused',reasonCode:'SANDBOX_UNAVAILABLE',modelTurns:0,costUsd:0,resultsObserved:1,initialized:true});
});

test('both race orderings refuse: the result before initialisation and after it',async()=>{
 for(const order of ['frames-first','init-first']){
  await refuses({order,frames:[errorResult]},{reasonCode:'SANDBOX_UNAVAILABLE',resultsObserved:1});
  await refuses({order,frames:[successUsage]},{reasonCode:'READINESS_MODEL_TURN_OBSERVED',modelTurns:1});
  await refuses({order,frames:[{...errorResult,num_turns:0,total_cost_usd:0.5}]},{reasonCode:'READINESS_MODEL_TURN_OBSERVED',costUsd:0.5},'cost on an error result');
 }
 await refuses({order:'frames-first',init:'hang',frames:[errorResult]},{reasonCode:'SANDBOX_UNAVAILABLE',initialized:false});
 await refuses({order:'frames-first',init:'reject',frames:[]},{reasonCode:'SANDBOX_UNAVAILABLE',initialized:false});
});

test('multiple results are all accounted: usage is summed and any error or success result refuses',async()=>{
 await refuses({frames:[errorResult,{...successUsage,num_turns:2,total_cost_usd:0.02}]},{reasonCode:'READINESS_MODEL_TURN_OBSERVED',modelTurns:2,costUsd:0.02,resultsObserved:2});
 await refuses({frames:[{...errorResult,errors:['first']},errorResult]},{reasonCode:'SANDBOX_UNAVAILABLE',resultsObserved:2});
 await refuses({frames:[{...successUsage,num_turns:0,total_cost_usd:0}]},{reasonCode:'SDK_UNEXPECTED_RESULT',resultsObserved:1},'a zero-usage success result still means a turn completed');
});

test('a result or failure observed during the deliberate shutdown still wins over the earlier initialisation',async()=>{
 await refuses({onClose:[errorResult]},{reasonCode:'SANDBOX_UNAVAILABLE',initialized:true,resultsObserved:1});
 await refuses({onClose:[successUsage]},{reasonCode:'READINESS_MODEL_TURN_OBSERVED',initialized:true});
});

test('an iterator failure or an unprompted end after initialisation refuses',async()=>{
 await refuses({after:'throw'},{reasonCode:'SDK_STARTUP_FAILED',initialized:true});
 await refuses({after:'end'},{reasonCode:'SDK_STREAM_ENDED',initialized:true});
 await refuses({order:'frames-first',after:'throw'},{reasonCode:'SDK_STARTUP_FAILED'});
});

test('every frame is validated: model activity, malformed and unexpected frames refuse',async()=>{
 for(const frame of [{type:'assistant',message:{content:[]}},{type:'stream_event',event:{}},{type:'system',subtype:'api_retry'},{type:'rate_limit_event'}])
  await refuses({frames:[frame]},{reasonCode:'READINESS_MODEL_TURN_OBSERVED'});
 for(const frame of [null,'text',[],{subtype:'init'},{...errorResult,num_turns:undefined},{...errorResult,num_turns:-1},{...errorResult,num_turns:0.5},{...successUsage,total_cost_usd:Number.NaN}])
  await refuses({frames:[frame]},{reasonCode:'SDK_FRAME_MALFORMED'});
 for(const frame of [{type:'system',subtype:'session_state_changed',state:'running'},{type:'auth_status'},{type:'novel_frame'}])
  await refuses({frames:[frame]},{reasonCode:'SDK_UNEXPECTED_FRAME'});
});

test('cleanup and shutdown failures are failed shutdowns, never available',async()=>{
 await refuses({closeThrows:true},{status:'refused',reasonCode:'SDK_CLOSE_FAILED',initialized:true,shutdown:'failed'});
 await refuses({onClose:'throw'},{reasonCode:'SDK_SHUTDOWN_FAILED',shutdown:'failed'});
 await refuses({onClose:'hang'},{reasonCode:'SDK_CLEANUP_TIMEOUT',shutdown:'failed'});
 const r=await refuses({},{reasonCode:'READINESS_CLEANUP_FAILED',shutdown:'failed'},{removeFails:true});assert.equal(r.sdkStartup.initialized,true);
 await refuses({init:'hang',onClose:'hang'},{status:'timeout',reasonCode:'SDK_STARTUP_TIMEOUT',shutdown:'failed'});
});

test('a query() that throws is an unexpected startup failure with a report, not an exception',async()=>{
 const r=await refuses(()=>{throw Error('spawn failed: bubblewrap is required');},{reasonCode:'SANDBOX_DEPENDENCIES_MISSING',initialized:false,messagesObserved:0});
 assert.equal(r.sdkStartup.shutdown,'clean');
});

test('the attestation also refuses a report whose ready flag contradicts its startup verdict',async()=>{
 const {ports:p}=ports({frames:[errorResult]});const r=await run(p);
 assert.equal(toBashSandboxAttestation({...r,ready:true},{outerIsolationBoundary:true}).available,false);
 const {ports:q}=ports();const ok=await run(q);
 for(const sdkStartup of [{...ok.sdkStartup,shutdown:'failed'},{...ok.sdkStartup,resultsObserved:1},{...ok.sdkStartup,modelTurns:1},{...ok.sdkStartup,initialized:false}])
  assert.equal(toBashSandboxAttestation({...ok,sdkStartup},{outerIsolationBoundary:true}).available,false,JSON.stringify(sdkStartup));
});

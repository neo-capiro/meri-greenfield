// Budgets of the SDK session mirror and the end-of-turn capture chain (adj-e deadline sweep B2, B3, D1, D2), checked two ways.
// The model below sizes each hop's serial work at E's Core latency profiles from the task verifies it performs. The verify counts
// are pinned by execution in session-owner.test.mjs (2 / 3 / 4) and completion-capture.test.mjs (2f+7 for f workspace files).
// The executed tests drive the real client, control session application, control capture channel and runner capture source
// on mocked timers, so a hop that kept its old allowance fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {continuationFixture,id} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {RUNNER_LOAD_MAX_MS,RUNNER_LOAD_CONTROL_MARGIN_MS,RUNNER_SESSION_RPC_MS,RUNNER_SESSION_STORE_CALL_MS,controlSessionRpcMs,
 CONTROL_CHECKPOINT_CAPTURE_MS,CONTROL_CAPTURE_CHANNEL_MS,TASK_ROUTER_CAPTURE_MS,RUNNER_CAPTURE_MS,runnerStartupBudget} from '../../../../packages/runtime/runner-load-budget.mjs';
import {createNativeSdkSessionClient,createNativeBoundSdkSessionStore} from '../session-client.mjs';
import {createNativeSdkSessionApplication} from '../session-http.mjs';
import {createTaskCheckpointSource} from '../task-checkpoint-source.mjs';
import {fixture as sessionFixture} from './fixture.mjs';

// Core identity / context latency (ms) at E's quiet, median and tail profiles. A task verify is one of each plus four DB reads.
const PROFILES={quiet:{identity:85,context:250},median:{identity:100,context:500},tail:{identity:150,context:750}};
const DB_MS=10,RPC_IO_MS=100,S3_MS=150,ECS_MS=200,TLS_MS=50,LOCAL_MS=300,MARGIN=1.5;
const verifyMs=p=>p.identity+p.context+4*DB_MS;
/** Serial work of each hop at one profile. */
function work(p){
 const v=verifyMs(p),read=2*v+RPC_IO_MS+3*DB_MS,routerHop=3*DB_MS+2*ECS_MS+TLS_MS;
 const session={'list-subkeys':read,load:read,append:3*v+RPC_IO_MS+8*DB_MS,register:4*v+routerHop+RPC_IO_MS+4*DB_MS,snapshot:3*v+S3_MS+9*DB_MS+RPC_IO_MS};
 // Two frozen snapshots of the main transcript (list-subkeys + load each), local process inspects, close and workspace read.
 const runnerCapture=2*(session['list-subkeys']+session.load)+LOCAL_MS,routerCapture=runnerCapture+routerHop,channel=routerCapture+TLS_MS;
 // Control: 2 verifies and the run reads before the capture, then publication (a verify with the run re-read, one per object
 // write, one per object read back, a final verify with the re-read), the journal commit and the release verify. Empty workspace.
 const controlCapture=2*v+8*DB_MS+channel+(4*v+2*8*DB_MS+S3_MS+S3_MS)+5*DB_MS+v;
 return {session,storeCall:session.load+session.append,runnerCapture,routerCapture,channel,controlCapture,complete:controlCapture+RPC_IO_MS};
}

test('every capture-chain hop keeps one control margin above the hop it encloses',()=>{
 assert.equal(CONTROL_CHECKPOINT_CAPTURE_MS,RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS);
 assert.equal(CONTROL_CAPTURE_CHANNEL_MS,CONTROL_CHECKPOINT_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS);
 assert.equal(TASK_ROUTER_CAPTURE_MS,CONTROL_CAPTURE_CHANNEL_MS-RUNNER_LOAD_CONTROL_MARGIN_MS);
 assert.equal(RUNNER_CAPTURE_MS,TASK_ROUTER_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS);
 for(const operation of Object.keys(RUNNER_SESSION_RPC_MS))assert.equal(controlSessionRpcMs(operation),RUNNER_SESSION_RPC_MS[operation]-RUNNER_LOAD_CONTROL_MARGIN_MS);
 // A capture's session reads fit inside the runner capture, and one bound-store call (load, then append) inside its timer.
 assert.ok(RUNNER_SESSION_RPC_MS.load+RUNNER_LOAD_CONTROL_MARGIN_MS<=RUNNER_CAPTURE_MS);
 assert.equal(RUNNER_SESSION_STORE_CALL_MS,RUNNER_SESSION_RPC_MS.load+RUNNER_SESSION_RPC_MS.append+RUNNER_LOAD_CONTROL_MARGIN_MS);
});

for(const [name,profile] of Object.entries(PROFILES))test(`${name} profile: session RPCs (B3), a bound-store call (D1) and the continuation snapshot (D2) keep a ${MARGIN}x margin`,()=>{
 const w=work(profile),local=runnerStartupBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs:Date.now()+900000}).stages.local.maxMs;
 for(const [operation,ms] of Object.entries(w.session))assert.ok(controlSessionRpcMs(operation)>=MARGIN*ms,`${operation}: ${controlSessionRpcMs(operation)} ms for ${ms} ms`);
 assert.ok(RUNNER_SESSION_STORE_CALL_MS>=MARGIN*w.storeCall,`store call: ${RUNNER_SESSION_STORE_CALL_MS} ms for ${w.storeCall} ms`);
 assert.ok(local>=RUNNER_SESSION_RPC_MS.snapshot+RUNNER_LOAD_CONTROL_MARGIN_MS&&local>=MARGIN*w.session.snapshot,`local stage: ${local} ms`);
});

for(const [name,profile] of Object.entries(PROFILES))test(`${name} profile: the end-of-turn capture chain (B2) fits every hop`,()=>{
 const w=work(profile);
 for(const [budget,ms,label] of [[RUNNER_CAPTURE_MS,w.runnerCapture,'runner capture'],[TASK_ROUTER_CAPTURE_MS,w.routerCapture,'router'],[CONTROL_CAPTURE_CHANNEL_MS,w.channel,'channel']])
  assert.ok(budget>=MARGIN*ms,`${label}: ${budget} ms for ${ms} ms`);
 // Control's capture and the runner's call hold every serial verify of the turn's end. At the tail profile the margin is
 // 1.28x / 1.40x: reaching 1.5x needs a longer checkpoint request than control's 25 s requestMs allows (adj-c C6 report).
 const required=name==='tail'?1.25:MARGIN;
 assert.ok(CONTROL_CHECKPOINT_CAPTURE_MS>=required*w.controlCapture,`control capture: ${CONTROL_CHECKPOINT_CAPTURE_MS} ms for ${w.controlCapture} ms`);
 assert.ok(RUNNER_LOAD_MAX_MS>=required*w.complete,`checkpoint/complete: ${RUNNER_LOAD_MAX_MS} ms for ${w.complete} ms`);
});

const settle=async()=>{for(let i=0;i<50;i++)await new Promise(resolve=>setImmediate(resolve));};

test('a session read slower than the old three-second default completes on its own allowance',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const f=sessionFixture(),app=createNativeSdkSessionApplication({owner:f.owner,maxRequestMs:25000}),delay=RUNNER_SESSION_RPC_MS.load-RUNNER_LOAD_CONTROL_MARGIN_MS;await f.invoke('register');
 const client=createNativeSdkSessionClient({origin:'https://synthetic-native.invalid',credential:'opaque-native-task',binding:f.binding,
  fetchImpl:(url,options)=>new Promise(resolve=>setTimeout(resolve,delay)).then(()=>app.handle(new Request(url,options)))});
 assert.ok(delay>3000);const pending=client.load({key:f.key});await settle();t.mock.timers.tick(delay);
 assert.deepEqual(await pending,{entries:null,offset:0});
});

test('control answers a slow session operation inside the runner allowance instead of leaving the runner to time out',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const f=sessionFixture(),parked=({signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 const app=createNativeSdkSessionApplication({owner:{register:parked,load:parked,append:parked,listSubkeys:parked},maxRequestMs:25000});
 const client=createNativeSdkSessionClient({origin:'https://synthetic-native.invalid',credential:'opaque-native-task',binding:f.binding,fetchImpl:(url,options)=>app.handle(new Request(url,options))});
 const pending=client.load({key:f.key});pending.catch(()=>{});await settle();t.mock.timers.tick(controlSessionRpcMs('load'));
 await assert.rejects(pending,error=>error.code==='SDK_SESSION_UNAVAILABLE'&&error.cause!==undefined);
});

test('a bound-store call slower than the old three-second default completes on its default timer',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const f=sessionFixture(),delay=RUNNER_SESSION_RPC_MS.append-RUNNER_LOAD_CONTROL_MARGIN_MS,entries=[{type:'user',uuid:id(870),text:'mirrored'}];
 const client={async register(){return {registered:true,key:f.key};},async load(){return {entries:null,offset:0};},async listSubkeys(){return {subkeys:[]};},
  append:({expectedOffset,entries:batch})=>new Promise(resolve=>setTimeout(()=>resolve({offset:expectedOffset+batch.length}),delay))};
 const bound=createNativeBoundSdkSessionStore({client,binding:f.binding,sessionKey:f.key});
 assert.ok(delay>3000&&delay<RUNNER_SESSION_STORE_CALL_MS);const pending=bound.store.append(f.key,entries);await settle();t.mock.timers.tick(delay);
 await pending;const status=await bound.settleObservedCalls();assert.equal(status.uncertain,false);assert.equal(status.appendFailures,0);
});

function original(){const {binding,target}=continuationFixture(),executionKey=hash(binding);return {binding,executionKey,executionId:executionKey,planSha256:'a'.repeat(64),expiresAtMs:Date.now()+600000,versions:target.versions};}

test('the runner capture holds two frozen snapshots that together outlast the old eight-second capture',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const o=original(),root=fs.mkdtempSync(join(tmpdir(),'meri-capture-budget-')),workspace=join(root,'workspace');fs.mkdirSync(workspace);fs.writeFileSync(join(workspace,'note.txt'),'captured');
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const key={projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:id(862)},transcripts=[{entries:[{type:'system',opaque:{state:'retained'}},{type:'user',uuid:id(863),message:{content:'first prompt'}}]}];
 const snapshotMs=RUNNER_SESSION_RPC_MS.load,{executionKey,...nativeOriginal}=o;let stopped=false;
 const source=createTaskCheckpointSource({original:o,workspace,closeQuery(){},
  session:{async settle(){},async close(){},snapshot:()=>new Promise(resolve=>setTimeout(()=>resolve({key,transcripts}),snapshotMs))},
  native:{async inspect(){return {...nativeOriginal,taskId:'scripted-native',state:stopped?'stopped':'executing',physicalStopProven:stopped};},async close(){stopped=true;}}});
 assert.ok(2*snapshotMs>8000);const pending=source.capture({binding:o.binding,controlId:id(864),sessionId:key.sessionId});
 for(let i=0;i<2;i++){await settle();t.mock.timers.tick(snapshotMs);}
 const captured=await pending;assert.equal(captured.key.sessionId,key.sessionId);assert.equal(source.status().state,'captured');
});

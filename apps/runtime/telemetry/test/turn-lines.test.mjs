import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnLineEmitter,LINE_SCHEMAS,timeoutClass} from '../turn-lines.mjs';
const runId='11111111-1111-4111-8111-111111111111',attemptId='22222222-2222-4222-8222-222222222222';
const poisons=['tenant-secret','actor-secret','bearer-secret','grant-secret','arn:aws:ecs:us-east-1:123:task/secret',
 '192.0.2.99','https://example.invalid/path?id=secret','private error message','SELECT secret FROM secrets'];
const fields={runId,attemptId,conversationId:runId,requestId:'a'.repeat(32),stage:'run.terminal',state:'failed',reasonCode:'DEADLINE',
 t0Ms:100,stages:{'send.admit.received':100,'run.terminal':150},firstTextMs:null,resultMs:50,deltaPublications:0,timeoutClass:'deadline',
 core:{identity:{'2xx':1}},coreMs:2,clerkReadsEstimate:1,aws:{DescribeTasks:{success:2}},awsMs:3,db:{statements:1,ms:4},
 runOwner:{'runner/load':{'2xx':1}},runOwnerMs:3,origin:'runtime',code:'DEADLINE',class:'ERROR',exit:'none',signal:'none',cause:'none',
 msgHash:'012345abcdef',outcome:'completed',refusal:{gate:'pair',step:'anything-private',code:'DEADLINE'},bootstrapMs:2,bedrockHeadersMs:3,
 firstChunkMs:4,streamEndMs:5,settleMs:6,ownerExchanges:{operation:{OPEN:1}},ownerExchangeMs:2,inputTokens:3,outputTokens:4,
 component:'pair',transition:'quarantined',reason:'PRODUCT_MODEL_ACCOUNTING_QUARANTINED',windowMs:60000,telemetryDropped:0,statusClass:'503',count:1,attribution:'turn'};

for(const event of Object.keys(LINE_SCHEMAS))test(`${event}: explicit schema and poison pin`,()=>{
 const output=[],emitter=createTurnLineEmitter({service:event==='meri.model.request'?'proxy':'control',write:line=>output.push(line),now:()=>123});
 const input={...fields,tenantId:poisons[0],actorId:poisons[1],bearer:poisons[2],authorization:poisons[2],grantId:poisons[3],taskArn:poisons[4],ip:poisons[5],url:poisons[6],error:poisons[7],sql:poisons[8],
  core:{...fields.core,[poisons[0]]:{[poisons[1]]:3},identity:{'2xx':1,[poisons[2]]:3}},db:{statements:1,ms:4,sql:poisons[8]},
  aws:{...fields.aws,[poisons[3]]:{success:2}},stages:{...fields.stages,[poisons[6]]:123}};
 input.toJSON=()=>{throw Error('never serialize source');};
 Object.defineProperty(input,'unknownGetter',{get(){throw Error('never read unknown fields');}});
 assert.equal(emitter.emit(event,input),true);assert.equal(output.length,1);
 for(const poison of poisons)assert.equal(output[0].includes(poison),false,poison);
 const line=JSON.parse(output[0]);assert.equal(line.schema,'meri.telemetry/1');assert.equal(line.event,event);assert.equal(line.runId??runId,runId);
 assert.equal(line._aws.Timestamp,123);assert.ok(Buffer.byteLength(output[0])<=8192);
 for(const group of line._aws.CloudWatchMetrics){assert.equal(group.Namespace,'Meri/Preview');for(const dimensions of group.Dimensions)assert.ok(dimensions.every(d=>!['runId','attemptId','tenantId','conversationId'].includes(d)));}
});

test('ids, codes and nested scalar fields reject arbitrary content',()=>{
 const output=[],emitter=createTurnLineEmitter({service:'runner',write:line=>output.push(line)});
 emitter.emit('meri.turn.failure',{runId:'tenant-secret',attemptId:'not-uuid',code:'PRIVATE_SECRET',class:'a\nline',stage:'unexpected',msgHash:'not a hash',cause:'bearer-secret'});
 const line=JSON.parse(output[0]);assert.equal(line.runId,'invalid');assert.equal(line.attemptId,'invalid');assert.equal(line.code,'other');assert.equal(line.class,'other');assert.equal(line.stage,'other');assert.equal(line.msgHash,'none');
});

test('metric names and dimensions have aggregate and component series without identity dimensions',()=>{
 const output=[],emitter=createTurnLineEmitter({service:'owner',environment:'Production',write:line=>output.push(JSON.parse(line))});
 emitter.emit('meri.health',{component:'pair',transition:'quarantined',code:'PRODUCT_OWNER_UNAVAILABLE'});
 assert.deepEqual(output[0]._aws.CloudWatchMetrics[0].Dimensions,[['Service'],['Service','Component']]);
 emitter.emit('meri.core.counters',{statusClass:'503',count:3,attribution:'background'});
 assert.deepEqual(output[1]._aws.CloudWatchMetrics[0].Dimensions,[['Service','StatusClass'],['Service','StatusClass','Attribution']]);
 assert.equal(output[1].CoreCalls,3);assert.equal(output[1]._aws.CloudWatchMetrics[0].Namespace,'Meri/Production');
});

test('unknown events and failed writes are swallowed and counted',async()=>{
 const emitter=createTurnLineEmitter({service:'control',write(){throw Error('writer');}});
 assert.equal(emitter.emit('meri.turn.stage',{runId,attemptId}),false);assert.equal(emitter.emit('unknown',{}),false);assert.equal(emitter.dropped,2);
 assert.equal(emitter.takeDropped(),2);assert.equal(emitter.dropped,0);
 const asyncEmitter=createTurnLineEmitter({service:'control',write:()=>Promise.reject(Error('async writer'))});
 asyncEmitter.emit('meri.health',{});await Promise.resolve();assert.equal(asyncEmitter.dropped,1);
});

test('every timeout class mapping is explicit',()=>{
 for(const code of ['DEADLINE','RUNTIME_STARTUP_TIMEOUT','RUNTIME_SHUTDOWN_TIMEOUT','PRODUCT_OWNER_STARTUP_TIMEOUT'])assert.equal(timeoutClass(code),'deadline',code);
 for(const code of ['PINNED_NATIVE_TIMEOUT','REMOTE_RUNNER_CLEANUP_UNKNOWN','SDK_CLEANUP_UNKNOWN'])assert.equal(timeoutClass(code),'transport-timeout',code);
 for(const code of ['NATIVE_UNAVAILABLE','PINNED_NATIVE_STATUS_503','503',503,'timeout','unanswered'])assert.equal(timeoutClass(code),'upstream-unavailable',String(code));
 for(const code of ['EXECUTION_FAILED',undefined,'secret'])assert.equal(timeoutClass(code),'none');
});

test('runner timeout signal catches detailed cause hidden by generic terminal reason',()=>{
 const lines=[],emitter=createTurnLineEmitter({service:'runner',write:line=>lines.push(JSON.parse(line))});
 emitter.emit('meri.turn.failure',{runId,attemptId,stage:'activity-query',code:'DEADLINE',timeoutClass:'deadline'});
 emitter.emit('meri.turn.failure',{runId,attemptId,stage:'activity-query',code:'EXECUTION_FAILED',timeoutClass:'none'});
 assert.equal(lines[0].TimeoutFailures,1);assert.equal(lines[0].Service,'runner');
 assert.equal(Object.hasOwn(lines[1],'TimeoutFailures'),false);
 assert.deepEqual(lines[0]._aws.CloudWatchMetrics.find(g=>g.Metrics[0].Name==='TimeoutFailures').Dimensions,[['Service']]);
});

test('durable reconciliation and hold-failure reasons retain canonical constants',()=>{
 const lines=[],emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line))});
 for(const reasonCode of ['ATTEMPT_LOST','HOLD_CHECKPOINT_FAILED'])emitter.emit('meri.turn.summary',{runId,attemptId,state:'failed',reasonCode,timeoutClass:'none'});
 assert.deepEqual(lines.map(line=>line.reasonCode),['ATTEMPT_LOST','HOLD_CHECKPOINT_FAILED']);
});


test('budget table startup schema permits only a lowercase digest and emits no metrics',()=>{
 const output=[],emitter=createTurnLineEmitter({service:'control',write:line=>output.push(JSON.parse(line)),now:()=>123});
 for(const tableSha256 of ['a'.repeat(64),'A'.repeat(64),'private-secret',123,null]){
  emitter.emit('meri.budget.table',{hops:278,tableSha256,values:{secret:123},runId,tenantId:'secret'});
  const line=output.at(-1);assert.equal(line.hops,278);assert.equal(line.tableSha256,tableSha256==='a'.repeat(64)?tableSha256:'invalid');
  assert.equal(line.atMs,123);assert.deepEqual(line._aws.CloudWatchMetrics,[]);
  assert.deepEqual(Object.keys(line).sort(),['schema','event','service','atMs','hops','tableSha256','Service','_aws'].sort());
 }
});

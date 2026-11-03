import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnLineEmitter,LINE_SCHEMAS,timeoutClass,safeText,safeToken} from '../turn-lines.mjs';
const runId='11111111-1111-4111-8111-111111111111',attemptId='22222222-2222-4222-8222-222222222222';
const poisons=['tenant-secret','actor-secret','bearer-secret','grant-secret','arn:aws:ecs:us-east-1:123:task/secret',
 '192.0.2.99','https://example.invalid/path?id=secret','private error message','SELECT secret FROM secrets'];
const fields={runId,attemptId,conversationId:runId,requestId:'a'.repeat(32),stage:'run.terminal',state:'failed',reasonCode:'DEADLINE',
 t0Ms:100,stages:{'send.admit.received':100,'run.terminal':150},firstTextMs:null,resultMs:50,deltaPublications:0,timeoutClass:'deadline',
 core:{identity:{'2xx':1}},coreMs:2,clerkReadsEstimate:1,aws:{DescribeTasks:{success:2}},awsMs:3,db:{statements:1,ms:4},
 runOwner:{'runner/load':{'2xx':1}},runOwnerMs:3,origin:'runtime',code:'DEADLINE',class:'ERROR',exit:'none',signal:'none',cause:'none',
 msgHash:'012345abcdef',outcome:'completed',refusal:{gate:'pair',step:'anything-private',code:'DEADLINE'},bootstrapMs:2,bedrockHeadersMs:3,
 firstChunkMs:4,streamEndMs:5,settleMs:6,ownerExchanges:{operation:{OPEN:1}},ownerExchangeMs:2,inputTokens:3,outputTokens:4,
 component:'pair',transition:'quarantined',reason:'PRODUCT_MODEL_ACCOUNTING_QUARANTINED',windowMs:60000,telemetryDropped:0,statusClass:'503',count:1,attribution:'turn',layer:'control',elapsedMs:8123};

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

test('an intent preparation line keeps plain detail words and an owner constant, never an identifier, host or free text',()=>{
 for(const [value,expected] of [['the proposal request was answered before any proposal was created (HTTP 404)','the proposal request was answered before any proposal was created (HTTP 404)'],["data must have required property 'title'","data must have required property 'title'"],
  ['core.internal.example','none'],['answered by core.internal.example before any proposal','none'],['11111111-1111-4111-8111-111111111111','none'],['run 11111111-1111-4111-8111-111111111111 refused','none'],
  ['0123456789abcdef0123456789abcdef','none'],['x\n','none'],['https://core.invalid/api','none'],['x'.repeat(161),'none'],['',''+'none'],[7,'none']])
  assert.equal(safeText(value),expected,String(value));
 for(const [value,expected] of [['SESSION_UNAVAILABLE','SESSION_UNAVAILABLE'],['ECONNREFUSED','ECONNREFUSED'],['HTTP_404','HTTP_404'],['PREVIEW_ROUTE_NOT_FOUND','PREVIEW_ROUTE_NOT_FOUND'],['session-unavailable','none'],['core.internal.example','none'],['11111111-1111-4111-8111-111111111111','none'],['A','none'],['X'.repeat(64),'none'],[null,'none']])
  assert.equal(safeToken(value),expected,String(value));
 const output=[],emitter=createTurnLineEmitter({service:'control',write:line=>output.push(JSON.parse(line))});
 emitter.emit('meri.intent.prepare',{runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222',layer:'control',code:'REFUSED',dispatched:'owner',elapsedMs:12,detail:'answered by core.internal.example','reason':'core.internal.example'});
 assert.equal(output[0].detail,'none');assert.equal(output[0].reason,'none');assert.equal(output[0].code,'REFUSED');assert.equal(output[0].dispatched,'owner');
 emitter.emit('meri.intent.prepare',{runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222',layer:'control',code:'UNAVAILABLE',dispatched:'before-owner',elapsedMs:3,detail:'the proposal request was not sent',reason:'SESSION_UNAVAILABLE'});
 assert.equal(output[1].detail,'the proposal request was not sent');assert.equal(output[1].reason,'SESSION_UNAVAILABLE');
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

test('a worker refusal line keeps only a closed operation, phase and owner code',()=>{
 const lines=[],emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line))});
 emitter.emit('meri.worker.refusal',{runId,attemptId,operation:'load',stage:'release',code:'RETENTION_READ_UNAVAILABLE'});
 assert.deepEqual({operation:lines[0].operation,stage:lines[0].stage,code:lines[0].code},{operation:'load',stage:'release',code:'RETENTION_READ_UNAVAILABLE'});
 assert.equal(lines[0].runId,runId);
 for(const code of ['WORKER_AUTHORITY_REFUSED','SCOPE_REFUSED','STALE_WRITER','RETENTION_SUPPRESSED','RETENTION_RECOVERY_BARRIER','NOT_FOUND'])
  {emitter.emit('meri.worker.refusal',{operation:'load',stage:'service',code});assert.equal(lines.at(-1).code,code,code);}
 emitter.emit('meri.worker.refusal',{operation:'tenant-secret',stage:'run.terminal',code:'PRIVATE_SECRET'});
 assert.deepEqual({operation:lines.at(-1).operation,stage:lines.at(-1).stage,code:lines.at(-1).code},{operation:'other',stage:'other',code:'other'});
 assert.equal(JSON.stringify(lines.at(-1)).includes('tenant-secret'),false);assert.equal(JSON.stringify(lines.at(-1)).includes('PRIVATE_SECRET'),false);
});

test('pair health uses the fixed P2 vocabulary and never serializes identity pins',()=>{
 const output=[],emitter=createTurnLineEmitter({service:'owner',write:line=>output.push(JSON.parse(line))});
 for(const code of ['PAIR_DRIFT','PAIR_REPROVEN','PAIR_UNAVAILABLE','PAIR_REPROVING']){
  assert.equal(emitter.emit('meri.health',{component:'pair',transition:'reproven',code,taskArn:'secret-pin',ip:'192.0.2.99'}),true);
 }
 assert.deepEqual(output.map(line=>line.code),['PAIR_DRIFT','PAIR_REPROVEN','PAIR_UNAVAILABLE','PAIR_REPROVING']);
 assert.ok(output.every(line=>line.transition==='reproven'&&!JSON.stringify(line).includes('secret-pin')&&!JSON.stringify(line).includes('192.0.2.99')));
});

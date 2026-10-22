import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnTelemetry,currentTurnTelemetry} from '../turn-context.mjs';
import {createTurnPublishObserver} from '../turn-publish.mjs';
const binding={runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333'};
const terminal=(sequence=3)=>({binding,sequence,type:'run.status',data:{state:'completed'}});
function fixture(service='control',options={}){const lines=[];let at=100;const telemetry=createTurnTelemetry({service,write:line=>lines.push(JSON.parse(line)),now:()=>at,...options});return {lines,telemetry,tick:n=>{at=n;}};}

test('nested provisional attribution adopts counts once and terminal waits for final recheck',async()=>{
 const {lines,telemetry,tick}=fixture();
 await telemetry.provisional(async()=>{
  assert.equal(currentTurnTelemetry(),telemetry);telemetry.recordCore('identity','2xx',2);
  await telemetry.provisional(async()=>{telemetry.recordCore('membership','2xx',3);telemetry.bind(binding);telemetry.bind(binding);});
  telemetry.stage(binding,'send.admit.received',100);tick(110);telemetry.summary({binding,sequence:1,type:'message.delta'});
  tick(130);telemetry.summary(terminal());assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,0);
  telemetry.recordCore('context','2xx',4);
 });
 const summary=lines.find(l=>l.event==='meri.turn.summary'),counts=lines.find(l=>l.event==='meri.turn.counters');
 assert.equal(summary.firstTextMs,10);assert.equal(summary.resultMs,30);assert.equal(counts.CoreCalls,3);assert.equal(counts.ClerkReadsEstimate,5);
 assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,1);assert.equal(currentTurnTelemetry(),undefined);
});

test('concurrent outer operations finish before terminal rollup; later work remains background',async()=>{
 const {lines,telemetry}=fixture();let release;const pending=new Promise(resolve=>{release=resolve;});
 const second=telemetry.within(binding,async()=>{await pending;telemetry.recordCore('identity','2xx',1);});
 await telemetry.within(binding,async()=>{telemetry.recordCore('context','2xx',2);telemetry.summary(terminal());});
 assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,0);release();await second;
 assert.equal(lines.find(l=>l.event==='meri.turn.counters').CoreCalls,2);
 await telemetry.within(binding,()=>telemetry.recordCore('identity','2xx',1));telemetry.rollup();
 assert.equal(lines.find(l=>l.event==='meri.process.rollup').CoreCalls,1);
});

test('request buckets drain independently and attach pending run work once',async()=>{
 const {lines,telemetry}=fixture('owner'),one='a'.repeat(32),two='b'.repeat(32);
 telemetry.within(binding,()=>telemetry.recordCore('identity','2xx',1));
 telemetry.withRequest(one,binding,()=>telemetry.recordDb(2));telemetry.withRequest(two,binding,()=>telemetry.recordDb(3));
 const first=telemetry.counters(binding,{requestId:one,reset:true,includeRun:true});
 const second=telemetry.counters(binding,{requestId:two,reset:true,includeRun:true});
 assert.equal(first.core.identity['2xx'],1);assert.deepEqual(second.core,{});assert.equal(first.db.ms,2);assert.equal(second.db.ms,3);
 assert.equal(lines.filter(l=>l.event==='meri.turn.counters').length,2);
});

test('bounded eviction and failed provisional work become background, dropped writes reported',async()=>{
 const {lines,telemetry}=fixture('control',{maxTrackedRuns:1});
 telemetry.within(binding,()=>telemetry.recordDb(1));
 telemetry.within({...binding,runId:'44444444-4444-4444-8444-444444444444'},()=>telemetry.recordDb(1));
 const error=Error('same');assert.throws(()=>telemetry.provisional(()=>{telemetry.recordCore('identity','503',1);throw error;}),e=>e===error);
 telemetry.rollup();assert.equal(lines.find(l=>l.event==='meri.process.rollup').DbStatements,1);assert.equal(lines.find(l=>l.event==='meri.process.rollup').CoreCalls,1);
 let broken=true;const emitted=[],other=createTurnTelemetry({service:'control',write:line=>{if(broken)throw Error('writer');emitted.push(JSON.parse(line));}});
 other.stage(binding,'run.starting');broken=false;other.rollup();assert.equal(emitted[0].telemetryDropped,1);
});

test('publish observer keeps result/error identity, deduplicates deltas and unknown t0 stays null',async()=>{
 const {lines,telemetry}=fixture(),delta={binding,sequence:1,type:'message.delta'},error=Error('original');
 const service=createTurnPublishObserver({telemetry}).observeRunOwner({async publish(input){if(input===error)throw error;return input;}});
 assert.equal(await service.publish(delta),delta);await service.publish(delta);await service.publish(terminal());await service.publish(terminal());
 await assert.rejects(service.publish(error),e=>e===error);
 const summary=lines.find(l=>l.event==='meri.turn.summary');assert.equal(summary.firstTextMs,null);assert.equal(summary.resultMs,null);assert.equal(summary.deltaPublications,1);
 assert.equal(lines.filter(l=>l.event==='meri.turn.summary').length,1);assert.equal(lines.filter(l=>l.stage==='delta.first.durable').length,1);
});

test('rollup timer is explicit, unreferenced, close idempotent',()=>{
 const {lines,telemetry}=fixture();assert.equal(lines.length,0);assert.equal(telemetry.start(),telemetry);telemetry.start();telemetry.close();telemetry.close();
 assert.equal(lines.filter(l=>l.event==='meri.process.rollup').length,1);
});

test('failed rollup preserves historical dropped count until successful recovery',()=>{
 let broken=true;const lines=[],telemetry=createTurnTelemetry({service:'control',write:line=>{if(broken)throw Error('offline');lines.push(JSON.parse(line));}});
 telemetry.stage(binding,'run.starting');telemetry.stage(binding,'run.running');assert.equal(telemetry.telemetryDropped,2);
 telemetry.rollup();assert.equal(telemetry.telemetryDropped,3);broken=false;telemetry.rollup();
 assert.equal(lines[0].telemetryDropped,3);assert.equal(telemetry.telemetryDropped,0);
});

test('scheduled background renewal does not inherit request attribution',async()=>{
 const {telemetry,lines}=fixture('owner');
 await telemetry.within(binding,async()=>{
  telemetry.recordAws('DescribeTasks','success',1);
  await telemetry.background(async()=>{await Promise.resolve();telemetry.recordAws('DescribeServices','success',1);});
  telemetry.recordAws('DescribeTasks','success',1);
 });
 const counts=telemetry.counters(binding);telemetry.rollup();
 assert.deepEqual(counts.aws,{DescribeTasks:{success:2}});
 assert.deepEqual(lines.find(line=>line.event==='meri.process.rollup').aws,{DescribeServices:{success:1}});
});

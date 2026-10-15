import test from 'node:test';
import assert from 'node:assert/strict';
import {SpanStatusCode} from '@opentelemetry/api';
import {createRunLifecycleObserver} from '../run-lifecycle.mjs';
import {instrumentApplication} from '../http.mjs';
import {inMemoryInstruments} from './fixture.mjs';

const binding=n=>({tenantId:'tenant-a',actorId:'actor-a',conversationId:'00000000-0000-4000-8000-000000000001',runId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,attemptId:'00000000-0000-4000-8000-0000000000aa',workerId:'00000000-0000-4000-8000-0000000000bb',writerFence:1});
const status=(n,sequence,state,reasonCode=null)=>({contractVersion:'0.1.0',eventId:`10000000-0000-4000-8000-${String(sequence).padStart(12,'0')}`,binding:binding(n),sequence,createdAt:'2026-10-15T00:00:00.000Z',scopes:[],type:'run.status',data:{state,reasonCode}});
function harness(){let clock=1_000_000;const f=inMemoryInstruments(),observer=createRunLifecycleObserver({instruments:f.instruments,now:()=>clock,maxTrackedRuns:2});return {...f,observer,tick:ms=>{clock+=ms;}};}

test('one run span per run from first accepted transition to terminal, with transitions, count and duration',async t=>{
 const h=harness();t.after(h.close);
 h.observer.observe(status(1,1,'starting'));h.tick(10);h.observer.observe(status(1,2,'running'));h.tick(90);h.observer.observe(status(1,3,'completed'));
 const [span]=h.spans();assert.equal(h.spans().length,1);assert.equal(span.name,'meri.run');assert.equal(span.status.code,SpanStatusCode.OK);
 assert.deepEqual(span.events.map(e=>e.attributes['meri.run.state']),['starting','running']);
 assert.equal(span.attributes['meri.run.id'],binding(1).runId);assert.equal(span.attributes['meri.tenant.id'],'tenant-a');assert.equal(span.attributes['meri.run.duration_known'],true);
 assert.equal(span.attributes['meri.run.state'],'completed');assert.equal(span.duration[0]*1000+span.duration[1]/1e6,100);
 const [runs]=await h.points('meri.runs');assert.equal(runs.value,1);assert.deepEqual(runs.attributes,{'meri.run.state':'completed'});
 const [duration]=await h.points('meri.run.duration');assert.equal(duration.value.sum,100);assert.equal(duration.value.count,1);
 assert.deepEqual(await h.points('meri.run.cost'),[]);
});
test('failed runs carry only the closed reason; replays and post-terminal duplicates are not counted twice',async t=>{
 const h=harness();t.after(h.close);
 h.observer.observe(status(2,1,'running'));h.observer.observe(status(2,1,'running'));h.tick(5);
 h.observer.observe(status(2,2,'failed','PROVIDER_TIMEOUT'));h.observer.observe(status(2,2,'failed','PROVIDER_TIMEOUT'));
 h.observer.observe(status(3,1,'failed','free text with secret sk-123'));
 const spans=h.spans();assert.equal(spans.length,2);assert.equal(spans[0].events.length,1);
 assert.equal(spans[0].status.code,SpanStatusCode.ERROR);assert.equal(spans[0].status.message,'PROVIDER_TIMEOUT');assert.equal(spans[1].status.message,'OTHER');
 assert.equal(spans[1].attributes['meri.run.duration_known'],false);
 const runs=await h.points('meri.runs');assert.deepEqual(runs.map(p=>[p.attributes['meri.run.reason'],p.value]).sort(),[['OTHER',1],['PROVIDER_TIMEOUT',1]]);
 assert.equal((await h.points('meri.run.duration'))[0].value.count,1);
});
test('tracked runs are bounded: an evicted run still emits its terminal span without a duration',async t=>{
 const h=harness();t.after(h.close);
 for(const n of [4,5,6])h.observer.observe(status(n,1,'running'));h.observer.observe(status(4,2,'cancelled','USER_CANCELLED'));h.observer.observe(status(6,2,'completed'));
 const [evicted,kept]=h.spans();assert.equal(evicted.attributes['meri.run.duration_known'],false);assert.equal(kept.attributes['meri.run.duration_known'],true);
});
test('observeRunOwner returns the publish result unchanged, keeps other members and never lets telemetry fail a publish',async t=>{
 const h=harness();t.after(h.close);const marker=Symbol('cleanup'),calls=[];
 const service=Object.freeze({publish:async input=>{calls.push(input);return input.event;},loadForExecution:async()=>'loaded',[marker]:'kept'});
 const observed=h.observer.observeRunOwner(service);assert.equal(observed[marker],'kept');assert.equal(await observed.loadForExecution(),'loaded');
 const event=status(7,1,'completed');assert.equal(await observed.publish({event}),event);assert.equal(h.spans().length,1);
 // A malformed accepted event makes the observer throw; the publish result is still returned untouched.
 const malformed={type:'run.status'};assert.equal(await observed.publish({event:malformed}),malformed);assert.equal(h.spans().length,1);
 await assert.rejects(h.observer.observeRunOwner({publish:async()=>{throw Object.assign(Error('STALE_WRITER'),{code:'STALE_WRITER'});}}).publish({}),/STALE_WRITER/u);
 assert.equal(calls.length,2);
});
test('HTTP spans and durations carry method, path and status only; path identifiers stay off metric dimensions',async t=>{
 const h=harness();t.after(h.close);let clock=0;
 const app=instrumentApplication(h.instruments,{handle:async request=>new URL(request.url).pathname==='/boom'?Promise.reject(Object.assign(Error('X'),{code:'BOOM_CODE'})):new Response('ok',{status:request.url.includes('fail')?503:200})},{now:()=>clock+=7});
 const request=path=>new Request('https://control.synthetic.invalid'+path+'?token=secret',{method:'POST',headers:{authorization:'Bearer secret',cookie:'c=1'}});
 assert.equal((await app.handle(request('/api/conversations/abc'))).status,200);assert.equal((await app.handle(request('/api/fail'))).status,503);
 await assert.rejects(app.handle(request('/boom')),/X/u);
 const spans=h.spans();assert.deepEqual(spans.map(s=>[s.attributes['url.path'],s.attributes['http.response.status_code'],s.status.code,s.status.message]),[['/api/conversations/abc',200,SpanStatusCode.OK,undefined],['/api/fail',503,SpanStatusCode.ERROR,'HTTP_SERVER_ERROR'],['/boom',undefined,SpanStatusCode.ERROR,'BOOM_CODE']]);
 const serialized=JSON.stringify(spans.map(s=>s.attributes));assert.doesNotMatch(serialized,/secret|Bearer|c=1/u);
 const points=await h.points('meri.http.server.duration');assert.ok(points.every(p=>!('url.path' in p.attributes)));assert.equal(points.reduce((n,p)=>n+p.value.count,0),3);
 assert.throws(()=>instrumentApplication(h.instruments,{}),/TELEMETRY_CONFIGURATION/u);
});

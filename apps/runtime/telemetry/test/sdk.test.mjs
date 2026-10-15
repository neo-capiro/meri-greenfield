import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {trace,metrics} from '@opentelemetry/api';
import {versions} from '../../../control/conversations/test/application-fixture.mjs';

const noop=()=>trace.getTracer('probe').startSpan('probe').isRecording()===false&&metrics.getMeterProvider().constructor.name==='NoopMeterProvider';
async function collector(){
 const received=[];const server=http.createServer((request,response)=>{const chunks=[];request.on('data',c=>chunks.push(c));request.on('end',()=>{received.push({path:request.url,type:request.headers['content-type'],body:Buffer.concat(chunks).toString('utf8')});response.writeHead(200,{'content-type':'application/json'}).end('{}');});});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {received,endpoint:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}

test('importing the telemetry composition registers no provider and opens no connection',async()=>{
 const original={request:http.request,connect:net.connect,fetch:globalThis.fetch};let attempts=0;const denied=()=>{attempts++;throw Error('IMPORT_NETWORK_SIDE_EFFECT');};
 http.request=denied;net.connect=denied;globalThis.fetch=denied;
 try{const module=await import('../index.mjs');assert.equal(typeof module.startControlTelemetry,'function');}finally{Object.assign(http,{request:original.request});net.connect=original.connect;globalThis.fetch=original.fetch;}
 assert.equal(attempts,0);assert.ok(noop(),'no global tracer or meter provider after import');
});
test('started SDK exports run and HTTP spans with versioned resource attributes and run metrics over OTLP/HTTP; close flushes and unregisters',async t=>{
 const sink=await collector();t.after(sink.close);const {startControlTelemetry}=await import('../index.mjs');
 const telemetry=startControlTelemetry({configuration:{telemetry:{enabled:true,endpoint:sink.endpoint,exportIntervalMs:60000},versions,limits:{requestMs:2000}}});
 try{
  assert.equal(noop(),false,'the SDK registers global providers only once started');
  const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
  const service=telemetry.observeRunOwner({publish:async({event})=>event});
  for(const [sequence,state] of [[1,'running'],[2,'completed']])await service.publish({event:{binding,sequence,type:'run.status',data:{state,reasonCode:null}}});
  const app=telemetry.instrumentApplication({handle:async()=>new Response(null,{status:204})});
  await app.handle(new Request('https://control.synthetic.invalid/health/x?token=secret-query',{headers:{authorization:'Bearer secret-header'}}));
 }finally{await telemetry.close();}
 assert.ok(noop(),'close unregisters the global providers');assert.equal(telemetry.close(),telemetry.close(),'close is idempotent');
 const traces=sink.received.filter(r=>r.path==='/v1/traces'),metric=sink.received.filter(r=>r.path==='/v1/metrics');
 assert.ok(traces.length>=1&&metric.length>=1,JSON.stringify(sink.received.map(r=>r.path)));
 const spans=traces.map(r=>r.body).join('\n'),points=metric.map(r=>r.body).join('\n');
 for(const expected of ['meri.run','meri.http.request','"meri-control"','meri.versions.sdk',versions.imageDigest,versions.skillsDigest])assert.ok(spans.includes(expected),expected);
 for(const expected of ['meri.runs','meri.run.duration','meri.http.server.duration'])assert.ok(points.includes(expected),expected);
 assert.doesNotMatch(spans+points,/secret-query|secret-header|host\.name|process\.command/u);
});
test('control startup failure after telemetry started still closes telemetry and unregisters providers',async()=>{
 const sink=await collector();const {startControl}=await import('../../control.mjs');
 const {candidateFixture}=await import('../../test/prepared-candidate-fixture.mjs');const {configuration}=candidateFixture();
 configuration.database.connectionFile='/nonexistent/meri-telemetry-test/db';configuration.telemetry={enabled:true,endpoint:sink.endpoint,exportIntervalMs:60000};
 // Observe the SDK's global registration and the owned close's unregistration on the shared API singleton.
 const calls=[],register=metrics.setGlobalMeterProvider,disable=metrics.disable;
 metrics.setGlobalMeterProvider=provider=>{calls.push('register');return register.call(metrics,provider);};metrics.disable=()=>{calls.push('disable');return disable.call(metrics);};
 try{await assert.rejects(startControl(configuration,{}),/CONTROL_STARTUP_FAILED/u);assert.deepEqual(calls,['register','disable']);assert.ok(noop());}
 finally{delete metrics.setGlobalMeterProvider;delete metrics.disable;await sink.close();}
});
test('disabled telemetry composes nothing: control never loads or starts the SDK',async()=>{
 const {startControl}=await import('../../control.mjs');const {candidateFixture}=await import('../../test/prepared-candidate-fixture.mjs');const {configuration}=candidateFixture();
 configuration.database.connectionFile='/nonexistent/meri-telemetry-test/db';configuration.telemetry={enabled:false,endpoint:'https://collector.synthetic.invalid'};
 const calls=[];metrics.setGlobalMeterProvider=()=>{calls.push('register');return false;};
 try{await assert.rejects(startControl(configuration,{}),/CONTROL_STARTUP_FAILED/u);assert.deepEqual(calls,[]);assert.ok(noop());}finally{delete metrics.setGlobalMeterProvider;}
});

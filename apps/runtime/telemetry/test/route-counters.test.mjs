import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteStatusCounters,compileRoutePatterns,routePattern,statusClass} from '../route-counters.mjs';
import {createTurnLineEmitter,HTTP_STATUS_CLASSES} from '../turn-lines.mjs';
import {createTurnTelemetry} from '../turn-context.mjs';
const uuid='11111111-1111-4111-8111-111111111111';
const routes={public:['/api/action-followthrough/session','/api/conversations/list','/api/conversations/events/:id/stream','/api/documents/download','/api/uploads/original/:id'],private:['/internal/conversations/publish']};
function fixture({windowMs=60000}={}){
 const lines=[];let at=1_000_000;const emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line)),now:()=>at});
 const counters=createRouteStatusCounters({emit:emitter.emit,now:()=>at,windowMs,routes});
 return {lines,counters,tick:ms=>{at+=ms;}};
}

test('only an allowlisted pattern is ever a route value; identifier shapes and unusual segments fold into other',()=>{
 const compiled=compileRoutePatterns(routes.public);
 assert.equal(routePattern(`/api/conversations/events/${uuid}/stream`,compiled),'/api/conversations/events/:id/stream');
 assert.equal(routePattern('/api/uploads/original/'+uuid,compiled),'/api/uploads/original/:id');
 assert.equal(routePattern('/api/uploads/original/01ARZ3NDEKTSV4RRFFQ69G5FAV',compiled),'/api/uploads/original/:id','a ULID in an :id slot is normalised');
 assert.equal(routePattern('/api/conversations/list',compiled),'/api/conversations/list');
 for(const path of ['/api/conversations/01ARZ3NDEKTSV4RRFFQ69G5FAV','/api/conversations/V1StGXR8_Z5jdHi6B-myT','/api/conversations/my-report-2026','/api/conversations/jane.doe',
  '/api/conversations/'+Buffer.from('opaque token').toString('base64url'),'/api/conversations/list/extra','/api/conversations','/api/documents/'+uuid+'/download','/internal/conversations/publish',
  '/api/conversations/list?select=secret','/api/conversations/list#x','/api/x/secret%20token','relative','',null,undefined])assert.equal(routePattern(path,compiled),'other',String(path));
 assert.equal(routePattern('/api/conversations/events//stream',compiled),'other','an empty id segment never matches');
 for(const bad of [['/api/x?y'],['api/x'],['/api/:name'],[42],'/api/x'])assert.throws(()=>compileRoutePatterns(bad),/ROUTE_COUNTERS_CONFIGURATION/u);
 for(const [status,expected] of [[200,'2xx'],[204,'2xx'],[302,'3xx'],[401,'401'],[403,'403'],[404,'404'],[409,'409'],[413,'4xx'],[499,'4xx'],[503,'503'],[502,'5xx'],[undefined,'5xx']])assert.equal(statusClass(status),expected,String(status));
});

test('junk paths never crowd a real route out: the dimension set stays closed under 300 distinct unknown paths',()=>{
 const f=fixture();
 for(let n=0;n<300;n++)f.counters.record('public',`/api/conversations/${n}-${'x'.repeat(n%7)}-${n%2?'01ARZ3NDEKTSV4RRFFQ69G5FAV':uuid}`,500);
 f.counters.record('public','/api/action-followthrough/session',503);
 f.counters.flush();
 assert.deepEqual(f.lines.map(line=>[line.route,line.statuses['5xx'],line.statuses['503']]).sort(),[['/api/action-followthrough/session',0,1],['other',300,0]]);
 assert.ok(f.lines.every(line=>!JSON.stringify(line).includes('01ARZ3') &&!JSON.stringify(line).includes(uuid)));
});

test('one line per route and listener per window, with every status class, and nothing per request',async()=>{
 const f=fixture();
 const app=f.counters.observe('public',{async handle(request){const path=new URL(request.url).pathname;if(path.endsWith('/download'))throw Error('private failure');return new Response(null,{status:path.endsWith('/session')?503:200});}});
 for(const path of [`/api/conversations/events/${uuid}/stream`,`/api/conversations/events/${'2'.repeat(8)}-2222-4222-8222-222222222222/stream`,'/api/action-followthrough/session','/api/action-followthrough/session','/api/documents/download'])
  await app.handle(new Request('https://control.test'+path+'?q=secret',{method:'POST'})).catch(()=>{});
 assert.equal(f.lines.length,0,'no line is written per request');
 f.tick(60000);await app.handle(new Request('https://control.test/api/conversations/list',{method:'POST'}));
 const routes=Object.fromEntries(f.lines.map(line=>[line.route,line]));
 assert.deepEqual(Object.keys(routes).sort(),['/api/action-followthrough/session','/api/conversations/events/:id/stream','/api/documents/download']);
 assert.equal(routes['/api/conversations/events/:id/stream'].statuses['2xx'],2,'two ids, one route');
 assert.equal(routes['/api/action-followthrough/session'].statuses['503'],2);assert.equal(routes['/api/action-followthrough/session'].HttpServerErrors,2);assert.equal(routes['/api/action-followthrough/session'].HttpResponses,2);
 assert.equal(routes['/api/documents/download'].statuses['5xx'],1,'a thrown handler counts as a server error');
 for(const line of f.lines){assert.equal(line.event,'meri.http.routes');assert.equal(line.listener,'public');assert.equal(Object.hasOwn(line,'Listener'),false,'the listener is a log field, not a dimension');assert.equal(line.windowMs,60000);assert.deepEqual(Object.keys(line.statuses).sort(),[...HTTP_STATUS_CLASSES].sort());
  assert.ok(!JSON.stringify(line).includes(uuid)&&!JSON.stringify(line).includes('private failure')&&!JSON.stringify(line).includes('secret'));
  assert.deepEqual(line._aws.CloudWatchMetrics.map(group=>group.Metrics[0].Name),['HttpResponses','HttpClientErrors','HttpServerErrors']);
  assert.deepEqual(line._aws.CloudWatchMetrics[0].Dimensions,[['Service'],['Service','Route']]);}
 f.counters.flush();assert.equal(f.lines.length,4);assert.equal(f.lines[3].route,'/api/conversations/list');assert.equal(f.lines[3].statuses['2xx'],1);
 f.counters.flush();assert.equal(f.lines.length,4,'an empty window writes nothing');
});

test('the telemetry rollup flushes a burst followed by silence within its own interval',()=>{
 const lines=[];let at=0;const telemetry=createTurnTelemetry({service:'control',now:()=>at,write:line=>lines.push(JSON.parse(line))});
 const counters=createRouteStatusCounters({emit:telemetry.emit,now:()=>at,routes});const off=telemetry.onRollup(counters.flush);
 counters.record('private','/internal/conversations/publish',503);at=60000;telemetry.rollup();
 const line=lines.find(l=>l.event==='meri.http.routes');assert.ok(line,'flushed by the rollup without another response');assert.equal(line.listener,'private');assert.equal(line.statuses['503'],1);
 off();counters.record('private','/internal/conversations/publish',200);telemetry.rollup();assert.equal(lines.filter(l=>l.event==='meri.http.routes').length,1,'an unsubscribed hook no longer runs');
 telemetry.close();assert.throws(()=>telemetry.onRollup('flush'),/TELEMETRY_CONFIGURATION/u);
});

test('listeners are counted apart, each against its own allowlist, and a failing emitter never reaches a request',async()=>{
 const f=fixture();
 f.counters.record('private','/internal/conversations/publish',200);f.counters.record('public','/internal/conversations/publish',404);f.counters.record('private','/api/conversations/list',200);
 f.counters.flush();
 assert.deepEqual(f.lines.map(line=>[line.listener,line.route,line.statuses['2xx'],line.statuses['404']]),[['private','/internal/conversations/publish',1,0],['public','other',0,1],['private','other',1,0]]);
 const broken=createRouteStatusCounters({emit(){throw Error('writer');},now:()=>0,routes});
 const app=broken.observe('public',{async handle(){return new Response('ok');}});
 assert.equal((await app.handle(new Request('https://control.test/api/conversations/list'))).status,200);broken.flush();
 assert.throws(()=>createRouteStatusCounters({emit:'stdout',routes}),/ROUTE_COUNTERS_CONFIGURATION/u);assert.throws(()=>createRouteStatusCounters({emit(){}}),/ROUTE_COUNTERS_CONFIGURATION/u);assert.throws(()=>broken.observe('public',{}),/ROUTE_COUNTERS_CONFIGURATION/u);
});

test('the line schema refuses a foreign route or status class',()=>{
 const lines=[],emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line))});
 emitter.emit('meri.http.routes',{listener:'other',route:'/api/x/'+'secret token',statuses:{'2xx':1,'tenant-secret':5,'5xx':'2'}});
 assert.equal(lines[0].route,'other');assert.equal(lines[0].listener,'public');assert.deepEqual(lines[0].statuses,{'2xx':1,'5xx':0});assert.ok(!JSON.stringify(lines[0]).includes('secret'));
});

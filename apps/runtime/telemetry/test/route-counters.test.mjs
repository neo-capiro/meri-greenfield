import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteStatusCounters,routePattern,statusClass} from '../route-counters.mjs';
import {createTurnLineEmitter,HTTP_STATUS_CLASSES} from '../turn-lines.mjs';
const uuid='11111111-1111-4111-8111-111111111111';
function fixture({windowMs=60000,maxRoutes=200}={}){
 const lines=[];let at=1_000_000;const emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line)),now:()=>at});
 const counters=createRouteStatusCounters({emit:emitter.emit,now:()=>at,windowMs,maxRoutes});
 return {lines,counters,tick:ms=>{at+=ms;}};
}

test('a route pattern carries no identifier, query or unusual segment',()=>{
 assert.equal(routePattern(`/api/conversations/events/${uuid}/stream`),'/api/conversations/events/:id/stream');
 assert.equal(routePattern('/api/documents/'+'a'.repeat(32)+'/download'),'/api/documents/:id/download');
 assert.equal(routePattern('/api/meri/office/wopi/files/0123456789abcdef0123456789abcdef/contents'),'/api/meri/office/wopi/files/:id/contents');
 assert.equal(routePattern('/internal/conversations/publish'),'/internal/conversations/publish');
 assert.equal(routePattern('/api/conversations/history/42'),'/api/conversations/history/:id');
 assert.equal(routePattern('/api/x/'+'secret%20token'),'other');assert.equal(routePattern('/'+'deep/'.repeat(14)),'other');
 assert.equal(routePattern('/api/sql?select=secret'),'other');assert.equal(routePattern('relative'),'other');assert.equal(routePattern(null),'other');
 assert.equal(routePattern('/api/conversations/'),'/api/conversations/');
 for(const [status,expected] of [[200,'2xx'],[204,'2xx'],[302,'3xx'],[401,'401'],[403,'403'],[404,'404'],[409,'409'],[413,'4xx'],[499,'4xx'],[503,'503'],[502,'5xx'],[undefined,'5xx']])assert.equal(statusClass(status),expected,String(status));
});

test('one line per route and listener per window, with every status class, and nothing per request',async()=>{
 const f=fixture();
 const app=f.counters.observe('public',{async handle(request){const path=new URL(request.url).pathname;if(path.endsWith('/boom'))throw Error('private failure');return new Response(null,{status:path.endsWith('/session')?503:200});}});
 for(const path of [`/api/conversations/events/${uuid}/stream`,`/api/conversations/events/${'2'.repeat(8)}-2222-4222-8222-222222222222/stream`,'/api/action-followthrough/session','/api/action-followthrough/session','/api/conversations/boom'])
  await app.handle(new Request('https://control.test'+path,{method:'POST'})).catch(()=>{});
 assert.equal(f.lines.length,0,'no line is written per request');
 f.tick(60000);await app.handle(new Request('https://control.test/api/conversations/list',{method:'POST'}));
 const routes=Object.fromEntries(f.lines.map(line=>[line.route,line]));
 assert.deepEqual(Object.keys(routes).sort(),['/api/action-followthrough/session','/api/conversations/boom','/api/conversations/events/:id/stream']);
 assert.equal(routes['/api/conversations/events/:id/stream'].statuses['2xx'],2,'two ids, one route');
 assert.equal(routes['/api/action-followthrough/session'].statuses['503'],2);assert.equal(routes['/api/action-followthrough/session'].HttpServerErrors,2);assert.equal(routes['/api/action-followthrough/session'].HttpResponses,2);
 assert.equal(routes['/api/conversations/boom'].statuses['5xx'],1,'a thrown handler counts as a server error');
 for(const line of f.lines){assert.equal(line.event,'meri.http.routes');assert.equal(line.listener,'public');assert.equal(line.windowMs,60000);assert.deepEqual(Object.keys(line.statuses).sort(),[...HTTP_STATUS_CLASSES].sort());
  assert.ok(!JSON.stringify(line).includes(uuid)&&!JSON.stringify(line).includes('private failure'));
  assert.deepEqual(line._aws.CloudWatchMetrics.map(group=>group.Metrics[0].Name),['HttpResponses','HttpClientErrors','HttpServerErrors']);
  assert.deepEqual(line._aws.CloudWatchMetrics[0].Dimensions,[['Service'],['Service','Route']]);}
 f.counters.flush();assert.equal(f.lines.length,4);assert.equal(f.lines[3].route,'/api/conversations/list');assert.equal(f.lines[3].statuses['2xx'],1);
 f.counters.flush();assert.equal(f.lines.length,4,'an empty window writes nothing');
});

test('listeners are counted apart, the route table is bounded and a failing emitter never reaches a request',async()=>{
 const f=fixture({maxRoutes:2});
 f.counters.record('private','/internal/conversations/publish',200);f.counters.record('public','/internal/conversations/publish',404);
 for(const n of [1,2,3,4])f.counters.record('public',`/api/route-${n}`,500);
 f.counters.flush();
 assert.deepEqual(f.lines.map(line=>[line.listener,line.route,line.statuses['2xx'],line.statuses['404'],line.statuses['5xx']]),[['private','/internal/conversations/publish',1,0,0],['public','/internal/conversations/publish',0,1,0],['public','other',0,0,4]]);
 const broken=createRouteStatusCounters({emit(){throw Error('writer');},now:()=>0});
 const app=broken.observe('public',{async handle(){return new Response('ok');}});
 assert.equal((await app.handle(new Request('https://control.test/api/conversations/list'))).status,200);broken.flush();
 assert.throws(()=>createRouteStatusCounters({emit:'stdout'}),/ROUTE_COUNTERS_CONFIGURATION/u);assert.throws(()=>broken.observe('public',{}),/ROUTE_COUNTERS_CONFIGURATION/u);
});

test('the line schema refuses a foreign route or status class',()=>{
 const lines=[],emitter=createTurnLineEmitter({service:'control',write:line=>lines.push(JSON.parse(line))});
 emitter.emit('meri.http.routes',{listener:'other',route:'/api/x/'+'secret token',statuses:{'2xx':1,'tenant-secret':5,'5xx':'2'}});
 assert.equal(lines[0].route,'other');assert.equal(lines[0].listener,'public');assert.deepEqual(lines[0].statuses,{'2xx':1,'5xx':0});assert.ok(!JSON.stringify(lines[0]).includes('secret'));
});

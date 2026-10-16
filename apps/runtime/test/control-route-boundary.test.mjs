import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications,listenControlApplications} from '../control-route-boundary.mjs';

test('public listener admits only the exact preview API paths and never protected native paths',async()=>{
 const calls=[],assembly={handle(request){calls.push(['public',new URL(request.url).pathname]);return new Response('public');}},candidate={handle(request){calls.push(['private',new URL(request.url).pathname]);return new Response('private');}};
 const routes=createControlRouteApplications({assembly,candidate});
 for(const path of ['/api/conversations','/api/conversations/123/turns','/api/action-followthrough/session'])assert.equal((await routes.public.handle(new Request('https://preview.invalid'+path))).status,200);
 for(const path of ['/v1/runner/native/bootstrap','/v1/native-task/prepare','/internal/conversations/123','/api/other','/api/action-followthrough/session/extra','/api/conversations-other'])assert.equal((await routes.public.handle(new Request('https://preview.invalid'+path))).status,404);
 assert.deepEqual(calls.map(row=>row[0]),['public','public','public']);
});
test('private listener excludes public paths and passes its unforgeable marker only to task router',async()=>{
 const marker=Object.freeze({}),seen=[],privateIngress={issue(){return marker;}},router={privateApplication:{handle(request,context){seen.push(context.ingress);return new Response('routed');}}},
  assembly={handle(){return new Response('assembly');}},candidate={handle(){return null;}},routes=createControlRouteApplications({assembly,candidate,router,privateIngress});
 assert.equal((await routes.private.handle(new Request('https://private.invalid/api/conversations'))).status,404);
 assert.equal(seen.length,0);
 assert.equal((await routes.private.handle(new Request('https://private.invalid/v1/native-task/prepare'))).status,200);
 assert.equal(seen[0],marker);
 assert.equal((await routes.public.handle(new Request('https://public.invalid/v1/native-task/prepare'))).status,404);
 assert.equal(seen.length,1);
});
test('poststart challenge is reachable only through the private listener marker',async()=>{
 const marker=Object.freeze({}),seen=[],poststart={privateApplication:{handle(request,context){seen.push(context.ingress);return new URL(request.url).pathname==='/v1/runner-poststart/challenge'?new Response('challenge'):null;}}};
 const routes=createControlRouteApplications({assembly:{handle(){return new Response('public');}},candidate:{handle(){return null;}},
  poststart,privateIngress:{issue(){return marker;}}});
 const url='https://control.invalid/v1/runner-poststart/challenge';
 assert.equal((await routes.public.handle(new Request(url))).status,404);
 assert.equal(seen.length,0);
 assert.equal((await routes.private.handle(new Request(url))).status,200);
 assert.strictEqual(seen[0],marker);
});
test('public listener waits for private bind; failed public bind retires the private listener',async()=>{
 const events=[],held=Promise.withResolvers(),configuration={http:{port:8080},privateHttp:{port:8082}},application={handle(){}},readiness=()=>{};
 const listen=async({configuration:configured})=>{if(configured.http.port===8082){events.push('private-open');await held.promise;return {close(){events.push('private-close');}};}events.push('public-open');throw Error('public-bind-failed');};
 const starting=listenControlApplications({configuration,publicApplication:application,privateApplication:application,readiness,listen});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['private-open']);
 held.resolve();await assert.rejects(starting,/public-bind-failed/);
 assert.deepEqual(events,['private-open','public-open','private-close']);
});
test('single-listener qualification starts only the public listener',async()=>{
 const calls=[],configuration={http:{port:8080}},application={handle(){}};
 const result=await listenControlApplications({configuration,publicApplication:application,privateApplication:null,readiness(){},listen:async({configuration:c})=>{calls.push(c.http.port);return {address:{port:c.http.port}};}});
 assert.deepEqual(calls,[8080]);assert.equal(result.publicListener.address.port,8080);assert.equal(result.privateListener,undefined);
});

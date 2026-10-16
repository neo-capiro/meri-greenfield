import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../control-route-boundary.mjs';

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

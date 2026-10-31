import test from 'node:test';
test('viewer and browser session reach public authentication; private host transport never does',async()=>{
 const called=[];
 const routes=createControlRouteApplications({assembly:{handle(r){called.push(new URL(r.url).pathname);return new Response('authenticated owner');}},candidate:{handle(){throw Error('private host must not be public');}}});
 for(const path of ['/api/meri/browser/read','/api/meri/browser/input','/api/action-followthrough/browser-session']){
  assert.equal((await routes.public.handle(new Request('https://control.test'+path))).status,200);
  assert.equal((await routes.private.handle(new Request('https://control.test'+path))).status,404);
 }
 assert.equal((await routes.public.handle(new Request('https://control.test/internal/browser-viewer'))).status,404);assert.equal(called.length,3);
});
import assert from 'node:assert/strict';
import {createControlRouteApplications,listenControlApplications} from '../control-route-boundary.mjs';
test('native observer is a dedicated private leaf, including when disabled',async()=>{
 let observed=0,broad=0;const base={assembly:{handle(){return new Response('public');}},candidate:{handle(){broad++;return new Response('broad');}}};
 const url='https://control.invalid/v1/execution/native/physical-observer';
 const enabled=createControlRouteApplications({...base,nativeObserver:{handle(){observed++;return new Response('observer');}}});
 assert.equal((await enabled.public.handle(new Request(url))).status,404);
 assert.equal(await (await enabled.private.handle(new Request(url))).text(),'observer');
 assert.equal((await createControlRouteApplications(base).private.handle(new Request(url))).status,404);
 assert.equal(observed,1);assert.equal(broad,0);
});

test('public listener admits only the exact preview API paths and never protected native paths',async()=>{
 const calls=[],assembly={handle(request){calls.push(['public',new URL(request.url).pathname]);return new Response('public');}},candidate={handle(request){calls.push(['private',new URL(request.url).pathname]);return new Response('private');}};
 const routes=createControlRouteApplications({assembly,candidate});
 for(const path of ['/api/conversations','/api/conversations/123/turns','/api/action-followthrough/session','/api/action-followthrough/query','/api/routines/session'])assert.equal((await routes.public.handle(new Request('https://preview.invalid'+path))).status,200);
 for(const path of ['/v1/runner/native/bootstrap','/v1/native-task/prepare','/internal/conversations/123','/api/other','/api/action-followthrough/session/extra','/api/conversations-other'])assert.equal((await routes.public.handle(new Request('https://preview.invalid'+path))).status,404);
 assert.deepEqual(calls.map(row=>row[0]),['public','public','public','public','public']);
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
test('approval metadata readback is private-only and disabled does not fall through to the candidate',async()=>{
 let calls=0,candidateCalls=0;const configuration={assembly:{handle(){throw Error('not public');}},candidate:{handle(){candidateCalls++;return new Response('candidate');}}},path='https://control.invalid/v1/internal/approval-metadata/read';
 const routed=createControlRouteApplications({...configuration,approvalMetadataReader:{handle(){calls++;return new Response('retained metadata');}}});
 assert.equal((await routed.public.handle(new Request(path))).status,404);assert.equal(calls,0);
 assert.equal((await routed.private.handle(new Request(path))).status,200);assert.equal(calls,1);assert.equal(candidateCalls,0);
 const disabled=createControlRouteApplications(configuration);assert.equal((await disabled.private.handle(new Request(path))).status,404);assert.equal(candidateCalls,0);
});
test('Office public operations derive from the canonical route export and WOPI is private only',async()=>{
 const {OFFICE_ROUTES}=await import('../../../packages/contracts/office-application/receive.mjs');
 const calls=[],office={async handleControl(request){calls.push(['control',new URL(request.url).pathname]);return new Response('office');},
  async handleWopi(request){calls.push(['wopi',new URL(request.url).pathname]);return new Response('wopi');}};
 const routes=createControlRouteApplications({assembly:{handle(){return new Response('assembly');}},candidate:{handle(){return null;}},office});
 for(const route of OFFICE_ROUTES){
  const response=await routes.public.handle(new Request('https://public.invalid/api/meri/office/'+route,{method:'POST'}));
  assert.equal(response.status,200);assert.equal(await response.text(),'office');
 }
 assert.equal(calls.filter(row=>row[0]==='control').length,8);
 const wopi='/api/meri/office/wopi/files/abc';
 assert.equal((await routes.public.handle(new Request('https://public.invalid'+wopi,{method:'POST'}))).status,404);
 assert.equal(calls.filter(row=>row[0]==='wopi').length,0);
 assert.equal((await routes.private.handle(new Request('https://private.invalid'+wopi,{method:'POST'}))).status,200);
 assert.equal(calls.filter(row=>row[0]==='wopi').length,1);
 assert.equal((await routes.public.handle(new Request('https://public.invalid/api/meri/other',{method:'POST'}))).status,404);
});
test('absent Office keeps every operation and WOPI at 404',async()=>{
 const routes=createControlRouteApplications({assembly:{handle(){return new Response('assembly');}},candidate:{handle(){return null;}},office:null});
 for(const path of ['/api/meri/office/open','/api/meri/office/inspect','/api/meri/office/wopi/files/abc'])
  assert.equal((await routes.public.handle(new Request('https://public.invalid'+path,{method:'POST'}))).status,404);
 assert.equal((await routes.private.handle(new Request('https://private.invalid/api/meri/office/wopi/files/abc',{method:'POST'}))).status,404);
});

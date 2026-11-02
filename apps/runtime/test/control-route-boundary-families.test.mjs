import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
test('tenant-settings and document routes reach the assembly on the public listener; their neighbours stay absent',async()=>{
 const seen=[];const routes=createControlRouteApplications({assembly:{handle(r){seen.push(new URL(r.url).pathname);return new Response('ok');}},candidate:{handle(){return null;}}});
test('the data-access center read reaches the assembly on the public listener; its neighbours and the private listener stay absent',async()=>{
 const seen=[];const routes=createControlRouteApplications({assembly:{handle(r){seen.push(new URL(r.url).pathname);return new Response('ok');}},candidate:{handle(){return null;}}});
 assert.equal((await routes.public.handle(new Request('https://control.test/api/data-access/read',{method:'POST'}))).status,200);
 for(const path of ['/api/data-access','/api/data-access/other','/api/data-access/read/extra'])
  assert.equal((await routes.public.handle(new Request('https://control.test'+path,{method:'POST'}))).status,404,path);
 assert.equal((await routes.private.handle(new Request('https://control.test/api/data-access/read',{method:'POST'}))).status,404);
 assert.deepEqual(seen,['/api/data-access/read']);
});
 for(const path of ['/api/settings/tenant/read','/api/settings/tenant/save','/api/settings/tenant/audit','/api/documents/x/download'])
  assert.equal((await routes.public.handle(new Request('https://control.test'+path,{method:'POST'}))).status,200,path);
 for(const path of ['/api/settings/tenant','/api/settings/tenant/other','/api/documents','/v1/runner/intents/prepare'])
  assert.equal((await routes.public.handle(new Request('https://control.test'+path,{method:'POST'}))).status,404,path);
 assert.deepEqual(seen,['/api/settings/tenant/read','/api/settings/tenant/save','/api/settings/tenant/audit','/api/documents/x/download']);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {id} from '../../test/store-fixture.mjs';
import {binding,proof} from './fixture.mjs';
import {fixture} from './http-fixture.mjs';

test('completed-run reader uses current native bearer and Core, with final membership/currentness and retention fence',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.equal(value.current.text,'x'.repeat(12));assert.equal(value.event.binding.runId,binding.runId);assert.equal(value.current.sourceLocator,'https://evidence.example.invalid/text');assert.deepEqual(f.state.body,{billId:'119-hr-1',versionCode:'ih'});assert.equal(f.state.sourceCalls,1);assert.equal(f.state.membership,1);assert.equal(f.state.currentness,2);assert.equal(f.state.retentionChecks,2);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('production product router mounts the same authenticated source owner after completion',async()=>{const f=await fixture({runtimeMount:true}),r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).current.text,'x'.repeat(12));assert.equal(f.state.sourceCalls,1);assert.equal(f.state.currentness,2);});
test('missing, cross-owner, inaccessible-client and forged requests refuse before source read',async()=>{
 for(const change of [f=>{f.state.principal.tenantId=id(90);},f=>{f.state.principal.actorId=id(90);},f=>{f.state.principal.clientIds=[];},f=>{f.state.admissionDenied=true;},f=>{f.state.currentDenied=true;},f=>{f.state.suppressed=true;}]){const f=await fixture();change(f);const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,0);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
 const f=await fixture();assert.equal((await f.read({...f.request,referenceId:id(90)})).status,404);assert.equal((await f.read({...f.request,authority:'forged'})).status,400);assert.equal(f.state.sourceCalls,0);
});
test('stale, unavailable and denied current source are distinct content-free failures',async()=>{
 for(const [status,expected]of [[400,409],[403,403],[503,503]]){const f=await fixture();f.state.sourceStatus=status;const r=await f.read();assert.equal(r.status,expected);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
 const f=await fixture();f.state.result={...f.state.result,textHash:'d'.repeat(64)};const r=await f.read();assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:{code:'SOURCE_REFERENCE_STALE'}});
});
test('revocation or suppression after the Core page read withholds the whole response',async()=>{
 for(const key of ['membershipDenied','finalDenied','suppressed']){const f=await fixture();f.state.afterRead=()=>{f.state[key]=true;};const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,1);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
});
test('continuation opens the saved positive-offset cursor, and malformed source URLs remain inert',async()=>{
 const first=proof({total:10000}),f=await fixture({total:10000,args:{billId:'119-hr-1',versionCode:'ih',cursor:first.result.coverage.nextCursor}});f.state.result.sourceLocator='javascript:alert(1)';const r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal(f.state.body.cursor,first.result.coverage.nextCursor);const value=await r.json();assert.equal(value.current.text.length,1000);assert.equal(value.current.sourceLocator,null);assert.equal(value.current.linkStatus,'unsafe');
});

test('General scope opens the saved bill page without inventing a selected client',async()=>{const f=await fixture({general:true});f.state.principal.clientIds=[];const r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).event.scopes[0].kind,'private-user');});
test('an existing non-source event is unsupported by this reader, not a corrupt native reference',async()=>{const f=await fixture(),r=await f.read({...f.request,referenceId:id(7)});assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:{code:'SOURCE_REFERENCE_NOT_FOUND'}});assert.equal(f.state.sourceCalls,0);});

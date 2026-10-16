/** SYNTHETIC: the product Fetch application composed with the real membership gate, memory, settings and task routes over doubles
 * (identity/membership directory, journal, Core, settings store, operational reads). No listener, database, Core or gateway. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createProductApplication} from '../http.mjs';
import {createMemoryRoutes} from '../../memory/routes.mjs';
import {createMemoryProducer} from '../../memory/producer.mjs';
import {createCoreReview} from '../../memory/core-review.mjs';
import {createCoreMemoryReads} from '../../memory/core-memory.mjs';
import {createSettingsRoutes} from '../../settings/routes.mjs';
import {createSettingsService,TENANT_SETTINGS_PERMISSION} from '../../settings/service.mjs';
import {createTaskRoutes} from '../../tasks/routes.mjs';
import {createCoreDouble,createJournalDouble,ids} from '../../memory/test/fixtures.mjs';
import {PLATFORM,createSettingsStoreDouble} from '../../settings/test/fixtures.mjs';
import {directory,id} from './fixtures.mjs';
function setup(){
 const d=directory(),journal=createJournalDouble(),core=createCoreDouble(),store=createSettingsStoreDouble(),reads=[];
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId:ids(),now:()=>d.now});
 const settings=createSettingsService({store,readPlatformLimits:async()=>structuredClone(PLATFORM),newId:ids(700)});
 const tasks=createTaskRoutes({now:()=>d.now,operationalReads:{read:async call=>{reads.push(call);throw Error('not composed in this test');}}});
 const app=createProductApplication({gate:d.gate,now:()=>d.now,limits:{maxRequestMs:3000,maxRequestBytes:65536,maxResponseBytes:1048576},
  routes:{...createMemoryRoutes({producer}),...createSettingsRoutes({service:settings}),...tasks}});
 const post=(path,body,{token='token-1',headers={},method='POST',raw}={})=>app.handle(new Request(`https://meri.example${path}`,{method,
  headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{}),...headers},...(method==='POST'?{body:raw??JSON.stringify(body)}:{})}));
 return {d,journal,core,store,reads,app,post};
}
const json=async response=>({status:response.status,body:await response.json(),headers:response.headers});
const propose=(n,over={})=>({idempotencyKey:id(n),scope:'personal',content:`fact ${n}`,...over});

test('transport refusals are content-free and precede membership admission',async()=>{
 const t=setup();const reads=()=>t.d.reads;
 assert.deepEqual(await json(await t.post('/api/memory/proposals/list',{},{token:null})).then(r=>[r.status,r.body]),[401,{error:{code:'UNAUTHENTICATED'}}]);
 assert.equal((await t.post('/api/memory/unknown',{})).status,404);
 assert.equal((await t.post('/api/memory/proposals/list?x=1',{})).status,404);
 assert.equal((await t.post('/api/memory/proposals/list',null,{method:'GET'})).status,405);
 assert.equal((await t.post('/api/memory/proposals/list',{},{headers:{'content-type':'text/plain'}})).status,415);
 assert.equal((await t.post('/api/memory/proposals/list',null,{raw:'{bad'})).status,400);
 assert.equal((await t.post('/api/memory/proposals/list',null,{raw:JSON.stringify({pad:'x'.repeat(70000)})})).status,413);
 assert.equal(reads(),0);
 const ok=await json(await t.post('/api/memory/proposals/list',{}));
 assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');assert.equal(ok.headers.get('x-content-type-options'),'nosniff');
});

test('memory routes: propose, list, status, correct; domain errors map to documented statuses with field-free bodies',async()=>{
 const t=setup();
 const proposed=await json(await t.post('/api/memory/proposals/propose',propose(1)));
 assert.equal(proposed.status,200);assert.equal(proposed.body.proposal.review.status,'pending');
 const listed=await json(await t.post('/api/memory/proposals/list',{limit:10}));assert.deepEqual(listed.body.proposals.map(p=>p.candidateId),[proposed.body.proposal.candidateId]);
 assert.equal((await json(await t.post('/api/memory/proposals/status',{candidateId:proposed.body.proposal.candidateId}))).body.review.status,'pending');
 assert.deepEqual((await json(await t.post('/api/memory/proposals/status',{candidateId:id(99)}))).body,{error:{code:'MEMORY_PROPOSAL_NOT_FOUND'}});
 assert.equal((await t.post('/api/memory/proposals/propose',propose(2,{scope:'firm'}))).status,403);
 assert.equal((await t.post('/api/memory/proposals/propose',{...propose(1),content:'different'})).status,409);
 assert.equal((await t.post('/api/memory/proposals/propose',{...propose(3),approved:true})).status,400);
 t.core.addMemory({memoryId:'mem-1'});
 const corrected=await json(await t.post('/api/memory/proposals/correct',{idempotencyKey:id(4),targetMemoryId:'mem-1',content:'fixed',reason:'source says so',sources:[{kind:'document',reference:'doc-7'}]}));
 assert.equal(corrected.status,200);assert.equal(corrected.body.proposal.kind,'correction');
});

test('membership removal denies new requests and withholds an acknowledged effect awaiting release',async()=>{
 const t=setup();
 // Removal lands while the proposal is being produced: the candidate exists, but the response is not released to the removed member.
 const submit=t.core.transport.call;t.core.transport.call=async(...args)=>{const out=await submit(...args);if(args[0]==='submit')t.d.member('tenant-one','actor-1',{status:'removed',membershipRevision:'m2'});return out;};
 const withheld=await json(await t.post('/api/memory/proposals/propose',propose(1)));
 assert.deepEqual([withheld.status,withheld.body],[403,{error:{code:'MEMBERSHIP_REVOKED',outcome:'RESULT_NOT_RELEASED'}}]);
 assert.equal(t.core.reviews.size,1);t.core.transport.call=submit;
 assert.deepEqual(await json(await t.post('/api/memory/proposals/list',{})).then(r=>[r.status,r.body]),[403,{error:{code:'MEMBERSHIP_REVOKED'}}]);
 assert.equal((await t.post('/api/settings/user/read',{})).status,403);
 // A changed membership (client removed) is a new revision: in-flight reads are withheld, fresh requests see the narrowed walls.
 t.d.member('tenant-one','actor-1');const c=await json(await t.post('/api/memory/proposals/propose',propose(2,{scope:'client',clientId:id(901)})));assert.equal(c.status,200);
 const read=t.journal.listOwn;t.journal.listOwn=async v=>{const out=await read(v);t.d.member('tenant-one','actor-1',{clientIds:[],membershipRevision:'m3'});return out;};
 assert.deepEqual((await json(await t.post('/api/memory/proposals/list',{}))).body,{error:{code:'MEMBERSHIP_CHANGED'}});
 t.journal.listOwn=read;
 // The earlier withheld personal candidate is still the member's own; the client candidate is now outside their walls.
 assert.deepEqual((await json(await t.post('/api/memory/proposals/list',{}))).body.proposals.map(p=>p.scope),['personal']);
});

test('cross-tenant: another tenant member never sees or reaches this tenant data',async()=>{
 const t=setup();await t.post('/api/memory/proposals/propose',propose(1));
 await t.post('/api/settings/user/save',{expectedRevision:0,preferences:{theme:'dark',density:'compact',timezone:null,notifications:{runCompleted:false,approvalRequested:true,memoryReviewed:true},defaultClientId:null}});
 const other=await json(await t.post('/api/memory/proposals/list',{},{token:'token-2'}));assert.deepEqual(other.body.proposals,[]);
 const mine=[...t.journal.rows.values()][0].candidate.candidateId;
 assert.equal((await t.post('/api/memory/proposals/status',{candidateId:mine},{token:'token-2'})).status,404);
 assert.equal((await json(await t.post('/api/settings/user/read',{},{token:'token-2'}))).body.preferences.theme,'system');
 assert.equal((await t.post('/api/memory/proposals/propose',propose(5,{scope:'client',clientId:id(901)}),{token:'token-2'})).status,403);
});

test('settings routes: strict validation and widening refusal surface the offending field; admin gating holds over HTTP',async()=>{
 const t=setup();
 const bad=await json(await t.post('/api/settings/user/save',{expectedRevision:0,preferences:{theme:'neon',density:'compact',timezone:null,notifications:{runCompleted:true,approvalRequested:true,memoryReviewed:true},defaultClientId:null}}));
 assert.deepEqual([bad.status,bad.body],[400,{error:{code:'SETTINGS_FIELD_INVALID',field:'theme'}}]);
 assert.equal((await t.post('/api/settings/tenant/save',{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{}}})).status,403);
 t.d.member('tenant-one','actor-1',{permissions:[TENANT_SETTINGS_PERMISSION],membershipRevision:'m9'});
 const widen=await json(await t.post('/api/settings/tenant/save',{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{capabilities:{bash:true}}}}));
 assert.deepEqual([widen.status,widen.body],[422,{error:{code:'CAPABILITY_TENANT_WIDENING_REFUSED',field:'capabilityPolicy.bash'}}]);
 const saved=await json(await t.post('/api/settings/tenant/save',{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{capabilities:{workspaceTools:true}}}}));
 assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
 assert.equal((await json(await t.post('/api/settings/tenant/audit',{}))).body.entries.length,1);
 assert.equal((await t.post('/api/settings/tenant/read',{unexpected:true})).status,400);
});

test('foreign failures never leak their messages',async()=>{
 const t=setup();
 const r=await json(await t.post('/api/tasks/list',{}));assert.deepEqual([r.status,r.body],[503,{error:{code:'TASKS_UNAVAILABLE'}}]);assert.equal(t.reads.length,1);
 t.journal.listOwn=async()=>{throw Error('synthetic driver failure text that must not leak');};
 const leaked=await json(await t.post('/api/memory/proposals/list',{}));assert.deepEqual(leaked.body,{error:{code:'MEMORY_UNAVAILABLE'}});
});

import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './http-fixture.mjs';
import {id} from '../../test/store-fixture.mjs';
import {BILL_TEXT_SOURCE_READ_SCHEMA} from '../../../../../packages/contracts/conversation-sources/protocol.mjs';
test('production router rereads whole and continued hearing pages with current native authority',async()=>{
 for(const options of [{},{large:true,part:1},{view:'briefs'},{view:'reconciliation'}]){const f=await fixture({hearing:true,runtimeMount:true,...options}),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.deepEqual(value.current.result,f.p.result);assert.deepEqual(f.state.body,f.p.event.data.selection);assert.equal(f.state.sourceCalls,1);assert.equal(f.state.currentness,2);assert.equal(f.state.membership,1);assert.equal(f.state.retentionChecks,2);assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('tenant, actor, client, wall, suppression, unknown reference and mismatched source kind deny before Core',async()=>{
 for(const change of [f=>f.state.principal.tenantId=id(90),f=>f.state.principal.actorId=id(90),f=>f.state.principal.clientIds=[],f=>f.state.currentDenied=true,f=>f.state.admissionDenied=true,f=>f.state.suppressed=true]){const f=await fixture({hearing:true});change(f);const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,0);assert.doesNotMatch(await r.text(),/Synthetic public|records|payload/);}
 const f=await fixture({hearing:true});for(const request of [{...f.request,referenceId:id(90)},{...f.request,schemaVersion:BILL_TEXT_SOURCE_READ_SCHEMA}])assert.equal((await f.read(request)).status,404);assert.equal((await f.read({...f.request,authority:'forged'})).status,400);assert.equal(f.state.sourceCalls,0);
});
test('current Core denial and version/content changes withhold the entire source',async()=>{
 for(const [status,expected]of [[401,401],[403,403],[400,409],[503,503]]){const f=await fixture({hearing:true});f.state.sourceStatus=status;const r=await f.read();assert.equal(r.status,expected);assert.doesNotMatch(await r.text(),/Synthetic public|payload/);}
 const f=await fixture({hearing:true});f.state.result=structuredClone(f.p.result);f.state.result.records[0].payload.evidence.text='changed';assert.equal((await f.read()).status,409);
 for(const reason of ['record_content_changed_restart_read','record_superseded_explicit_historical_read_required','record_version_unavailable']){const f=await fixture({hearing:true});f.state.result={records:[],coverage:{sources:[{stopReason:reason}]}};const r=await f.read();assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:{code:'SOURCE_REFERENCE_STALE'}});}
});
test('revocation and suppression during hearing reread prevent final publication',async()=>{
 for(const key of ['membershipDenied','finalDenied','suppressed']){const f=await fixture({hearing:true});f.state.afterRead=()=>{f.state[key]=true;};const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,1);assert.doesNotMatch(await r.text(),/Synthetic public|payload/);}
});
test('General selected-client source still checks current client membership and cannot survive loss of access',async()=>{
 const f=await fixture({hearing:true,general:true,view:'briefs'});assert.equal((await f.read()).status,200);f.state.principal.clientIds=[];const r=await f.read();assert.equal(r.status,403);assert.equal(f.state.sourceCalls,1);
});

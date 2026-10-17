/** Actual borrowed-PG store, transaction, native Core membership transport, service and Fetch API. Database/identity/Fetch are scripted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createSettingsPoolFixture} from '../../test/postgres-store-fixture.mjs';
import {createUserPreferencesFeature} from '../feature.mjs';
import {fixture,CLIENT} from './fixture.mjs';
const read=/^SELECT revision,document,document_sha256 FROM meri_settings\.user_preferences WHERE tenant_id=\$1 AND actor_id=\$2$/u;
const insert=/^INSERT INTO meri_settings\.user_preferences\(.* ON CONFLICT \(tenant_id,actor_id\) DO NOTHING RETURNING revision,document,document_sha256$/u;
const audit=/^INSERT INTO meri_settings\.settings_audit\(/u;
test('opt-in composes actual owners; lost COMMIT ACK reconciles by read without redispatch or second audit',async()=>{
 const native=fixture(),preferences={...native.preferences,theme:'dark',defaultClientId:CLIENT,notifications:{runCompleted:false,approvalRequested:true,memoryReviewed:false}};
 const row={revision:'1',document:preferences,document_sha256:canonicalSha256(preferences)};
 const p=createSettingsPoolFixture([
  {steps:[{match:read,rows:[]}]},
  {steps:[{match:insert,rows:[row],inspect(params){assert.deepEqual(params.slice(0,2),['tenant-A','actor-A']);assert.deepEqual(JSON.parse(params[3]),preferences);}},{match:audit}],loseCommitAck:true},
  {steps:[{match:read,rows:[row]}]},
  {steps:[{match:insert,rows:[]}]},
 ]);
 const feature=createUserPreferencesFeature({enabled:true,pool:p.pool,gate:native.gate,now:()=>native.state.now,newId:native.newId});
 assert.equal(p.connections(),0);assert.equal(native.state.requests.length,0);
 const call=(operation,body={})=>feature.application.handle(new Request('https://meri.synthetic.invalid/api/settings/user/'+operation,
  {method:'POST',headers:{authorization:'Bearer A','content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await call('read')).status,200);
 const unknown=await call('save',{expectedRevision:0,preferences});assert.equal(unknown.status,503);
 assert.deepEqual(await unknown.json(),{error:{code:'SETTINGS_COMMIT_UNKNOWN',outcome:'UNKNOWN'}});
 assert.deepEqual(p.committed.map(x=>x.kind),['document','audit']);const calls=p.calls.filter(x=>insert.test(x.sql)).length;
 const observed=await call('read');assert.equal(observed.status,200);
 assert.deepEqual(await observed.json(),{owner:{tenantId:'tenant-A',actorId:'actor-A'},revision:1,preferences});
 assert.equal(p.calls.filter(x=>insert.test(x.sql)).length,calls);
 const replay=await call('save',{expectedRevision:0,preferences});assert.equal(replay.status,409);
 assert.deepEqual(await replay.json(),{error:{code:'SETTINGS_REVISION_CONFLICT'}});
 assert.equal(p.committed.filter(x=>x.kind==='audit').length,1);assert.equal(p.released.length,4);
 const before=p.connections();assert.equal((await call('tenant/read')).status,404);assert.equal(p.connections(),before);
});

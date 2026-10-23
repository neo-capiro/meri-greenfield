/** Source-only settings/CAS controls; native migration execution is a separate root gate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createPostgresSettingsStore} from '../postgres-store.mjs';
import {modelSettings,tenantSettings} from '../documents.mjs';
import {createSettingsPoolFixture} from './postgres-store-fixture.mjs';
import {PLATFORM} from './fixtures.mjs';

const base={capabilityPolicy:{},defaultTimezone:'UTC'};
const model={monthlyCapMicroUsd:123456789,maxTurns:20,maxBudgetMicroUsd:2000000};
const row=(revision,document,policy=model)=>({revision:String(revision),document,document_sha256:hash(document),monthly_cap_micro_usd:String(policy.monthlyCapMicroUsd),sdk_max_turns:policy.maxTurns,sdk_max_budget_micro_usd:String(policy.maxBudgetMicroUsd)});
const save=(document,expectedRevision=1)=>({kind:'tenant',tenantId:'tenant-synthetic',expectedRevision,document,audit:{auditId:'00000000-0000-4000-8000-000000000001',actorId:'admin-synthetic',platformSha256:'a'.repeat(64)}});
const select=/^SELECT \* FROM meri_settings\.tenant_settings .* FOR UPDATE$/u,update=/^UPDATE meri_settings\.tenant_settings /u,audit=/^INSERT INTO meri_settings\.settings_audit/u;

test('old-client omission preserves the exact locked model policy and audits the composed view',async()=>{
 const changed={...base,defaultTimezone:'America/Chicago'};
 const p=createSettingsPoolFixture([{steps:[{match:select,rows:[row(1,base)]},{match:update,rows:[row(2,changed)],inspect(params){assert.deepEqual(params.slice(-3),[model.monthlyCapMicroUsd,20,2000000]);assert.equal(params[2],JSON.stringify(changed));}},{match:audit,inspect(params){assert.equal(params[7],hash({...base,model}));assert.equal(params[8],hash({...changed,model}));assert.deepEqual(params[10],['defaultTimezone']);}}]}]);
 const result=await createPostgresSettingsStore({pool:p.pool}).save(save(changed));
 assert.deepEqual(result,{revision:2,documentSha256:hash(changed),model});
 assert.notEqual(result.documentSha256,hash({...changed,model}),'base integrity and audit hashes have distinct documented meaning');
});

test('one CAS changes typed policy with the existing audit owner and keeps base bytes/hash',async()=>{
 const next={monthlyCapMicroUsd:555555555,maxTurns:31,maxBudgetMicroUsd:3000000};
 const p=createSettingsPoolFixture([{steps:[{match:select,rows:[row(1,base)]},{match:update,rows:[row(2,base,next)],inspect(params){assert.equal(params[3],hash(base));assert.deepEqual(params.slice(-3),Object.values(next));}},{match:audit,inspect(params){assert.equal(params[7],hash({...base,model}));assert.equal(params[8],hash({...base,model:next}));assert.deepEqual(params[10],['model.maxBudgetMicroUsd','model.maxTurns','model.monthlyCapMicroUsd']);}}]}]);
 assert.deepEqual(await createPostgresSettingsStore({pool:p.pool}).save(save({...base,model:next})),{revision:2,documentSha256:hash(base),model:next});
});

test('policy update at a stale revision and divergent RETURNING policy both refuse before audit',async()=>{
 for(const stale of [true,false]){
  const steps=[{match:select,rows:[row(stale?2:1,base)]}];
  if(!stale)steps.push({match:update,rows:[row(2,base,{...model,monthlyCapMicroUsd:1})]});
  const p=createSettingsPoolFixture([{steps}]);
  await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(save(base)),new RegExp(stale?'SETTINGS_REVISION_CONFLICT':'SETTINGS_STORE_STATE'));
  assert.equal(p.calls.some(c=>audit.test(c.sql)),false);assert.deepEqual(p.committed,[]);
 }
});

test('explicit null, incomplete and malformed model policies cannot reset the cap',()=>{
 assert.deepEqual(tenantSettings(base,PLATFORM),base);
 for(const value of [null,{}, {...model,monthlyCapMicroUsd:null},{...model,monthlyCapMicroUsd:'123'},{...model,monthlyCapMicroUsd:0},{...model,maxTurns:101},{...model,override:1}]){
  assert.throws(()=>tenantSettings({...base,model:value},PLATFORM));
  assert.throws(()=>modelSettings(value));
 }
});

test('forward migration copies only the exact old cap and verifies the absent-row base hash',async()=>{
 const sql=await readFile(new URL('../../conversations/migrations/0021_sdk_run_usage.sql',import.meta.url),'utf8');
 assert.match(sql,new RegExp(hash(base)));
 assert.match(sql,/SELECT tenant_id,1,'\{"capabilityPolicy":\{\},"defaultTimezone":"UTC"\}'::jsonb/u);
 assert.match(sql,/FROM meri_product_budget\.tenant_budgets\s+ON CONFLICT \(tenant_id\) DO UPDATE SET monthly_cap_micro_usd=EXCLUDED\.monthly_cap_micro_usd/u);
 assert.doesNotMatch(sql,/monthly_cap_micro_usd bigint[^,]*DEFAULT/u);
 assert.doesNotMatch(sql,/UPDATE SET[^;]*(?:document|revision|sdk_max)/u);
 assert.match(sql,/sdk_max_turns integer NOT NULL DEFAULT 20/u);
 assert.match(sql,/sdk_max_budget_micro_usd bigint NOT NULL DEFAULT 2000000/u);
 assert.match(sql,/IS TRUE\);/u,'malformed JSON cannot satisfy a CHECK through SQL NULL');
});

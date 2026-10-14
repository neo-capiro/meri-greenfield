import test from 'node:test';import assert from 'node:assert/strict';
import pg from '/workspace/meri-first-session/apps/runtime/node_modules/pg/lib/index.js';
import {readFile} from 'node:fs/promises';
import {createPostgresAdmittedRunOwner} from '../../../../../apps/gateway/budget/admitted-run-owner.mjs';
import {productFixture} from '../../../../../apps/gateway/budget/product-scripted-fixture.mjs';
import {BudgetStateDenied} from '../../../../../apps/gateway/budget/postgres-budget-store.mjs';
test('genuine pg admitted-run owner refuses absent product namespace without leasing effects or substituting qualification grants',async()=>{
 const engine=JSON.parse(await readFile('/workspace/cloud-onboarding/meri-native/engine.json','utf8'));assert.deepEqual(engine,{host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner'});
 const pool=new pg.Pool({...engine,max:1,connectionTimeoutMillis:3000,query_timeout:3000,options:'-c default_transaction_read_only=on',application_name:'meri-first-session-read-only-probe'});
 try{const before=(await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'meri%' ORDER BY nspname")).rows.map(r=>r.nspname);assert.deepEqual(before,['meri_qualification']);
  const f=productFixture(),owner=createPostgresAdmittedRunOwner({pool,namespace:'product',allocationJson:JSON.stringify(f.allocation),grantFactsJsons:[JSON.stringify(f.context())],now:Date.now,limits:{maxRequestMs:1000,maxFactBytes:65536}});let effects=0;
  await assert.rejects(owner.currentRun(f.f.binding,{}),e=>e instanceof BudgetStateDenied&&e.message==='BUDGET_STATE_UNAVAILABLE');
  await assert.rejects(owner.withCurrentAllocation({binding:f.f.binding},async()=>{effects++;}),e=>e instanceof BudgetStateDenied&&e.message==='BUDGET_STATE_UNAVAILABLE');assert.equal(effects,0);
  assert.equal((await pool.query('SELECT 1 AS reusable')).rows[0].reusable,1);
  assert.deepEqual((await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'meri%' ORDER BY nspname")).rows.map(r=>r.nspname),before);
 }finally{await pool.end();}
});

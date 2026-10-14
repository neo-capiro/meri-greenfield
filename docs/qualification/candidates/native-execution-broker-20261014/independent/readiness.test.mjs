import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,control} from '../../../../../apps/runtime/native-authority/test/broker-pg-fixture.mjs';
import {listenFetch} from '../../../../../apps/runtime/native-authority/test/task-verifier-fixture.mjs';
import {createNativeBrokerStack} from '../../../../../apps/runtime/native-authority/broker-stack.mjs';
if(process.env.MERI_BROKER_TEST_DATABASE!=='meri_broker_independent')throw Error('Independent task-owned database required');
async function request(listener,token=control,body={}){return fetch(listener.origin+'/v1/readiness',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});}
test('actual readiness HTTP is control-only closed-body connectivity and allocates no execution',async t=>{
 const x=await fixture(t),listener=await listenFetch(x.stack.application);t.after(()=>listener.close());
 const good=await request(listener);assert.equal(good.status,200);assert.deepEqual(await good.json(),{service:'meri-native-capability-provider/1',ready:true});assert.equal(good.headers.get('cache-control'),'no-store');
 assert.equal((await request(listener,x.f.credential)).status,403);assert.equal((await request(listener,control,{ready:true})).status,503);assert.equal(x.stack.tasks.status().supervisorPid,null);assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'0');
});
test('readiness refuses missing execution/session/allocation schema in own database',async t=>{
 const x=await fixture(t),listener=await listenFetch(x.stack.application);t.after(()=>listener.close());
 for(const [schema,table] of [['meri_conversations','native_executions'],['meri_conversations','sdk_sessions'],['meri_product_budget','tool_run_allocations']]){
  await x.pool.query(`ALTER TABLE ${schema}.${table} RENAME TO independent_readiness_missing`);
  try{assert.equal((await request(listener)).status,503);}finally{await x.pool.query(`ALTER TABLE ${schema}.independent_readiness_missing RENAME TO ${table}`);}
 }assert.equal((await request(listener)).status,200);assert.equal(x.stack.tasks.status().supervisorPid,null);
});
test('readiness refuses actual executable hash mismatch without process allocation',async t=>{
 const x=await fixture(t),changed=createNativeBrokerStack({...x.config,launchConfiguration:{...x.launchConfiguration,executableSha256:'0'.repeat(64)}}),listener=await listenFetch(changed.application);t.after(()=>listener.close());
 assert.equal((await request(listener)).status,503);assert.equal(changed.tasks.status().supervisorPid,null);assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'0');await changed.close();
});
test('readiness refuses current grant revocation and closed supervisor even with schema/pins intact',async t=>{
 const x=await fixture(t),listener=await listenFetch(x.stack.application);t.after(()=>listener.close());assert.equal((await request(listener)).status,200);
 await x.revoke();assert.equal((await request(listener)).status,503);await x.stack.close();assert.equal((await request(listener)).status,503);assert.equal(x.stack.tasks.status().supervisorPid,null);
});
test('closing unopened task rejects readiness and launch without minting physical stop proof',async t=>{
 const x=await fixture(t);await x.stack.tasks.close();await assert.rejects(x.stack.tasks.readiness());await assert.rejects(x.stack.tasks.launch({...x.stack.broker.original,plan:x.stack.plan}));assert.equal(x.stack.tasks.status().supervisorPid,null);assert.equal(x.stack.tasks.status().closed,true);assert.equal(x.stack.tasks.status().physicalStopProven,false);assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'0');
});

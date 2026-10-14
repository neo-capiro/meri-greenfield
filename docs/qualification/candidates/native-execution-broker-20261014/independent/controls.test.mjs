import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../../../apps/runtime/native-authority/test/broker-pg-fixture.mjs';
import {createIndependentNativeTask} from '../../../../../apps/runtime/native-authority/independent-task.mjs';
import {createNativeBrokerStack} from '../../../../../apps/runtime/native-authority/broker-stack.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
if(process.env.MERI_BROKER_TEST_DATABASE!=='meri_broker_independent')throw Error('Independent task-owned database required');
test('actual launch observes committed claim before effect; concurrent replay has one physical owner',async t=>{
 let x,launches=0;
 x=await fixture(t,{tasksFactory:config=>{const task=createIndependentNativeTask(config);return {...task,async launch(input){
  const rows=(await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows;assert.equal(rows.length,1);assert.equal(rows[0].record.phase,'launching');assert.equal(rows[0].record.executionId,input.executionId);launches++;return task.launch(input);
 }};}});
 const replies=await Promise.all([x.start(),x.start(),x.start()]);assert.equal(launches,1);assert.ok(replies.every(r=>r.executionId===hash(x.binding)));assert.equal((await x.pool.query('SELECT current_database() AS db')).rows[0].db,'meri_broker_independent');
 await x.stack.close();assert.equal(x.stack.tasks.status().physicalStopProven,true);
});
test('revocation after acknowledged native launch retires original task before start failure',async t=>{
 let x,launches=0;x=await fixture(t,{tasksFactory:config=>{const task=createIndependentNativeTask(config);return {...task,async launch(input){launches++;const fact=await task.launch(input);await x.revoke();return fact;}};}});
 await assert.rejects(x.start());assert.equal(launches,1);assert.equal(x.stack.tasks.status().physicalStopProven,true);const record=(await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record;assert.equal(record.phase,'retired');assert.equal(record.native.physicalStopProven,true);await assert.rejects(x.start());assert.equal(launches,1);
});
test('coherently rehashed malformed native receipt fails durable decoding instead of repair',async t=>{
 const x=await fixture(t);await x.start();const before=(await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record;
 const damaged={...before,native:{...before.native,workerSelectedAuthority:true}};await x.pool.query('UPDATE meri_conversations.native_executions SET record=$1,record_sha256=$2',[damaged,hash(damaged)]);
 await assert.rejects(x.stack.store.executions.read(x.binding,()=>{}));await assert.rejects(x.poll());assert.deepEqual((await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record,damaged);await x.stack.tasks.close();assert.equal(x.stack.tasks.status().physicalStopProven,true);
});
test('actual launch/runtime plan changes cannot replay original durable intent',async t=>{
 const x=await fixture(t);await x.start();const changed=createNativeBrokerStack({...x.config,launchConfiguration:{...x.launchConfiguration,launch:{...x.launchConfiguration.launch,env:{...x.launchConfiguration.launch.env,MERI_INDEPENDENT_CHANGE:'changed'}}},runtime:{...x.runtime,proxyCredential:'changed-existing-proxy'}});
 assert.notEqual(changed.broker.original.planSha256,x.stack.broker.original.planSha256);await assert.rejects(changed.broker.start({binding:x.binding,executionKey:hash(x.binding)}));assert.equal(changed.tasks.status().supervisorPid,null);assert.equal((await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record.planSha256,x.stack.broker.original.planSha256);await changed.close();await x.stack.tasks.close();
});
test('hostile original launch configuration refuses without traps or task allocation',async t=>{
 const x=await fixture(t);let traps=0,created=0;const hostile={...x.launchConfiguration,get binding(){traps++;return x.binding;}};
 assert.throws(()=>createNativeBrokerStack({...x.config,launchConfiguration:hostile,tasksFactory(){created++;throw Error('must not allocate');}}));assert.equal(traps,0);assert.equal(created,0);assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'0');
});
test('worker byte port cannot forge registration; independent supervisor reads real CLI stdout',async t=>{
 const x=await fixture(t);await x.start();const l=x.launchConfiguration,p=x.stack.tasks.spawnClaudeCodeProcess({...l.launch,cwd:l.workspace});p.stdout.on('error',()=>{});p.stdout.resume();assert.equal(typeof p.stdout.write,'undefined');
 p.stdin.write(JSON.stringify({type:'system',subtype:'init',session_id:x.key.sessionId,claude_code_version:'2.1.295'})+'\n');await assert.rejects(x.stack.tasks.registration.read({binding:x.binding,key:x.key,deadlineMs:Date.now()+75}));
 p.stdin.write('emit\n');const receipt=await x.stack.tasks.registration.read({binding:x.binding,key:x.key,deadlineMs:Date.now()+2000});assert.deepEqual(receipt.binding,x.binding);assert.equal(receipt.expiresAtMs,x.expiry);assert.ok(x.stack.tasks.status().nativePid>1);assert.notEqual(x.stack.tasks.status().nativePid,x.stack.tasks.status().supervisorPid);await x.stack.close();assert.equal(x.stack.tasks.status().physicalStopProven,true);
});
test('runtime refuses continuation body and altered runtime pins without additional task',async t=>{
 const x=await fixture(t);await x.start();const pid=x.stack.tasks.status().supervisorPid;
 await assert.rejects(x.stack.runtime.runtime({binding:x.binding,versions:x.runtime.versions,continuation:{workerClaim:true}}));await assert.rejects(x.stack.runtime.runtime({binding:{...x.binding,writerFence:2},versions:x.runtime.versions}));assert.equal(x.stack.tasks.status().supervisorPid,pid);
 assert.equal((await x.stack.runtime.runtime({binding:x.binding,versions:x.runtime.versions})).deadlineMs,x.expiry);
});

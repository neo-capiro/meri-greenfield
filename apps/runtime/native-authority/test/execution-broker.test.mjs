import test from 'node:test';import assert from 'node:assert/strict';import {fixture,sha,control} from './broker-pg-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';import {createNativeExecutionBroker} from '../execution-broker.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';import {createNativeCapabilityClient} from '../../native-client.mjs';
import {listenFetch} from './task-verifier-fixture.mjs';import {createNativeSdkSessionApplication} from '../session-http.mjs';import {createNativeSdkSessionClient} from '../session-client.mjs';
test('real PostgreSQL concurrent/replayed start retains one actual independent supervisor and original claim',async t=>{
 const x=await fixture(t);const replies=await Promise.all(Array.from({length:4},()=>x.start()));assert.ok(replies.every(r=>r.executionId===hash(x.binding)));
 const rows=await x.pool.query('SELECT record FROM meri_conversations.native_executions');assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].record.phase,'started');const pid=x.stack.tasks.status().supervisorPid;assert.ok(pid>0&&pid!==process.pid);
 const fresh=createNativeExecutionBroker({binding:x.binding,versions:x.runtime.versions,plan:x.stack.plan,expiresAtMs:x.expiry,journal:createPostgresConversationStore({pool:x.pool}).executions,tasks:x.stack.tasks,verifier:x.config.supervisor.taskVerifier,taskCapability:x.f.credential,enabled:true,maxRequestMs:5000});
 assert.equal((await fresh.start({binding:x.binding,executionKey:hash(x.binding)})).executionId,replies[0].executionId);assert.equal(x.stack.tasks.status().supervisorPid,pid);assert.equal((await x.poll()).state,'executing');
});
test('actual protected HTTP broker/runtime path correlates current native task and original runtime',async t=>{
 const x=await fixture(t),listener=await listenFetch(x.stack.application);t.after(()=>listener.close());
 const native=credential=>createNativeCapabilityClient({configuration:{origin:listener.origin,maxResponseBytes:131072},credential});
 const started=await native(control).call('execution/start',{binding:x.binding,executionKey:hash(x.binding)});assert.equal(started.expiresAtMs,x.expiry);
 assert.equal((await native(x.f.credential).call('runner/runtime',{binding:x.binding,versions:x.runtime.versions})).sdkSessionKey,null);
 await assert.rejects(native(x.f.credential).call('execution/poll',{binding:x.binding,executionId:hash(x.binding)}));await assert.rejects(native(control).call('runner/runtime',{binding:x.binding,versions:x.runtime.versions}));
 await x.revoke();await assert.rejects(native(x.f.credential).call('runner/runtime',{binding:x.binding,versions:x.runtime.versions}));assert.equal(x.stack.tasks.status().physicalStopProven,true);
});
test('separate supervisor observes real native-format bytes and canonical PG session owner retains witness',async t=>{
 const x=await fixture(t);await x.start();const l=x.launchConfiguration,processPort=x.stack.tasks.spawnClaudeCodeProcess({...l.launch,cwd:l.workspace});assert.notEqual(x.stack.tasks.status().supervisorPid,process.pid);processPort.stdout.resume();processPort.stdin.write('emit\n');
 const session=createNativeSdkSessionApplication({owner:x.stack.productPorts.sdkSessionOwner,maxRequestMs:3000}),listener=await listenFetch(session);t.after(()=>listener.close());
 const client=createNativeSdkSessionClient({origin:'https://session.synthetic.invalid',binding:x.binding,credential:x.f.credential,fetchImpl:(url,options)=>fetch(listener.origin+new URL(url).pathname,options)});
 assert.equal((await client.register({key:x.key})).registered,true);const entries=[{type:'system',marker:'real PG and separate trusted observer'}];await client.append({key:x.key,appendId:'11111111-1111-4111-8111-000000000090',expectedOffset:0,entriesSha256:hash(entries),entries});assert.deepEqual((await client.load({key:x.key})).entries,entries);
 const stored=(await x.pool.query('SELECT owner FROM meri_conversations.sdk_sessions')).rows[0].owner;assert.equal(stored.expiresAtMs,x.expiry);assert.deepEqual(stored.binding,x.binding);assert.notEqual(stored.observationId,'synthetic');
 await x.status('starting',100);await x.status('running',101);await x.status('completed',102);assert.equal((await x.poll()).state,'completed');assert.equal(x.stack.tasks.status().physicalStopProven,true);assert.equal((await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record.phase,'retired');
});
test('lost real claim commit acknowledgement dispatches zero and durable replay never relaunches',async t=>{
 const x=await fixture(t);let lose=true;const wrapped={async connect(){const real=await x.pool.connect();return {async query(sql,args){const out=await real.query(sql,args);if(sql==='COMMIT'&&lose){lose=false;throw Error('synthetic lost ACK after actual PG COMMIT');}return out;},release:e=>real.release(e)};}};
 const journal=createPostgresConversationStore({pool:wrapped}).executions;let calls=0;const tasks={launch(){calls++;throw Error();},inspect(){throw Error('no launch exists');},retire(){throw Error('no launch exists');}};
 const broker=createNativeExecutionBroker({binding:x.binding,versions:x.runtime.versions,plan:x.stack.plan,expiresAtMs:x.expiry,journal,tasks,verifier:x.config.supervisor.taskVerifier,taskCapability:x.f.credential,enabled:true});
 await assert.rejects(broker.start({binding:x.binding,executionKey:hash(x.binding)}),/COMMIT_UNKNOWN/);assert.equal(calls,0);assert.equal((await x.pool.query('SELECT count(*) FROM meri_conversations.native_executions')).rows[0].count,'1');await assert.rejects(broker.start({binding:x.binding,executionKey:hash(x.binding)}));assert.equal(calls,0);
});
test('durable journal refuses altered plan/expiry/phase and SQL trigger protects original identity',async t=>{
 const x=await fixture(t);await x.start();const record=(await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record;
 await assert.rejects(x.stack.store.executions.claim({...x.stack.broker.original,versions:undefined},()=>{}));
 await assert.rejects(x.stack.store.executions.record({binding:x.binding,executionId:record.executionId,phase:'retired',native:null},()=>{}));
 await assert.rejects(x.pool.query("UPDATE meri_conversations.native_executions SET record=jsonb_set(record,'{expiresAtMs}','1')"),/immutable/);assert.equal((await x.pool.query('SELECT record FROM meri_conversations.native_executions')).rows[0].record.expiresAtMs,x.expiry);
});
test('product completion and native process exit are independent facts; revocation still permits original containment',async t=>{
 const x=await fixture(t);await x.start();const l=x.launchConfiguration,p=x.stack.tasks.spawnClaudeCodeProcess({...l.launch,cwd:l.workspace});p.stdout.resume();p.stdin.end();await new Promise(resolve=>p.once('exit',resolve));await assert.rejects(x.poll(),/PROCESS_STOPPED_WITHOUT_RUN_OUTCOME/);assert.equal(x.stack.tasks.status().physicalStopProven,true);
});

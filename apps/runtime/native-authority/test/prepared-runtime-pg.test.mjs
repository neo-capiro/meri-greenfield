/** Actual canonical SQL, control HTTP receiver and session owner. No model/process/cloud calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {admittedController} from './run-pg-fixture.mjs';
import {createNativeSdkSessionClient} from '../session-client.mjs';
test('prepared runtime and native session registration use the current canonical run without a model launch descriptor',async t=>{
 const f=await admittedController(t),{controller,binding,runtime}=f;
 t.after(()=>controller.close());
 await assert.rejects(controller.runtime.runtime({binding,versions:runtime.versions}));
 await controller.allocate();const prepared=await controller.runtime.runtime({binding,versions:runtime.versions});
 assert.deepEqual(prepared,{...runtime,sdkSessionKey:null});assert.equal(f.counts.allocations,1);
 const sessions=createNativeSdkSessionClient({origin:'https://synthetic-controller.invalid',credential:f.credential,binding,fetchImpl:(url,options)=>controller.application.handle(new Request(url,options))});
 assert.equal((await sessions.register({key:f.sessionKey})).registered,true);
 assert.equal((await sessions.register({key:f.sessionKey})).registered,true);
 const rows=(await f.pool.query('SELECT owner FROM meri_conversations.sdk_sessions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId])).rows;
 assert.equal(rows.length,1);assert.deepEqual(rows[0].owner.key,f.sessionKey);
 await f.revoke();await assert.rejects(controller.runtime.runtime({binding,versions:runtime.versions}));await assert.rejects(sessions.register({key:f.sessionKey}));
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.sdk_sessions WHERE tenant_id=$1',[binding.tenantId])).rows[0].n,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionSessions} from '../execution-sessions.mjs';

test('each service observation reads current execution once and cannot replay or forge a receipt',async()=>{
 let reads=0,at=1000,changed=false;
 const sessions=createExecutionSessions({binding,credential:'synthetic-run-credential',now:()=>at,
  execution:{async authenticate(){reads++;return {execution:{binding:changed?{...binding,writerFence:2}:binding,expiresAtMs:3000},
   scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:'11111111-1111-4111-8111-111111111111',policyRevision:'v1'}],selectedClientId:'11111111-1111-4111-8111-111111111111'};}}});
 const auth=await sessions.authenticateSession({credential:'synthetic-run-credential',deadlineMs:2000});
 const current=await sessions.readCurrentState({authentication:structuredClone(auth)});
 assert.equal(reads,1);assert.deepEqual(current.binding,binding);assert.equal(current.expiresAtMs,2000);
 await assert.rejects(sessions.readCurrentState({authentication:auth}),/EXECUTION_AUTHORITY_REFUSED/u);
 await assert.rejects(sessions.authenticateSession({credential:'foreign'}),/EXECUTION_AUTHORITY_REFUSED/u);
 const next=await sessions.authenticateSession({credential:'synthetic-run-credential'});assert.equal(reads,2);
 await assert.rejects(sessions.readCurrentState({authentication:{...next,expiresAtMs:999999}}),/EXECUTION_AUTHORITY_REFUSED/u);
 at=3001;await assert.rejects(sessions.readCurrentState({authentication:next}),/EXECUTION_AUTHORITY_REFUSED/u);
 at=1000;changed=true;
 await assert.rejects(sessions.authenticateSession({credential:'synthetic-run-credential'}),/EXECUTION_AUTHORITY_REFUSED/u);
});

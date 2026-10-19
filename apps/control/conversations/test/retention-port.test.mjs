/** Canonical retention read gates compose without changing suppression or cleanup ownership. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationService,cleanupRead} from '../service.mjs';
import {applicationFixture,binding,versions} from './application-fixture.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createServingFence} from '../../retention/serving-fence.mjs';
import {createRetentionReadGate} from '../../retention/suppression.mjs';
import {subjectKey} from '../../retention/boundary.mjs';

test('the canonical retention gate composes, suppresses history and still permits cancellation cleanup',async()=>{
 const journal=createMemoryRetentionJournal(),serving=createServingFence();serving.enable({watermark:{sequence:0,entrySha256:null}});
 const retention=createRetentionReadGate({journal,serving});assert.equal(typeof retention.withRelease,'function');
 const f=await applicationFixture({initialInput:true,retention});
 try{
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  assert.equal((await f.service.history({credential:f.credential})).run.state,'queued');
  const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
  await journal.set(subjectKey(subject),{state:'SUPPRESSED',ledgerSequence:1,entrySha256:'a'.repeat(64)});
  await assert.rejects(f.service.history({credential:f.credential}),{code:'RETENTION_SUPPRESSED'});
  assert.deepEqual(await f.service.cancel({credential:f.credential}),{state:'cancelled'});assert.equal(f.state.cancels,1);
  assert.equal((await f.service[cleanupRead]({credential:f.credential})).run.state,'cancelled');
  assert.equal(await retention.isSuppressed(subject),true,'cleanup never releases suppression');
 }finally{f.close();}
});

test('optional serving methods are typed and unknown retention keys remain closed without invoking any owner',()=>{
 const unused=()=>assert.fail('configuration validation must not invoke a retained owner');
 const options={sessions:{authenticateSession:unused,readCurrentState:unused},store:{accept:unused,append:unused,read:unused},dispatcher:{start:unused,cancel:unused},versions};
 for(const retention of [{assertServable:unused},{assertServable:unused,isSuppressed:unused},{assertServable:unused,isSuppressed:unused,withRelease:unused}])assert.doesNotThrow(()=>createConversationService({...options,retention}));
 for(const withRelease of [undefined,null,false,1,'callable',{}])assert.throws(()=>createConversationService({...options,retention:{assertServable:unused,withRelease}}),{code:'CONTROL_CONFIGURATION'});
 assert.throws(()=>createConversationService({...options,retention:{assertServable:unused,withRelease:unused,foreign:unused}}),{message:'INVALID_COMMAND'});
 assert.throws(()=>createConversationService({...options,retention:{assertServable:null,withRelease:unused}}),{code:'CONTROL_CONFIGURATION'});
});

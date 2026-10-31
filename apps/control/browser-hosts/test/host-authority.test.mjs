import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalHostAuthority} from '../native-currentness.mjs';
const policy='a'.repeat(64);
const binding={tenantId:'tenant',actorId:'00000000-0000-4000-8000-000000000001',conversationId:'00000000-0000-4000-8000-000000000002',runId:'00000000-0000-4000-8000-000000000003',attemptId:'00000000-0000-4000-8000-000000000004',workerId:'00000000-0000-4000-8000-000000000005',writerFence:1};
const now=1000;
const core={async readCurrent({credential}){assert.equal(credential,'live-credential');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:['chat'],clientIds:[],identityRevision:'c'.repeat(64),membershipRevision:'d'.repeat(64),contextRevision:'e'.repeat(64),conversationId:binding.conversationId,selectedClientId:null,checkedAtMs:now,expiresAtMs:6000};}};
const nativeCredentials={async nativeCredentialFor(){return {credential:'live-credential',expiresAtMs:6000};}};
const retentionGate={async assertServable({tenantId,kind,subjectId}){assert.equal(tenantId,binding.tenantId);assert.equal(kind,'conversation');assert.equal(subjectId,binding.conversationId);}};
test('host authority external producer needs no execution reader and returns only bound facts plus currentUntil',async()=>{
 const owner=createCanonicalHostAuthority({core,nativeCredentials,retentionGate,now:()=>now,policySha256:policy,maxFreshMs:30000});
 const answer=await owner.verify(undefined,{binding,selectedClientId:null,expectedPolicySha256:policy,deadlineMs:31000});
 assert.deepEqual(Object.keys(answer).sort(),['binding','currentUntilMs','policySha256','selectedClientId']);
 assert.equal(answer.currentUntilMs,6000);assert.equal(answer.binding, binding);
});
test('host authority refuses a policy mismatch and retention refusal',async()=>{
 const owner=createCanonicalHostAuthority({core,nativeCredentials,retentionGate,now:()=>now,policySha256:policy,maxFreshMs:30000});
 await assert.rejects(()=>owner.verify(undefined,{binding,selectedClientId:null,expectedPolicySha256:'b'.repeat(64),deadlineMs:31000}),{code:'NATIVE_HOST_AUTHORITY_REFUSED'});
 const refusing=createCanonicalHostAuthority({core,nativeCredentials,retentionGate:{async assertServable(){throw Error('refused');}},now:()=>now,policySha256:policy});
 await assert.rejects(()=>refusing.verify(undefined,{binding,selectedClientId:null,expectedPolicySha256:policy,deadlineMs:31000}));
});

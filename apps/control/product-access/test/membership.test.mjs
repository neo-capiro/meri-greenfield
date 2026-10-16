/** SYNTHETIC: membership gate with scripted identity and Core-membership ports, and its use as the identity port of the actual
 * process-local action-session owner. Not Clerk, Core or live-policy qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {productFailure} from '../errors.mjs';
import {createMembershipGate} from '../membership.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';
import {NOW,directory,id} from './fixtures.mjs';
const code=async(promise,expected)=>assert.rejects(promise,e=>productFailure(e)?.code===expected);

test('admits only a currently active member and builds the principal from Core facts',async()=>{
 const d=directory();const {principal}=await d.gate.admit({credential:'token-1'});
 assert.deepEqual(principal,{tenantId:'tenant-one',actorId:'actor-1',role:'member',permissions:[],clientIds:[id(901)],membershipRevision:'m1'});
 assert.equal(Object.isFrozen(principal),true);
 await code(d.gate.admit({credential:'unknown'}),'ACCESS_DENIED');
 d.member('tenant-one','actor-1',{status:'removed'});await code(d.gate.admit({credential:'token-1'}),'MEMBERSHIP_REVOKED');
 d.member('tenant-one','actor-1',{status:'suspended'});await code(d.gate.admit({credential:'token-1'}),'MEMBERSHIP_REVOKED');
 d.members.delete('tenant-one/actor-1');await code(d.gate.admit({credential:'token-1'}),'ACCESS_DENIED');
});

test('membership facts must match the verified identity, be fresh and closed',async()=>{
 const d=directory();
 d.members.set('tenant-one/actor-1',{...d.members.get('tenant-one/actor-1'),tenantId:'tenant-two'});await code(d.gate.admit({credential:'token-1'}),'ACCESS_DENIED');
 d.member('tenant-one','actor-1',{clientIds:['not-a-uuid']});await code(d.gate.admit({credential:'token-1'}),'ACCESS_DENIED');
 d.member('tenant-one','actor-1',{extra:true});await code(d.gate.admit({credential:'token-1'}),'ACCESS_DENIED');
 d.member('tenant-one','actor-1',{role:'Not A Role'});await code(d.gate.admit({credential:'token-1'}),'ACCESS_DENIED');
 const stale=createMembershipGate({now:()=>NOW,limits:{maxRequestMs:2000,maxFactBytes:65536},verifyToken:async()=>({tenantId:'tenant-one',actorId:'actor-1',checkedAtMs:NOW-1,expiresAtMs:NOW+1000}),readMembership:async()=>{throw Error('unreached');}});
 await code(stale.admit({credential:'token-1'}),'ACCESS_DENIED');
});

test('recheck denies stored access after removal or any membership change',async()=>{
 const d=directory();const {principal}=await d.gate.admit({credential:'token-1'});
 assert.equal(await d.gate.recheck({principal}),principal);
 d.member('tenant-one','actor-1',{clientIds:[],membershipRevision:'m2'});await code(d.gate.recheck({principal}),'MEMBERSHIP_CHANGED');
 d.member('tenant-one','actor-1',{status:'removed',membershipRevision:'m3'});await code(d.gate.recheck({principal}),'MEMBERSHIP_REVOKED');
});

test('removal denies a stored action session on its next use and discards it (actual action-session owner)',async()=>{
 const d=directory();
 const binding={tenantId:'tenant-one',actorId:'actor-1',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const owner=createActionSessionOwner({mode:'process-local',now:()=>d.now,verifyIdentity:d.gate.verifyIdentity,limits:{maxSessions:4,maxRequestMs:2000,maxTtlMs:60000,maxFactBytes:65536},
  resolveContext:async({identitySha256})=>({identitySha256,binding,scopes:[{tenantId:'tenant-one',kind:'client',resourceId:id(901),policyRevision:'p1'}],selectedClientId:id(901),contextRevision:'c1',checkedAtMs:d.now,expiresAtMs:d.now+60000})});
 const issued=await owner.issue({identityCredential:'token-1'});
 assert.equal((await owner.authenticateSession({credential:issued.credential})).principal.actorId,'actor-1');
 d.member('tenant-one','actor-1',{status:'removed',membershipRevision:'m2'});
 await assert.rejects(owner.authenticateSession({credential:issued.credential}),/SESSION_REFUSED/);
 assert.equal(owner.status().sessions,0);
 // Reinstatement does not revive the discarded session; a new issuance is required.
 d.member('tenant-one','actor-1');await assert.rejects(owner.authenticateSession({credential:issued.credential}),/SESSION_REFUSED/);
 await assert.rejects(owner.issue({identityCredential:'token-1'}).then(()=>{d.member('tenant-one','actor-1',{status:'removed'});return owner.issue({identityCredential:'token-1'});}),/SESSION_REFUSED/);
 // A role or client change is also a new identity revision, so the stored session no longer authenticates.
 d.member('tenant-one','actor-1');const again=await owner.issue({identityCredential:'token-1'});
 d.member('tenant-one','actor-1',{role:'analyst'});await assert.rejects(owner.authenticateSession({credential:again.credential}),/SESSION_REFUSED/);
 owner.close();
});

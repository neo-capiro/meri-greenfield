import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionSessionOwner} from '../../../../../apps/control/action-host/session/owner.mjs';
import {createApplicationContextAdapters} from '../../../../../apps/control/action-host/application-adapters/context-adapter.mjs';
import {assertAuthorityContextReceipt} from '../../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const at=1791914400000,now=()=>at;
const binding={tenantId:'synthetic-tenant',actorId:'synthetic-backend-user',conversationId:'10000000-0000-4000-8000-000000000001',runId:'10000000-0000-4000-8000-000000000002',attemptId:'10000000-0000-4000-8000-000000000003',workerId:'10000000-0000-4000-8000-000000000004',writerFence:1};
const clientId='10000000-0000-4000-8000-000000000005';
const identity={principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic-current-native-revision',checkedAtMs:at,expiresAtMs:at+1000};
const native={identitySha256:canonicalSha256(identity),principal:identity.principal,identityRevision:identity.identityRevision,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'synthetic-current-native-wall-revision',checkedAtMs:at,expiresAtMs:at+1000};
const limits={maxSessions:4,maxRequestMs:500,maxTtlMs:1000,maxFactBytes:131072};
const issue={identityCredential:'synthetic-only',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId}};
test('valid Capiro context wire cannot be supplied directly as Meri opaque-session current state',async()=>{
 assertAuthorityContextReceipt(native);
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:async()=>identity,resolveContext:async()=>native,now,limits});
 try{await assert.rejects(sessions.issue(issue),error=>error.code==='SESSION_REFUSED');assert.equal(sessions.status().sessions,0);}finally{sessions.close();}
});
test('same native context passes through canonical current-run join with no extra backend wall field',async()=>{
 let checks=0;
 const adapter=createApplicationContextAdapters({client:{readIdentity:async()=>identity,readContext:async()=>native},currentRun:async()=>{checks++;return JSON.stringify({binding,policyRevision:'synthetic-current-policy',deadlineMs:at+1000,checkedAtMs:at});},commandContext:{binding,clientResolution:{reference:clientId,clientId}},now,limits:{maxRequestMs:500,maxFactBytes:131072}});
 const sessions=createActionSessionOwner({mode:'process-local',...adapter,now,limits});
 try{const receipt=await sessions.issue(issue);assert.equal(receipt.context.selectedClientId,clientId);assert.equal(receipt.context.actorId,binding.actorId);assert.equal(checks,2);assert.equal(sessions.status().sessions,1);}finally{sessions.close();}
});

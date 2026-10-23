import test from 'node:test';import assert from 'node:assert/strict';
import {assertGeneralClientDelegation as check} from '../general-read-delegation.mjs';
import {conversationScopes} from '../../../../packages/contracts/conversation-scope.mjs';
import {BINDING as binding,CLIENT,POLICY as policyRevision} from './current-authority-fixture.mjs';
const principal={tenantId:binding.tenantId,actorId:binding.actorId};
function proof(){return {binding,policyRevision,scopes:conversationScopes(binding,null,policyRevision),subject:{...principal,kind:'client',entityType:'client',entityIds:[CLIENT],policyRevision,scopes:conversationScopes(binding,CLIENT,policyRevision)},native:{principal,identityRevision:'identity',membershipRevision:'member',clientIds:[CLIENT]},conversation:{principal,identityRevision:'identity',contextRevision:'context',conversationId:binding.conversationId,selectedClientId:null}};}
test('explicit native General context and current exact client wall prove one private-task delegation',()=>{assert.equal(check(proof()).clientId,CLIENT);});
test('delegation proof rejects missing General context, foreign principals, stale identities, revoked walls and mixed results',()=>{
 for(const mutate of [p=>p.conversation=null,p=>p.conversation.selectedClientId=CLIENT,p=>p.scopes[0].resourceId='foreign',p=>p.scopes[0].kind='tenant',p=>p.subject.actorId='foreign',p=>p.native={...p.native,principal:{...principal,actorId:'foreign'}},p=>p.conversation.identityRevision='stale',p=>p.native.clientIds=[],p=>p.subject.entityIds.push('foreign'),p=>p.subject.scopes=conversationScopes(binding,null,policyRevision)]){const p=proof();mutate(p);assert.throws(()=>check(p));}
});

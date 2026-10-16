import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplicationContextAdapters} from './context-adapter.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {binding,id} from '../../conversations/test/application-fixture.mjs';

const at=Date.now(),clientId=id(5),candidate=id(710),policyRevision='a'.repeat(64);
const next={...binding,conversationId:candidate,runId:id(711),attemptId:id(712),workerId:id(713)};
const principal={tenantId:binding.tenantId,actorId:binding.actorId};
const identity={principal,identityRevision:'native-1',checkedAtMs:at,expiresAtMs:at+1000};
const runFact=()=>JSON.stringify({binding:next,policyRevision,checkedAtMs:at,deadlineMs:at+800});

function fixture({denyContext=false,rotateContext=false}={}){
 const order=[];let contextReads=0;
 const adapters=createApplicationContextAdapters({commandContext:{binding,clientResolution:{reference:clientId,clientId}},now:()=>at,limits:{maxRequestMs:500,maxFactBytes:65536},
  client:{async readIdentity(){order.push('identity');return identity;},async readContext({conversationId,clientId:requested,identitySha256}){order.push('context');contextReads++;if(denyContext)throw Error('Core denied');return {...identity,identitySha256,conversationId,selectedClientId:requested,contextRevision:rotateContext&&contextReads===2?'changed':'stable'};}},
  async currentRun(request){order.push('current');assert.deepEqual(request,next);return runFact();},
  async admitInitialConversation(request){order.push('admit');assert.deepEqual(request.principal,principal);assert.equal(request.conversationId,candidate);assert.equal(request.selectedClientId,clientId);return runFact();}});
 const resolve=async(hints={conversationId:candidate,clientId})=>{const proven=await adapters.verifyIdentity({credential:'native-bearer',deadlineMs:at+500});return adapters.resolveContext({identityCredential:'native-bearer',identity:proven,identitySha256:canonicalSha256(proven),hints,deadlineMs:at+500});};
 return {order,resolve};
}

test('dynamic initial binding is admitted only after native Core context and rechecked before release',async()=>{
 const f=fixture(),result=await f.resolve();assert.deepEqual(result.binding,next);assert.equal(result.selectedClientId,clientId);
 assert.deepEqual(f.order,['identity','context','admit','current','context','current']);
});
test('Core denial cannot admit a candidate conversation',async()=>{const f=fixture({denyContext:true});await assert.rejects(f.resolve());assert.deepEqual(f.order,['identity','context']);});
test('changed Core context during admission refuses release',async()=>{const f=fixture({rotateContext:true});await assert.rejects(f.resolve());assert.deepEqual(f.order,['identity','context','admit','current','context']);});
test('run hint cannot replace the admitted binding',async()=>{const f=fixture();await assert.rejects(f.resolve({conversationId:candidate,clientId,runId:id(714)}));assert.deepEqual(f.order,['identity','context','admit']);});

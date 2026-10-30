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

function fixture({denyContext=false,rotateContext=false,admit=null}={}){
 const order=[],admitted=[];let contextReads=0;
 const adapters=createApplicationContextAdapters({now:()=>at,limits:{maxRequestMs:500,maxFactBytes:65536},
  client:{async readIdentity(){order.push('identity');return identity;},async readContext({conversationId,clientId:requested,identitySha256}){order.push('context');contextReads++;if(denyContext)throw Error('Core denied');return {...identity,identitySha256,conversationId,selectedClientId:requested,contextRevision:rotateContext&&contextReads===2?'changed':'stable'};}},
  async currentRun(request){order.push('current');assert.deepEqual(request,next);return runFact();},
  async admitInitialConversation(request){order.push('admit');admitted.push(request);assert.deepEqual(request.principal,principal);assert.equal(request.conversationId,candidate);assert.equal(request.selectedClientId,clientId);return admit?admit(request):runFact();}});
 const resolve=async(hints={conversationId:candidate,clientId})=>{const proven=await adapters.verifyIdentity({credential:'native-bearer',deadlineMs:at+500});return adapters.resolveContext({identityCredential:'native-bearer',identity:proven,identitySha256:canonicalSha256(proven),hints,deadlineMs:at+500});};
 return {order,admitted,resolve};
}

test('dynamic initial binding is admitted only after native Core context and rechecked before release',async()=>{
 const f=fixture(),result=await f.resolve();assert.deepEqual(result.binding,next);assert.equal(result.selectedClientId,clientId);
 assert.deepEqual(f.order,['identity','context','admit','current','context','current']);
});
test('Core denial cannot admit a candidate conversation',async()=>{const f=fixture({denyContext:true});await assert.rejects(f.resolve());assert.deepEqual(f.order,['identity','context']);});
test('changed Core context during admission refuses release',async()=>{const f=fixture({rotateContext:true});await assert.rejects(f.resolve());assert.deepEqual(f.order,['identity','context','admit','current','context']);});
test('run hint cannot replace the admitted binding',async()=>{const f=fixture();await assert.rejects(f.resolve({conversationId:candidate,clientId,runId:id(714)}));assert.deepEqual(f.order,['identity','context','admit']);});
test('an exact run hint reaches the trusted admission only as a constraint; no hint passes none',async()=>{
 const hinted=fixture();assert.deepEqual((await hinted.resolve({conversationId:candidate,clientId,runId:next.runId})).binding,next);assert.equal(hinted.admitted[0].runId,next.runId);
 const plain=fixture();await plain.resolve();assert.equal(Object.hasOwn(plain.admitted[0],'runId'),false);
});
// C1: the internal atomic supersession result is the only thing that lets a hinted runId differ from the binding
// this admission returns. Every other mismatch, and every malformed proof, still refuses at the same boundary.
const source={...next,runId:id(714),attemptId:id(715),workerId:id(716)};
const withProof=proof=>async()=>JSON.stringify({binding:next,policyRevision,checkedAtMs:at,deadlineMs:at+800,rebind:proof});
test('a verified exact-source supersession is carried with the fact and pins the returned binding',async()=>{
 const f=fixture({admit:withProof({source,target:next})});
 const result=await f.resolve({conversationId:candidate,clientId,runId:source.runId});
 assert.deepEqual(result.binding,next);assert.deepEqual(result.rebind,{source,target:next});
 assert.equal(f.admitted[0].runId,source.runId,'the exact source still reaches the owner as a constraint');
 assert.deepEqual(f.order,['identity','context','admit','current','context','current']);
});
test('a mismatched, forged or foreign internal supersession still refuses',async()=>{
 const noProof=fixture();await assert.rejects(noProof.resolve({conversationId:candidate,clientId,runId:source.runId}));assert.deepEqual(noProof.order,['identity','context','admit']);
 const forged=fixture({admit:withProof({source,target:{...next,runId:id(799)}})});await assert.rejects(forged.resolve({conversationId:candidate,clientId,runId:source.runId}));assert.deepEqual(forged.order,['identity','context','admit']);
 const foreign=fixture({admit:withProof({source:{...source,conversationId:id(701)},target:next})});await assert.rejects(foreign.resolve({conversationId:candidate,clientId,runId:source.runId}));assert.deepEqual(foreign.order,['identity','context','admit']);
 const selfProof=fixture({admit:withProof({source:next,target:next})});await assert.rejects(selfProof.resolve({conversationId:candidate,clientId,runId:source.runId}));assert.deepEqual(selfProof.order,['identity','context','admit']);
});


for(const intent of ['resume','takeover.end'])test(`fresh exact target context accepts ${intent} without selecting another run`,async()=>{
 const target={...binding,runId:id(720),attemptId:id(721),workerId:id(722),writerFence:binding.writerFence+1};
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision}],nativeContextRevision='stable';let currentReads=0;
 const adapters=createApplicationContextAdapters({now:()=>at,limits:{maxRequestMs:500,maxFactBytes:65536},
  client:{readIdentity:async()=>identity,readContext:async input=>({...identity,identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:nativeContextRevision})},
  currentRun:async requested=>{assert.deepEqual(requested,target);currentReads++;return JSON.stringify({binding:target,policyRevision,checkedAtMs:at,deadlineMs:at+800});},
  admitInitialConversation:async()=>assert.fail('a committed transition must never select or reserve')});
 const sourceContext={binding,scopes,selectedClientId:clientId,contextRevision:canonicalSha256({identityRevision:identity.identityRevision,nativeContextRevision,binding,policyRevision})};
 const input={identityCredential:'synthetic-native',identity,identitySha256:canonicalSha256(identity),sourceContext,
  transition:{intent,sourceBinding:binding,targetBinding:target,selectedClientId:clientId,policyRevision,scopes},deadlineMs:at+500};
 assert.deepEqual((await adapters.resolveTransitionContext(input)).binding,target);assert.equal(currentReads,2);
 await assert.rejects(adapters.resolveTransitionContext({...input,transition:{...input.transition,targetBinding:{...target,actorId:id(723)}}}));
});

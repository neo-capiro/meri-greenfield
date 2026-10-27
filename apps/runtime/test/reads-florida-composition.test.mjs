/** Current Core/Intel-owned Florida read through the native current-authority composition. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as nativeFixture,uuid} from './reads-native-fixture.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const operation={id:'get_florida_budget_project',version:'0.2.0'},family='florida-budget';
async function fixture({client=false}={}){
 const scene=billTextCase(),clientId=uuid('9'),calls=[];let mutate,status=200;
 Object.assign(scene,{operation,family,contract:resolveOperationContract(operation),arguments:{},visibleClientIds:[clientId]});
 scene.authority.decision.operation=operation.id+'@0.2.0';scene.authority.sourceIds=scene.contract.descriptor.sourceRequirements.map(source=>source.sourceId);
 if(client){const subject=scene.authority.subject;Object.assign(subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[{tenantId:scene.authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:subject.policyRevision}]});}
 scene.transport={...scene.transport,async fetchImpl(url,options){assert.equal(new URL(url).pathname,'/api/clio/tools/get_florida_budget_project');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  const input=JSON.parse(options.body);calls.push(input);
  const result={tool:operation.id,generatedAt:new Date(scene.now()).toISOString(),result:{scope:{jurisdiction:'FL',sessionKey:input.sessionKey,folderId:input.folderId,clientId:input.clientId||input.folderId?clientId:null},fiscalYear:input.fiscalYear,projects:[],nextOffset:null,documents:[],amounts:[],events:[],notice:'Selected publisher evidence. Requests and chamber alternatives are not awards. No statewide aggregate is inferred.'},authority:'Canonical source wording'};
  mutate?.(result);return Response.json(result,{status});
 }};
 const f=await nativeFixture(family,operation.id,{scene,privateUser:!client});
 return {execute:f.execute,calls,clientId,status:value=>{status=value;},mutate:value=>{mutate=value;},revoke:f.revoke};
}
for(const client of [false,true])for(const selector of ['none','name','uuid','folder'])test(`Florida ${selector} selector uses current native admission in ${client?'client':'General'} context`,async()=>{
 const f=await fixture({client}),args=selector==='none'?{}:selector==='name'?{clientId:' Synthetic client '}:selector==='uuid'?{clientId:f.clientId.toUpperCase()}:{folderId:'folder',sessionKey:'session'};
 const r=await f.execute(args);const allowed=selector==='uuid'||!client&&['none','folder'].includes(selector);if(!allowed){assert.equal(r.status,selector==='name'?400:403,await r.clone().text());assert.equal(f.calls.length,0);return;}assert.equal(r.status,200,await r.clone().text());const result=JSON.parse((await r.json()).resultJson);assert.equal(result.operation.id,operation.id);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].clientId,selector==='name'?'Synthetic client':selector==='uuid'?f.clientId:null);
 assert.equal(result.result.result.scope.clientId,selector==='none'?null:f.clientId);
});
test('Florida canonical refusal and execution revocation cannot release a page',async()=>{
 const denied=await fixture();denied.status(403);assert.equal((await denied.execute()).status,403);assert.equal(denied.calls.length,1);
 const revoked=await fixture();revoked.mutate(revoked.revoke);assert.equal((await revoked.execute()).status,403);assert.equal(revoked.calls.length,1);
});
test('Florida malformed selector refuses before dispatch',async()=>{const f=await fixture();for(const args of [{folderId:'x'.repeat(101)},{clientId:{}},{offset:10001},{fiscalYear:'invalid'},{effectiveScope:{}}])assert.notEqual((await f.execute(args)).status,200);assert.equal(f.calls.length,0);});
test('Florida returned selector, paging and opaque row controls stay enforced',async()=>{
 for(const mutate of [p=>{p.result.scope.clientId=uuid('6');},p=>{p.result.scope.folderId='other';},p=>{p.result.scope.sessionKey='other';},p=>{p.result.nextOffset=100;},p=>{p.result.fiscalYear='2027-28';},p=>{p.result.projects=[{privateField:'secret'}];}]){
  const f=await fixture();f.mutate(mutate);assert.notEqual((await f.execute({clientId:f.clientId,folderId:'folder',sessionKey:'session'})).status,200);assert.equal(f.calls.length,1);
 }
});

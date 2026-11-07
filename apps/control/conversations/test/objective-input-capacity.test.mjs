import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareObjectiveInputFacts,prepareOriginalInputFacts} from '../initial-input-facts.mjs';
import {runStartFixture,id,NOW} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
import {versions} from './store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {assertObjectivePrompt,OBJECTIVE_PROMPT_MAX_BYTES,OBJECTIVE_PROMPT_JSON_MAX_BYTES} from '../../../../packages/runtime/objective-input-capacity.mjs';

function fixture(){
 const f=runStartFixture({prompt:'Synthetic complete source.\n'.repeat(25000)});
 return {record:f.record,binding:f.binding,versions,scopes:[{kind:'client',tenantId:f.tenantId,resourceId:f.clientId,policyRevision:'policy1'}],
  selectedClientId:f.clientId,input:{requestId:f.acceptedRequest.requestId,prompt:f.acceptedRequest.prompt},request:f.acceptedRequest,
  allocatedAtMs:NOW,expiresAtMs:NOW+60000};
}
test('private Objective facts hash full original input and request while public submit remains bounded',async()=>{
 const f=fixture(),facts=await prepareObjectiveInputFacts(f);
 assert.equal(facts.inputSha256,hash(f.input));assert.equal(facts.requestSha256,hash(f.request));
 assert.ok(Buffer.byteLength(f.request.prompt)>619726);
 assert.equal(JSON.stringify(facts).includes('Validated private Objective prompt'),false);
 await assert.rejects(prepareOriginalInputFacts(f));
 assert.throws(()=>receiveConversationRequest('submit',Buffer.from(JSON.stringify(f.input))));
 assert.throws(()=>receiveConversationRequest('submit',Buffer.from(JSON.stringify({requestId:f.input.requestId,prompt:'x'.repeat(100001)}))));
 assert.equal(receiveConversationRequest('submit',Buffer.from(JSON.stringify({requestId:f.input.requestId,prompt:'x'.repeat(100000)}))).prompt.length,100000);
});
test('large private input rejects missing or mismatched proof, fields, prompt, binding, scopes and selections',async()=>{
 const changes=[
  f=>{delete f.record;},f=>{f.input.prompt+='different';},f=>{f.request.prompt+='different';},f=>{f.input.extra=true;},
  f=>{f.request.extra=true;},f=>{f.request.skill={skillId:'quick_skill.cited_report'};},
  f=>{f.request.window={};},f=>{f.request.windowRequest={};},f=>{f.request.modelSelection={provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6'};},
  f=>{f.binding.runId=id(99);},f=>{f.scopes[0].resourceId=id(99);},f=>{f.scopes[0].tenantId=id(99);},
  f=>{f.scopes.push({...f.scopes[0]});},f=>{f.selectedClientId=id(99);},f=>{f.versions={};},
  f=>{f.record.selection.executionContext.prompt+='tampered';},
 ];
 for(const change of changes){const f=structuredClone(fixture());change(f);await assert.rejects(prepareObjectiveInputFacts(f));}
});
test('Objective prompt bounds measure raw UTF8 and escaped JSON independently, without truncation',()=>{
 assert.equal(assertObjectivePrompt('x'.repeat(OBJECTIVE_PROMPT_MAX_BYTES)).length,OBJECTIVE_PROMPT_MAX_BYTES);
 assert.throws(()=>assertObjectivePrompt('x'.repeat(OBJECTIVE_PROMPT_MAX_BYTES+1)));
 assert.throws(()=>assertObjectivePrompt('é'.repeat(OBJECTIVE_PROMPT_MAX_BYTES/2+1)));
 const escaped='x'+'\u0000'.repeat(Math.floor((OBJECTIVE_PROMPT_JSON_MAX_BYTES-3)/6));
 assert.equal(assertObjectivePrompt(escaped),escaped);
 assert.throws(()=>assertObjectivePrompt(escaped+'\u0000'));
});

/** The actual public browser boundary; no package installation or provider/DB work. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {hash} from 'node:crypto';
import {receiveConversationUsageRequest as admit,receiveConversationUsageResponse as receive,conversationUsageMetadata as metadata,conversationUsageErrors} from '@capiro/meri-contracts/conversation-usage';
import {assertConversationUsageResponse} from '../conversation-usage/validate.mjs';
import {projectRecordedUsage} from '../../../apps/control/conversations/usage-read/projection.mjs';
import {payload,savedUsage,request,id} from '../../../apps/control/conversations/usage-read/test/fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('public request and response preserve exact run identity, original units and known zero without private data',()=>{
 const input=admit(bytes(request)),body=projectRecordedUsage(savedUsage(payload({zero:true,omitted:1})),request),value=receive(200,bytes(body),input);
 assert.deepEqual(value,body);assert.deepEqual(assertConversationUsageResponse(body,request),body);assert.equal(metadata.currency,'USD');assert.equal(value.usage.currency,'USD');assert.equal(value.usage.runDelta.sdkEstimateUsd,0);assert.equal(value.usage.cumulative.models[0].cacheCreationInputTokens,0);assert.equal(value.usage.providerBilledUsd,null);
 assert.ok(Object.isFrozen(input)&&Object.isFrozen(value)&&Object.isFrozen(value.usage.cumulative.models[0]));assert.equal(value.toolAudit.partial,true);
 assert.throws(()=>receive(200,bytes(body),structuredClone(input)),/UNADMITTED_REQUEST/);assert.throws(()=>conversationUsageErrors.USAGE_UNAVAILABLE.push(200),TypeError);
});
test('missing recording and recorded unavailable remain distinct and cannot be relabeled as zero',()=>{
 const q=admit(bytes(request));for(const record of [null,savedUsage(payload({unavailable:true}))]){const body=projectRecordedUsage(record,request);assert.deepEqual(receive(200,bytes(body),q),body);}
 const absent=structuredClone(projectRecordedUsage(null,request));absent.recording='recorded';assert.throws(()=>receive(200,bytes(absent),q));
});
test('closed browser boundary rejects mismatched model/run facts, invented billing/effects and invalid partial coverage',()=>{
 const q=admit(bytes(request)),body=projectRecordedUsage(savedUsage(),request);
 for(const change of [v=>v.runId=id(90),v=>v.conversationId=id(90),v=>v.usage.currency='EUR',v=>v.usage.providerBilledUsd=0,
  v=>v.usage.cumulative.models[0].sdkEstimateUsd=Infinity,v=>delete v.usage.cumulative.models[0].inputTokens,
  v=>v.usage.runDelta.modelCounters[0].model='another-model',v=>v.usage.cumulative.models.push(v.usage.cumulative.models[0]),
  v=>v.toolAudit.partial=true,v=>v.toolAudit.tools[0].confirmedEffect=true,v=>v.toolAudit.tools[0].toolUseId='private',
  v=>v.toolAudit.tools[0].name='Read\nprivate',v=>v.toolAudit.tools[0].durationMs=-1,v=>v.usage.runDelta.modelCounters[0].inputTokens=101]){
  const value=structuredClone(body);change(value);assert.throws(()=>receive(200,bytes(value),q));
 }
});
test('limits, inert identifier strings, closed errors and hostile bytes are enforced by the generated receiver',()=>{
 const q=admit(bytes(request)),body=structuredClone(projectRecordedUsage(savedUsage(),request));body.toolAudit.tools[0].name='mcp__vendor__operation/v1';assert.equal(receive(200,bytes(body),q).toolAudit.tools[0].name,'mcp__vendor__operation/v1');
 assert.equal(Object.keys(body.toolAudit.tools[0]).sort().join(','),'durationMs,executionOutcome,name');
 for(const change of [v=>v.toolAudit.tools=Array.from({length:129},()=>v.toolAudit.tools[0]),v=>v.toolAudit.tools[0].name='x'.repeat(201),
  v=>v.usage.cumulative.models=Array.from({length:33},(_,index)=>({...v.usage.cumulative.models[0],model:'model'+index})),
  v=>v.usage.cumulative.models[0].inputTokens=Number.MAX_SAFE_INTEGER+1,v=>v.usage.cumulative.sdkEstimateUsd=Number.MAX_SAFE_INTEGER]){
  const invalid=structuredClone(body);change(invalid);assert.throws(()=>receive(200,bytes(invalid),q));
 }
 for(const [code,statuses]of Object.entries(conversationUsageErrors))for(const status of statuses)assert.deepEqual(receive(status,bytes({error:{code}}),q),{error:{code}});
 for(const bad of [{error:{code:'USAGE_UNAVAILABLE',message:'private'}},{error:{code:'made-up'}},{error:{code:'ACCESS_DENIED'},usage:0}])assert.throws(()=>receive(503,bytes(bad),q));
 for(const bad of [new Uint8Array([255]),new Uint8Array(4097),new TextEncoder().encode('{"__proto__":{}}'),bytes({...request,tenantId:'forged'}),bytes({...request,runId:'\ud800'})])assert.throws(()=>admit(bad));
 assert.throws(()=>receive(200,new Uint8Array(131073),q));
});
test('frozen event schema stays byte-identical and public usage bounds match the unbuilt package version',async()=>{
 assert.equal(hash('sha256',await readFile(new URL('../meri.schema.json',import.meta.url)),'hex'),'e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b');
 assert.equal(metadata.packageVersion,'0.1.15');assert.equal(metadata.maxTools,128);assert.equal(metadata.maxModels,32);
});

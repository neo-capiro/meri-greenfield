import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {productFixture,NOW} from '../budget/product-scripted-fixture.mjs';
import {createProductProxySettlementBridge} from './product-settlement-bridge.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const seed=productFixture(),selected=seed.context();
 const raw=Buffer.from('{"prompt":"synthetic"}');
 const native=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}');
 const claim={status:'COMPLETE',binding:{request_id:'request_A',native_body_sha256:hash(native),raw_request_sha256:hash(raw),pricing_revision:'b'.repeat(64),counted_input_tokens:12,max_output_tokens:16,allowed_tool_names:['local_echo']},evidence_sha256:'e'.repeat(64),input_tokens:12,output_tokens:7,reason:'COMPLETE_NATIVE_MESSAGE',origin:'native-usage-data'};
 const completion={requestId:'request_A',binding:selected.binding,taskArn:selected.qualificationBinding.workerArn,capabilitySha256:selected.capabilitySha256,nativeBodySha256:hash(native),rawRequestSha256:hash(raw),modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',pricingRevision:claim.binding.pricing_revision,evidenceSha256:claim.evidence_sha256,httpStatus:200,complete:true,eof:true,usage:{inputTokens:12,outputTokens:7}};
 const observed={reservation:{requestId:'request_A',nativeBodySha256:hash(native),state:'UNKNOWN'},rawRequestBody:raw,nativeRequestBody:native,usageResult:structuredClone(claim),completion};
 const pricing={modelId:completion.modelId,profileId:completion.profileId,revision:claim.binding.pricing_revision,validUntilMs:NOW+8000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
 const config={allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,pricing,requestId:'request_A'};
 return {claim,observed,config,selected};
}

test('private bridge requires a constructor-captured complete-response observer',()=>{
 const {config}=fixture();
 assert.throws(()=>createProductProxySettlementBridge({...config,pool:{connect(){}},captureAuthenticatedComplete:null}),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
});

test('a Python usage claim cannot settle without matching independent host capture',async()=>{
 const {config,claim,observed}=fixture();let sql=0,captures=0;
 const bridge=createProductProxySettlementBridge({...config,pool:{connect(){sql++;throw Error('unexpected SQL');}},captureAuthenticatedComplete:async request=>{
  captures++;assert.equal(request.requestId,'request_A');return observed;
 }});
 await assert.rejects(bridge.settleComplete('request_A',{...claim,output_tokens:8}),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.equal(captures,1);assert.equal(sql,0);
 await assert.rejects(bridge.settleComplete('request_A',claim),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.equal(captures,1);assert.equal(sql,0);
});

test('complete authenticated observation reaches only canonical settlement SQL once',async()=>{
 const {config,claim,observed}=fixture();let sql=0,captures=0;
 const bridge=createProductProxySettlementBridge({...config,pool:{connect(){sql++;throw Error('synthetic unavailable SQL');}},captureAuthenticatedComplete:async()=>{captures++;return observed;}});
 await assert.rejects(bridge.settleComplete('request_A',claim),/BUDGET_STATE_UNAVAILABLE/);
 assert.equal(sql,1);assert.equal(captures,1);
 await assert.rejects(bridge.settleComplete('request_A',claim),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.equal(sql,1);
});

test('receipt, request bytes, native bytes, EOF and run identity are checked before SQL',async()=>{
 const {config,claim,observed}=fixture();let sql=0;
 const pool={connect(){sql++;throw Error('unexpected SQL');}};
 for(const alter of [
  v=>({...v,reservation:{...v.reservation,state:'SETTLED'}}),
  v=>({...v,rawRequestBody:Buffer.from('changed')}),
  v=>({...v,nativeRequestBody:Buffer.from('changed')}),
  v=>({...v,completion:{...v.completion,eof:false}}),
  v=>({...v,completion:{...v.completion,binding:{...v.completion.binding,tenantId:'other'}}}),
  v=>({...v,completion:{...v.completion,taskArn:'other'}}),
 ]){
  const bridge=createProductProxySettlementBridge({...config,pool,captureAuthenticatedComplete:async()=>alter(observed)});
  await assert.rejects(bridge.settleComplete('request_A',claim));
 }
 assert.equal(sql,0);
});

test('read-only outcome is restricted to the constructor-captured slot',async()=>{
 const {config}=fixture();let sql=0,captures=0;
 const bridge=createProductProxySettlementBridge({...config,pool:{connect(){sql++;throw Error('synthetic unavailable SQL');}},captureAuthenticatedComplete:async()=>{captures++;throw Error('should not capture');}});
 await assert.rejects(bridge.readOutcome('other'),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.equal(sql,0);
 await assert.rejects(bridge.readOutcome('request_A'),/BUDGET_STATE_UNAVAILABLE/);
 assert.equal(sql,1);assert.equal(captures,0);
});

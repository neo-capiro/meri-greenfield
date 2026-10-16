import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {productFixture,NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {createProductProxyOwnerComposition} from './product-owner-composition.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const requestId='request_A';
const clientId='11111111-1111-4111-8111-111111111111';
const credential='synthetic-product-model-bearer-000001';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const modelId='anthropic.claude-sonnet-4-6';
const profileId='us.anthropic.claude-sonnet-4-6';

function fixture(){
 const seed=productFixture(),selected={...seed.context(),capabilitySha256:sha(credential)};
 const raw=Buffer.from('{"prompt":"synthetic"}');
 const native=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}');
 const pricing={modelId,profileId,revision:'b'.repeat(64),validUntilMs:NOW+8000,
  actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,
  outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
 const observation={requestId,peer:{binding:selected.binding,
  taskArn:selected.qualificationBinding.workerArn,grantId:selected.grantId,observedAtMs:NOW},
  proxyCredential:credential,rawRequestBody:raw,
  nativeRequest:{method:'POST',url:`https://${host}/model/${profileId}/invoke`,host,
   contentType:'application/json',body:native,headers:[['host',host],['content-type','application/json']]},
  count:{inputTokens:12,nativeBodySha256:sha(native),modelId,origin:'aws-counttokens'}};
 const usage={status:'COMPLETE',binding:{request_id:requestId,native_body_sha256:sha(native),
  raw_request_sha256:sha(raw),pricing_revision:pricing.revision,counted_input_tokens:12,
  max_output_tokens:16,allowed_tool_names:['local_echo']},evidence_sha256:'e'.repeat(64),
  input_tokens:12,output_tokens:7,reason:'COMPLETE_NATIVE_MESSAGE',origin:'native-usage-data'};
 const completion={requestId,binding:selected.binding,
  taskArn:selected.qualificationBinding.workerArn,capabilitySha256:selected.capabilitySha256,
  nativeBodySha256:sha(native),rawRequestSha256:sha(raw),modelId,profileId,
  pricingRevision:pricing.revision,evidenceSha256:usage.evidence_sha256,httpStatus:200,
  complete:true,eof:true,usage:{inputTokens:12,outputTokens:7}};
 const complete={reservation:{requestId,nativeBodySha256:sha(native),state:'UNKNOWN'},
  rawRequestBody:raw,nativeRequestBody:native,completion,usageResult:structuredClone(usage)};
 let sql=0,requestCaptures=0,completeCaptures=0;
 const pool={connect(){sql++;throw Error('synthetic unavailable SQL');}};
 const hostChannel={requestId,
  async captureAuthenticatedCall(){requestCaptures++;return observation;},
  async captureAuthenticatedComplete(){completeCaptures++;return complete;}};
 const configuration={pool,allocationJson:JSON.stringify(seed.allocation),
  grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,
  selectedClientId:clientId,pricing,requestId,now:()=>NOW,
  limits:{maxRequestMs:1000,maxFactBytes:65536},
  checkCurrentConversation:async()=>({identitySha256:'a'.repeat(64),binding:selected.binding,
   scopes:[{kind:'client',tenantId:selected.binding.tenantId,resourceId:clientId,
    policyRevision:selected.qualificationBinding.policyRevision}],selectedClientId:clientId,
   contextRevision:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+5000}),hostChannel};
 return {configuration,hostChannel,observation,usage,
  request:{requestId,binding:selected.binding,deadlineMs:NOW+5000},
  calls:()=>({sql,requestCaptures,completeCaptures})};
}

test('missing, mismatched, or incomplete private host channel refuses composition',()=>{
 const {configuration,hostChannel}=fixture();
 for(const channel of [undefined,null,{...hostChannel,requestId:'another'},
  {...hostChannel,captureAuthenticatedCall:null},
  {...hostChannel,captureAuthenticatedComplete:null}]){
  assert.throws(()=>createProductProxyOwnerComposition({...configuration,hostChannel:channel}));
 }
 assert.throws(()=>createProductProxyOwnerComposition({...configuration,pool:{}}),
  /PRODUCT_PROXY_OWNER_COMPOSITION_REFUSED/);
});

test('request and completion claims require independent captures before canonical SQL',async()=>{
 const {configuration,observation,usage,request,calls}=fixture();
 const owner=createProductProxyOwnerComposition(configuration);
 await assert.rejects(owner.reserve(request,{...observation,rawRequestBody:Buffer.from('forged')}),
  /PRODUCT_PROXY_BRIDGE_REFUSED/);
 await assert.rejects(owner.settleComplete(requestId,{...usage,output_tokens:8}),
  /PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.deepEqual(calls(),{sql:0,requestCaptures:1,completeCaptures:1});
 await assert.rejects(owner.reserve(request,observation),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 await assert.rejects(owner.settleComplete(requestId,usage),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.deepEqual(calls(),{sql:0,requestCaptures:1,completeCaptures:1});
});

test('both exact captures reach the same canonical pool and retain slot isolation',async()=>{
 const {configuration,observation,usage,request,calls}=fixture();
 const owner=createProductProxyOwnerComposition(configuration);
 assert.deepEqual(Object.keys(owner),['reserve','settleComplete','readOutcome']);
 await assert.rejects(owner.reserve(request,observation),/BUDGET_STATE_UNAVAILABLE/);
 await assert.rejects(owner.settleComplete(requestId,usage),/BUDGET_STATE_UNAVAILABLE/);
 assert.deepEqual(calls(),{sql:2,requestCaptures:1,completeCaptures:1});
 await assert.rejects(owner.readOutcome('other'),/PRODUCT_SETTLEMENT_BRIDGE_REFUSED/);
 assert.equal(calls().sql,2);
});

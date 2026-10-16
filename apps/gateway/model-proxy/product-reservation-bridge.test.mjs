import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {productFixture,NOW} from '../budget/product-scripted-fixture.mjs';
import {createProductProxyReservationBridge} from './product-reservation-bridge.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const credential='synthetic-product-model-bearer-000001';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const url=`https://${host}/model/us.anthropic.claude-sonnet-4-6/invoke`;
const pricing={modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'b'.repeat(64),validUntilMs:NOW+8000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
const clientId='11111111-1111-4111-8111-111111111111';

function fixture(){
 const seed=productFixture(),selected={...seed.context(),capabilitySha256:hash(credential)};
 const body=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}');
 const observation={requestId:'request_A',peer:{binding:selected.binding,taskArn:selected.qualificationBinding.workerArn,grantId:selected.grantId,observedAtMs:NOW},proxyCredential:credential,
  rawRequestBody:Buffer.from('{"prompt":"synthetic"}'),
  nativeRequest:{method:'POST',url,host,contentType:'application/json',body,headers:[['host',host],['content-type','application/json']]},
  count:{inputTokens:12,nativeBodySha256:hash(body),modelId:pricing.modelId,origin:'aws-counttokens'}};
 const value={requestId:'request_A',binding:selected.binding,deadlineMs:NOW+5000};
 const config={allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,selectedClientId:clientId,pricing,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:65536},checkCurrentConversation:async()=>({identitySha256:'a'.repeat(64),binding:selected.binding,scopes:[{kind:'client',tenantId:selected.binding.tenantId,resourceId:clientId,policyRevision:selected.qualificationBinding.policyRevision}],selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+5000})};
 return {observation,value,config};
}

test('bridge requires a constructor-captured host authenticator',()=>{
 const {config}=fixture();
 assert.throws(()=>createProductProxyReservationBridge({...config,pool:{connect(){}},captureAuthenticatedCall:null}),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 assert.throws(()=>createProductProxyReservationBridge({...config,pool:{connect(){}},captureAuthenticatedCall:async()=>null,checkCurrentConversation:null}),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 const withoutClient={...config};delete withoutClient.selectedClientId;
 assert.throws(()=>createProductProxyReservationBridge({...withoutClient,pool:{connect(){}},captureAuthenticatedCall:async()=>null}));
});

test('caller observation is cross-checked against independent host capture before SQL',async()=>{
 const {config,value,observation}=fixture();let sql=0,captures=0;
 const bridge=createProductProxyReservationBridge({...config,pool:{connect(){sql++;throw Error('unexpected SQL');}},captureAuthenticatedCall:async request=>{
  captures++;assert.equal(request.requestId,value.requestId);assert.deepEqual(request.binding,value.binding);return observation;
 }});
 const forged={...observation,rawRequestBody:Buffer.from('{"prompt":"forged"}')};
 await assert.rejects(bridge.reserve(value,forged),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 assert.equal(captures,1);assert.equal(sql,0);
 await assert.rejects(bridge.reserve(value,observation),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 assert.equal(captures,1);assert.equal(sql,0);
});

test('exact authenticated observation reaches canonical reservation once',async()=>{
 const {config,value,observation}=fixture();let sql=0,captures=0;
 const bridge=createProductProxyReservationBridge({...config,pool:{connect(){sql++;throw Error('synthetic unavailable SQL');}},captureAuthenticatedCall:async()=>{captures++;return observation;}});
 await assert.rejects(bridge.reserve(value,observation),/BUDGET_STATE_UNAVAILABLE/);
 assert.equal(captures,1);assert.equal(sql,1);
 await assert.rejects(bridge.reserve(value,observation),/PRODUCT_PROXY_BRIDGE_REFUSED/);
 assert.equal(sql,1);
});

test('extra caller evidence and binding substitution cannot reach SQL',async()=>{
 const {config,value,observation}=fixture();let sql=0;
 const pool={connect(){sql++;throw Error('unexpected SQL');}};
 const one=createProductProxyReservationBridge({...config,pool,captureAuthenticatedCall:async()=>observation});
 await assert.rejects(one.reserve(value,{...observation,authenticated:true}));
 const two=createProductProxyReservationBridge({...config,pool,captureAuthenticatedCall:async()=>observation});
 await assert.rejects(two.reserve({...value,binding:{...value.binding,tenantId:'another'}},observation));
 assert.equal(sql,0);
});

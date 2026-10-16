import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {productFixture,NOW} from '../budget/product-scripted-fixture.mjs';
import {createProductProxyRequestOwner,observeProductProxyRequest} from './product-request-owner.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const credential='synthetic-product-model-bearer-000001';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const url=`https://${host}/model/us.anthropic.claude-sonnet-4-6/invoke`;
const pin={modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'b'.repeat(64),validUntilMs:NOW+8000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
const clientId='11111111-1111-4111-8111-111111111111';
const current=selected=>async()=>({identitySha256:'a'.repeat(64),binding:selected.binding,scopes:[{kind:'client',tenantId:selected.binding.tenantId,resourceId:clientId,policyRevision:selected.qualificationBinding.policyRevision}],selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+5000});
function fixture(){
 const seed=productFixture(),selected={...seed.context(),capabilitySha256:hash(credential)};
 const rawRequestBody=Buffer.from('{"model":"meri-sonnet-qualification","messages":[{"role":"user","content":"synthetic"}],"max_tokens":16}');
 const body=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}');
 const source={requestId:'request_A',peer:{binding:selected.binding,taskArn:selected.qualificationBinding.workerArn,grantId:selected.grantId,observedAtMs:NOW},proxyCredential:credential,rawRequestBody,
  nativeRequest:{method:'POST',url,host,contentType:'application/json',body,headers:[['host',host],['content-type','application/json']]},
  count:{inputTokens:12,nativeBodySha256:hash(body),modelId:pin.modelId,origin:'aws-counttokens'}};
 return {seed,selected,source};
}

test('trusted final native bytes and one AWS count become exact budget evidence',()=>{
 const {selected,source}=fixture(),observed=observeProductProxyRequest(source,selected,pin,'request_A',()=>NOW);
 assert.deepEqual(observed,{binding:selected.binding,taskArn:selected.qualificationBinding.workerArn,capabilitySha256:hash(credential),nativeBodySha256:hash(source.nativeRequest.body),rawRequestSha256:hash(source.rawRequestBody),modelId:pin.modelId,profileId:pin.profileId,maxOutputTokens:16,count:{nativeBodySha256:hash(source.nativeRequest.body),modelId:pin.modelId,inputTokens:12}});
});

test('wrong direct peer, bearer, final bytes, count or route refuses before any product SQL',async()=>{
 const {seed,selected,source}=fixture(),attempts=[];
 const changes=[
  s=>{s.peer.taskArn='arn:aws:ecs:us-east-1:967807252336:task/other/'+'f'.repeat(32);},
  s=>{s.proxyCredential='wrong-synthetic-product-model-bearer';},
  s=>{s.nativeRequest.body=Buffer.from(s.nativeRequest.body.toString()+' ');},
  s=>{s.count.origin='fixture';},
  s=>{s.nativeRequest.url+='?route=other';},
  s=>{s.nativeRequest.headers.push(['x-amzn-bedrock-service-tier','priority']);},
 ];
 for(const change of changes){
  const altered={...source,peer:{...source.peer},rawRequestBody:Buffer.from(source.rawRequestBody),nativeRequest:{...source.nativeRequest,body:Buffer.from(source.nativeRequest.body),headers:source.nativeRequest.headers.map(pair=>[...pair])},count:{...source.count}};change(altered);
  const owner=createProductProxyRequestOwner({pool:{connect(){attempts.push('sql');throw Error('should not connect');}},allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,selectedClientId:clientId,pricing:pin,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:65536},observeProxy:async()=>altered,checkCurrentConversation:current(selected)});
  await assert.rejects(owner.reserve({requestId:'request_A',binding:selected.binding,deadlineMs:NOW+5000}),/PRODUCT_PROXY_OBSERVATION_REFUSED/);
 }
 assert.deepEqual(attempts,[]);
});

test('worker-supplied observation cannot enter the private reserve port',async()=>{
 const {seed,selected,source}=fixture();let observed=0;
 const owner=createProductProxyRequestOwner({pool:{connect(){throw Error('unexpected SQL');}},allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,selectedClientId:clientId,pricing:pin,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:65536},observeProxy:async()=>{observed++;return source;},checkCurrentConversation:current(selected)});
 await assert.rejects(owner.reserve({requestId:'request_A',binding:selected.binding,deadlineMs:NOW+5000,count:source.count}));
 assert.equal(observed,0);
});

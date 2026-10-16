/** Inert HTTPS owner-channel controls; no listener, certificate or SQL store. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {productFixture,NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {createProductOwnerChannel,createProductOwnerServiceGate} from './owner-channel.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const wire=value=>Buffer.from(JSON.stringify(value));
const id='request_A';
const clientId='11111111-1111-4111-8111-111111111111';
const credential='synthetic-product-model-bearer-000001';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const model='anthropic.claude-sonnet-4-6';
const profile='us.anthropic.claude-sonnet-4-6';

function fixture(){
 const seed=productFixture(),selected={...seed.context(),capabilitySha256:sha(credential)};
 const binding=selected.binding;
 const bindingTuple=['tenantId','actorId','conversationId','runId','attemptId','workerId',
  'writerFence'].map(key=>binding[key]);
 const raw=Buffer.from('{"prompt":"synthetic"}');
 const native=Buffer.from('{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,'+
  '"messages":[{"role":"user","content":"synthetic"}]}');
 const pricing={modelId:model,profileId:profile,revision:'b'.repeat(64),
  validUntilMs:NOW+8000,actualInputMicroUSDPerK:3300,
  reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,
  maxInputTokens:8192,maxOutputTokens:256};
 const requestDeadline=NOW+5000;
 const reservation=['meri.proxy.reservation/1',[id,bindingTuple,requestDeadline],
  [id,[bindingTuple,selected.qualificationBinding.workerArn,selected.grantId,NOW],
   credential,raw.toString('base64'),['POST',`https://${host}/model/${profile}/invoke`,
    host,'application/json',native.toString('base64'),
    [['host',host],['content-type','application/json']]],
   [12,sha(native),model,'aws-counttokens']]];
 const facts={binding,allocationJson:JSON.stringify(seed.allocation),
  grantFactsJsons:[JSON.stringify(selected)],modelGrantId:selected.grantId,
  selectedClientId:clientId,original:{},resource:{taskArn:selected.qualificationBinding.workerArn},
  requestSha256:'e'.repeat(64),expiresAtMs:requestDeadline};
 const ownerTaskArn='arn:aws:ecs:us-east-1:967807252336:task/owner-service';
 const proxyTaskArn='arn:aws:ecs:us-east-1:967807252336:task/proxy-service';
 const clientPolicy={clientCertSha256:'a'.repeat(64),clientSubject:'proxy-task-v1',
  deploymentRevision:'proxy-revision-v1',issuerSha256:'b'.repeat(64),
  selectedClientId:clientId,ownerTaskArn,proxyTaskArn};
 const peerBase={clientCertSha256:clientPolicy.clientCertSha256,
  clientSubject:clientPolicy.clientSubject,
  deploymentRevision:clientPolicy.deploymentRevision,issuerSha256:clientPolicy.issuerSha256,
  proxyTaskArn:clientPolicy.proxyTaskArn,tlsVersion:'TLSv1.3'};
 let sql=0;const lookedUp=[];
 const persistedFacts={available:true,async resolve(value){lookedUp.push(value);return facts;}};
 const serviceGate=createProductOwnerServiceGate();
 const ownerPorts={pool:{connect(){sql++;throw Error('synthetic SQL unavailable');}},
  pricing,limits:{maxRequestMs:1000,maxFactBytes:65536},
  checkCurrentConversation:async()=>({identitySha256:'a'.repeat(64),binding,
   scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,
    policyRevision:selected.qualificationBinding.policyRevision}],
   selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:NOW,
   expiresAtMs:requestDeadline})};
 const channel=(maxExchangeMs=3000)=>createProductOwnerChannel({clientPolicy,
  persistedFacts,ownerPorts,serviceGate,now:()=>NOW,maxExchangeMs});
 const open=wire(['meri.proxy.session-open/1',id,sha(credential),bindingTuple,requestDeadline]);
 const operationPeer={...peerBase,connectionId:'operation-A'};
 const capturePeer={...peerBase,connectionId:'capture-A'};
 return {channel,open,operationPeer,capturePeer,lookedUp,facts,selected,
  reservation,sql:()=>sql,clientPolicy,persistedFacts,ownerPorts,serviceGate,
  ownerTaskArn,proxyTaskArn,workerTaskArn:selected.qualificationBinding.workerArn};
}

test('open selects current persisted facts by observed bearer digest and reveals no facts',async()=>{
 const f=fixture(),channel=f.channel();
 assert.equal(new Set([f.proxyTaskArn,f.ownerTaskArn,f.workerTaskArn]).size,3);
 const ack=JSON.parse(await channel.open(f.open,f.operationPeer));
 assert.deepEqual(ack.slice(0,1),['meri.proxy.session/1']);
 assert.equal(ack.length,4);
 assert.equal(ack[2],id);
 assert.equal(ack[3],sha(credential));
 assert.equal(JSON.stringify(ack).includes(f.selected.grantId),false);
 assert.equal(f.lookedUp.length,1);
 assert.equal(f.lookedUp[0].capabilitySha256,sha(credential));
 assert.equal(f.lookedUp[0].deadlineMs,NOW+3000);
 assert.ok(f.lookedUp[0].signal instanceof AbortSignal);
 assert.equal(f.sql(),0);
 await assert.rejects(channel.open(f.open,f.operationPeer),/PRODUCT_OWNER_CHANNEL_DENIED/);
});

test('foreign worker, proxy, grant selector, model grant and client cannot select a session',async()=>{
 for(const wrong of ['worker','proxy','capability','modelGrant','client']){
  const f=fixture();
  if(wrong==='worker')f.facts.resource.taskArn+='-foreign';
  if(wrong==='capability'){
   const fact=JSON.parse(f.facts.grantFactsJsons[0]);
   fact.capabilitySha256='f'.repeat(64);
   f.facts.grantFactsJsons=[JSON.stringify(fact)];
  }
  if(wrong==='modelGrant')f.facts.modelGrantId='99999999-9999-4999-8999-999999999999';
  if(wrong==='client')f.facts.selectedClientId='99999999-9999-4999-8999-999999999999';
  const channel=f.channel();
  const peer=wrong==='proxy'?{...f.operationPeer,proxyTaskArn:'foreign-proxy'}:
   f.operationPeer;
  await assert.rejects(channel.open(f.open,peer),/PRODUCT_OWNER_CHANNEL_DENIED/,
   wrong);
  assert.equal(channel.available,false);
  assert.equal(f.sql(),0);
 }
});

test('operation-first and capture-poll-first each require independent fresh capture before SQL',async()=>{
 for(const first of ['operation','poll']){
  const f=fixture(),channel=f.channel();
  const ack=JSON.parse(await channel.open(f.open,f.operationPeer));
  const session=ack[1];
  const operationBody=wire(['meri.proxy.operation/1',session,f.reservation]);
  const pollBody=wire(['meri.proxy.capture-poll/1',session,id,'call']);
  let operation,poll;
  if(first==='operation'){
   operation=channel.operation(operationBody,f.operationPeer);
   await Promise.resolve();
   poll=channel.poll(pollBody,f.capturePeer);
  }else{
   poll=channel.poll(pollBody,f.capturePeer);
   await Promise.resolve();
   operation=channel.operation(operationBody,f.operationPeer);
  }
  const challenge=JSON.parse(await poll);
  assert.deepEqual(challenge.slice(0,2),['meri.proxy.capture-call/1',id]);
  assert.deepEqual(challenge[2],f.reservation[1][1]);
  const reply=JSON.parse(await channel.reply(wire([
   'meri.proxy.capture-reply/1',session,f.reservation]),f.capturePeer));
  assert.deepEqual(reply,['meri.proxy.capture-ack/1',session,id,'call']);
  await assert.rejects(operation,/PRODUCT_OWNER_CHANNEL_DENIED/);
  assert.equal(f.sql(),1);
  assert.equal(channel.available,false);
 }
});

test('separate capture channel and exact selector are mandatory',async()=>{
 const f=fixture(),channel=f.channel();
 await channel.open(f.open,f.operationPeer);
 await assert.rejects(channel.poll(wire(['meri.proxy.capture-poll/1','wrong',id,'call']),
  {...f.capturePeer,connectionId:f.operationPeer.connectionId}),
 /PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(channel.available,false);
 assert.equal(f.sql(),0);
 const fresh=fixture(),bad=JSON.parse(fresh.open);
 bad[2]='f'.repeat(64);
 fresh.persistedFacts.resolve=async()=>fresh.facts;
 await assert.rejects(fresh.channel().open(wire(bad),fresh.operationPeer),
  /PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(fresh.sql(),0);
});

test('duplicate capture poll poisons the outstanding single-flight exchange',async()=>{
 const f=fixture(),channel=f.channel();
 const ack=JSON.parse(await channel.open(f.open,f.operationPeer));
 const body=wire(['meri.proxy.capture-poll/1',ack[1],id,'call']);
 const first=channel.poll(body,f.capturePeer);
 const replay=channel.poll(body,f.capturePeer);
 const results=await Promise.allSettled([first,replay]);
 assert.deepEqual(results.map(result=>result.status),['rejected','rejected']);
 assert.equal(channel.available,false);
 assert.equal(f.serviceGate.available,false);
 assert.equal(f.sql(),0);
});

test('fresh capture with a foreign worker task is refused before canonical SQL',async()=>{
 const f=fixture(),channel=f.channel();
 const ack=JSON.parse(await channel.open(f.open,f.operationPeer));
 f.reservation[2][1][1]='arn:aws:ecs:us-east-1:967807252336:task/foreign-worker';
 const operation=channel.operation(wire(['meri.proxy.operation/1',ack[1],f.reservation]),
  f.operationPeer);
 const challenge=JSON.parse(await channel.poll(wire([
  'meri.proxy.capture-poll/1',ack[1],id,'call']),f.capturePeer));
 assert.equal(challenge[0],'meri.proxy.capture-call/1');
 await channel.reply(wire(['meri.proxy.capture-reply/1',ack[1],f.reservation]),
  f.capturePeer);
 await assert.rejects(operation,/PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(f.sql(),0);
 assert.equal(channel.available,false);
});

test('unresolved persisted read aborts and quarantines all later service sessions',async()=>{
 const f=fixture();
 let release;
 f.persistedFacts.resolve=()=>new Promise(resolve=>{release=resolve;});
 const channel=f.channel(10);
 await assert.rejects(channel.open(f.open,f.operationPeer),/PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(f.serviceGate.available,false);
 assert.equal(f.serviceGate.pending,1);
 assert.throws(()=>f.channel(),/PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.throws(()=>createProductOwnerChannel({clientPolicy:f.clientPolicy,
  persistedFacts:f.persistedFacts,ownerPorts:f.ownerPorts,
  serviceGate:createProductOwnerServiceGate(),now:()=>NOW}),
 /PRODUCT_OWNER_CHANNEL_DENIED/);
 release(f.facts);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.serviceGate.pending,0);
 assert.equal(f.serviceGate.available,false);
});

test('a second gate cannot replace an active gate for the same pool or facts',()=>{
 const f=fixture();
 f.channel();
 const fresh=createProductOwnerServiceGate();
 assert.throws(()=>createProductOwnerChannel({clientPolicy:f.clientPolicy,
  persistedFacts:f.persistedFacts,ownerPorts:f.ownerPorts,
  serviceGate:fresh,now:()=>NOW}),/PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(f.serviceGate.available,true);
});

test('unresolved canonical owner I/O quarantines the shared service gate',async()=>{
 const f=fixture();
 let started,release;
 const entered=new Promise(resolve=>{started=resolve;});
 f.ownerPorts.pool.connect=()=>{
  started();
  return new Promise((_,reject)=>{release=reject;});
 };
 const channel=f.channel(100);
 const ack=JSON.parse(await channel.open(f.open,f.operationPeer));
 const operation=channel.operation(wire(['meri.proxy.operation/1',ack[1],f.reservation]),
  f.operationPeer);
 await channel.poll(wire(['meri.proxy.capture-poll/1',ack[1],id,'call']),f.capturePeer);
 await channel.reply(wire(['meri.proxy.capture-reply/1',ack[1],f.reservation]),
  f.capturePeer);
 await entered;
 await assert.rejects(operation,/PRODUCT_OWNER_CHANNEL_DENIED/);
 assert.equal(f.serviceGate.available,false);
 assert.equal(f.serviceGate.pending,1);
 assert.throws(()=>f.channel(),/PRODUCT_OWNER_CHANNEL_DENIED/);
 release(Error('late SQL completion'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.serviceGate.pending,0);
 assert.equal(f.serviceGate.available,false);
});

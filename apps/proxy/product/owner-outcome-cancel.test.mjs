/** Request ownership only: the canonical budget is covered by the composed TLS
 * suite. This scripted composition isolates the recovery pool's cancellation. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
const wire=value=>Buffer.from(JSON.stringify(value));
const requestId='request_A',at=2000000000000,deadline=at+5000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'11111111-1111-4111-8111-111111111111',
 runId:'22222222-2222-4222-8222-222222222222',attemptId:'33333333-3333-4333-8333-333333333333',
 workerId:'44444444-4444-4444-8444-444444444444',writerFence:1};
const tuple=Object.values(binding),credential='synthetic-product-bearer-000000001',raw=Buffer.from('raw'),native=Buffer.from('native');
mock.module('./product-owner-composition.mjs',{namedExports:{createProductProxyOwnerComposition:({pool})=>({
 async reserve(){return {requestId,state:'UNKNOWN',nativeBodySha256:sha(native)};},
 async settleComplete(){return {requestId,state:'SETTLED'};},
 async readOutcome(){const client=await pool.connect();try{
  await client.query('SELECT outcome');
  return {requestId,state:'SETTLED',actualMicroUSD:'1'};
 }finally{client.release();}}
})}});
const {createProductOwnerChannel,createProductOwnerServiceGate}=await import('./owner-channel.mjs');

async function fixture(){
 let queried,resolveQuery,stall=true,connects=0;const releases=[];
 const queryStarted=new Promise(resolve=>{queried=resolve;});
 const pool={async connect(){connects++;return {query(){queried();return stall?new Promise(resolve=>{resolveQuery=resolve;}):Promise.resolve();},release(error){releases.push(error);}};}};
 const policy={clientCertSha256:'a'.repeat(64),clientSubject:'proxy-task-v1',deploymentRevision:'revision',
  issuerSha256:'b'.repeat(64),selectedClientId:'55555555-5555-4555-8555-555555555555',ownerTaskArn:'owner',proxyTaskArn:'proxy'};
 const peer={clientCertSha256:policy.clientCertSha256,clientSubject:policy.clientSubject,deploymentRevision:policy.deploymentRevision,
  issuerSha256:policy.issuerSha256,proxyTaskArn:policy.proxyTaskArn,tlsVersion:'TLSv1.3',connectionId:'original'};
 const grantId='66666666-6666-4666-8666-666666666666';
 const facts={binding,allocationJson:'{}',grantFactsJsons:[JSON.stringify({grantId,binding,capabilitySha256:sha(credential),qualificationBinding:{workerArn:'runner'}})],
  modelGrantId:grantId,selectedClientId:policy.selectedClientId,original:{},resource:{taskArn:'runner'},requestSha256:'e'.repeat(64),expiresAtMs:deadline};
 const gate=createProductOwnerServiceGate(),channel=createProductOwnerChannel({clientPolicy:policy,persistedFacts:{available:true,async resolve(){return facts;}},
  ownerPorts:{pool,pricing:{},limits:{},async checkCurrentConversation(){}},serviceGate:gate,now:()=>at,maxExchangeMs:1000});
 const opened=JSON.parse(await channel.open(wire(['meri.proxy.session-open/1',requestId,sha(credential),tuple,deadline]),peer));
 const session=opened[1],reservation=['meri.proxy.reservation/1',[requestId,tuple,deadline],
  [requestId,[tuple,'runner',grantId,at],credential,raw.toString('base64'),
   ['POST','https://example.test/invoke','example.test','application/json',native.toString('base64'),[['host','example.test'],['content-type','application/json']]],
   [12,sha(native),'anthropic.claude-sonnet-4-6','aws-counttokens']]];
 await channel.operation(wire(['meri.proxy.operation/1',session,reservation]),peer);
 const settlement=['meri.proxy.settlement/1',requestId,['COMPLETE',[requestId,sha(native),sha(raw),'b'.repeat(64),12,16,[]],'e'.repeat(64),12,7,'COMPLETE_NATIVE_MESSAGE','native-usage-data']];
 await channel.operation(wire(['meri.proxy.operation/1',session,settlement]),peer);channel.close();
 return {channel,gate,releases,queryStarted,connects:()=>connects,releaseQuery(){resolveQuery();},serve(){stall=false;},
  body:wire(['meri.proxy.operation/1',session,['meri.proxy.outcome/1',requestId]]),peer:{...peer,connectionId:'recovery'}};
}

test('aborting recovery evicts its read client and keeps the service serving',async()=>{
 const f=await fixture(),abort=new AbortController();
 const pending=f.channel.readOutcome(f.body,f.peer,{signal:abort.signal});
 await f.queryStarted;const refused=assert.rejects(pending,/DEADLINE/);abort.abort();
 assert.equal(f.releases.length,1,'abort evicts immediately, before the deadline timer');
 assert.ok(f.releases[0] instanceof Error);assert.equal(f.gate.available,true);await refused;
 f.releaseQuery();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.releases.length,1,'late completion cannot return the client twice');
 f.serve();assert.equal(JSON.parse(await f.channel.readOutcome(f.body,f.peer))[0],'meri.proxy.outcome-receipt/1');
});

test('a cancelled recovery and foreign recovery selectors never acquire a client',async()=>{
 const f=await fixture(),abort=new AbortController();abort.abort();
 await assert.rejects(f.channel.readOutcome(f.body,f.peer,{signal:abort.signal}));
 for(const change of [frame=>{frame[1]='foreign';},frame=>{frame[2][1]='foreign';},frame=>{frame[2][0]='meri.proxy.settlement/1';}]){
  const frame=JSON.parse(f.body);change(frame);await assert.rejects(f.channel.readOutcome(wire(frame),f.peer));
 }
 await assert.rejects(f.channel.readOutcome(f.body,{...f.peer,proxyTaskArn:'foreign'}));
 assert.equal(f.connects(),0);assert.equal(f.gate.available,true);
});

/** Real TLS / HTTP transport with synthetic proof and placement ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createP2OwnerFixture} from './test/p2-owner-fixture.mjs';
import {OWNER_PATHS} from './owner-channel.mjs';
const placement=(id,deadline=Date.now()+5000)=>['meri.proxy.placement-read/1',id,'a'.repeat(64),deadline];

test('real TLS accepts only a post-handshake proof then reuses the lease on held HTTP exchanges',async()=>{
 const f=await createP2OwnerFixture();
 try{
  assert.equal(f.counts.pairProofs,1);let handshaken=false;
  f.proofHook(()=>{assert.equal(handshaken,true,'new socket proof cannot start before TLS handshake');});
  const first=await f.request(OWNER_PATHS.operation,placement('first'),{onSocket:socket=>socket.once('secureConnect',()=>{handshaken=true;})});
  assert.equal(first.status,200);assert.equal(f.counts.pairProofs,2);assert.equal(f.counts.placement,1);
  const second=await f.request(OWNER_PATHS.operation,placement('second'));
  assert.equal(second.status,200);assert.equal(first.socket,second.socket);assert.equal(f.counts.pairProofs,2,'held exchanges perform no discoveries');
 }finally{await f.close();}
});

test('real TLS with mismatched peer identity or unavailable post-handshake proof performs no owner work',async()=>{
 const f=await createP2OwnerFixture();
 try{
  await assert.rejects(f.request(OWNER_PATHS.operation,placement('wrong-peer'),{localAddress:'127.0.0.3'}));
  assert.equal(f.counts.placement,0);assert.equal(f.counts.pairProofs,1);
  f.setUnavailable(true);await assert.rejects(f.request(OWNER_PATHS.operation,placement('no-proof')));
  assert.equal(f.counts.placement,0);assert.equal(f.counts.pairProofs,2);assert.equal(f.serviceGate.available,true);
  f.setUnavailable(false);assert.equal((await f.request(OWNER_PATHS.operation,placement('recovered'))).status,200);
 }finally{await f.close();}
});

test('expired held-socket lease makes one bounded proof and refuses unavailable without poisoning',async()=>{
 let mono=0;const f=await createP2OwnerFixture({monotonicNow:()=>mono});
 try{
  assert.equal((await f.request(OWNER_PATHS.operation,placement('first'))).status,200);
  f.setUnavailable(true);mono=30000;const before=f.counts.pairProofs;
  const refused=await f.request(OWNER_PATHS.operation,placement('expired'));
  assert.equal(refused.status,403);assert.equal(f.counts.placement,1);assert.equal(f.counts.pairProofs,before+1);assert.equal(f.serviceGate.available,true);
 }finally{await f.close();}
});

for(const independentReadiness of [false,true])test(`in-flight owner work cannot return after monotonic lease expiry${independentReadiness?' even while process readiness is true':''}`,async()=>{
 // Certificate creation can cross a second boundary; freeze after its notBefore.
 const wall=Date.now()+60000;let mono=0,entered,finish;
 const working=new Promise(resolve=>{entered=resolve;}),release=new Promise(resolve=>{finish=resolve;});
 const f=await createP2OwnerFixture({now:()=>wall,monotonicNow:()=>mono,maxRequestMs:5000,
  afterPlacement:async()=>{entered();await release;},
  // N14 must remain independently guarded: a ready process is not socket authority.
  readiness:independentReadiness?()=>true:undefined});
 try{
  let closed;
  const pending=f.request(OWNER_PATHS.operation,placement('expires-in-flight',wall+5000),{
   onSocket:socket=>{closed=new Promise(resolve=>socket.once('close',resolve));},
  });
  await Promise.race([working,pending.then(()=>assert.fail('owner work never entered'))]);assert.equal(f.counts.placement,1);
  mono=f.reader.current().expiresAtMonoMs+1;finish();
  const refused=await pending;
  assert.equal(refused.status,403);assert.equal(refused.body.length,0);
  assert.equal(refused.headers.connection,'close');await closed;assert.equal(refused.socket.destroyed,true);
  assert.equal(f.serviceGate.available,true);assert.equal(f.counts.pairProofs,2);
  assert.equal(f.pins.expiresAtMs,wall+3600000,'the wall clock stayed fixed throughout owner work');
 }finally{finish();await f.close();}
});

test('replacement destroys the old physical socket before new-generation serving; revision drift retires',async()=>{
 const f=await createP2OwnerFixture();
 try{
  const before=await f.request(OWNER_PATHS.operation,placement('old'));
  const closed=new Promise(resolve=>before.socket.once('close',resolve));
  f.replaceProxy();await f.reader.read({deadlineMs:Date.now()+1000});await closed;
  assert.equal(before.socket.destroyed,true);assert.equal(f.reader.reproving,true);assert.equal(f.server.available,true);
  const next=await f.request(OWNER_PATHS.operation,placement('new'),{localAddress:'127.0.0.3'});
  assert.equal(next.status,200);assert.equal(f.reader.reproving,false);assert.equal(f.health.filter(row=>row[1]==='reproven').length,1);
  f.mutatePair(pair=>{pair.owner.taskArn='foreign-own-task';});
  await assert.rejects(f.reader.read({deadlineMs:Date.now()+1000}),{code:'PAIR_DRIFT'});
  assert.equal(f.server.available,false);assert.equal(f.serviceGate.available,false);
 }finally{await f.close();}
});

test('aborted read-only HTTPS request closes its socket but the next request still serves',async()=>{
 let block=true,started;const entered=new Promise(resolve=>{started=resolve;});
 const placementPort={available:true,resolve:async({signal})=>{
  if(block){started();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}
  throw Error('synthetic answered refusal');
 }};
 const f=await createP2OwnerFixture({placement:placementPort,maxRequestMs:50});
 try{
  const pending=f.request(OWNER_PATHS.operation,placement('aborted'));const rejected=assert.rejects(pending);
  await entered;await rejected;assert.equal(f.serviceGate.available,true);assert.equal(f.server.available,true);
  block=false;const next=await f.request('/health/ready');assert.equal(next.status,200);
 }finally{await f.close();}
});

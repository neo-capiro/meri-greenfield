/** Real TLS generation boundary with a deliberately delayed synthetic session owner. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';

const channelModule=await import('./owner-channel.mjs');
const entered=Promise.withResolvers(),release=Promise.withResolvers();
const requestId='late-admit-request',sessionId='late-admit-session',capability='a'.repeat(64);
let outcomeCalls=0,closedChannels=0;
// Hold only the session-owner seam. The real listener, physical sockets, pair
// holder, replacement callback and post-handshake generation proof still run.
mock.module(new URL('./owner-channel.mjs',import.meta.url).href,{namedExports:{
 ...channelModule,
 createProductOwnerChannel:()=>({
  async admit(request){
   assert.equal(request.requestId,requestId);
   assert.equal(request.capabilitySha256,capability);
   entered.resolve();await release.promise;
   return Buffer.from(JSON.stringify(['meri.proxy.session/1',sessionId,requestId,capability]));
  },
  async readOutcome(){outcomeCalls++;return Buffer.from(JSON.stringify(['forbidden-old-session-outcome']));},
  close(){closedChannels++;},get canReadOutcome(){return true;},
 }),
}});
const {createP2OwnerFixture}=await import('./test/p2-owner-fixture.mjs');

test('an admit completed after replacement cannot publish or serve an old-generation session',async()=>{
 const f=await createP2OwnerFixture({maxRequestMs:5000});
 try{
  const pending=f.request(channelModule.OWNER_PATHS.operation,
   ['meri.proxy.admit/1',requestId,capability,Date.now()+30000]);
  const rejected=assert.rejects(pending);
  await Promise.race([entered.promise,pending.then(()=>assert.fail('admit never entered'))]);
  f.replaceProxy();await f.reader.read({deadlineMs:Date.now()+5000});
  await rejected;
  assert.equal(f.reader.reproving,true);
  release.resolve();
  const deadline=Date.now()+5000;
  while(f.server.pendingRequests>0&&Date.now()<deadline)await nextTurn();
  assert.equal(f.server.pendingRequests,0,'the delayed admit completed after generation clearing');
  const result=await f.request(channelModule.OWNER_PATHS.operation,
   ['meri.proxy.operation/2',sessionId,['meri.proxy.outcome/1',requestId],null],
   {using:f.agent(),localAddress:'127.0.0.3'});
  assert.equal(f.reader.reproving,false,'the new physical socket has a valid new-generation proof');
  assert.equal(f.health.filter(row=>row[1]==='reproven').length,1);
  assert.equal(result.status,403);
  assert.equal(result.body.length,0);
  assert.equal(outcomeCalls,0,'old-generation session never reaches the outcome owner');
  assert.equal(closedChannels,1,'the unpublished late admission channel is closed');
  assert.equal(f.serviceGate.available,true);
 }finally{release.resolve();await f.close();}
});

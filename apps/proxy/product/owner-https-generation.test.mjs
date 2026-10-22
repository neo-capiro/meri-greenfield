/** Real TLS generation boundary with a deliberately delayed synthetic session owner. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';

const channelModule=await import('./owner-channel.mjs');
const entered=Promise.withResolvers(),release=Promise.withResolvers();
const requestId='late-open-request',sessionId='late-open-session',capability='a'.repeat(64);
let captureCalls=0;
// Hold only the session-owner seam. The real listener, physical sockets, pair
// holder, replacement callback and post-handshake generation proof still run.
mock.module(new URL('./owner-channel.mjs',import.meta.url).href,{namedExports:{
 ...channelModule,
 createProductOwnerChannel:()=>({
  async open(body){
   const frame=JSON.parse(body);
   assert.equal(frame[0],'meri.proxy.session-open/1');
   assert.equal(frame[1],requestId);
   entered.resolve();await release.promise;
   return Buffer.from(JSON.stringify(['meri.proxy.session/1',sessionId,requestId,capability]));
  },
  async poll(){captureCalls++;return Buffer.from(JSON.stringify(['forbidden-old-session-capture']));},
  close(){},get canReadOutcome(){return false;},
 }),
}});
const {createP2OwnerFixture}=await import('./test/p2-owner-fixture.mjs');

test('an open completed after replacement cannot serve capture on a new-generation socket',async()=>{
 const f=await createP2OwnerFixture({maxRequestMs:5000});
 try{
  const pending=f.request(channelModule.OWNER_PATHS.open,
   ['meri.proxy.session-open/1',requestId,capability,null,Date.now()+30000]);
  const rejected=assert.rejects(pending);
  await Promise.race([entered.promise,pending.then(()=>assert.fail('open never entered'))]);
  f.replaceProxy();await f.reader.read({deadlineMs:Date.now()+5000});
  await rejected;
  assert.equal(f.reader.reproving,true);
  release.resolve();
  const deadline=Date.now()+5000;
  while(f.server.pendingRequests>0&&Date.now()<deadline)await nextTurn();
  assert.equal(f.server.pendingRequests,0,'the delayed open completed after generation clearing');
  const result=await f.request(channelModule.OWNER_PATHS.poll,
   ['meri.proxy.capture-poll/1',sessionId,requestId,'call'],
   {using:f.agent(),localAddress:'127.0.0.3'});
  assert.equal(f.reader.reproving,false,'the new physical socket has a valid new-generation proof');
  assert.equal(f.health.filter(row=>row[1]==='reproven').length,1);
  assert.equal(result.status,403);
  assert.equal(result.body.length,0);
  assert.equal(captureCalls,0,'old-generation session never reaches the capture owner');
  assert.equal(f.serviceGate.available,true);
 }finally{release.resolve();await f.close();}
});

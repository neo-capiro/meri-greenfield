import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerPairLease,pairFailure,PAIR_LEASE_TTL_MS,PAIR_RENEW_MS,PAIR_REPROOF_MS,
 PAIR_REPROOFS_PER_10_MIN,PAIR_RENEWER_QUARANTINE_COOLDOWN_MS} from './owner-pair-lease.mjs';

const WALL=1900000000000;
async function fixture(options={}){
 let wall=WALL,mono=100,replyError=null,quarantined=false,readHook=null,created=0,reads=0;
 const events=[],timers=[],health=[],diagnostics=[];
 const pins={deploymentRevision:'revision-1',expiresAtMs:WALL+3600000,ownerCertSha256:'a'.repeat(64),proxyCertSha256:'b'.repeat(64)};
 const task=(name,n)=>({taskArn:name,privateIpv4Address:'10.40.4.'+n,networkInterfaceId:'eni-'+String(n).repeat(8),createdAtMs:WALL-10000});
 let observation={owner:task('owner',1),proxy:task('proxy',2)};
 const holder=await createOwnerPairLease({pins,maxLeaseMs:PAIR_LEASE_TTL_MS,maxRequestMs:1000,
  now:()=>wall,monotonicNow:()=>mono,random:()=>.5,
  schedule:(fn,delay)=>{const timer={fn,delay};timers.push(timer);return timer;},unschedule:t=>{t.cancelled=true;},
  telemetry:{health:(...args)=>health.push(args),background:fn=>{events.push('background');return fn();}},writeDiagnostic:line=>diagnostics.push(line),
  createDiscovery:async()=>{created++;quarantined=false;return {get available(){return !quarantined;},async read(){
   reads++;events.push(['proof',mono]);if(readHook)await readHook();if(replyError)throw replyError;
   return structuredClone({...observation,checkedAtMs:wall,expiresAtMs:Math.min(pins.expiresAtMs,wall+PAIR_LEASE_TTL_MS)});
  }};},...options});
 const read=()=>holder.read({deadlineMs:wall+1000});
 const bind=async(lease=holder.current(),handshakeAtMonoMs=mono)=>{
  events.push(['handshake',handshakeAtMonoMs]);
  return holder.proveConnection({generation:lease.generation,localAddress:lease.ownerPrivateIpv4Address,
   remoteAddress:lease.proxyPrivateIpv4Address,handshakeAtMonoMs,deadlineMs:wall+1000});
 };
 return {holder,read,bind,pins,events,timers,health,diagnostics,get reads(){return reads;},get created(){return created;},
  setWall:value=>{wall=value;},setMono:value=>{mono=value;},advance:value=>{wall+=value;mono+=value;},
  change:fn=>{fn(observation);},unavailable:()=>{replyError=pairFailure();},drift:()=>{replyError=pairFailure('PAIR_DRIFT');},recover:()=>{replyError=null;},
  quarantine:()=>{quarantined=true;replyError=pairFailure();},hook:fn=>{readHook=fn;},
  replace:(n,createdAtMs=WALL-10000+n)=>{observation.proxy=task('proxy-'+n,n);observation.proxy.createdAtMs=createdAtMs;}};
}

test('no valid lease means no exchange; a starved renewer and wall-clock steps cannot extend monotonic TTL',async()=>{
 const f=await fixture();assert.throws(()=>f.holder.current(),{code:'PAIR_UNAVAILABLE'});
 const lease=await f.read();assert.equal(f.holder.assertConnection(lease),lease);
 f.setWall(WALL-5000);f.setMono(lease.expiresAtMonoMs-1);assert.equal(f.holder.assertConnection(lease),lease);
 f.setMono(lease.expiresAtMonoMs);assert.throws(()=>f.holder.assertConnection(lease),{code:'PAIR_UNAVAILABLE'});
 f.setWall(WALL+10);assert.throws(()=>f.holder.assertConnection(lease),{code:'PAIR_UNAVAILABLE'});
 assert.equal(f.reads,1,'checking expiry never discovers or sends');assert.equal(f.holder.ready,false);await f.holder.close();
 const g=await fixture();const value=await g.read();g.setWall(value.expiresAtMs);assert.throws(()=>g.holder.assertConnection(value));await g.holder.close();
});

test('new sockets require a full proof started after their handshake; earlier in-flight proof does not count',async()=>{
 const f=await fixture();const lease=await f.read();let finish;
 f.setMono(200);f.hook(()=>new Promise(resolve=>{finish=resolve;}));
 const earlier=f.read();await new Promise(resolve=>setImmediate(resolve));
 f.setMono(300);const binding=f.bind(lease,300);await Promise.resolve();
 f.hook(null);f.setMono(400);finish();await earlier;const bound=await binding;
 assert.equal(f.reads,3,'startup, earlier proof and a separate proof begun after handshake');
 assert.ok(bound.proofStartedAtMonoMs>=300);assert.deepEqual(f.events.at(-1),['proof',400]);
 const before=f.reads;
 await assert.rejects(f.holder.proveConnection({generation:1,localAddress:lease.ownerPrivateIpv4Address,
  remoteAddress:'10.40.4.99',handshakeAtMonoMs:400,deadlineMs:WALL+1000}),{code:'PAIR_UNAVAILABLE'});
 assert.equal(f.reads,before,'unbound peer IP is refused before discovery');await f.holder.close();
});

test('replacement closes old sockets and sessions first; only post-handshake proof admits the next generation once',async()=>{
 const f=await fixture();const old=await f.read(),resources={socket:true,session:true};
 f.holder.subscribe((reason,previous)=>{
  if(reason==='replacement'){assert.equal(previous,old);assert.throws(()=>f.holder.current());resources.socket=false;resources.session=false;}
 });
 f.replace(3);const next=await f.read();assert.deepEqual(resources,{socket:false,session:false});
 assert.equal(next.generation,old.generation+1);assert.equal(next.proxyPrivateIpv4Address,'10.40.4.3');
 assert.equal(f.holder.ready,true);assert.throws(()=>f.holder.assertConnection(old));
 assert.throws(()=>f.holder.assertConnection(next),{code:'PAIR_REPROVING'});assert.deepEqual(f.health,[]);
 const bound=await f.bind(next);assert.equal(f.holder.assertConnection(bound).generation,2);
 assert.throws(()=>f.holder.assertConnection(old),{code:'PAIR_UNAVAILABLE'},'old generation stays refused after new sockets become usable');
 assert.deepEqual(f.health,[['pair','reproven','PAIR_REPROVEN']]);assert.equal(f.diagnostics.length,1);
 await f.read();await f.bind();assert.equal(f.health.length,1,'normal renewals and additional carriers do not log replacement');
 await f.holder.close();
});

test('re-proof readiness grace is monotonic and late post-handshake success can recover until absolute pin expiry',async()=>{
 const f=await fixture();await f.read();f.replace(3);const next=await f.read();
 f.setMono(next.checkedAtMonoMs+PAIR_REPROOF_MS-1);assert.equal(f.holder.ready,true);
 f.setMono(next.checkedAtMonoMs+PAIR_REPROOF_MS);assert.equal(f.holder.ready,false);assert.equal(f.holder.available,true);
 f.advance(1);await f.read();await f.bind();assert.equal(f.holder.ready,true);
 f.setWall(f.pins.expiresAtMs);assert.equal(f.holder.available,false);await assert.rejects(f.read());await f.holder.close();
});

for(const [label,change] of [
 ['own task',f=>f.change(p=>{p.owner.taskArn='other-owner';})],
 ['own ENI',f=>f.change(p=>{p.owner.networkInterfaceId='eni-99999999';})],
 ['same partner ARN with changed ENI',f=>f.change(p=>{p.proxy.networkInterfaceId='eni-99999999';})],
 ['older replacement',f=>f.replace(3,WALL-10001)],
 ['observed revision or network drift',f=>f.drift()],
])test(label+' retires and cannot be re-pinned',async()=>{
 const f=await fixture();const old=await f.read();let closed=0;f.holder.subscribe(reason=>{if(reason==='retired')closed++;});change(f);
 await assert.rejects(f.read(),{code:'PAIR_DRIFT'});assert.equal(f.holder.available,false);assert.equal(f.holder.ready,false);assert.equal(closed,1);
 assert.throws(()=>f.holder.assertConnection(old),{code:'PAIR_DRIFT'});f.recover();const count=f.reads;
 await assert.rejects(f.read(),{code:'PAIR_DRIFT'});assert.equal(f.reads,count);await f.holder.close();
});

test('a previously seen partner ARN returning is drift, including a larger creation time',async()=>{
 const f=await fixture();await f.read();f.replace(3);await f.read();await f.bind();
 f.change(p=>{p.proxy.taskArn='proxy';p.proxy.createdAtMs=WALL;});
 await assert.rejects(f.read(),{code:'PAIR_DRIFT'});assert.equal(f.holder.available,false);await f.holder.close();
});

test('a fourth replacement in a rolling ten minutes retires, while old entries age out',async()=>{
 const f=await fixture();await f.read();
 for(let i=0;i<PAIR_REPROOFS_PER_10_MIN;i++){f.replace(i+3);await f.read();await f.bind();}
 f.replace(6);await assert.rejects(f.read(),{code:'PAIR_DRIFT'});assert.equal(f.health.filter(r=>r[1]==='reproven').length,3);await f.holder.close();
 const g=await fixture();await g.read();
 for(let i=0;i<4;i++){g.replace(i+3);await g.read();await g.bind();g.advance(10*60000);}
 assert.equal(g.holder.available,true);await g.holder.close();
});

test('unavailable renewal preserves lease; expired synchronous proof refuses only that request and never serves stale',async()=>{
 const f=await fixture();const old=await f.read();f.unavailable();await assert.rejects(f.read(),{code:'PAIR_UNAVAILABLE'});
 assert.equal(f.holder.assertConnection(old),old);assert.equal(f.holder.available,true);
 f.advance(PAIR_LEASE_TTL_MS);const before=f.reads;
 await assert.rejects(f.holder.ensure({deadlineMs:WALL+PAIR_LEASE_TTL_MS+1000}),{code:'PAIR_UNAVAILABLE'});
 assert.equal(f.reads,before+1);assert.equal(f.holder.available,true);assert.throws(()=>f.holder.assertConnection(old));
 f.recover();const fresh=await f.read();assert.equal(f.holder.assertConnection(old),fresh);await f.holder.close();
});

test('one renewer serializes every discovery and renews independently of request traffic',async()=>{
 const f=await fixture();await f.read();f.holder.start();f.holder.start();assert.equal(f.timers.length,1);assert.equal(f.timers[0].delay,PAIR_RENEW_MS);
 f.advance(PAIR_RENEW_MS);f.timers[0].fn();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.reads,2);assert.equal(f.timers.length,2);assert.ok(f.events.includes('background'));
 const old=f.holder.current();for(let i=0;i<100;i++)f.holder.assertConnection(old);assert.equal(f.reads,2);
 await f.holder.close();assert.equal(f.timers.at(-1).cancelled,true);
});

test('unsettled SDK quarantine belongs to the renewer and recreates discovery only after bounded cooldown',async()=>{
 const f=await fixture();await f.read();f.quarantine();await assert.rejects(f.read(),{code:'PAIR_UNAVAILABLE'});
 assert.equal(f.holder.quarantined,true);assert.equal(f.holder.available,true);assert.equal(f.created,1);
 f.advance(PAIR_RENEWER_QUARANTINE_COOLDOWN_MS-1);await assert.rejects(f.read(),{code:'PAIR_UNAVAILABLE'});assert.equal(f.created,1);
 f.advance(1);f.recover();await f.read();assert.equal(f.created,2);assert.equal(f.holder.quarantined,false);assert.equal(f.holder.ready,true);await f.holder.close();
});

test('configured lease cap must leave at least two renewal periods',async()=>{
 await assert.rejects(fixture({maxLeaseMs:2*PAIR_RENEW_MS-1}),{code:'PAIR_UNAVAILABLE'});
 const f=await fixture({maxLeaseMs:2*PAIR_RENEW_MS});const lease=await f.read();
 assert.equal(lease.expiresAtMonoMs-lease.checkedAtMonoMs,2*PAIR_RENEW_MS);await f.holder.close();
});

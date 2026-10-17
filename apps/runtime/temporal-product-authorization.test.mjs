import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createTemporalProductAuthorization} from './temporal-product-authorization.mjs';

const NOW=1_800_000_000_000;
const configuration=()=>({enabled:true,role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-control:v1',maxRequestMs:1000,
 authorization:{tokenFile:'/run/meri-temporal/token.json',namespace:'meri',audience:'meri-temporal',issuer:'https://issuer.synthetic.invalid/',refreshMs:5000,maxLifetimeMs:60000}});
function timers(){
 const pending=new Set();
 return {pending,setTimeout(fn,ms){const timer={fn,ms,unref(){}};pending.add(timer);return timer;},clearTimeout(timer){pending.delete(timer);},
  fire(ms){const timer=[...pending].find(timer=>timer.ms===ms);assert.ok(timer,`expected ${ms}ms timer`);pending.delete(timer);timer.fn();}};
}
async function settled(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture(overrides={}){
 const c=configuration(),clock={at:NOW},scheduled=timers(),state={serial:0,reads:0,refreshes:0,closes:0,current:false,expiresAtMs:null,token:null,readError:false,events:[]},watchers=new Set();
 const now=()=>clock.at;
 const writer={async refresh({signal}={}){
  state.refreshes++;state.events.push('writer');await overrides.renew?.({signal,state});
  signal?.throwIfAborted();
  state.token={token:`synthetic-temporal-token-${++state.serial}-`+'x'.repeat(32),expiresAtMs:now()+9000,
   claims:{namespace:c.authorization.namespace,audience:c.authorization.audience,issuer:c.authorization.issuer}};
  state.current=true;state.expiresAtMs=state.token.expiresAtMs;
 },async start(value){return writer.refresh(value);},async close(){state.closes++;state.current=false;watchers.clear();await overrides.close?.();},
 status:()=>({expiresAtMs:state.expiresAtMs}),healthy:()=>state.current&&state.expiresAtMs>now(),
 watch(listener){watchers.add(listener);return ()=>watchers.delete(listener);}};
 const losses=[];
 const lifecycle=createTemporalProductAuthorization({configuration:c,now,timers:scheduled,onUnavailable:code=>{losses.push({code,healthy:lifecycle.healthy()});overrides.onUnavailable?.();}},
  {createWriter(options){assert.deepEqual(options.configuration,c);return writer;},createReader({tokenFile}){assert.equal(tokenFile,c.authorization.tokenFile);return {async read({signal}={}){
   state.reads++;state.events.push('reader');await overrides.read?.({signal,state});signal?.throwIfAborted();
   if(state.readError)throw Error('private issuer/file detail');return structuredClone(state.token);
  }};}});
 return {c,clock,scheduled,state,losses,lifecycle,lose(){state.current=false;for(const watcher of [...watchers])watcher('TEMPORAL_PRODUCT_TOKEN_REVOKED');}};
}

test('disabled construction never reads material or schedules work; enabled config requires a synchronous stop owner',async()=>{
 const scheduled=timers();const lifecycle=createTemporalProductAuthorization({timers:scheduled,delivery:{get read(){assert.fail('disabled delivery touched');}}});
 assert.equal((await lifecycle.start()).state,'disabled');assert.equal(lifecycle.healthy(),false);
 assert.throws(()=>lifecycle.apiKey(),/TEMPORAL_PRODUCT_AUTHORIZATION_UNAVAILABLE/u);
 assert.deepEqual(await lifecycle.close(),{closed:true,physicalStopProven:false});assert.equal(scheduled.pending.size,0);
 assert.throws(()=>createTemporalProductAuthorization({configuration:configuration()}),/TEMPORAL_PRODUCT_AUTHORIZATION_CONFIGURATION/u);
 assert.throws(()=>createTemporalProductAuthorization({configuration:configuration(),onUnavailable:async()=>{}}),/TEMPORAL_PRODUCT_AUTHORIZATION_CONFIGURATION/u);
});

test('actual canonical authorization starts only after writer publication and rotates attached connections',async()=>{
 const f=fixture();assert.equal(f.lifecycle.healthy(),false);assert.throws(()=>f.lifecycle.readiness(),/UNAVAILABLE/u);
 const result=await f.lifecycle.start();assert.equal(result.state,'current');assert.deepEqual(f.state.events,['writer','reader']);
 assert.deepEqual(f.lifecycle.readiness(),{ready:true});assert.match(f.lifecycle.apiKey(),/^synthetic-temporal-token-1-/u);
 const rotated=[];f.lifecycle.attach({async setApiKey(token){rotated.push(token);}});
 f.clock.at+=100;await f.lifecycle.refresh();assert.deepEqual(f.state.events,['writer','reader','writer','reader']);
 assert.equal(rotated.length,1);assert.match(rotated[0],/^synthetic-temporal-token-2-/u);
 assert.equal(f.lifecycle.current().expiresAtMs,f.clock.at+9000);
 assert.deepEqual(await f.lifecycle.close(),{closed:true,physicalStopProven:false});await f.lifecycle.close();
 assert.equal(f.state.closes,1);assert.equal(f.scheduled.pending.size,0);assert.equal(f.lifecycle.current(),null);
});

test('one original refresh is shared and close discards a late publication without restoring authority',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const f=fixture({renew:()=>pending});
 const first=f.lifecycle.start(),second=f.lifecycle.refresh();assert.equal(first,second);await settled();assert.equal(f.state.refreshes,1);
 const denied=assert.rejects(first,/TEMPORAL_PRODUCT_AUTHORIZATION_/u);await f.lifecycle.close();release();await denied;await settled();
 assert.equal(f.lifecycle.healthy(),false);assert.equal(f.state.reads,0);assert.equal(f.state.closes,1);
 assert.throws(()=>f.lifecycle.apiKey(),/UNAVAILABLE/u);await assert.rejects(f.lifecycle.refresh(),/CLOSED/u);
});

test('writer revocation publishes loss before stopping, drops cached API key, and never recovers implicitly',async()=>{
 const f=fixture();await f.lifecycle.start();const observed=[];f.lifecycle.watch(code=>observed.push({code,healthy:f.lifecycle.healthy()}));
 f.lose();assert.equal(f.lifecycle.healthy(),false);assert.equal(f.losses.length,1);assert.equal(f.losses[0].healthy,false);
 assert.equal(observed.length,1);assert.equal(observed[0].healthy,false);assert.throws(()=>f.lifecycle.apiKey(),/UNAVAILABLE/u);
 await f.lifecycle.close();assert.equal(f.state.closes,1);assert.equal(f.scheduled.pending.size,0);
 await assert.rejects(f.lifecycle.refresh(),/CLOSED/u);assert.equal(f.state.refreshes,1);
});

test('canonical authorization read failure or expired writer lease closes both owners and stops readiness',async()=>{
 for(const kind of ['read-failure','expiry']){
  const f=fixture();await f.lifecycle.start();
  if(kind==='read-failure'){f.state.readError=true;f.clock.at+=4000;f.scheduled.fire(4000);}
  else{f.clock.at+=9000;f.scheduled.fire(9000);}
  await settled();assert.equal(f.lifecycle.healthy(),false);assert.equal(f.losses.length,1);
  assert.throws(()=>f.lifecycle.readiness(),/UNAVAILABLE/u);assert.equal(f.lifecycle.current(),null);
  await f.lifecycle.close();assert.equal(f.state.closes,1);assert.equal(f.scheduled.pending.size,0);
  assert.doesNotMatch(JSON.stringify(f.lifecycle.status()),/private issuer|synthetic-temporal-token/u);
 }
});

test('failed or hung native key rotation is denied under the same bounded refresh lifetime',async()=>{
 for(const kind of ['rejected','hung']){
  let release;const held=new Promise(resolve=>{release=resolve;});const f=fixture();await f.lifecycle.start();
  f.lifecycle.attach({async setApiKey(){if(kind==='rejected')throw Error('private native rotation');await held;}});
  const pending=f.lifecycle.refresh(),denied=assert.rejects(pending,/TEMPORAL_PRODUCT_AUTHORIZATION_/u);await settled();
  if(kind==='hung'){f.clock.at+=1000;f.scheduled.fire(1000);}
  await denied;assert.equal(f.lifecycle.healthy(),false);assert.equal(f.losses.length,1);assert.equal(f.state.closes,1);
  if(kind==='hung')assert.equal(f.lifecycle.failure(),'TEMPORAL_PRODUCT_AUTHORIZATION_IO_UNKNOWN');
  release();await settled();assert.equal(f.lifecycle.current(),null);assert.throws(()=>f.lifecycle.apiKey(),/UNAVAILABLE/u);
  await f.lifecycle.close();assert.equal(f.scheduled.pending.size,0);
 }
});

test('a stop-owner failure remains cleanup unknown and cannot reopen readiness',async()=>{
 const f=fixture({onUnavailable(){throw Error('private stop failure');}});await f.lifecycle.start();f.lose();
 await assert.rejects(f.lifecycle.close(),/TEMPORAL_PRODUCT_AUTHORIZATION_CLEANUP_UNKNOWN/u);
 assert.equal(f.lifecycle.healthy(),false);assert.equal(f.state.closes,1);assert.equal(f.losses.length,1);
});

test('canonical automatic refresh bounds a hung native rotation before original token expiry and discards late replies',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const f=fixture();await f.lifecycle.start();
 const calls=[];f.lifecycle.attach({async setApiKey(token){calls.push(['first',token]);await pending;}});
 f.lifecycle.attach({async setApiKey(token){calls.push(['second',token]);}});
 const originalExpiry=f.lifecycle.current().expiresAtMs;
 f.clock.at+=4000;f.scheduled.fire(4000);await settled();assert.equal(calls.length,1);assert.equal(f.lifecycle.healthy(),true);
 f.clock.at+=1000;f.scheduled.fire(1000);await settled();
 assert.ok(f.clock.at<originalExpiry,'the owned refresh deadline precedes the old key expiry');
 assert.equal(f.lifecycle.healthy(),false);assert.equal(f.losses.length,1);assert.equal(f.losses[0].healthy,false);
 assert.equal(f.lifecycle.failure(),'TEMPORAL_PRODUCT_AUTHORIZATION_IO_UNKNOWN');
 assert.equal(f.lifecycle.current(),null);assert.throws(()=>f.lifecycle.apiKey(),/UNAVAILABLE/u);
 assert.equal(f.state.closes,1);assert.equal(f.scheduled.pending.size,0);
 release();await settled();assert.equal(calls.length,1,'late rotation cannot advance to another native connection');
 assert.equal(f.lifecycle.current(),null);await assert.rejects(f.lifecycle.refresh(),/CLOSED/u);
 await f.lifecycle.close();assert.equal(f.scheduled.pending.size,0);
});

test('default construction is inert and the actual writer rejects unsupported native filesystem before delivery',async()=>{
 if(process.platform==='linux')return;
 let reads=0,losses=0;const lifecycle=createTemporalProductAuthorization({configuration:configuration(),delivery:{async read(){reads++;assert.fail('delivery must not run');}},onUnavailable(){losses++;}});
 assert.equal(reads,0);assert.equal(lifecycle.status().state,'idle');await assert.rejects(lifecycle.start(),/TEMPORAL_PRODUCT_AUTHORIZATION_/u);
 assert.equal(reads,0);assert.equal(losses,1);assert.equal(lifecycle.healthy(),false);await lifecycle.close();
});

const native=process.platform==='linux'&&process.getuid?.()>0&&process.getgid?.()>0;
test('Linux actual writer/file-reader lifecycle owns only its separate initially empty token directory',{skip:native?false:'UNRUN: requires nonroot Linux file identity/mode/atomic rename'},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-temporal-product-auth-'));
 t.after(async()=>{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.split(/[\\/]/u).at(-1).startsWith('meri-temporal-product-auth-'));await rm(directory,{recursive:true,force:true});});
 const c=configuration();c.authorization.tokenFile=join(directory,'token.json');let serial=0,losses=0;
 const lifecycle=createTemporalProductAuthorization({configuration:c,onUnavailable(){losses++;},delivery:{async read(request){
  return {schemaVersion:1,state:'CURRENT',identity:{role:request.role,subject:request.subject,workloadPrincipal:request.workloadPrincipal},observedAtMs:Date.now(),validUntilMs:Date.now()+9000,
   token:{token:'synthetic-temporal-native-'+(++serial)+'x'.repeat(32),expiresAtMs:Date.now()+30000,claims:{namespace:request.namespace,audience:request.audience,issuer:request.issuer}}};
 }}});
 t.after(()=>lifecycle.close());await lifecycle.start();assert.equal(lifecycle.healthy(),true);await lifecycle.refresh();assert.equal(serial,2);
 await lifecycle.close();assert.deepEqual(await readdir(directory),[]);assert.equal(losses,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,lstat,unlink,symlink,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createTemporalTokenFileReader} from './temporal-authorization.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {parseTemporalProductTokenWriterConfiguration,inspectTemporalProductTokenDelivery,createTemporalProductTokenLease,createTemporalProductTokenWriter} from './temporal-product-token-writer.mjs';

const at=1_800_000_000_000;
const configuration=()=>({enabled:true,role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-control:v1',maxRequestMs:1000,
 authorization:{tokenFile:'/run/meri/temporal-token.json',namespace:'meri-product',audience:'meri-temporal',issuer:'https://issuer.synthetic.invalid/',refreshMs:5000,maxLifetimeMs:60000}});
function response(c,now=at,serial=1){return {schemaVersion:1,state:'CURRENT',identity:{role:c.role,subject:c.subject,workloadPrincipal:c.workloadPrincipal},observedAtMs:now,validUntilMs:now+9000,
 token:{token:`synthetic-token-${serial}-`+'x'.repeat(24),expiresAtMs:now+30000,claims:{namespace:c.authorization.namespace,audience:c.authorization.audience,issuer:c.authorization.issuer}}};}
const inspect=(c,v)=>inspectTemporalProductTokenDelivery({configuration:c,value:v,requestStartedAtMs:at-10,nowMs:at});
function timers(){const pending=new Set();return {pending,setTimeout(fn,ms){const t={fn,ms,unref(){}};pending.add(t);return t;},clearTimeout(t){pending.delete(t);},fire(ms){const t=[...pending].find(t=>t.ms===ms);assert.ok(t,`timer ${ms} exists`);pending.delete(t);t.fn();}};}
const native=process.platform==='linux'&&process.getuid?.()>0&&process.getgid?.()>0;
const linux={skip:native?false:'UNRUN: requires non-root Linux owner/mode/atomic-rename semantics'};
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'meri-temporal-writer-'));t.after(()=>rm(dir,{recursive:true,force:true}));const c=configuration();c.authorization.tokenFile=join(dir,'token.json');return {dir,c};}
async function missing(path){try{await lstat(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}}
async function until(check){const deadline=Date.now()+2000;while(!await check()){if(Date.now()>=deadline)assert.fail('bounded condition did not settle');await new Promise(resolve=>setTimeout(resolve,5));}}

test('writer configuration defaults disabled and is closed before resource allocation',()=>{
 assert.deepEqual(parseTemporalProductTokenWriterConfiguration(),{enabled:false});
 assert.deepEqual(parseTemporalProductTokenWriterConfiguration({enabled:false}),{enabled:false});
 for(const change of [
  c=>{c.enabled='true';},c=>{c.role='runner';},c=>{c.subject='';},c=>{c.authorization.tokenFile='/run/meri/../token.json';},
  c=>{c.authorization.tokenFile='/run/meri/token.json/';},c=>{c.authorization.maxLifetimeMs=300001;},c=>{c.maxRequestMs=5001;},
  c=>{c.authorization.refreshMs=30000;},c=>{c.token='not-configuration';},
 ]){const c=configuration();change(c);assert.throws(()=>parseTemporalProductTokenWriterConfiguration(c),/TEMPORAL_PRODUCT_TOKEN_CONFIGURATION/u);}
 assert.throws(()=>parseTemporalProductTokenWriterConfiguration({enabled:false,authorization:configuration().authorization}),/TEMPORAL_PRODUCT_TOKEN_CONFIGURATION/u);
 assert.throws(()=>createTemporalProductTokenWriter({configuration:configuration(),delivery:{read:()=>{},url:'https://invented.invalid'}}),/TEMPORAL_PRODUCT_TOKEN_CONFIGURATION/u);
});

test('delivery inspection reuses canonical token validation, caps expiry at currentness, and exposes no material',async()=>{
 const c=configuration(),v=response(c),summary=await inspect(c,v);
 assert.deepEqual(summary,{state:'CURRENT',expiresAtMs:at+9000});
 assert.doesNotMatch(JSON.stringify(summary),/synthetic-token|workloadPrincipal|claims|subject/u);
 // The canonical authorization factory receives an inert validation-only scheduler; no timer handle survives inspection.
 for(let i=0;i<3;i++)assert.deepEqual(await inspect(c,v),summary);
});

test('delivery denies revoked, unavailable, stale, foreign or contradictory current identity and token claims',async()=>{
 const c=configuration();
 for(const state of ['REVOKED','UNAVAILABLE']){const v={...response(c),state,validUntilMs:null,token:null};await assert.rejects(inspect(c,v),new RegExp('TEMPORAL_PRODUCT_TOKEN_'+state,'u'));}
 for(const mutate of [
  v=>{v.identity.subject='other';},v=>{v.identity.role='temporal-worker';},v=>{v.identity.workloadPrincipal='other';},
  v=>{v.observedAtMs=at-11;},v=>{v.observedAtMs=at+1;},v=>{v.validUntilMs=at+1000;},v=>{v.validUntilMs=at+10001;},
  v=>{v.token.claims.issuer='https://other.invalid/';},v=>{v.token.claims.namespace='other';},v=>{v.token.expiresAtMs=at;},
  v=>{v.token.expiresAtMs=at+60001;},v=>{v.token.expiresAtMs=at+1000;},v=>{v.token.token='short';},
  v=>{v.token.extra='refused';},v=>{v.extra='refused';},v=>{v.state='REVOKED';},
 ]){const v=response(c);mutate(v);await assert.rejects(inspect(c,v),/TEMPORAL_PRODUCT_TOKEN_/u);}
 await assert.rejects(inspectTemporalProductTokenDelivery({configuration:c,value:response(c),requestStartedAtMs:at-1001,nowMs:at}),/TEMPORAL_PRODUCT_TOKEN_DELIVERY/u);
});

test('disabled writer never touches supplied ports or timers, and close is idempotent',async()=>{
 let timerCalls=0;const writer=createTemporalProductTokenWriter({delivery:{get read(){assert.fail('disabled delivery touched');}},timers:{setTimeout(){timerCalls++;assert.fail('disabled timer');},clearTimeout(){timerCalls++;}}});
 assert.deepEqual(await writer.start(),{enabled:false,state:'disabled',expiresAtMs:null,failure:null});
 assert.equal(writer.healthy(),false);assert.doesNotMatch(JSON.stringify(writer.status()),/token-/u);
 await writer.close();await writer.close();assert.equal(writer.status().state,'closed');assert.equal(timerCalls,0);
 await assert.rejects(writer.refresh(),/TEMPORAL_PRODUCT_TOKEN_CLOSED/u);
});

test('expiry fences immediately while renewal and cleanup remain unresolved',async()=>{
 const scheduled=timers(),clock={now:at},operation=new AbortController();let renewals=0,cleanupStarted=false;
 const lease=createTemporalProductTokenLease({refreshMs:5000,maxRequestMs:1000,now:()=>clock.now,timers:scheduled,
  renew(){renewals++;return new Promise(()=>{});},abort:()=>operation.abort(),onExpiry(){cleanupStarted=true;return new Promise(()=>{});}});
 const observed=[];lease.watch(code=>observed.push({code,healthy:lease.healthy(),aborted:operation.signal.aborted}));
 lease.publish({expiresAtMs:at+9000});clock.now+=5000;scheduled.fire(5000);await new Promise(resolve=>setImmediate(resolve));assert.equal(renewals,1);
 clock.now+=4000;scheduled.fire(9000);
 assert.equal(cleanupStarted,true);assert.equal(lease.healthy(),false);assert.equal(lease.status().expiresAtMs,null);
 assert.deepEqual(observed,[{code:'TEMPORAL_PRODUCT_TOKEN_EXPIRY',healthy:false,aborted:true}]);
 assert.equal(scheduled.pending.size,0);lease.close();
});

test('an unsettled canonical lifetime permanently quarantines new work before and after a late reply',async()=>{
 const scheduled=timers();let release;
 const lease=createTemporalProductTokenLease({refreshMs:5000,maxRequestMs:1000,now:()=>at,timers:scheduled,renew:async()=>{}});
 const lifetime=createOperationLifetime({now:()=>at,deadlineMs:at+1000,schedule:scheduled.setTimeout,unschedule:scheduled.clearTimeout,errorFactory:()=>Error('bounded operation closed')});
 const work=lifetime.run(()=>new Promise(resolve=>{release=resolve;}));await new Promise(resolve=>setImmediate(resolve));
 const rejection=assert.rejects(work,/bounded operation closed/u),receipt=lifetime.close();assert.equal(receipt.unsettledOperations,1);
 lease.accountForLifetime(receipt);
 assert.throws(()=>lease.assertRefreshable(),/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u,'new work is refused while the old read remains unresolved');
 assert.throws(()=>lease.publish({expiresAtMs:at+9000}),/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u);
 release('late-reply');await rejection;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(lifetime.pendingOperations(),0);assert.throws(()=>lease.assertRefreshable(),/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u,'settling late does not authorize recovery of a quarantined instance');
 assert.equal(lease.healthy(),false);assert.equal(lease.status().failure,'TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN');lease.close();
});

test('enabled construction is inert and unsupported native platform refuses before delivery',async t=>{
 let reads=0;const writer=createTemporalProductTokenWriter({configuration:configuration(),delivery:{async read(){reads++;assert.fail('unexpected delivery');}}});
 assert.equal(reads,0);assert.equal(writer.status().state,'idle');
 if(process.platform!=='linux'){await assert.rejects(writer.refresh(),/TEMPORAL_PRODUCT_TOKEN_PLATFORM/u);assert.equal(reads,0);}else t.diagnostic('native filesystem behavior is covered by the Linux cases');
 await writer.close();
});

test('Linux: atomic owner-only replacement stays compatible with the existing reader and closes only owned files',linux,async t=>{
 const {dir,c}=await fixture(t),clock={now:at},scheduled=timers();let serial=0;
 const writer=createTemporalProductTokenWriter({configuration:c,now:()=>clock.now,timers:scheduled,delivery:{async read(request){
  assert.deepEqual(Object.keys(request).sort(),['schemaVersion','role','subject','workloadPrincipal','namespace','audience','issuer','signal'].sort());
  assert.ok(request.signal instanceof AbortSignal);return response(c,clock.now,++serial);
 }}});t.after(()=>writer.close());
 await writer.start();const first=await lstat(c.authorization.tokenFile);assert.equal(first.mode&0o777,0o600);assert.equal(first.uid,process.getuid());assert.equal(first.nlink,1);
 assert.equal((await createTemporalTokenFileReader({tokenFile:c.authorization.tokenFile}).read()).token,response(c,at,1).token);
 clock.now+=1000;await writer.refresh();const second=await lstat(c.authorization.tokenFile);assert.notEqual(second.ino,first.ino);
 assert.equal((await createTemporalTokenFileReader({tokenFile:c.authorization.tokenFile}).read()).token,response(c,clock.now,2).token);
 assert.equal(writer.healthy(),true);assert.doesNotMatch(JSON.stringify(writer.status()),/synthetic-token|claims|principal/u);
 await writer.close();assert.equal(await missing(c.authorization.tokenFile),true);assert.deepEqual(await readdir(dir),[]);assert.equal(scheduled.pending.size,0);
});

test('Linux: renewal, expiry and revocation remove published authorization and notify the application',linux,async t=>{
 const {dir,c}=await fixture(t),scheduled=timers(),clock={now:at};let state='CURRENT',reads=0;
 const writer=createTemporalProductTokenWriter({configuration:c,now:()=>clock.now,timers:scheduled,delivery:{async read(){reads++;const v=response(c,clock.now,reads);return state==='CURRENT'?v:{...v,state,token:null,validUntilMs:null};}}});t.after(()=>writer.close());
 const events=[];writer.watch(code=>events.push(code));await writer.start();clock.now+=5000;scheduled.fire(5000);await until(()=>reads===2&&writer.status().expiresAtMs===clock.now+9000);
 state='REVOKED';await assert.rejects(writer.refresh(),/TEMPORAL_PRODUCT_TOKEN_REVOKED/u);assert.equal(writer.healthy(),false);assert.equal(await missing(c.authorization.tokenFile),true);assert.equal(events.at(-1),'TEMPORAL_PRODUCT_TOKEN_REVOKED');
 state='CURRENT';await writer.refresh();clock.now+=9000;scheduled.fire(9000);await until(()=>missing(c.authorization.tokenFile));assert.equal(writer.healthy(),false);assert.equal(events.at(-1),'TEMPORAL_PRODUCT_TOKEN_EXPIRY');
 await writer.close();assert.deepEqual(await readdir(dir),[]);
});

test('Linux: bounded delivery abort and late reply never reinstall an authorization file',linux,async t=>{
 const {dir,c}=await fixture(t),scheduled=timers();let release,signal,reads=0;
 const writer=createTemporalProductTokenWriter({configuration:c,now:()=>at,timers:scheduled,delivery:{read(request){reads++;signal=request.signal;return new Promise(resolve=>{release=resolve;});}}});t.after(()=>writer.close());
 const pending=writer.start();await until(()=>!!release);scheduled.fire(1000);await assert.rejects(pending,/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u);
 assert.equal(signal.aborted,true);assert.equal(await missing(c.authorization.tokenFile),true);
 await assert.rejects(writer.refresh(),/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u);assert.equal(reads,1,'repeat is refused before the old issuer read is released');
 release(response(c));await new Promise(resolve=>setImmediate(resolve));assert.equal(await missing(c.authorization.tokenFile),true);assert.equal(writer.healthy(),false);
 await assert.rejects(writer.refresh(),/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u);assert.equal(reads,1,'the instance remains quarantined after the late reply');
 await writer.close();assert.deepEqual(await readdir(dir),[]);
});

test('Linux: close aborts in-flight delivery, ignores its late reply and removes the task-local lock',linux,async t=>{
 const {dir,c}=await fixture(t),scheduled=timers();let release,signal;
 const writer=createTemporalProductTokenWriter({configuration:c,now:()=>at,timers:scheduled,delivery:{read(request){signal=request.signal;return new Promise(resolve=>{release=resolve;});}}});
 const pending=writer.start();await until(()=>!!release);const rejection=assert.rejects(pending,/TEMPORAL_PRODUCT_TOKEN_IO_UNKNOWN/u);
 assert.deepEqual(await writer.close(),{closed:true,physicalStopProven:false});await rejection;
 assert.equal(signal.aborted,true);release(response(c));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(await readdir(dir),[]);assert.equal(scheduled.pending.size,0);
});

test('Linux: preexisting credentials and foreign replacements are preserved rather than adopted or removed',linux,async t=>{
 const {dir,c}=await fixture(t);await writeFile(c.authorization.tokenFile,'foreign-existing',{mode:0o600});let reads=0;
 const occupied=createTemporalProductTokenWriter({configuration:c,delivery:{async read(){reads++;return response(c);}}});
 await assert.rejects(occupied.start(),/TEMPORAL_PRODUCT_TOKEN_PATH_OCCUPIED/u);await occupied.close();assert.equal(reads,0);assert.equal(await readFile(c.authorization.tokenFile,'utf8'),'foreign-existing');await unlink(c.authorization.tokenFile);
 const scheduled=timers(),writer=createTemporalProductTokenWriter({configuration:c,now:()=>at,timers:scheduled,delivery:{async read(){return response(c);}}});await writer.start();
 await unlink(c.authorization.tokenFile);await writeFile(c.authorization.tokenFile,'foreign-replacement',{mode:0o600});
 await assert.rejects(writer.close(),/TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN/u);assert.equal(await readFile(c.authorization.tokenFile,'utf8'),'foreign-replacement');assert.equal(writer.healthy(),false);assert.equal(writer.status().failure,'TEMPORAL_PRODUCT_TOKEN_CLEANUP_UNKNOWN');
 // A symlink at the token path is also an occupied path, never followed or replaced.
 const c2=structuredClone(c);c2.authorization.tokenFile=join(dir,'second.json');await symlink(c.authorization.tokenFile,c2.authorization.tokenFile);
 const linked=createTemporalProductTokenWriter({configuration:c2,delivery:{async read(){assert.fail('symlink reached delivery');}}});await assert.rejects(linked.start(),/TEMPORAL_PRODUCT_TOKEN_PATH_OCCUPIED/u);await linked.close();assert.equal((await lstat(c2.authorization.tokenFile)).isSymbolicLink(),true);
});

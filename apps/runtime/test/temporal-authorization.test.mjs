import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createTemporalAuthorization,parseTemporalAuthorizationConfiguration,createTemporalTokenFileReader} from '../temporal-authorization.mjs';
const config={tokenFile:'/run/meri/temporal-token.json',namespace:'meri-product',audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid',refreshMs:5000,maxLifetimeMs:600000};
const claims={namespace:'meri-product',audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid'};
function clock(start=1_800_000_000_000){let t=start;return {now:()=>t,advance(ms){t+=ms;}};}
test('configuration is closed and bounded; plaintext tokens or extra fields are refused',()=>{
 assert.deepEqual(parseTemporalAuthorizationConfiguration(config),config);
 assert.throws(()=>parseTemporalAuthorizationConfiguration({...config,token:'plaintext'}),/INVALID_COMMAND/);
 assert.throws(()=>parseTemporalAuthorizationConfiguration({...config,tokenFile:'relative.json'}),/TEMPORAL_AUTHORIZATION_CONFIGURATION/);
 assert.throws(()=>parseTemporalAuthorizationConfiguration({...config,refreshMs:10}),/TEMPORAL_AUTHORIZATION_CONFIGURATION/);
 assert.throws(()=>parseTemporalAuthorizationConfiguration({...config,maxLifetimeMs:config.refreshMs}),/TEMPORAL_AUTHORIZATION_CONFIGURATION/);
});
test('a fresh token serves the client callback and attached worker connections; expiry, wrong claims, over-long lifetime and close fail closed without retrying a stale token',async()=>{
 const c=clock();let serial=0,reads=0;const reader={async read(){reads++;return {token:'synthetic-token-'+(++serial)+'-'+'x'.repeat(16),expiresAtMs:c.now()+20000,claims};}};
 const auth=createTemporalAuthorization({configuration:config,reader,now:c.now});
 assert.throws(()=>auth.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/,'no token before the first refresh');
 await auth.refresh();const first=auth.apiKey();assert.match(first,/^synthetic-token-1-/);assert.equal(auth.current().expiresAtMs,c.now()+20000);
 const setCalls=[];const connection={async setApiKey(token){setCalls.push(token);}};auth.attach(connection);
 await auth.refresh();assert.match(auth.apiKey(),/^synthetic-token-2-/);assert.deepEqual(setCalls.map(t=>t.slice(0,17)),['synthetic-token-2'],'the worker connection receives the refreshed token');
 c.advance(20001);assert.throws(()=>auth.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/,'an expired token is never returned');
 const bad=createTemporalAuthorization({configuration:config,reader:{async read(){return {token:'y'.repeat(32),expiresAtMs:c.now()+1000,claims:{...claims,namespace:'other'}};}},now:c.now});await assert.rejects(bad.refresh(),/TEMPORAL_AUTHORIZATION_CLAIMS/);assert.throws(()=>bad.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/);
 const long=createTemporalAuthorization({configuration:config,reader:{async read(){return {token:'y'.repeat(32),expiresAtMs:c.now()+config.maxLifetimeMs+1,claims};}},now:c.now});await assert.rejects(long.refresh(),/TEMPORAL_AUTHORIZATION_EXPIRY/);
 const expired=createTemporalAuthorization({configuration:config,reader:{async read(){return {token:'y'.repeat(32),expiresAtMs:c.now(),claims};}},now:c.now});await assert.rejects(expired.refresh(),/TEMPORAL_AUTHORIZATION_EXPIRY/);
 await auth.close();assert.throws(()=>auth.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/);await assert.rejects(auth.refresh(),/TEMPORAL_AUTHORIZATION_CLOSED/);assert.throws(()=>auth.attach(connection),/TEMPORAL_AUTHORIZATION_CONFIGURATION/);
 assert.equal(reads,2,'exactly the two explicit refreshes read the issuer; no retry loop');
});
test('the file reader applies readSecret semantics: owner-only mode, no follow, bounded size, JSON only',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'meri-temporal-auth-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'token.json');
 writeFileSync(file,JSON.stringify({token:'z'.repeat(32),expiresAtMs:Date.now()+30000,claims}));chmodSync(file,0o644);
 await assert.rejects(createTemporalTokenFileReader({tokenFile:file}).read(),/RUNTIME_SECRET_FILE/,'group or world readable token file refused');
 chmodSync(file,0o600);const c=clock(Date.now());const auth=createTemporalAuthorization({configuration:{...config,tokenFile:file},reader:createTemporalTokenFileReader({tokenFile:file}),now:c.now});await auth.refresh();assert.equal(auth.apiKey(),'z'.repeat(32));await auth.close();
 writeFileSync(file,'not json');chmodSync(file,0o600);await assert.rejects(createTemporalTokenFileReader({tokenFile:file}).read(),/TEMPORAL_AUTHORIZATION_TOKEN/);
});
/** Injectable timers: every scheduled callback is captured with its delay and fired by the test. */
function fakeTimers(){const scheduled=[];let id=0;return {scheduled,setTimeout(fn,ms){const h={id:++id,fn,ms,unref(){}};scheduled.push(h);return h;},clearTimeout(h){const i=scheduled.indexOf(h);if(i>=0)scheduled.splice(i,1);},fire(predicate){const h=scheduled.find(predicate);if(!h)throw Error('no such timer');scheduled.splice(scheduled.indexOf(h),1);h.fn();return h;}};}
test('fail closed: a refresh failure drops the current token, notifies watchers, fails readiness and retries on a bounded schedule; recovery restores service and rotates attached connections',async()=>{
 const c=clock(),timers=fakeTimers();let serial=0,failing=false;const reader={async read(){if(failing)throw Error('issuer down');return {token:'synthetic-token-'+(++serial)+'-'+'x'.repeat(16),expiresAtMs:c.now()+20000,claims};}};
 const auth=createTemporalAuthorization({configuration:config,reader,now:c.now,timers});const events=[];auth.watch(code=>events.push(code));
 const setCalls=[];auth.attach({async setApiKey(token){setCalls.push(token.slice(0,17));}});
 await auth.refresh();assert.equal(auth.healthy(),true);assert.match(auth.apiKey(),/^synthetic-token-1-/);assert.deepEqual(timers.scheduled.map(h=>h.ms).sort((a,b)=>a-b),[5000,20000],'a refresh timer and an expiry timer');
 failing=true;timers.fire(h=>h.ms===5000);await new Promise(r=>setImmediate(r));
 assert.equal(auth.healthy(),false);assert.throws(()=>auth.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/,'no stale token after a failed scheduled refresh');assert.equal(auth.current(),null);assert.equal(auth.failure(),'TEMPORAL_AUTHORIZATION_FAILED','a plain reader error is the generic failure code');assert.ok(events.length>=1,'watchers are told');
 assert.deepEqual(timers.scheduled.map(h=>h.ms),[1000],'a bounded retry is scheduled, nothing else');
 timers.fire(h=>h.ms===1000);await new Promise(r=>setImmediate(r));assert.equal(auth.healthy(),false);assert.deepEqual(timers.scheduled.map(h=>h.ms),[1000],'still failing: another bounded retry');
 failing=false;timers.fire(h=>h.ms===1000);await new Promise(r=>setImmediate(r));assert.equal(auth.healthy(),true);assert.match(auth.apiKey(),/^synthetic-token-2-/);assert.deepEqual(setCalls,['synthetic-token-1','synthetic-token-2'],'the recovered token rotated to the worker connection');
 // Expiry without a successful refresh: the expiry timer fails closed and notifies.
 failing=true;c.advance(20000);timers.fire(h=>h.ms===20000);assert.equal(auth.healthy(),false);assert.equal(events.at(-1),'TEMPORAL_AUTHORIZATION_EXPIRY');assert.throws(()=>auth.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/);
 await auth.close();assert.deepEqual(timers.scheduled,[],'close clears every timer');assert.equal(auth.healthy(),false);
});
test('fail closed: the reader is bounded and aborted, a read that resolves after close is discarded, a worker rotation failure leaves no current token, and rotation serves only the latest token',async()=>{
 const c=clock();let aborted=false;const hanging={async read({signal}){await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));return new Promise(()=>{});}};
 const bounded=createTemporalAuthorization({configuration:config,reader:hanging,now:c.now,readTimeoutMs:20});await assert.rejects(bounded.refresh(),/TEMPORAL_AUTHORIZATION_TIMEOUT/);assert.equal(aborted,true,'the reader received the abort');assert.equal(bounded.healthy(),false);await bounded.close();
 assert.throws(()=>createTemporalAuthorization({configuration:config,reader:hanging,now:c.now,readTimeoutMs:config.refreshMs+1}),/TEMPORAL_AUTHORIZATION_CONFIGURATION/,'the read bound cannot exceed the refresh interval');
 let release;const late={async read(){await new Promise(r=>{release=r;});return {token:'y'.repeat(32),expiresAtMs:c.now()+20000,claims};}};
 const closing=createTemporalAuthorization({configuration:config,reader:late,now:c.now,timers:fakeTimers()});const setCalls=[];closing.attach({async setApiKey(t){setCalls.push(t);}});const pending=closing.refresh();await new Promise(r=>setImmediate(r));await closing.close();release();
 await assert.rejects(pending,/TEMPORAL_AUTHORIZATION_CLOSED/,'a read that completes after close does not install a token');assert.equal(closing.current(),null);assert.deepEqual(setCalls,[],'no connection receives a token after close');
 let serial=0;const reader={async read(){return {token:'synthetic-token-'+(++serial)+'-'+'x'.repeat(16),expiresAtMs:c.now()+20000,claims};}};
 const rotating=createTemporalAuthorization({configuration:config,reader,now:c.now,timers:fakeTimers()});const calls=[];rotating.attach({async setApiKey(t){calls.push(['a',t.slice(0,17)]);}});rotating.attach({async setApiKey(t){calls.push(['b',t.slice(0,17)]);if(t.startsWith('synthetic-token-2'))throw Error('native rotation refused');}});
 await rotating.refresh();assert.match(rotating.apiKey(),/^synthetic-token-1-/);
 await assert.rejects(rotating.refresh(),/TEMPORAL_AUTHORIZATION_ROTATION/);assert.equal(rotating.healthy(),false);assert.throws(()=>rotating.apiKey(),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/,'current is not updated when any attached connection refused the key; the older token is not served either');
 assert.deepEqual(calls,[['a','synthetic-token-1'],['b','synthetic-token-1'],['a','synthetic-token-2'],['b','synthetic-token-2']]);
 await rotating.refresh();assert.match(rotating.apiKey(),/^synthetic-token-3-/);assert.deepEqual(calls.slice(-2),[['a','synthetic-token-3'],['b','synthetic-token-3']],'every connection carries the latest token');await rotating.close();
});
test('worker readiness and stop: readiness fails on unhealthy authorization before inspecting the poller; a fail-closed transition shuts the running worker down; the configuration requires the authorization namespace to equal the Temporal namespace',async()=>{
 const {createWorkerReadiness,stopWorkerOnAuthorizationFailure}=await import('../temporal-worker.mjs');const {validateConfiguration}=await import('../config.mjs');const {versions}=await import('../../control/conversations/test/application-fixture.mjs');
 const c=clock(),timers=fakeTimers();let failing=false;const reader={async read(){if(failing)throw Error('issuer down');return {token:'z'.repeat(32),expiresAtMs:c.now()+20000,claims};}};
 const auth=createTemporalAuthorization({configuration:config,reader,now:c.now,timers});await auth.refresh();
 let state='RUNNING',shutdowns=0;const worker={getState:()=>state,shutdown(){shutdowns++;state='STOPPING';}};const readiness=createWorkerReadiness({worker,authorization:auth});await readiness();
 const unwatch=stopWorkerOnAuthorizationFailure({worker,authorization:auth});failing=true;timers.fire(h=>h.ms===5000);await new Promise(r=>setImmediate(r));
 await assert.rejects(readiness(),/WORKER_AUTHORIZATION_UNAVAILABLE/);assert.equal(shutdowns,1,'the poller stopped on the fail-closed transition');assert.equal(state,'STOPPING');unwatch();
 state='RUNNING';await createWorkerReadiness({worker,authorization:null})();state='STOPPED';await assert.rejects(createWorkerReadiness({worker,authorization:null})(),/WORKER_NOT_RUNNING/);await auth.close();
 const limits={startupMs:5000,shutdownMs:1000,requestMs:1000,requestBytes:131072},http={hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'};
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,limits,http,native:{origin:'http://127.0.0.1',capabilityFile:'/tmp/synthetic-not-read',loopback:true,maxResponseBytes:2097152},database:{connectionFile:'/tmp/synthetic-not-read'},temporal:{address:'temporal.invalid:7233',namespace:'meri-product',taskQueue:'meri-conversations-v1',tls:{caFile:'/tmp/ca',certFile:'/tmp/cert',keyFile:'/tmp/key'},authorization:config},sessions:{mode:'process-local',replicas:1,maxSessions:20,maxTtlMs:30000},versions};
 assert.doesNotThrow(()=>validateConfiguration(configuration,'control'));assert.throws(()=>validateConfiguration({...configuration,temporal:{...configuration.temporal,namespace:'meri-other'}},'control'),/TEMPORAL_AUTHORIZATION_CONFIGURATION/,'the token namespace must be the namespace the connection uses');
 const {database,sessions,versions:_v,...workerConfiguration}=configuration;assert.throws(()=>validateConfiguration({...workerConfiguration,native:{...workerConfiguration.native,preparedKickoff:true},temporal:{...configuration.temporal,authorization:{...config,namespace:'meri-other'}}},'temporal-worker'),/TEMPORAL_AUTHORIZATION_CONFIGURATION/);void _v;void database;void sessions;
});

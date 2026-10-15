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

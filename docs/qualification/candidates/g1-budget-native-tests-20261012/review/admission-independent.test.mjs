// Offline only: import safe fixture, never integration/child or native resource functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root, 'explicit source root required');
const {parseNativeAdmission} = await import(pathToFileURL(resolve(root,'apps/gateway/test/postgres-budget-native-fixture.mjs')));
const now=1800000000000;
const config=()=>({host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',
  password:'SYNTHETIC_ONLY_NOT_A_CREDENTIAL',systemIdentifier:'1234567890123456789',serverStartTime:'2027-01-15T08:00:00.000Z',
  serverVersion:'170000',t0Ms:now,workDeadlineMs:now+720000,cleanupDeadlineMs:now+900000,
  stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64)});
const hash=x=>createHash('sha256').update(x).digest('hex');
const env=(c=config())=>{const raw=JSON.stringify(c);return {MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',
  MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:hash(raw)};};
const deny=(e,t=now)=>assert.throws(()=>parseNativeAdmission(e,t),/BUDGET_NATIVE_TEST_ADMISSION_REQUIRED/);

test('configuration is frozen correlation only, with no resource invocation',()=>{
  const input=env();const result=parseNativeAdmission(input,now);assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(result,config());input.MERI_BUDGET_PG_TEST_CONFIG='changed';assert.deepEqual(result,config());
});
test('default closed and exact opt-in',()=>{deny({});for(const value of ['', 'yes', true, 'explicit-isolated-engine '])deny({...env(),MERI_BUDGET_PG_TEST_RUN:value});});
test('exact raw JSON digest and byte ceiling',()=>{
  deny({...env(),MERI_BUDGET_PG_TEST_CONFIG_SHA256:'c'.repeat(64)});
  deny({...env(),MERI_BUDGET_PG_TEST_CONFIG:' '.repeat(8193)});
  const raw='!invalid';deny({...env(),MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:hash(raw)});
});
test('configuration has closed fields and scalar identity',()=>{
  const extra={...config(),approved:true};deny(env(extra));const missing=config();delete missing.user;deny(env(missing));
  for(const field of ['host','database','user','password','serverVersion','stateLockSha256','migrationSha256'])deny(env({...config(),[field]:null}));
});
test('numeric system identity is rejected before native use',()=>{deny(env({...config(),systemIdentifier:123456789}));});
test('SHA object cannot execute string conversion',()=>{
  let effects=0;const good=env();const digest={toString(){effects++;return good.MERI_BUDGET_PG_TEST_CONFIG_SHA256;}};
  assert.throws(()=>parseNativeAdmission({...good,MERI_BUDGET_PG_TEST_CONFIG_SHA256:digest},now));assert.equal(effects,0);
});
test('getter environment rejected without evaluating body',()=>{
  let effects=0;const e=env();Object.defineProperty(e,'unexpected',{enumerable:true,get(){effects++;return 'secret';}});
  deny(e);assert.equal(effects,0);
});
test('proxy environment rejected before reflection',()=>{
  let effects=0;const p=new Proxy(env(),{getPrototypeOf(){effects++;throw Error('trap');},ownKeys(){effects++;throw Error('trap');}});
  deny(p);assert.equal(effects,0);
});
test('inherited environment rejected',()=>{const e=Object.assign(Object.create({inherited:true}),env());deny(e);});
test('ambient provider/database/native injection configuration denied',()=>{
  for(const key of ['PGHOST','PGDATABASE','AWS_PROFILE','ANTHROPIC_API_KEY','OPENAI_API_KEY','BEDROCK_REGION','NODE_OPTIONS','NODE_PATH'])deny({...env(),[key]:'SYNTHETIC'});
});
test('future, elapsed and malformed trusted clock refused',()=>{
  for(const clock of [now-1,now+720000,now+900000,NaN,Infinity,'0'])deny(env(),clock);
  for(const field of ['workDeadlineMs','cleanupDeadlineMs'])deny(env({...config(),[field]:config()[field]+1}));
});
test('loopback-only identity, port and bounded password',()=>{
  for(const host of ['localhost','::1','0.0.0.0','192.0.2.1'])deny(env({...config(),host}));
  for(const port of [0,65536,1.5,'55432'])deny(env({...config(),port}));
  for(const password of ['', 'x'.repeat(513)])deny(env({...config(),password}));
});

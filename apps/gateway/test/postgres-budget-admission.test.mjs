// The only executable checks authorized for this source slice. No native calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseNativeAdmission, sha256, active } from './postgres-budget-native-fixture.mjs';
import { runChild } from './postgres-budget-child.mjs';

const NOW=1800000000000;
const config=()=>({host:'127.0.0.1',port:6543,database:'meri_qualification_test',user:'qualification_owner',
  password:'synthetic-placeholder-not-a-credential',systemIdentifier:'123456789',serverStartTime:'2026-10-12T00:00:00Z',
  serverVersion:'160015',t0Ms:NOW-1000,workDeadlineMs:NOW-1000+720000,cleanupDeadlineMs:NOW-1000+900000,
  stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64)});
function env(c=config()){const raw=JSON.stringify(c);return {MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:sha256(raw)};}

test('pure admission returns frozen correlation only; importing child does not run it',()=>{
  const admitted=parseNativeAdmission(env(),NOW);assert.ok(Object.isFrozen(admitted));assert.equal(admitted.host,'127.0.0.1');
  assert.equal(typeof runChild,'function');assert.equal(Object.hasOwn(admitted,'authorized'),false);
});
for(const mode of [undefined,'yes','true',''])test(`missing/unrecognized mode ${String(mode)} refuses before native dependencies`,()=>{
  const e=env();e.MERI_BUDGET_PG_TEST_RUN=mode;assert.throws(()=>parseNativeAdmission(e,NOW),/^Error: BUDGET_NATIVE_TEST_ADMISSION_REQUIRED$/);
});
for(const [name,value] of [['host','db.internal'],['host','localhost'],['port',0],['port','6543'],['database','production'],
  ['user','postgres'],['password',''],['systemIdentifier','-1'],['systemIdentifier',123],['serverStartTime',0],['serverStartTime','bad'],['serverVersion','16.15'],
  ['workDeadlineMs',NOW+720000],['cleanupDeadlineMs',NOW+900000],['t0Ms',NOW+1],['stateLockSha256','x'],['migrationSha256',null]])
  test(`closed native binding rejects ${name}=${String(value)}`,()=>assert.throws(()=>parseNativeAdmission(env({...config(),[name]:value}),NOW)));
for(const name of ['PGHOST','PGPASSWORD','PGSERVICE','AWS_ACCESS_KEY_ID','ANTHROPIC_API_KEY','OPENAI_API_KEY','BEDROCK_ENDPOINT','NODE_OPTIONS','NODE_PATH'])
  test(`ambient ${name} cannot override native admission`,()=>assert.throws(()=>parseNativeAdmission({...env(),[name]:'synthetic'},NOW)));
test('hash mismatch, extra keys, overflow, expiry and effectful environment fail closed',()=>{
  assert.throws(()=>parseNativeAdmission({...env(),MERI_BUDGET_PG_TEST_CONFIG_SHA256:'f'.repeat(64)},NOW));
  assert.throws(()=>parseNativeAdmission(env({...config(),approved:true}),NOW));
  assert.throws(()=>parseNativeAdmission(env({...config(),password:'x'.repeat(9000)}),NOW));
  assert.throws(()=>parseNativeAdmission(env(),config().workDeadlineMs));
  let coercions=0;const digest={toString(){coercions++;return 'a'.repeat(64);}};
  assert.throws(()=>parseNativeAdmission({...env(),MERI_BUDGET_PG_TEST_CONFIG_SHA256:digest},NOW));assert.equal(coercions,0);
  let effects=0;const getter=Object.defineProperty({},'MERI_BUDGET_PG_TEST_RUN',{get(){effects++;return 'explicit-isolated-engine';}});
  const proxy=new Proxy({}, {getPrototypeOf(){effects++;throw Error();}});
  assert.throws(()=>parseNativeAdmission(getter,NOW));assert.throws(()=>parseNativeAdmission(proxy,NOW));assert.equal(effects,0);
  assert.throws(()=>active(config())); // Unadmitted data cannot reach a native helper.
});
test('source admission precedes dynamic application imports; no migration/reset/production activation',async()=>{
  const integration=await readFile(new URL('./postgres-budget.integration.mjs',import.meta.url),'utf8');
  const child=await readFile(new URL('./postgres-budget-child.mjs',import.meta.url),'utf8');
  const helper=await readFile(new URL('./postgres-budget-native-fixture.mjs',import.meta.url),'utf8');
  assert.ok(integration.indexOf('const admission=parseNativeAdmission')<integration.indexOf("import('../budget/"));
  assert.ok(child.indexOf('const admission=parseNativeAdmission')<child.indexOf('await openNativePool'));
  assert.doesNotMatch(integration+child+helper,/sourceEnabled\s*:\s*true|\bTRUNCATE\b|\bDROP\b|\bCREATE\s+(?:DATABASE|SCHEMA)|\.migrate|pg_ctl|\.native\b/);
  assert.match(helper,/require\('pg\/package\.json'\)\.version!=='8\.23\.1'/);
  assert.match(helper,/const value=await client\.query\(\.\.\.args\)/);
  assert.match(helper,/synthetic-post-commit-loss/);
  assert.match(integration,/maxToolCalls:1/);assert.match(integration,/for\(let n=0;n<3;n\+\+\)/);
});

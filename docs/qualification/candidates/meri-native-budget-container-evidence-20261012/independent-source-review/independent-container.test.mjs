// Independent source-only checks. Docker execution is replaced before any call.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { execFile as esmExecFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { parseNativeAdmission, sha256, assertServerIdentity, openNativePool } from '/workspace/scratch/meri-native-budget-container-20261012/apps/gateway/test/postgres-budget-native-fixture.mjs';
import { assertPreparedContainerInspection, inspectPreparedContainer } from '/workspace/scratch/meri-native-budget-container-20261012/apps/gateway/test/postgres-budget-container-fixture.mjs';

const originalExecFile = childProcess.execFile;
let calls = [], response;
function forbiddenNativeExec() { throw Error('UNMOCKED_EXECUTION_FORBIDDEN'); }
forbiddenNativeExec[promisify.custom] = async (...args) => {
  calls.push(args);
  if (response instanceof Error) throw response;
  return { stdout: response, stderr: '' };
};
childProcess.execFile = forbiddenNativeExec;
syncBuiltinESMExports();
assert.equal(esmExecFile,forbiddenNativeExec,'No inspector test may reach the native executor');
test.after(() => { childProcess.execFile = originalExecFile; syncBuiltinESMExports(); });
test.beforeEach(() => { calls = []; response = JSON.stringify(metadata()); });

const NOW = 1800000000000;
function config(now=NOW) { return {
  host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',password:null,
  systemIdentifier:'123456789',serverStartTime:'2026-10-12T00:00:00Z',serverVersion:'160015',
  t0Ms:now-1000,workDeadlineMs:now-1000+720000,cleanupDeadlineMs:now-1000+900000,
  stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64),
  preparedContainer:{id:'c'.repeat(64),image:'sha256:'+'d'.repeat(64),serverHost:'172.17.0.2',serverPort:5432},
}; }
function env(c) { const raw=JSON.stringify(c); return {
  MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',MERI_BUDGET_PG_TEST_CONFIG:raw,
  MERI_BUDGET_PG_TEST_CONFIG_SHA256:sha256(raw),
}; }
function metadata() { return {
  id:'c'.repeat(64),image:'sha256:'+'d'.repeat(64),name:'/meri-native-postgres',running:true,purpose:'meri-native-tests',
  portCount:1,bindings:[{HostIp:'127.0.0.1',HostPort:'55432'}],networkCount:1,serverHost:'172.17.0.2',
  mounts:[{Type:'volume',Name:'meri-native-postgres-data',Destination:'/var/lib/postgresql/data',RW:true}],
}; }
function server() { return {
  db:'meri_qualification_test',usr:'qualification_owner',addr:'172.17.0.2',port:5432,
  fsync:'on',sync:'on',version:'160015',started:new Date('2026-10-12T00:00:00Z'),system:'123456789',
}; }
const refusal = /^Error: BUDGET_NATIVE_TEST_ADMISSION_REQUIRED$/;

test('SQL address projection uses bare host instead of CIDR text without removing other identity checks', async () => {
  const source=await readFile('/workspace/scratch/meri-native-budget-container-20261012/apps/gateway/test/postgres-budget-native-fixture.mjs','utf8');
  assert.match(source,/host\(inet_server_addr\(\)\) AS addr/);
  assert.doesNotMatch(source,/inet_server_addr\(\)::text AS addr/);
});

test('prepared correlation is frozen at both levels and maps distinct host/server endpoints', () => {
  const c=parseNativeAdmission(env(config()),NOW);
  assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.preparedContainer));
  assert.throws(() => { c.preparedContainer.serverHost='172.17.0.3'; },TypeError);
  assertPreparedContainerInspection(c,metadata());assertServerIdentity(server(),c);
  assert.equal(c.port,55432);assert.equal(c.preparedContainer.serverPort,5432);assert.equal(c.password,null);
});
test('legacy thirteen-key password path retains its port and SQL identity behavior', () => {
  const c=config();delete c.preparedContainer;c.password='synthetic-nonsecret-value';c.port=6543;
  assert.equal(Object.keys(c).length,13);
  const admitted=parseNativeAdmission(env(c),NOW);
  assertServerIdentity({...server(),addr:'127.0.0.1',port:6543},admitted);
  assert.equal(admitted.password,c.password);
});
test('null password cannot open the legacy profile without descriptor', () => {
  const c=config();delete c.preparedContainer;
  assert.throws(() => parseNativeAdmission(env(c),NOW),refusal);
});
for (const [field,value] of [['host','localhost'],['port',5432],['database','production'],['user','postgres']]) {
  test(`prepared parser refuses wrong ${field}`, () => {
    assert.throws(() => parseNativeAdmission(env({...config(),[field]:value}),NOW),refusal);
    assert.equal(calls.length,0);
  });
}
for (const [name,mutate] of [
  ['container',r=>r.id='e'.repeat(64)],['image',r=>r.image='sha256:'+'e'.repeat(64)],
  ['name',r=>r.name='/other'],['running',r=>r.running=false],['purpose',r=>r.purpose='other'],
  ['volume',r=>r.mounts[0].Name='other'],['volume destination',r=>r.mounts[0].Destination='/other'],
  ['volume writeability',r=>r.mounts[0].RW=false],['mapped address',r=>r.bindings[0].HostIp='0.0.0.0'],
  ['mapped port',r=>r.bindings[0].HostPort='5432'],['inner address',r=>r.serverHost='172.17.0.3'],
  ['extra mapping',r=>r.bindings.push({HostIp:'127.0.0.1',HostPort:'55432'})],
  ['extra network',r=>r.networkCount=2],['extra exposed port',r=>r.portCount=2],
  ['malformed bindings',r=>r.bindings=[null]],['malformed mounts',r=>r.mounts=[null]],
]) {
  test(`inspected identity refuses wrong ${name} with scrubbed error`, async () => {
    const r=metadata();mutate(r);response=JSON.stringify(r);
    await assert.rejects(inspectPreparedContainer(config()),refusal);
    assert.equal(calls.length,1);
  });
}
test('local inspector execution receives only fixed local command, whitelist, bounds and clean environment', async () => {
  const before=process.env.DOCKER_HOST;process.env.DOCKER_HOST='tcp://synthetic.invalid:1234';
  try { await inspectPreparedContainer(config()); }
  finally { if(before===undefined)delete process.env.DOCKER_HOST;else process.env.DOCKER_HOST=before; }
  const [file,args,options]=calls[0];
  assert.equal(file,'/usr/local/bin/docker');
  assert.deepEqual(args.slice(0,4),['--host','unix:///var/run/docker.sock','inspect','--format']);
  assert.equal(args[5],'meri-native-postgres');
  assert.equal(options.timeout,5000);assert.equal(options.maxBuffer,8192);
  assert.deepEqual(options.env,{PATH:'/usr/local/bin:/usr/bin:/bin'});
  assert.doesNotMatch(args[4],/\.Config\.Env|json \.Mounts|json \.NetworkSettings\.Networks|\.Source|\.DriverOpts/);
});
for (const [name,value] of [
  ['malformed JSON','not-json'],['null JSON','null'],
  ['simulated CLI timeout',Object.assign(Error('SYNTHETIC_ERROR_NOT_TO_EXPOSE'),{code:'ETIMEDOUT'})],
  ['simulated CLI failure',Error('SYNTHETIC_ERROR_NOT_TO_EXPOSE')],
]) {
  test(`inspector scrubs ${name}`, async () => {
    response=value;
    await assert.rejects(inspectPreparedContainer(config()),error => {
      assert.equal(error.message,'BUDGET_NATIVE_TEST_ADMISSION_REQUIRED');assert.equal(error.cause,undefined);return true;
    });
    assert.equal(calls.length,1);
  });
}
for (const name of ['PGPASSWORD','PGSERVICE']) {
  test(`actual ${name} drift rejects before any stubbed Docker or pool path`, async () => {
    const now=Date.now(),c=config(now),valid=env(c),admitted=parseNativeAdmission(valid,now);
    const controlled=[...new Set([...Object.keys(valid),name])],before={};
    for(const key of controlled){before[key]=process.env[key];delete process.env[key];}
    try {
      Object.assign(process.env,valid);
      assert.equal(parseNativeAdmission({...process.env},now).password,null);
      process.env[name]='synthetic-drift';
      await assert.rejects(openNativePool(admitted),refusal);assert.equal(calls.length,0);
    } finally {
      for(const key of controlled){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
    }
  });
}
for (const [field,value] of [['db','production'],['usr','postgres'],['addr','127.0.0.1'],['port',55432],
  ['system','987654321'],['started',new Date('2026-10-12T00:00:01Z')],['version','170011'],['fsync','off'],['sync','off']]) {
  test(`SQL identity retains refusal of wrong ${field}`, () => {
    assert.throws(() => assertServerIdentity({...server(),[field]:value},config()));assert.equal(calls.length,0);
  });
}

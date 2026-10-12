// Ordinary source-only tests: no Docker invocation, socket, pool or SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseNativeAdmission, sha256, assertServerIdentity, openNativePool } from './postgres-budget-native-fixture.mjs';
import { assertPreparedContainerInspection } from './postgres-budget-container-fixture.mjs';

const NOW=1800000000000;
const config=()=>({host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',
  password:null,systemIdentifier:'123456789',serverStartTime:'2026-10-12T00:00:00Z',serverVersion:'160015',
  t0Ms:NOW-1000,workDeadlineMs:NOW-1000+720000,cleanupDeadlineMs:NOW-1000+900000,
  stateLockSha256:'a'.repeat(64),migrationSha256:'b'.repeat(64),
  preparedContainer:{id:'c'.repeat(64),image:`sha256:${'d'.repeat(64)}`,serverHost:'172.17.0.2',serverPort:5432}});
function env(c){const raw=JSON.stringify(c);return {MERI_BUDGET_PG_TEST_RUN:'explicit-isolated-engine',MERI_BUDGET_PG_TEST_CONFIG:raw,MERI_BUDGET_PG_TEST_CONFIG_SHA256:sha256(raw)};}
const metadata=()=>({id:'c'.repeat(64),image:`sha256:${'d'.repeat(64)}`,name:'/meri-native-postgres',running:true,
  purpose:'meri-native-tests',portCount:1,bindings:[{HostIp:'127.0.0.1',HostPort:'55432'}],
  networkCount:1,serverHost:'172.17.0.2',
  mounts:[{Type:'volume',Name:'meri-native-postgres-data',Destination:'/var/lib/postgresql/data',RW:true}]});
const server=()=>({db:'meri_qualification_test',usr:'qualification_owner',addr:'172.17.0.2',port:5432,
  fsync:'on',sync:'on',version:'160015',started:new Date('2026-10-12T00:00:00Z'),system:'123456789'});

test('explicit prepared trust profile is deeply frozen and binds mapped and server endpoints separately',()=>{
  const c=parseNativeAdmission(env(config()),NOW);
  assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.preparedContainer));
  assert.equal(c.password,null);assert.equal(c.port,55432);assert.equal(c.preparedContainer.serverPort,5432);
  assertPreparedContainerInspection(c,metadata());assertServerIdentity(server(),c);
  const direct={...config(),port:6543,password:'synthetic-fixture-value'};delete direct.preparedContainer;
  assertServerIdentity({...server(),addr:'127.0.0.1',port:6543},parseNativeAdmission(env(direct),NOW));
});
for(const [field,value] of [['host','localhost'],['host','172.17.0.2'],['port',5432],['port',55433],
  ['database','another_test'],['user','postgres'],['password','unused'],['password',undefined]])
  test(`prepared admission rejects wrong ${field} ${String(value)}`,()=>{
    assert.throws(()=>parseNativeAdmission(env({...config(),[field]:value}),NOW),/BUDGET_NATIVE_TEST_ADMISSION_REQUIRED/);
  });
for(const [field,value] of [['id','c'.repeat(63)],['image','d'.repeat(64)],['serverHost','127.0.0.1'],
  ['serverHost','8.8.8.8'],['serverHost','172.17.0.2.invalid'],['serverPort',55432],['serverPort','5432'],['extra',true]])
  test(`prepared descriptor rejects invalid ${field}`,()=>{
    const c=config();c.preparedContainer[field]=value;
    assert.throws(()=>parseNativeAdmission(env(c),NOW),/BUDGET_NATIVE_TEST_ADMISSION_REQUIRED/);
  });
for(const [name,change] of [
  ['container',r=>r.id='e'.repeat(64)],['image',r=>r.image=`sha256:${'e'.repeat(64)}`],
  ['name',r=>r.name='/another'],['stopped',r=>r.running=false],['purpose',r=>r.purpose='other'],
  ['volume',r=>r.mounts[0].Name='another'],['mount destination',r=>r.mounts[0].Destination='/elsewhere'],
  ['read-only mount',r=>r.mounts[0].RW=false],['inner address',r=>r.serverHost='172.17.0.3'],
  ['extra network',r=>r.networkCount=2],
  ['public host',r=>r.bindings[0].HostIp='0.0.0.0'],
  ['public port',r=>r.bindings[0].HostPort='5432'],
  ['duplicate mapping',r=>r.bindings.push({HostIp:'127.0.0.1',HostPort:'55432'})],
  ['extra port',r=>r.portCount=2],['malformed mapping',r=>r.bindings=[null]],
  ['malformed mount',r=>r.mounts=[null]]])
  test(`read-only identity refuses wrong ${name}`,()=>{
    const r=metadata();change(r);
    assert.throws(()=>assertPreparedContainerInspection(config(),r),/^Error: BUDGET_NATIVE_TEST_ADMISSION_REQUIRED$/);
  });
for(const [field,value] of [['db','another_test'],['usr','postgres'],['addr','127.0.0.1'],['port',55432],
  ['system','987654321'],['started',new Date('2026-10-12T00:00:01Z')],['version','170011'],['fsync','off'],['sync','off']])
  test(`SQL identity still refuses wrong ${field}`,()=>assert.throws(()=>assertServerIdentity({...server(),[field]:value},config())));
test('container inspector remains bounded, local, read-only and excludes secret-bearing metadata',async()=>{
  const source=await readFile(new URL('./postgres-budget-container-fixture.mjs',import.meta.url),'utf8');
  assert.match(source,/unix:\/\/\/var\/run\/docker\.sock/);assert.match(source,/timeout: 5000, maxBuffer: 8192/);
  assert.match(source,/env: \{ PATH:/);assert.doesNotMatch(source,/process\.env|\.Config\.Env|\b(?:start|restart|create|exec)\b/);
  const native=await readFile(new URL('./postgres-budget-native-fixture.mjs',import.meta.url),'utf8');
  assert.ok(native.indexOf('await inspectPreparedContainer(c)')<native.indexOf('new Pool('));
  assert.match(native,/parseNativeAdmission\(\{\.\.\.process\.env\}\)/);
  assert.match(native,/password:c\.preparedContainer \? \(\) => undefined : c\.password/);
  assert.match(native,/host\(inet_server_addr\(\)\) AS addr/);
});
test('actual ambient password drift after admission refuses before Docker or pg loading',async()=>{
  const now=Date.now(),c=config();c.t0Ms=now;c.workDeadlineMs=now+720000;c.cleanupDeadlineMs=now+900000;
  const validEnv=env(c),admitted=parseNativeAdmission(validEnv,now),before={};
  const controlled=[...new Set([...Object.keys(process.env).filter(k=>/^(PG|AWS_|ANTHROPIC_|OPENAI_|BEDROCK_|NODE_OPTIONS$|NODE_PATH$)/.test(k)),...Object.keys(validEnv),'PGPASSWORD'])];
  for(const k of controlled){before[k]=process.env[k];delete process.env[k];}
  try {
    Object.assign(process.env,validEnv);
    assert.equal(parseNativeAdmission({...process.env},now).password,null);
    process.env.PGPASSWORD='synthetic-drift-test';
    await assert.rejects(openNativePool(admitted),/^Error: BUDGET_NATIVE_TEST_ADMISSION_REQUIRED$/);
  } finally {for(const k of controlled){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});

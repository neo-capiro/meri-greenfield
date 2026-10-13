import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readLocalActionAdmission,migrationPaths} from './admission.mjs';
import {passedPersistenceResult} from './cli.mjs';

const root=new URL('../../',import.meta.url),hash=body=>createHash('sha256').update(body).digest('hex');
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'meri-local-admission-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'private.json'),now=Date.now(),migrationSha256={};
  for(const [name,relative]of Object.entries(migrationPaths))migrationSha256[name]=hash(await readFile(new URL(relative,root)));
  const input={schema:'meri-local-action-input/1',migrationSha256,native:{host:'127.0.0.1',port:54329,database:'meri_qualification_test',user:'qualification_owner',
    password:'SYNTHETIC_PRIVATE_TEST_ONLY',systemIdentifier:'123456789',serverStartTime:new Date(now-1000).toISOString(),serverVersion:'170011',
    t0Ms:now,workDeadlineMs:now+720000,cleanupDeadlineMs:now+900000,migrationSha256:migrationSha256.budget,
    stateLockSha256:hash(await readFile(new URL('apps/control/qualification-sdk-fixture/state/package-lock.json',root)))}};
  const save=async()=>{const raw=JSON.stringify(input);await writeFile(path,raw,{mode:0o600});return {path,sha256:hash(raw),now:()=>now};};
  return {dir,path,input,save};
}
test('private exact source-bound fixture input yields a nonsecret descriptor without opening a pool',async t=>{
  const f=await fixture(t),admitted=await readLocalActionAdmission(await f.save());
  assert.equal(admitted.native.password,'SYNTHETIC_PRIVATE_TEST_ONLY');
  assert.equal(admitted.descriptor.mode,'synthetic-local-action');
  assert.equal(admitted.descriptor.database,'meri_qualification_test');
  assert.equal(JSON.stringify(admitted.descriptor).includes('SYNTHETIC_PRIVATE_TEST_ONLY'),false);
  assert.ok(Object.isFrozen(admitted.descriptor));
});
test('native parseable server time retains its instant in the canonical runner descriptor',async t=>{
  const f=await fixture(t);f.input.native.serverStartTime='2026-10-12T20:00:00-04:00';
  const admitted=await readLocalActionAdmission(await f.save());
  assert.equal(admitted.descriptor.serverStartTime,'2026-10-13T00:00:00.000Z');
  assert.equal(Date.parse(admitted.native.serverStartTime),Date.parse(admitted.descriptor.serverStartTime));
});
for(const [name,change]of [
  ['remote host',f=>{f.input.native.host='example.invalid';}],
  ['another database',f=>{f.input.native.database='production';}],
  ['stale lifetime',f=>{f.input.native.t0Ms-=900000;f.input.native.workDeadlineMs-=900000;f.input.native.cleanupDeadlineMs-=900000;}],
  ['source migration substitution',f=>{f.input.migrationSha256.lookup='0'.repeat(64);}],
  ['driver lock substitution',f=>{f.input.native.stateLockSha256='0'.repeat(64);}],
  ['extra wrapper field',f=>{f.input.approved=true;}],
])test(`admission refuses ${name}`,async t=>{const f=await fixture(t);change(f);await assert.rejects(readLocalActionAdmission(await f.save()),/LOCAL_ACTION_ADMISSION_REQUIRED/);});
test('admission refuses wrong input digest, public modes, symlinks and oversized files',async t=>{
  const f=await fixture(t),args=await f.save();
  await assert.rejects(readLocalActionAdmission({...args,sha256:'0'.repeat(64)}),/LOCAL_ACTION_ADMISSION_REQUIRED/);
  await chmod(f.path,0o644);await assert.rejects(readLocalActionAdmission(args),/LOCAL_ACTION_ADMISSION_REQUIRED/);await chmod(f.path,0o600);
  const linked=join(f.dir,'link');await symlink(f.path,linked);await assert.rejects(readLocalActionAdmission({...args,path:linked}),/LOCAL_ACTION_ADMISSION_REQUIRED/);
  const large=' '.repeat(16385);await writeFile(f.path,large);await assert.rejects(readLocalActionAdmission({...args,sha256:hash(large)}),/LOCAL_ACTION_ADMISSION_REQUIRED/);
});
test('CLI help and missing/bad arguments are inert bounded outcomes with no private path disclosure',()=>{
  const cli=fileURLToPath(new URL('cli.mjs',import.meta.url));
  for(const [args,status]of [[['--help'],0],[[],2],[['--config','PRIVATE_SECRET_PATH','--config-sha256','a'.repeat(64),'--output','NEVER_CREATED'],2]]){
    const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:5000,maxBuffer:32768});
    assert.equal(r.status,status,r.stderr);assert.equal((r.stdout+r.stderr).includes('PRIVATE_SECRET_PATH'),false);
  }
});
test('CLI requires every named persistence case and explicit known cleanup before reporting success',()=>{
  const value={schema:'meri.local-action-persistence/1',status:'PASS',runtimeQualified:false,sourceTransport:'synthetic-in-process',databaseRestartTested:false,
    cases:['reconnect','concurrent-claim','lost-claim-ack','lost-dispatch-ack','lost-result-ack','revoked-read'].map(name=>({name,status:'PASS'})),
    cleanup:{acquisitionPending:false,freshPoolCleanupUnknown:false,unsettledOperations:0,ownedFreshPoolsClosed:1,borrowedPoolClosed:false}};
  assert.equal(passedPersistenceResult(value),true);
  for(const mutate of [v=>{v.cases.pop();},v=>{v.cases[1].name='reconnect';},v=>{v.cases[2].status='HOLD';},v=>{v.cleanup.acquisitionPending=true;},v=>{v.cleanup.freshPoolCleanupUnknown=true;},v=>{v.cleanup.borrowedPoolClosed=true;},v=>{v.runtimeQualified=true;},v=>{v.databaseRestartTested=true;}]){
    const changed=structuredClone(value);mutate(changed);assert.equal(passedPersistenceResult(changed),false);
  }
});

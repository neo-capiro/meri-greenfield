// Process-group cleanup after leader exit. A member that has already exited stays in the owned group as a zombie
// until its parent reaps it (LibreOffice's short-lived gpg helpers, reparented to a slow-reaping init, are the observed
// case). Absence must be waited for within a bound, never assumed: a group still present at the bound stays
// ARTIFACT_CLEANUP_FAILED. Deterministic fixture: the zombie's parent leaves the group (setsid) and reaps it late.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runArtifactProcess} from '../process.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const fixture=fileURLToPath(new URL('./artifact-process-group-drain-child.py',import.meta.url));
const gone=pid=>{try{process.kill(pid,0);return false;}catch(e){return e.code==='ESRCH';}};
async function until(check,ms){const end=Date.now()+ms;while(!check()){if(Date.now()>end)return false;await new Promise(r=>setTimeout(r,20));}return true;}
async function owned(delay,fn){
  const cwd=await mkdtemp(join(tmpdir(),'meri-artifact-group-drain-'));let reaper;
  try{
    const outcome=await runArtifactProcess(python,['-I','-B',fixture,String(delay)],{cwd,input:Buffer.alloc(0),deadlineMs:Date.now()+20000}).then(r=>({result:r}),e=>({error:e}));
    reaper=Number(await readFile(join(cwd,'reaper.pid'),'utf8'));return await fn(outcome,reaper);
  }finally{
    if(reaper&&!gone(reaper))try{process.kill(reaper,'SIGKILL');}catch{}
    await rm(cwd,{recursive:true,force:true});
  }
}

test('a zombie member reaped after the group kill is waited for, then the group is reported absent',()=>owned(0.6,async({result,error},reaper)=>{
  assert.equal(error,undefined,error&&`${error.code} groupAbsent=${error.receipt?.groupAbsent}`);
  assert.equal(result.receipt.exitCode,0);assert.equal(result.receipt.groupAbsent,true);
  assert.throws(()=>process.kill(-result.receipt.pid,0),e=>e.code==='ESRCH');
  assert.ok(await until(()=>gone(reaper),5000),'the out-of-group reaper exits after reaping');
}));

test('a group that is still present at the drain bound remains ARTIFACT_CLEANUP_FAILED',{timeout:30000},()=>owned(30,async({result,error},reaper)=>{
  assert.equal(result,undefined,'absence is never assumed');
  assert.equal(error.code,'ARTIFACT_CLEANUP_FAILED');assert.equal(error.receipt.exitCode,0);assert.equal(error.receipt.groupAbsent,false);
  process.kill(reaper,'SIGKILL');
  assert.ok(await until(()=>{try{process.kill(-error.receipt.pid,0);return false;}catch(e){return e.code==='ESRCH';}},15000),'the fixture group drains once its reaper is gone');
}));

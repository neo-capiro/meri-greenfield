import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runArtifactProcess} from '../process.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=fileURLToPath(new URL('./artifact-process-independent-child.mjs',import.meta.url));
async function owned(scenario,options={}){const cwd=await mkdtemp(join(tmpdir(),'meri-artifact-process-control-'));try{return await runArtifactProcess(process.execPath,[fixture,scenario],{cwd,input:Buffer.alloc(0),deadlineMs:Date.now()+5000,...options});}finally{await rm(cwd,{recursive:true,force:true});}}
function absent(r){assert.equal(r.leaderClosed,true);assert.equal(r.groupAbsent,true);assert.equal(r.sandboxQualified,false);assert.throws(()=>process.kill(-r.pid,0),e=>e.code==='ESRCH');}
function capture(r,out,err){assert.equal(r.hashScope,'retained bytes');assert.equal(r.stdoutRetainedBytes,out.length);assert.equal(r.stderrRetainedBytes,err.length);assert.equal(r.stdoutSha256,sha(out));assert.equal(r.stderrSha256,sha(err));assert.ok(r.stdoutBytes>=out.length);assert.ok(r.stderrBytes>=err.length);assert.equal(r.stdoutEnded,true);assert.equal(r.stderrEnded,true);assert.deepEqual(r.streamErrors,[]);}
test('independent process success binds EOF and retained byte hashes',async()=>{const r=await owned('normal');assert.equal(r.stdout.toString(),'out');capture(r.receipt,r.stdout,Buffer.from('err'));absent(r.receipt);});
for(const stream of ['stdout','stderr'])test(`independent process ${stream} overflow retains truthful bytes and closes group`,async()=>{await assert.rejects(owned(stream,{maxOutput:16}),e=>{assert.equal(e.code,'ARTIFACT_OUTPUT_LIMIT');assert.ok(Buffer.isBuffer(e.stdout));assert.ok(Buffer.isBuffer(e.stderr));capture(e.receipt,e.stdout,e.stderr);assert.ok(e.receipt[stream+'Bytes']>(stream==='stdout'?16:65536));assert.ok(e.receipt.stdoutRetainedBytes<=16);assert.ok(e.receipt.stderrRetainedBytes<=65536);absent(e.receipt);return true;});});
test('independent process nonzero retains exact error and closure',async()=>{await assert.rejects(owned('failure'),e=>{assert.equal(e.code,'ARTIFACT_PROCESS_FAILED');assert.equal(e.receipt.exitCode,3);capture(e.receipt,e.stdout,e.stderr);assert.equal(e.stderr.toString(),'failure');absent(e.receipt);return true;});});
test('independent process deadline closes exact owned group',async()=>{await assert.rejects(owned('deadline',{deadlineMs:Date.now()+100}),e=>{assert.equal(e.code,'ARTIFACT_DEADLINE');absent(e.receipt);return true;});});
test('independent process cancelled admission starts no child',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(owned('normal',{signal:controller.signal}),e=>e.code==='ARTIFACT_CANCELLED'&&!e.receipt);});

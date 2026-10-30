// Inert bounds fixtures for the real artifact process owner and the fixed upload probe plan. No OS child, sandbox,
// network, provider or real proc/credential state is used: the spawn/kill ports are injected and every event is fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {runArtifactProcess} from '../process.mjs';
import {uploadSandboxArguments,UPLOAD_IMAGE_PATHS} from '../../runtime/uploads/native-sandbox.mjs';
import {RENDERER_PROBE_PATH} from '../renderer-qualification.mjs';

class FakeStream extends EventEmitter{
 constructor(){super();this.destroyed=0;}
 destroy(){this.destroyed++;return this;}
}
class FakeChild extends EventEmitter{
 constructor({pid=4242}={}){super();this.pid=pid;this.stdout=new FakeStream();this.stderr=new FakeStream();
  this.stdin=new FakeStream();this.stdinData=null;this.stdin.end=data=>{this.stdinData=data;};}
}
const gone=()=>{const e=Error('gone');e.code='ESRCH';throw e;};
// Inert group port: SIGKILL succeeds, signal-0 probes report absence. An `error` variant proves a failed drain.
const absentKill=()=>gone();
const failedKill=(pid,signal)=>{if(signal===0){const e=Error('denied');e.code='EPERM';throw e;}};
const spawnOf=(child,schedule)=>(executable,args,options)=>{schedule(child);return child;};

test('fixed upload probe plan mounts the probe and its relative helper import read-only',()=>{
 const cwd=join(UPLOAD_IMAGE_PATHS.tempRoot,'meri-upload-probe-AbCd12');
 const argv=uploadSandboxArguments({role:'probe',cwd,mode:'default'});
 const mounted=new Set();
 for(let i=0;i<argv.length;i++)if(argv[i]==='--ro-bind')mounted.add(argv[i+2]);
 assert.ok(mounted.has(RENDERER_PROBE_PATH),'the probe itself is mounted');
 const helper=join(dirname(RENDERER_PROBE_PATH),'renderer-probe-observation.mjs');
 assert.ok(mounted.has(helper),'the helper dependency is mounted beside the probe');
 const source=readFileSync(RENDERER_PROBE_PATH,'utf8');
 const specifiers=[...source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/gu)].map(match=>match[1]);
 assert.ok(specifiers.length>0,'the actual probe has relative imports');
 for(const specifier of specifiers){
  const target=resolve(dirname(RENDERER_PROBE_PATH),specifier);
  assert.ok(mounted.has(target),`relative import ${specifier} resolves inside the planned read-only mounts`);
 }
});

test('a completed child returns retained stdout and a proven-absent group',async()=>{
 const child=new FakeChild();
 const result=await runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.from('x'),deadlineMs:Date.now()+5000,settlementMs:20},
  {spawn:spawnOf(child,()=>setImmediate(()=>{child.stdout.emit('data',Buffer.from('ok'));child.stdout.emit('end');
   child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);})),kill:absentKill});
 assert.equal(result.stdout.toString(),'ok');
 assert.equal(result.receipt.settlement,'closed');
 assert.equal(result.receipt.groupAbsent,true);
 assert.equal(result.receipt.groupKillAttempted,true);
});

test('stdout overflow is refused before unbounded accumulation',async()=>{
 const child=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,maxOutput:4,settlementMs:20},
  {spawn:spawnOf(child,()=>setImmediate(()=>{child.stdout.emit('data',Buffer.from('toolong'));child.stdout.emit('end');
   child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);})),kill:absentKill}),
  error=>{assert.equal(error.code,'ARTIFACT_OUTPUT_LIMIT');assert.ok(error.receipt.stdoutBytes>4);return true;});
});

test('a deadline is an honest failure, not a completed observation',async()=>{
 const child=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+10,settlementMs:20},
  {spawn:spawnOf(child,()=>{/* never exits or closes */}),kill:absentKill}),
  error=>{assert.equal(error.code,'ARTIFACT_DEADLINE');assert.equal(error.receipt.settlement,'timeout');
   assert.equal(error.receipt.leaderClosed,false);return true;});
});

test('a settlement timeout is refusal, never claimed descendant absence',async()=>{
 const child=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,settlementMs:15},
  {spawn:spawnOf(child,()=>setImmediate(()=>{child.emit('exit',0,null);})),kill:absentKill}),
  error=>{assert.equal(error.code,'ARTIFACT_CLEANUP_FAILED');assert.equal(error.receipt.settlement,'timeout');return true;});
});

test('spawn failure and stream failure are distinct honest failures',async()=>{
 const spawnFail=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,settlementMs:20},
  {spawn:spawnOf(spawnFail,()=>setImmediate(()=>{const e=Error('nope');e.code='ENOENT';spawnFail.emit('error',e);
   spawnFail.emit('close',null,null);})),kill:absentKill}),
  error=>{assert.equal(error.code,'ARTIFACT_PROCESS_FAILED');assert.equal(error.receipt.spawnError,'ENOENT');return true;});
 const streamFail=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,settlementMs:20},
  {spawn:spawnOf(streamFail,()=>setImmediate(()=>{streamFail.stdout.emit('error',Error('broken'));streamFail.stdout.emit('end');
   streamFail.stderr.emit('end');streamFail.emit('exit',0,null);streamFail.emit('close',0,null);})),kill:absentKill}),
  error=>{assert.equal(error.code,'ARTIFACT_STREAM_ERROR');assert.deepEqual([...error.receipt.streamErrors],['stdout']);return true;});
});

test('an unobservable group drain is a cleanup failure, not absence',async()=>{
 const child=new FakeChild();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,settlementMs:20},
  {spawn:spawnOf(child,()=>setImmediate(()=>{child.stdout.emit('end');child.stderr.emit('end');
   child.emit('exit',0,null);child.emit('close',0,null);})),kill:failedKill}),
  error=>{assert.equal(error.code,'ARTIFACT_CLEANUP_FAILED');assert.equal(error.receipt.groupAbsent,false);return true;});
});

test('terminal settlement disposes owned stdio, freezes evidence and ignores late events',async()=>{
 const child=new FakeChild();let kills=0;let error;
 try{
  await runArtifactProcess('/inert',[],{cwd:'/tmp',input:Buffer.alloc(0),deadlineMs:Date.now()+5000,maxOutput:4,settlementMs:10},
   {spawn:spawnOf(child,()=>setImmediate(()=>child.emit('exit',0,null))),
    kill:()=>{kills++;throw Object.assign(Error('absent'),{code:'ESRCH'});}});
 }catch(caught){error=caught;}
 assert.equal(error.code,'ARTIFACT_CLEANUP_FAILED');assert.equal(error.receipt.settlement,'timeout');
 assert.equal(error.receipt.stdoutEnded,false,'local disposal is not EOF evidence');
 assert.equal(error.receipt.groupAbsent,true,'group absence is still the bounded poll result');
 for(const stream of [child.stdin,child.stdout,child.stderr])assert.equal(stream.destroyed,1,'each owned endpoint is disposed once');
 assert.equal(child.stdout.listenerCount('data'),0);assert.equal(child.stderr.listenerCount('data'),0);
 assert.equal(child.stdout.listenerCount('end'),0);assert.equal(child.stderr.listenerCount('end'),0);
 assert.ok(child.stdout.listenerCount('error')>=1,'a no-op error listener stays so a late error is not uncaught');
 const receipt=error.receipt,bytes=receipt.stdoutBytes,killsAt=kills;
 assert.ok(Object.isFrozen(receipt));assert.ok(Object.isFrozen(receipt.streamErrors));
 child.stdout.emit('data',Buffer.from('late output exceeds the cap'));
 child.stderr.emit('data',Buffer.from('late error output'));
 child.stdout.emit('error',Error('late stream error'));
 child.emit('error',Error('late child error'));
 child.emit('exit',3,null);child.emit('close',3,null);
 assert.equal(kills,killsAt,'no post-settlement PID/group action');
 assert.equal(receipt.stdoutBytes,bytes,'retained counters stay frozen');
 assert.equal(error.receipt.stdoutRetainedBytes,0);
});

test('abort and pre-aborted signals never start a child',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(runArtifactProcess('/bin/true',[],{cwd:'/tmp',input:Buffer.alloc(0),signal:controller.signal,deadlineMs:Date.now()+5000}),
  error=>error.code==='ARTIFACT_CANCELLED');
});

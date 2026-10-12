// Source-only EventEmitter controls. No child, native process or OS kill is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
const root = process.env.MERI_SANDBOX_REPO;
const { runArtifactsChild } = await import(pathToFileURL(`${root}/apps/worker/qualification/probes/office-export.mjs`));
function child() {
  const c = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
  c.pid = 424242; c.kill = () => { throw Error('direct native kill is not authorized'); };
  return c;
}
const defaults = { base:'/synthetic/owned-office-run', deadlineMs:200, graceMs:20,
  detached:true, groupKill:()=>true, probeGroup:()=>false };

test('already aborted Office supervision never acquires a child',async()=>{
  const controller=new AbortController();controller.abort();let spawned=0;
  const result=await runArtifactsChild({...defaults,signal:controller.signal,spawnFn:()=>{
    spawned++;const c=child();setImmediate(()=>c.emit('close',0,null));return c;
  }});
  assert.equal(spawned,0);assert.notEqual(result.status,0);
});

test('Linux non-detached group ownership is refused before spawning',async()=>{
  assert.equal(process.platform,'linux','this exact qualification review runs on Linux');let spawned=0;
  const result=await runArtifactsChild({...defaults,detached:false,spawnFn:()=>{
    spawned++;const c=child();setImmediate(()=>c.emit('close',0,null));return c;
  }});
  assert.equal(spawned,0);assert.equal(result.cleanupConfirmed,false);
});

test('stderr overflow is a terminal failed probe, not silent truncation success',async()=>{
  const result=await runArtifactsChild({...defaults,spawnFn:()=>{
    const c=child();setImmediate(()=>{c.stderr.emit('data',Buffer.alloc(65537,120));c.emit('close',0,null);});return c;
  }});
  assert.equal(result.overflow,true);assert.ok(result.error);assert.ok(Buffer.byteLength(result.stderr)<=65536);
});

test('abort after spawn requests scoped containment before later normal close',async()=>{
  const controller=new AbortController();const c=child();let kills=0;let timer;
  const operation=runArtifactsChild({...defaults,signal:controller.signal,spawnFn:()=>c,groupKill:actual=>{
    assert.equal(actual,c);kills++;return true;
  }});
  controller.abort();
  try { await new Promise(resolve=>{timer=setTimeout(resolve,25);});assert.equal(kills,1); }
  finally { clearTimeout(timer);c.emit('close',0,null);await operation; }
  const result=await operation;assert.ok(result.error || result.aborted || result.timedOut);
});

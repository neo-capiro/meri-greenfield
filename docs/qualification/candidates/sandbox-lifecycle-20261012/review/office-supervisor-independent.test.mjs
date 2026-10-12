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

test('owned close plus definite absence permits a successful child result',async()=>{
  const c=child();const untouched=child();let probes=0;
  const result=await runArtifactsChild({...defaults,spawnFn:()=>{
    setImmediate(()=>{c.stdout.emit('data',Buffer.from('{"ok":true}'));c.emit('close',0,null);});return c;
  },probeGroup:actual=>{assert.equal(actual,c);assert.notEqual(actual,untouched);probes++;return false;}});
  assert.equal(result.status,0);assert.equal(result.cleanupConfirmed,true);assert.ok(probes);assert.equal(result.stdout,'{"ok":true}');
});

test('normal close cannot turn unknown group observation into confirmed teardown',async()=>{
  const c=child();let kills=0;
  const result=await runArtifactsChild({...defaults,spawnFn:()=>{setImmediate(()=>c.emit('close',0,null));return c;},
    probeGroup:()=>undefined,groupKill:actual=>{assert.equal(actual,c);kills++;return true;}});
  assert.equal(result.cleanupConfirmed,false);assert.ok(result.error);assert.equal(kills,1);
});

test('owned group alive after close gets one scoped containment and positive absence readback',async()=>{
  const c=child();let killed=false;let probes=0;
  const result=await runArtifactsChild({...defaults,spawnFn:()=>{setImmediate(()=>c.emit('close',0,null));return c;},
    probeGroup:actual=>{assert.equal(actual,c);probes++;return !killed;},
    groupKill:actual=>{assert.equal(actual,c);assert.equal(killed,false);killed=true;return true;}});
  assert.equal(killed,true);assert.ok(probes>=2);assert.equal(result.cleanupConfirmed,true);
});

test('child exit and kill acknowledgement without close retain cleanup uncertainty',async()=>{
  const c=child();let killed=false;
  const result=await runArtifactsChild({...defaults,deadlineMs:10,graceMs:10,spawnFn:()=>{
    setImmediate(()=>c.emit('exit',0,null));return c;
  },groupKill:actual=>{assert.equal(actual,c);killed=true;return true;},probeGroup:()=>false});
  assert.equal(killed,true);assert.equal(result.cleanupConfirmed,false);assert.equal(result.timedOut,true);assert.ok(result.error);
});

test('late close and output cannot rewrite an already returned timeout result',async()=>{
  const c=child();let kills=0;
  const result=await runArtifactsChild({...defaults,deadlineMs:10,graceMs:10,spawnFn:()=>c,
    groupKill:()=>{kills++;return true;},probeGroup:()=>false});
  const before=JSON.stringify(result);c.stdout.emit('data',Buffer.from('{"ok":true}'));c.emit('close',0,null);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.stringify(result),before);assert.equal(kills,1);assert.equal(result.cleanupConfirmed,false);
});

test('malformed deadlines and cleanup bounds deny before any spawn',async()=>{
  for(const options of [{deadlineMs:NaN},{deadlineMs:Infinity},{deadlineMs:0},{graceMs:NaN},{graceMs:0},{graceMs:5001}]){
    let spawned=0;const result=await runArtifactsChild({...defaults,...options,spawnFn:()=>{spawned++;return child();}});
    assert.equal(spawned,0);assert.equal(result.cleanupConfirmed,false);assert.ok(result.error);
  }
});

test('a throwing physical-observation port remains UNKNOWN rather than absent',async()=>{
  const c=child();const result=await runArtifactsChild({...defaults,spawnFn:()=>{setImmediate(()=>c.emit('close',0,null));return c;},
    probeGroup:()=>{throw Error('observation unavailable');},groupKill:()=>false});
  assert.equal(result.cleanupConfirmed,false);assert.ok(result.error);
});

// Source controls only; every child and containment/observation port is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
const root=process.env.MERI_SANDBOX_REPO;
const {runOwnedProbeChild}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/owned-probe-child.mjs`));
function child(pid=424242){const c=new EventEmitter();c.pid=pid;c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>{throw Error('native kill is not permitted by this test');};return c;}
const common={base:'/synthetic/run',deadlineMs:200,graceMs:20,detached:true,groupKill:()=>true,probeGroup:()=>false};

test('fixed supervisor entrypoint allowlist rejects arbitrary executable/script before acquisition',async()=>{
 for(const script of [undefined,null,'../artifacts.mjs','/tmp/browser.mjs','browser.mjs; touch /tmp/no','runtime.mjs','office-export.mjs','sdk-capture.mjs']){
  let acquired=0;let result;
  try{result=await runOwnedProbeChild({...common,script,spawnFn:()=>{acquired++;return child();}});}catch(error){result={error:String(error)};}
  assert.equal(acquired,0);assert.ok(result.error);assert.notEqual(result.status,0);
 }
});

test('both actual fixed probes spawn Node with exact owned-group and bounded output path',async()=>{
 for(const script of ['browser.mjs','artifacts.mjs']){
  let actual;const c=child();const environment={SYNTHETIC:'unchanged'};
  const result=await runOwnedProbeChild({...common,script,env:environment,spawnFn:(command,args,options)=>{
   actual={command,args,options};setImmediate(()=>{c.stdout.emit('data',Buffer.from('{"ok":true}'));c.emit('close',0,null);});return c;
  }});
  assert.equal(actual.command,process.execPath);assert.equal(actual.args.length,1);assert.ok(actual.args[0].endsWith('/'+script));
  assert.equal(actual.options.detached,true);assert.notEqual(actual.options.shell,true);assert.deepEqual(environment,{SYNTHETIC:'unchanged'});
  assert.equal(result.cleanupConfirmed,true);assert.equal(result.status,0);
 }
});

test('run A abort and containment do not kill or corrupt independently owned run B',async()=>{
 const a=child(424242);const b=child(424243);const controller=new AbortController();const kills=[];const closed=new Set();
 const contain=c=>{kills.push(c);assert.equal(c,a);setImmediate(()=>{closed.add(a);a.emit('close',null,'SIGKILL');});return true;};
 const observe=c=>{assert.ok(c===a||c===b);return !closed.has(c);};
 const A=runOwnedProbeChild({...common,script:'browser.mjs',signal:controller.signal,spawnFn:()=>a,groupKill:contain,probeGroup:observe});
 const B=runOwnedProbeChild({...common,script:'artifacts.mjs',spawnFn:()=>b,groupKill:contain,probeGroup:observe});
 controller.abort();setTimeout(()=>{b.stdout.emit('data',Buffer.from('{"ok":true,"owner":"B"}'));closed.add(b);b.emit('close',0,null);},10);
 const [ra,rb]=await Promise.all([A,B]);assert.deepEqual(kills,[a]);assert.ok(ra.error||ra.aborted||ra.timedOut);assert.equal(rb.status,0);assert.equal(rb.cleanupConfirmed,true);assert.equal(rb.stdout,'{"ok":true,"owner":"B"}');
});

test('launch failure never creates a successful cleanup or child verdict',async()=>{
 let attempts=0;const result=await runOwnedProbeChild({...common,script:'browser.mjs',spawnFn:()=>{attempts++;throw Error('synthetic spawn failure');}});
 assert.equal(attempts,1);assert.notEqual(result.status,0);assert.equal(result.cleanupConfirmed,false);assert.ok(result.error);
});

test('late normal close cannot outrun an expired watchdog timer after an event-loop stall',async()=>{
 const c=child();const result=await runOwnedProbeChild({...common,script:'browser.mjs',deadlineMs:5,spawnFn:()=>{
  queueMicrotask(()=>{const end=performance.now()+12;while(performance.now()<end){}c.stdout.emit('data',Buffer.from('{"ok":true}'));c.emit('close',0,null);});return c;
 }});
 assert.equal(result.timedOut,true);assert.ok(result.error);assert.equal(result.cleanupConfirmed,true);
});

test('malformed UTF-8 cannot inflate retained stderr beyond the byte cap',async()=>{
 const c=child();const result=await runOwnedProbeChild({...common,script:'browser.mjs',spawnFn:()=>{
  setImmediate(()=>{c.stderr.emit('data',Buffer.alloc(32768,255));c.emit('close',0,null);});return c;
 }});
 assert.ok(Buffer.byteLength(result.stderr)<=65536);assert.equal(result.overflow,true);assert.ok(result.error);
});

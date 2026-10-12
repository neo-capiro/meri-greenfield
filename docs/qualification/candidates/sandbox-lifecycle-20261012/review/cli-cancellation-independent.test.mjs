// Fake process events and output streams only. No OS signal or process is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_SANDBOX_REPO;
const before={int:process.listenerCount('SIGINT'),term:process.listenerCount('SIGTERM')};
const {installProbeCancellation}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/owned-probe-child.mjs`));
const {runQualificationChildren}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/runtime.mjs`));
const {streamRecords,main:officeMain}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/office-export.mjs`));

test('import installs no real process signal handlers',()=>{
 assert.equal(process.listenerCount('SIGINT'),before.int);assert.equal(process.listenerCount('SIGTERM'),before.term);
});

test('first signal aborts once; repeated signal retains listeners until owned disposal',()=>{
 const fake=new EventEmitter();let borrowed=0;const original=()=>{borrowed++;};fake.on('SIGTERM',original);
 const bridge=installProbeCancellation(fake);let aborts=0;bridge.signal.addEventListener('abort',()=>{aborts++;});
 assert.equal(bridge.signal.aborted,false);fake.emit('SIGINT');const reason=bridge.signal.reason;fake.emit('SIGTERM');
 assert.equal(aborts,1);assert.equal(bridge.signal.reason,reason);assert.equal(borrowed,1);assert.equal(fake.listenerCount('SIGINT'),1);assert.equal(fake.listenerCount('SIGTERM'),2);
 bridge.dispose();bridge.dispose();assert.equal(fake.listenerCount('SIGINT'),0);assert.deepEqual(fake.listeners('SIGTERM'),[original]);
});

test('CLI signal reaches actual runtime containment and repeated signals never acquire another child',async()=>{
 const fake=new EventEmitter();const bridge=installProbeCancellation(fake);let children=0,kills=0,closed=false;let child;
 const result=runQualificationChildren({signal:bridge.signal,deadlineMs:100,graceMs:20,detached:true,
  spawnFn:()=>{children++;child=new EventEmitter();child.pid=424242;child.stdout=new EventEmitter();child.stderr=new EventEmitter();queueMicrotask(()=>{fake.emit('SIGTERM');fake.emit('SIGINT');});return child;},
  groupKill:c=>{assert.equal(c,child);kills++;queueMicrotask(()=>{closed=true;c.emit('close',null,'SIGKILL');});return true;},
  probeGroup:c=>{assert.equal(c,child);return !closed;}
 });
 const values=await result;assert.equal(children,1);assert.equal(kills,1);assert.equal(values[0].cleanupConfirmed,true);assert.ok(values.every(x=>x.status==='fail'));bridge.dispose();assert.equal(fake.listenerCount('SIGTERM'),0);
});

test('already-aborted Office stream emits no successful capture records',async()=>{
 const controller=new AbortController();controller.abort();const lines=[];const stream=new EventEmitter();stream.write=(line,callback)=>{lines.push(line);callback();return true;};
 const result=await streamRecords(stream,[{kind:'capture'},{kind:'end'}],{deadlineMs:100,signal:controller.signal});
 assert.equal(result.ok,false);assert.equal(lines.length,0);
});

test('cancellation during export suppresses later chunks and successful end after write callback',async()=>{
 const controller=new AbortController();const lines=[];const stream=new EventEmitter();
 stream.write=(line,callback)=>{lines.push(line);if(lines.length===1){controller.abort();setTimeout(callback,10);return false;}callback();return true;};
 const result=await streamRecords(stream,[{kind:'capture'},{kind:'chunk'},{kind:'end'}],{deadlineMs:100,signal:controller.signal});
 assert.equal(result.ok,false);assert.equal(lines.length,1);assert.ok(!lines.some(x=>x.includes('"kind":"end"')));
});

test('already-aborted Office entry acquires no directory or native child',async()=>{
 const controller=new AbortController();controller.abort();let dirs=0,children=0;const stream=new EventEmitter();stream.write=(_line,callback)=>{callback();return true;};
 const result=await officeMain({baseRoot:'/tmp',signal:controller.signal,writeStream:stream,mkdir:()=>{dirs++;throw Error('must not mkdir');},spawnFn:()=>{children++;throw Error('must not spawn');}});
 assert.equal(result,1);assert.equal(dirs,0);assert.equal(children,0);
});

test('actual runtime CLI child owner installs bounded signal bridge and removes only own listeners',async()=>{
 const {runQualificationChildrenForCli}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/runtime.mjs`));
 const fake=new EventEmitter();const borrowed=()=>{};fake.on('SIGTERM',borrowed);let child,spawns=0,kills=0,closed=false;
 const values=await runQualificationChildrenForCli({processLike:fake,deadlineMs:100,graceMs:20,detached:true,
  spawnFn:()=>{spawns++;assert.equal(fake.listenerCount('SIGINT'),1);assert.equal(fake.listenerCount('SIGTERM'),2);child=new EventEmitter();child.pid=424242;child.stdout=new EventEmitter();child.stderr=new EventEmitter();queueMicrotask(()=>{fake.emit('SIGTERM');fake.emit('SIGINT');});return child;},
  groupKill:c=>{assert.equal(c,child);kills++;queueMicrotask(()=>{closed=true;c.emit('close',null,'SIGKILL');});return true;},
  probeGroup:c=>{assert.equal(c,child);return !closed;}
 });
 assert.equal(spawns,1);assert.equal(kills,1);assert.equal(values[0].cleanupConfirmed,true);assert.equal(values[1].notRun,true);
 assert.equal(fake.listenerCount('SIGINT'),0);assert.deepEqual(fake.listeners('SIGTERM'),[borrowed]);
});

test('actual runtime CLI owner disposes signal handlers when input admission refuses a child',async()=>{
 const {runQualificationChildrenForCli}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/runtime.mjs`));
 const fake=new EventEmitter();let spawns=0;
 const values=await runQualificationChildrenForCli({processLike:fake,deadlineMs:NaN,spawnFn:()=>{spawns++;throw Error('must not spawn');}});
 assert.equal(spawns,0);assert.ok(values.every(x=>x.status==='fail'));assert.equal(fake.listenerCount('SIGINT'),0);assert.equal(fake.listenerCount('SIGTERM'),0);
});

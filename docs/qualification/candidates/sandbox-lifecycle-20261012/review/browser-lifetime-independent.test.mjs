// API lifecycle only: no MCP SDK connection, HTTP listener or browser is created.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_SANDBOX_REPO;
const {createBrowserLifetime,closeFixtureServer}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/browser-lifetime.mjs`));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('browser API completion closes only explicitly owned resources once',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});const owned={id:'A'};const borrowed={id:'B'};const closed=[];
 life.own('owned',owned,resource=>{closed.push(resource);});assert.equal(await life.run('operation',()=>42),42);
 const first=life.close();assert.equal(life.close(),first);const result=await first;
 assert.deepEqual(closed,[owned]);assert.ok(!closed.includes(borrowed));assert.equal(result.confirmed,true);assert.match(result.scope,/API.*physical/);
});

test('already-aborted browser scope refuses before invoking an operation',async()=>{
 const controller=new AbortController();controller.abort();const life=createBrowserLifetime({deadlineMs:100,graceMs:10,signal:controller.signal});let calls=0;
 await assert.rejects(life.run('not-started',()=>{calls++;}));assert.equal(calls,0);await life.close();
});

test('parked browser operation is bounded and retains unresolved API cleanup',async()=>{
 const life=createBrowserLifetime({deadlineMs:10,graceMs:10});let release;
 await assert.rejects(life.run('parked',()=>new Promise(resolve=>{release=resolve;})),/deadline/);
 const result=await life.close();assert.equal(result.confirmed,false);assert.deepEqual(result.pendingAtClose,['parked']);
 const before=JSON.stringify(result);release('late result');await tick();assert.equal(JSON.stringify(result),before);
});

test('server acquisition completing after timeout is still owned and closed',async()=>{
 const life=createBrowserLifetime({deadlineMs:10,graceMs:10});let release;const server={id:'late-A'};const closed=[];
 await assert.rejects(life.acquire('server',()=>new Promise(resolve=>{release=resolve;}),resource=>{closed.push(resource);}),/deadline/);
 const result=await life.close();assert.equal(result.confirmed,false);release(server);await tick();await tick();assert.deepEqual(closed,[server]);assert.equal(result.confirmed,false);
});

test('one parked resource close cannot prevent other owned cleanup attempts',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});const called=[];
 life.own('parked',{id:1},()=>{called.push('parked');return new Promise(()=>{});});life.own('normal',{id:2},()=>{called.push('normal');});
 const result=await life.close();assert.deepEqual(called,['parked','normal']);assert.equal(result.confirmed,false);
 assert.equal(result.resources.find(x=>x.label==='normal').ok,true);assert.equal(result.resources.find(x=>x.label==='parked').ok,false);
});

test('server close requires its callback rather than synchronous return',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});let closeCallback;const server={close:callback=>{closeCallback=callback;return server;}};
 life.own('server',server,closeFixtureServer);const result=await life.close();assert.equal(result.confirmed,false);assert.equal(result.resources[0].ok,false);
 closeCallback();await tick();assert.equal(result.confirmed,false);
});

test('server close callback error retains cleanup uncertainty',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});life.own('server',{close:callback=>callback(Error('active socket'))},closeFixtureServer);
 const result=await life.close();assert.equal(result.confirmed,false);assert.match(result.resources[0].error,/active socket/);
});

test('stderr overflow rejects the active operation and never grows retained output beyond cap',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});let release;
 const result=life.run('connect',()=>new Promise(resolve=>{release=resolve;}));await tick();
 life.captureStderr(Buffer.alloc(65537,120));await assert.rejects(result,/stderr/);assert.ok(Buffer.byteLength(life.stderr)<=65536);
 const cleanup=await life.close();assert.equal(cleanup.confirmed,false);release();await tick();
});

test('closing a scope suppresses pending output and applies late-connect cleanup',async()=>{
 const life=createBrowserLifetime({deadlineMs:200,graceMs:10});let release;let lateClosed=0;
 const result=life.run('connect',()=>new Promise(resolve=>{release=resolve;}),{lateCleanup:()=>{lateClosed++;}});result.catch(()=>{});await tick();
 const cleanup=await life.close();await assert.rejects(result,/closed/);assert.equal(cleanup.confirmed,false);
 release();await tick();await tick();assert.equal(lateClosed,1);assert.equal(cleanup.confirmed,false);
});

test('absolute browser deadline elapsed between ports is retained before final success',async()=>{
 const life=createBrowserLifetime({deadlineMs:10,graceMs:10});assert.equal(await life.run('last observation',()=>42),42);
 await wait(20);await life.close();assert.match(life.failure??'',/deadline/);
});

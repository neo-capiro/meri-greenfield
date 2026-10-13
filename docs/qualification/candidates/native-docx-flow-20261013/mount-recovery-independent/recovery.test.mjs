import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createOwnedRuntimeSdkSession} from '../../../../../apps/runtime/sdk-session-runtime.mjs';
const store=Object.freeze({async load(){return null;},async append(){}});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const input=signal=>({binding:{},sessionKey:{projectKey:'observed',sessionId:'observed'},signal});

test('already cancelled preparation and closed-before-microtask preparation allocate no factory resource',async()=>{
 let calls=0;const c=new AbortController();c.abort();
 const owner=createOwnedRuntimeSdkSession({factory:async()=>{calls++;}});
 await assert.rejects(owner.prepare(input(c.signal)),/RUNNER_SESSION_STOPPED/);assert.equal(calls,0);
 const second=createOwnedRuntimeSdkSession({factory:async()=>{calls++;}}),pending=second.prepare(input());
 await second.close();await assert.rejects(pending,/RUNNER_SESSION_STOPPED/);assert.equal(calls,0);
 assert.deepEqual(second.cleanupStatus(),{pendingInitializations:0,closed:true,failures:[],physicalStopProven:false});
});

test('closing while initialization is pending retires the eventual mirror once without installing it',async()=>{
 const pending=Promise.withResolvers(),ready=Promise.withResolvers();let closes=0;
 const owner=createOwnedRuntimeSdkSession({factory:async()=>{ready.resolve();return pending.promise;}}),preparing=owner.prepare(input());
 await ready.promise;await owner.close();assert.equal(owner.cleanupStatus().pendingInitializations,1);
 pending.resolve({store,async settle(){},async close(){closes++;}});
 await assert.rejects(preparing,/RUNNER_SESSION_STOPPED/);await pause(20);await owner.close();
 assert.equal(closes,1);assert.equal(owner.cleanupStatus().pendingInitializations,0);assert.equal(owner.cleanupStatus().physicalStopProven,false);
});

test('configured close bound returns UNKNOWN, aborts its work and does not claim physical stop',async()=>{
 const parked=Promise.withResolvers();let received;const owner=createOwnedRuntimeSdkSession({cleanupMs:25,factory:async()=>({store,async settle(){},async close(options){received=options;await parked.promise;}})});
 await owner.prepare(input());const started=performance.now();
 try{await assert.rejects(owner.close(),/RUNNER_CLEANUP_UNKNOWN/);const elapsed=performance.now()-started;assert.ok(elapsed>=15&&elapsed<300,`cleanup elapsed ${elapsed}`);assert.ok(received.signal.aborted);assert.ok(Number.isSafeInteger(received.deadlineMs));assert.deepEqual(owner.cleanupStatus().failures,['RUNNER_CLEANUP_UNKNOWN']);assert.equal(owner.cleanupStatus().physicalStopProven,false);await assert.rejects(owner.close(),/RUNNER_CLEANUP_UNKNOWN/);}
 finally{parked.resolve();await pause(0);}
});

test('default close bound is1000ms, preserving the original70ms failure as a separately documented contract mismatch',async()=>{
 const parked=Promise.withResolvers();const owner=createOwnedRuntimeSdkSession({factory:async()=>({store,async settle(){},async close(){await parked.promise;}})});await owner.prepare(input());const started=performance.now();
 try{await assert.rejects(owner.close(),/RUNNER_CLEANUP_UNKNOWN/);const elapsed=performance.now()-started;assert.ok(elapsed>=850&&elapsed<1800,`default cleanup elapsed ${elapsed}`);assert.equal(owner.cleanupStatus().physicalStopProven,false);}
 finally{parked.resolve();await pause(0);}
});

test('settlement cancellation stops result release and teardown still retires exactly once',async()=>{
 const c=new AbortController(),started=Promise.withResolvers(),parked=Promise.withResolvers();let closes=0;
 const owner=createOwnedRuntimeSdkSession({cleanupMs:100,factory:async()=>({store,async settle(options){started.resolve(options);await parked.promise;},async close(){closes++;}})});await owner.prepare(input());
 const settling=owner.settle(c.signal),options=await started.promise;c.abort();
 await assert.rejects(settling,/RUNNER_CLEANUP_UNKNOWN/);assert.ok(options.signal.aborted);await owner.close();assert.equal(closes,1);parked.resolve();
});

test('captured resource close and settle preserve the factory result receiver even after method replacement',async()=>{
 let settled=0,closed=0;const resource={store,async settle(){assert.equal(this,resource,'settle receiver must remain the owned factory resource');settled++;},async close(){assert.equal(this,resource,'close receiver must remain the owned factory resource');closed++;}};
 const owner=createOwnedRuntimeSdkSession({factory:async()=>resource});await owner.prepare(input());resource.settle=()=>{throw Error('replacement must not run');};resource.close=()=>{throw Error('replacement must not run');};
 try{await owner.settle();await owner.close();assert.equal(settled,1);assert.equal(closed,1);}finally{await owner.close().catch(()=>{});}
});

test('factory result getters are refused without executing accessor code',async()=>{
 for(const name of ['store','settle','close']){let calls=0;const resource={store,async settle(){},async close(){}};Object.defineProperty(resource,name,{enumerable:true,get(){calls++;return ()=>{};}});
 const owner=createOwnedRuntimeSdkSession({factory:async()=>resource});await assert.rejects(owner.prepare(input()));await owner.close();assert.equal(calls,0);}
});

test('late parked retirement records UNKNOWN and cannot reopen or return the late store',async()=>{
 const ready=Promise.withResolvers(),result=Promise.withResolvers(),parked=Promise.withResolvers(),c=new AbortController();let closes=0;
 const owner=createOwnedRuntimeSdkSession({cleanupMs:20,factory:async()=>{ready.resolve();return result.promise;}}),preparing=owner.prepare(input(c.signal));await ready.promise;c.abort();await owner.close();
 result.resolve({store,async settle(){},async close(){closes++;await parked.promise;}});await assert.rejects(preparing,/RUNNER_SESSION_STOPPED/);await pause(35);
 assert.equal(closes,1);assert.deepEqual(owner.cleanupStatus().failures,['RUNNER_CLEANUP_UNKNOWN']);assert.equal(owner.cleanupStatus().physicalStopProven,false);await assert.rejects(owner.prepare(input()),/RUNNER_SESSION_CONFIGURATION/);parked.resolve();
});


test('owned factory configuration accessors and proxies are refused without execution',()=>{
 for(const name of ['factory','now','cleanupMs']){let calls=0;const cfg={factory:async()=>({store,async settle(){},async close(){}}),now:Date.now,cleanupMs:25};Object.defineProperty(cfg,name,{enumerable:true,get(){calls++;return cfg[name];}});assert.throws(()=>createOwnedRuntimeSdkSession(cfg));assert.equal(calls,0);}
 let proxyCalls=0;const cfg=new Proxy({factory:()=>{}},{get(){proxyCalls++;throw Error('must not execute');},getOwnPropertyDescriptor(){proxyCalls++;throw Error('must not execute');},getPrototypeOf(){proxyCalls++;throw Error('must not execute');}});assert.throws(()=>createOwnedRuntimeSdkSession(cfg));assert.equal(proxyCalls,0);
});

test('prepare input accessor and non-native signal refuse before any factory allocation',async()=>{
 let calls=0,getters=0;const owner=createOwnedRuntimeSdkSession({factory:async()=>{calls++;return {store,async settle(){},async close(){}};}});
 const bad=input();Object.defineProperty(bad,'signal',{enumerable:true,get(){getters++;return new AbortController().signal;}});await assert.rejects(owner.prepare(bad));assert.equal(getters,0);assert.equal(calls,0);
 await assert.rejects(owner.prepare({...input(),signal:{aborted:false,addEventListener(){getters++;}}}));assert.equal(getters,0);assert.equal(calls,0);await owner.close();
});

test('overlapping initialization cannot overwrite the first owned mirror',async()=>{
 const ready=Promise.withResolvers(),result=Promise.withResolvers();let calls=0,closes=0;
 const owner=createOwnedRuntimeSdkSession({factory:async()=>{calls++;ready.resolve();return result.promise;}}),first=owner.prepare(input());await ready.promise;
 await assert.rejects(owner.prepare(input()),/RUNNER_SESSION_CONFIGURATION/);assert.equal(calls,1);
 result.resolve({store,async settle(){},async close(){closes++;}});assert.equal(await first,store);await owner.close();assert.equal(closes,1);assert.equal(owner.cleanupStatus().pendingInitializations,0);
});

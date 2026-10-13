/** Independent lifecycle controls: real loopback listener, inert application boundary. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';
import {runLocalHostRecovery} from '../local/recovery.mjs';
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const defaults={mode:'synthetic-local',approve:()=>{throw Error('unexpected approve');},revoke:()=>{throw Error('unexpected revoke');},stats:()=>({taskEffects:0})};
const refusingApp=()=>({handle:async()=>new Response(JSON.stringify({error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}}),{status:403,headers:{'content-type':'application/json'}})});
async function accelerated(work){const native=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>native(fn,ms===30000?60:ms,...args);try{return await work();}finally{globalThis.setTimeout=native;}}

test('independent async graph: query refusal closes listener then owned graph once',async()=>{
 let closes=0,applications=0;const servers=[],native=http.Server.prototype.listen;
 http.Server.prototype.listen=function(...args){servers.push(this);return native.apply(this,args);};
 try{await assert.rejects(runLocalHostRecovery({...defaults,openHost:async()=>{applications++;await Promise.resolve();return {app:refusingApp(),credential:'opaque',closeGraph:async()=>{closes++;assert.ok(servers.every(s=>!s.listening));}};}}));assert.equal(applications,1);assert.equal(closes,1);assert.equal(servers.length,1);assert.ok(servers.every(s=>!s.listening));}
 finally{http.Server.prototype.listen=native;}
});

test('independent async graph: invalid graph credential still closes acquired ownership',async()=>{
 let closes=0,handled=0;
 await assert.rejects(runLocalHostRecovery({...defaults,openHost:async()=>({app:{handle:async()=>{handled++;return new Response('');}},credential:'',closeGraph:async()=>{closes++;}})}));
 assert.equal(closes,1);assert.equal(handled,0);
});

test('independent async graph: total cutoff refuses parked acquisition and closes late graph exactly once',()=>accelerated(async()=>{
 const parked=gate(),entered=gate(),closed=gate();let closes=0,handled=0,signal;
 const pending=runLocalHostRecovery({...defaults,openHost:async call=>{signal=call.signal;entered.resolve();await parked.promise;return {app:{handle:async()=>{handled++;return new Response('');}},credential:'opaque',closeGraph:async()=>{closes++;closed.resolve();}};}});pending.catch(()=>{});
 await entered.promise;
 try{assert.equal(await Promise.race([pending.then(()=>'returned',()=>'refused'),sleep(250).then(()=>'pending')]),'refused');assert.equal(signal.aborted,true);assert.equal(closes,0);}
 finally{parked.resolve();await Promise.race([closed.promise,sleep(300)]);await pending.catch(()=>{});}
 assert.equal(closes,1);assert.equal(handled,0);
}));

test('independent async graph: rejected acquisition starts no listener or approval',async()=>{
 let listeners=0;const native=http.Server.prototype.listen;http.Server.prototype.listen=function(...args){listeners++;return native.apply(this,args);};
 try{await assert.rejects(runLocalHostRecovery({...defaults,openHost:async()=>{throw Error('owned acquisition failed');}}),/owned acquisition failed/);assert.equal(listeners,0);}finally{http.Server.prototype.listen=native;}
});

test('independent async graph: cleanup failure is surfaced and borrowed application is not disposed',async()=>{
 let closes=0,disposed=0;const borrowed={handle:refusingApp().handle,close:()=>{disposed++;}};
 await assert.rejects(runLocalHostRecovery({...defaults,openHost:async()=>({app:{handle:borrowed.handle},credential:'opaque',closeGraph:async()=>{closes++;throw Error('owned close failed');}})}),/owned close failed/);
 assert.equal(closes,1);assert.equal(disposed,0);
});

test('independent async graph: uncooperative cleanup cannot park caller forever',async()=>{
 let closes=0;const parked=gate();const pending=runLocalHostRecovery({...defaults,openHost:async()=>({app:refusingApp(),credential:'opaque',closeGraph:async()=>{closes++;await parked.promise;}})});pending.catch(()=>{});
 try{assert.equal(await Promise.race([pending.then(()=>'returned',()=>'refused'),sleep(1400).then(()=>'pending')]),'refused');assert.equal(closes,1);}finally{parked.resolve();await pending.catch(()=>{});}
});

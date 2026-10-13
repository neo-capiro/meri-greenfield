/** Independent integrated source checks; all SQL/source state remains synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import http from 'node:http';
import {runLocalHostRecovery} from './recovery.mjs';

// This narrow lifecycle fixture is NOT a domain or durability oracle. It reaches
// borrowed approve/revoke waits through real loopback HTTP before the actual
// accepted durable fixture is available for the full integrated controls.
function lifecycleFixture(){
 let effects=0,revoked=false,approved=false,hosts=0;const proposal={same:'immutable proposal sentinel'},source={same:'retained result sentinel'};
 const draft={source,task:{title:'Review the retained synthetic recommendation'}};
 return {mode:'synthetic-local',openHost(){hosts++;return {credential:'independent-no-authority',app:{async handle(request){const route=new URL(request.url).pathname.split('/').at(-1);await request.json();let body,status=200;
  if(route==='query')body={acceptedTasks:false,resultReference:'same-result',resultSha256:'same-hash',observation:{result:{actions:[{id:'same-action'}]}}};
  else if(route==='draft'){body=revoked?{error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}}:draft;status=revoked?403:200;}
  else if(route==='prepare')body={status:'approval_required',draft,proposal};
  else if(route==='execute'){if(!approved){status=409;body={error:{code:'COMMAND_APPROVAL_REFUSED',outcome:'NOT_DISPATCHED'}};}else{effects=1;body={status:'observed',same:'retained observation'};}}
  else{status=404;body={error:{code:'NOT_FOUND',outcome:'NOT_DISPATCHED'}};}
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 }}};},approve(value){assert.deepEqual(value,proposal);approved=true;},revoke(){revoked=true;},stats(){return {taskEffects:effects,hosts};}};
}
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
for(const port of ['approve','revoke'])test(`independent: runner total deadline settles while ${port} ignores cancellation`,async()=>{
 const fixture=lifecycleFixture(),parked=gate(),entered=gate(),nativeSetTimeout=globalThis.setTimeout;const original=fixture[port];let invocation;
 // Accelerate only the exact whole-run timer, leaving transport timers real.
 globalThis.setTimeout=(fn,ms,...args)=>nativeSetTimeout(fn,ms===30000?100:ms,...args);
 fixture[port]=async value=>{entered.resolve();await parked.promise;return original(value);};
 try{
  invocation=runLocalHostRecovery(fixture);invocation.catch(()=>{});await entered.promise;
  const result=await Promise.race([invocation.then(()=>({state:'returned'}),()=>({state:'refused'})),sleep(350).then(()=>({state:'pending'}))]);
  assert.equal(result.state,'refused','aborted whole-run deadline must stop awaiting the borrowed callback');
 }finally{parked.resolve();try{await invocation;}catch{}globalThis.setTimeout=nativeSetTimeout;}
});

test('independent: unaccelerated thirty-second cutoff closes listeners and settles parked approve',async()=>{
 const fixture=lifecycleFixture(),parked=gate(),entered=gate(),original=fixture.approve,servers=[],nativeListen=http.Server.prototype.listen;let invocation;
 http.Server.prototype.listen=function(...args){servers.push(this);return nativeListen.apply(this,args);};
 fixture.approve=async value=>{entered.resolve();await parked.promise;return original(value);};
 try{
  invocation=runLocalHostRecovery(fixture);invocation.catch(()=>{});await entered.promise;
  const state=await Promise.race([invocation.then(()=>'returned',()=>'refused'),sleep(31000).then(()=>'pending')]);
  const connections=await Promise.all(servers.map(server=>new Promise((resolve,reject)=>server.getConnections((error,count)=>error?reject(error):resolve(count)))));
  const observed={state,hostsOpened:servers.length,allListenersClosed:servers.every(server=>!server.listening),activeConnections:connections.reduce((a,b)=>a+b,0)};
  assert.deepEqual(observed,{state:'refused',hostsOpened:2,allListenersClosed:true,activeConnections:0});
 }finally{parked.resolve();try{await invocation;}catch{}http.Server.prototype.listen=nativeListen;}
});

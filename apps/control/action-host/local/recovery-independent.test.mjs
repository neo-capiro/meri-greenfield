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

import net from 'node:net';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {listenActionApplication} from '../../action-application/node-http.mjs';
const checkout=fileURLToPath(new URL('../../../../',import.meta.url));
async function actualFixture(){
 process.env.MERI_REVIEW_SOURCE_ROOT=checkout;
 const {createLocalActionHostFixture}=await import('./fixture.mjs');
 return createLocalActionHostFixture({mode:'synthetic-local'});
}
async function noConnection(origin){
 const url=new URL(origin);
 await new Promise((resolve,reject)=>{const socket=net.connect({host:url.hostname,port:Number(url.port)});
  socket.setTimeout(500,()=>{socket.destroy();reject(Error('closed listener connection timed out'));});
  socket.once('connect',()=>{socket.destroy();reject(Error('closed listener accepted connection'));});
  socket.once('error',error=>{socket.destroy();if(error.code==='ECONNREFUSED')resolve();else reject(error);});
 });
}
async function openActual(fixture,work){
 const {app,credential}=fixture.openHost();
 const server=await listenActionApplication({app,host:'127.0.0.1',port:0,lifetimeMs:5000});
 const call=async(route,body,token=credential)=>{
  const response=await fetch(`${server.origin}/api/action-followthrough/${route}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
  return {status:response.status,body:await response.json()};
 };
 try{return await work(call);}finally{await server.close();assert.deepEqual(server.status(),{closed:true,listening:false,activeSockets:0});await noConnection(server.origin);}
}
const success=(value,stage)=>{assert.equal(value.status,200,`${stage}: ${JSON.stringify(value.body)}`);return value.body;};

test('independent actual graph: same retained selection and proposal across three HTTP hosts, one effect and fresh revocation',async()=>{
 const fixture=await actualFixture(),initial=fixture.stats();let selected,pending,observed,proposalBytes;
 try{
  await openActual(fixture,async call=>{
   const wrong=await call('query',{request:{limit:20}},'wrong-synthetic-token');assert.notEqual(wrong.status,200);assert.equal(fixture.stats().sourceReads,0);
   const oversized=await call('query',{request:{query:'x'.repeat(70000)}});assert.equal(oversized.status,413);assert.equal(fixture.stats().sourceReads,0);
   assert.equal((await call('approve',{})).status,404);assert.equal(fixture.stats().taskEffects,0);
   const read=success(await call('query',{request:{limit:20}}),'query');assert.equal(read.acceptedTasks,false);assert.equal(read.classification,'recommendations');
   selected={resultReference:read.resultReference,resultSha256:read.resultSha256,actionId:read.observation.result.actions[0].id};
   const corrupt=await call('draft',{selection:{...selected,resultSha256:'0'.repeat(64)}});assert.notEqual(corrupt.status,200);
   const draft=success(await call('draft',{selection:selected,edits:{title:'Independent retained task',dueDate:null}}),'draft');
   pending=success(await call('prepare',{draft}),'prepare');assert.equal(pending.status,'approval_required');proposalBytes=JSON.stringify(pending.proposal);
   const denied=await call('execute',{proposal:pending.proposal});assert.notEqual(denied.status,200);assert.equal(denied.body.error.outcome,'NOT_DISPATCHED');assert.equal(fixture.stats().taskEffects,0);
  });
  const before=fixture.stats();assert.equal(before.sourceReads,1);assert.equal(before.metadataRows,1);assert.equal(before.lookupRows,initial.lookupRows+1);
  await openActual(fixture,async call=>{
   const draft=success(await call('draft',{selection:selected,edits:{title:pending.draft.task.title,dueDate:null}}),'retained draft');assert.deepEqual(draft.source,pending.draft.source);assert.equal(fixture.stats().sourceReads,1);
   fixture.approve(pending.proposal);
   const altered=structuredClone(pending.proposal);altered.command.arguments.title='forged title';assert.notEqual((await call('execute',{proposal:altered})).status,200);assert.equal(fixture.stats().taskEffects,0);
   observed=success(await call('execute',{proposal:pending.proposal}),'approved execute');assert.equal(observed.status,'observed');assert.equal(fixture.stats().taskEffects,1);assert.equal(JSON.stringify(pending.proposal),proposalBytes);
  });
  await openActual(fixture,async call=>{
   assert.deepEqual(success(await call('execute',{proposal:pending.proposal}),'replay'),observed);assert.equal(fixture.stats().taskEffects,1);
   fixture.revoke();assert.notEqual((await call('draft',{selection:selected})).status,200);assert.notEqual((await call('execute',{proposal:pending.proposal})).status,200);assert.equal(fixture.stats().taskEffects,1);
  });
  const stats=fixture.stats();assert.equal(stats.hostsOpened,3);assert.equal(stats.sourceReads,1);assert.equal(stats.commandReservations,1);assert.equal(stats.commandChargeMicroUsd,'10');assert.equal(stats.lookupChargeMicroUsd,'10');
 }finally{fixture.close();assert.equal(fixture.stats().closed,true);}
});

test('independent actual runner closes all three owned sockets and reports only synthetic recovery',async()=>{
 const fixture=await actualFixture(),servers=[],origins=[],nativeListen=http.Server.prototype.listen;
 http.Server.prototype.listen=function(...args){servers.push(this);this.once('listening',()=>{origins.push(`http://127.0.0.1:${this.address().port}`);});return nativeListen.apply(this,args);};
 try{
  const result=await runLocalHostRecovery({mode:fixture.mode,openHost:fixture.openHost,approve:fixture.approve,revoke:fixture.revoke,stats:fixture.stats});
  assert.equal(result.status,'PASS');assert.equal(result.nativeDatabase,false);assert.equal(result.productionActivated,false);assert.equal(result.reconstructedHosts,3);assert.equal(result.stats.taskEffects,1);assert.equal(result.stats.sourceReads,1);
  assert.deepEqual(result.cleanup.listeners,Array.from({length:3},()=>({closed:true,listening:false,activeSockets:0})));assert.equal(servers.length,3);assert.ok(servers.every(server=>!server.listening));
  for(const origin of origins)await noConnection(origin);
 }finally{http.Server.prototype.listen=nativeListen;fixture.close();}
});

test('independent runner failure closes listener without retrying or changing proposals',async()=>{
 const fixture=lifecycleFixture(),servers=[],nativeListen=http.Server.prototype.listen;
 http.Server.prototype.listen=function(...args){servers.push(this);return nativeListen.apply(this,args);};
 fixture.approve=()=>{throw Error('INDEPENDENT_APPROVAL_FAILURE');};
 try{await assert.rejects(runLocalHostRecovery(fixture),/INDEPENDENT_APPROVAL_FAILURE/);assert.equal(fixture.stats().hosts,2);assert.equal(fixture.stats().taskEffects,0);assert.ok(servers.every(server=>!server.listening));}
 finally{http.Server.prototype.listen=nativeListen;}
});

test('independent CLI import/help/invalid are inert and explicit run is finite and secret-free',()=>{
 const cli='scripts/local-followthrough/host-run.mjs',options={cwd:checkout,encoding:'utf8',timeout:15000,maxBuffer:131072};
 const inert=execFileSync(process.execPath,['--input-type=module','-e',"import http from 'node:http';http.Server.prototype.listen=()=>{throw Error('UNEXPECTED_LISTENER')};await import('./scripts/local-followthrough/host-run.mjs');"],options);assert.equal(inert,'');
 const help=spawnSync(process.execPath,[cli,'--help'],options);assert.equal(help.status,0);assert.match(help.stdout,/synthetic/);assert.equal(help.stderr,'');
 const invalid=spawnSync(process.execPath,[cli,'--run','extra'],options);assert.equal(invalid.status,2);assert.equal(invalid.stdout,'LOCAL_ARGUMENTS_REFUSED\n');
 const run=spawnSync(process.execPath,[cli,'--run'],options);assert.equal(run.error,undefined);assert.equal(run.status,0,run.stdout+run.stderr);assert.equal(run.stderr,'');
 const result=JSON.parse(run.stdout);assert.equal(result.status,'PASS');assert.equal(result.fixtureClosed,true);assert.equal(result.nativeDatabase,false);assert.equal(result.productionActivated,false);assert.equal(result.result.stats.taskEffects,1);assert.equal(result.result.cleanup.listeners.length,3);
 assert.doesNotMatch(run.stdout,/local_host_|Bearer|SYNTHETIC_SOURCE|SYNTHETIC_SERVICE|"credential"|"proposal"|"actions"/);
});

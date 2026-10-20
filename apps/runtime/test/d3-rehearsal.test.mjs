/** Pre-deploy rehearsal of the browser side of D3 against the live control composition under measured Core latencies.
 *
 * Composed for real: assemblePreparedCandidate + assembleControl exactly as startControl mounts them (the public action-session
 * route, the conversation, input and lifecycle applications, the action session owner with Core identity, context and membership,
 * the conversation and lifecycle services, the bounded event stream) over the postgres store on the scripted protocol fixture with
 * the canonical initial-input owner (the frontend's Send is allocate, admit, submit with one request body).
 * Modelled: Core latency per route (rehearsal-support.mjs); the runner, which appends its events at the publish cadence
 * that rehearsal measured (each publish is a full authorization round); Temporal start/cancel (fixed latency); the native original
 * stop (`execution/kickoff/stop` answers after `stopMs`, the ECS stop and grant revocation it proves).
 * Not modelled: the runner's own authorization path (measured by first-turn-rehearsal), ECS, the frontend proxy (its 30 s request and
 * stream caps are applied as limits), and the multi-run next-turn reservation (the candidate fixture is the static first run).
 * Run: node --test --test-concurrency=1 apps/runtime/test/d3-rehearsal.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {assemblePreparedCandidate} from '../prepared-candidate.mjs';
import {assembleControl} from '../control.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {id} from '../../control/conversations/test/application-fixture.mjs';
import {CORE_PROFILES,recordHostClockSteps} from './rehearsal-support.mjs';

/** Median runner/publish duration (ms) per profile, measured by first-turn-rehearsal on 4797f7da: the runner's event cadence. */
export const PUBLISH_MS=Object.freeze({quiet:6300,'live-median':10500,'live-tail':15700});
/** The live limits (render-material.mjs) and the frontend's per-request and per-stream budget (withActionDeadline, proxy.ts). */
const LIMITS={startupMs:30000,shutdownMs:10000,requestMs:25000,requestBytes:131072},FRONTEND_MS=30000,TEMPORAL_MS=100;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(Error('aborted'));const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(Error('aborted'));};signal?.addEventListener('abort',abort,{once:true});});
const check=()=>{};

/** One live control composition with Core latency `profile` and a native original stop that answers after `stopMs`. */
function compose({profile,stopMs=1000}){
 const latency=CORE_PROFILES[profile];if(!latency)throw Error('unknown profile');
 const f=candidateFixture(),clientId=id(5),principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId},route=new AsyncLocalStorage(),core={},started=performance.now();
 // Live renders the multi-run window, which also bounds run facts (prepared-candidate.mjs factUntil); without it the static fixture's
 // facts expire with requestMs and every session and input allocation lasts 25 s. 300 s is the fixture allocation's runtime.
 const configuration={...f.configuration,limits:LIMITS,nativeCandidate:{...f.configuration.nativeCandidate,multiRun:{runWindowMs:300000}}};
 const sql=initialInputFixture();sql.pool.query=async(query,args)=>query.startsWith('SELECT name,to_regclass')?{rows:args[0].map(name=>({name,relation:name}))}:{rows:[{cap_micro_usd:'1000',consumed_micro_usd:'0',quarantined:false}]};
 async function fetchImpl(url,init){
  const path=new URL(url).pathname,kind=path.endsWith('/identity')?'identity':path.endsWith('/context')?'context':path.endsWith('/membership')?'membership':null;if(!kind)throw Error('unknown local Core route '+path);
  const name=route.getStore()??'other';core[name]??={calls:0};core[name].calls++;core[name][kind]=(core[name][kind]??0)+1;
  await delay(latency[kind],init.signal);const checkedAtMs=Date.now(),expiresAtMs=checkedAtMs+600000,body=JSON.parse(init.body);
  if(kind==='identity')return Response.json({principal,identityRevision:'identity-revision',checkedAtMs,expiresAtMs});
  if(kind==='membership')return Response.json({...principal,status:'active',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'membership-revision',checkedAtMs,expiresAtMs});
  return Response.json({principal,identityRevision:'identity-revision',identitySha256:body.identitySha256,conversationId:f.binding.conversationId,selectedClientId:clientId,contextRevision:'context-revision',checkedAtMs,expiresAtMs});
 }
 const effects={starts:0,cancels:0,stops:0};
 const candidate=assemblePreparedCandidate({configuration,pool:sql.pool,ecs:{send(){throw Error('No AWS');}},objects:{get(){throw Error('No objects');},put(){throw Error('No objects');}},credentials:f.secret,fetchImpl,allocate(){throw Error('No allocation');}});
 const client={connection:{withDeadline(_deadline,fn){return fn();},withAbortSignal(_signal,fn){return fn();}},
  workflow:{async start(){await delay(TEMPORAL_MS);effects.starts++;},getHandle(){return {async signal(){await delay(TEMPORAL_MS);},async cancel(){await delay(TEMPORAL_MS);effects.cancels++;}};}}};
 // control.mjs routes the stop-only native call around its fence; here it answers after the modelled ECS stop and revocation.
 const native=Object.freeze({...candidate.native,async call(operation,input,options={}){if(operation!=='execution/kickoff/stop')return candidate.native.call(operation,input,options);
  await delay(stopMs,options.signal);effects.stops++;return {binding:input.binding,executionId:input.executionId,expiresAtMs:Date.now()+600000};}});
 const assembly=assembleControl({configuration,pool:sql.pool,client,native,canonicalProductPorts:candidate.productPorts});candidate.bindApplication(assembly.application);
 const at=()=>Math.round(performance.now()-started);
 /** A browser request through the frontend's 30 s budget: status, body, duration and the Core calls it made. */
 async function call(name,method,path,{body,credential,headers={},signal}={}){
  const begun=performance.now(),deadline=AbortSignal.timeout(FRONTEND_MS),request=new Request('https://control.synthetic.invalid'+path,{method,signal:signal?AbortSignal.any([signal,deadline]):deadline,
   headers:{authorization:'Bearer '+credential,...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const response=await route.run(name,async()=>(await candidate.application.handle(request))??assembly.application.handle(request));
  return {response,status:response.status,ms:Math.round(performance.now()-begun)};
 }
 const json=async r=>({...r,body:await r.response.json()});
 // Host wall-clock steps, recorded only: rehearsal-support.mjs keeps this process's Date.now from going back.
 const clock=recordHostClockSteps(at);
 return {f,assembly,candidate,effects,core,at,call,json,hostClockSteps:clock.steps,close:async()=>{clock.stop();assembly.close();await candidate.close();}};
}

/** The runner as control sees it: one durable event per publish, at the measured cadence; stops at the first refusal. */
function runner(c,{profile,deltas,appended}){
 const {binding}=c.f;let stopped=false;
 const append=async(type,data)=>{const saved=await c.assembly.store.read(binding,{after:0,limit:1},check),event={eventId:randomUUID(),createdAt:new Date().toISOString(),type,data};
  await c.assembly.store.append(binding,event,check,saved.run.scopes);appended.set(event.eventId,c.at());};
 const done=(async()=>{try{
   await append('run.status',{state:'starting',reasonCode:null});await delay(PUBLISH_MS[profile]);await append('run.status',{state:'running',reasonCode:null});
   for(let i=0;i<deltas;i++){await delay(PUBLISH_MS[profile]);await append('message.delta',{messageId:id(700),text:i?` word${i}`:'Hello'});}
   await delay(PUBLISH_MS[profile]);await append('run.status',{state:'completed',reasonCode:null});return 'completed';
  }catch(error){stopped=true;return 'refused:'+(error?.code??error?.message);}})();
 return {done,get stopped(){return stopped;}};
}

/** The browser's action session, re-issued once when control refuses it as expired, as the frontend renews it (sessions last at most
 * 300 s, so a turn at tail latency can outlive one). */
function browserSession(c){
 const session={credential:null,renewals:0,
  async issue(){const r=await c.json(await c.call('session','POST','/api/action-followthrough/session',{body:{},credential:c.f.secret.identity}));if(r.status===200)session.credential=r.body.credential;return r;},
  async request(name,method,path,options={}){let r=await c.call(name,method,path,{...options,credential:session.credential});
   if(r.status===403&&(await r.response.clone().json().catch(()=>null))?.error?.code==='SESSION_REFUSED'){await r.response.body?.cancel();session.renewals++;await session.issue();r=await c.call(name,method,path,{...options,credential:session.credential});}
   return r;}};
 return session;
}

/** The browser's observation loop: open the stream from its cursor, reconnect when the 30 s subscription ends, refresh once after
 * `refreshAfterDeltas` deltas (abort, 1 s page reload, reconnect from the last delivered sequence). Returns at a terminal status. */
async function observe(c,{browser,appended,refreshAfterDeltas,untilMs}){
 const {conversationId}=c.f.binding,seen=[],connections=[],path=`/api/conversations/events/${conversationId}/stream`;let cursor=0,refreshed=false,terminal=null,refused=0;
 while(!terminal&&c.at()<untilMs&&refused<3){ // the browser stops watching after three refused connections in a row
  const controller=new AbortController(),opened=c.at(),r=await browser.request('events/stream','GET',path,{headers:{'x-meri-resume-sequence':String(cursor)},signal:controller.signal});
  const connection={openedAtMs:opened,status:r.status,setupMs:r.ms,events:0,endedBy:null};connections.push(connection);
  if(r.status!==200){connection.endedBy='status';refused++;await r.response.body?.cancel();await delay(1000);continue;}refused=0;
  const reader=r.response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try{read:while(true){const {done,value}=await reader.read();if(done){connection.endedBy='server';break;}buffer+=decoder.decode(value,{stream:true});let split;
    while((split=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,split);buffer=buffer.slice(split+2);const data=frame.split('\n').find(line=>line.startsWith('data: '));if(!data)continue;
     let chunk;try{chunk=JSON.parse(data.slice(6));}catch{continue;}if(chunk.type!=='data-meri-event')continue;const event=chunk.data;
     seen.push({sequence:event.sequence,type:event.type,state:event.data?.state??null,deliveredMs:c.at()-(appended.get(event.eventId)??c.at()),duplicate:event.sequence<=cursor});cursor=Math.max(cursor,event.sequence);connection.events++;
     if(event.type==='run.status'&&['completed','failed','cancelled'].includes(event.data?.state)){terminal=event.data.state;connection.endedBy='terminal';await reader.cancel();break read;}
     if(!refreshed&&refreshAfterDeltas!==undefined&&seen.filter(e=>e.type==='message.delta').length>=refreshAfterDeltas){refreshed=true;connection.endedBy='refresh';controller.abort();await reader.cancel().catch(()=>{});await delay(1000);break read;}}}
  }catch(error){connection.endedBy??='error:'+(error?.message??String(error));}
 }
 const sequences=seen.map(e=>e.sequence);
 return {terminal,connections,events:seen.length,duplicates:seen.filter(e=>e.duplicate).length,gaps:sequences.filter((s,i)=>i>0&&s!==sequences[i-1]+1).length,
  deliveryMs:{median:median(seen.map(e=>e.deliveredMs)),max:Math.max(0,...seen.map(e=>e.deliveredMs))}};
}
const median=list=>list.length?[...list].sort((a,b)=>a-b)[Math.floor((list.length-1)/2)]:null;
const summary=r=>({status:r.status,ms:r.ms,...(r.body?.error?{code:r.body.error.code}:{})});
/** The frontend's Send: allocate, admit and submit the same request body, each through its own 30 s budget. */
async function send(c,browser,body){const steps={};
 for(const [name,path] of [['allocate','/api/conversations/input/allocate'],['admit','/api/conversations/input/admit'],['submit','/api/conversations/submit']]){
  const r=await c.json(await browser.request(name,'POST',path,{body}));steps[name]=summary(r);steps.last=r;if(r.status!==200)break;}
 const {last,...shown}=steps;return {steps:shown,ok:last.status===200,body:last.body};}

/** D3 c, e and the refresh path: session, submit, live stream with one refresh mid-stream, completion, then history as a reload reads it. */
export async function rehearseStreamAndRefresh({profile,deltas=6}){
 const c=compose({profile}),appended=new Map(),browser=browserSession(c);
 try{
  const session=await browser.issue();
  const submit=await send(c,browser,{requestId:id(88),prompt:'Reply with the word hello.'});
  const run=runner(c,{profile,deltas,appended});
  const stream=await observe(c,{browser,appended,refreshAfterDeltas:2,untilMs:c.at()+(deltas+6)*PUBLISH_MS[profile]+120000});
  const outcome=await run.done;
  const history=await c.json(await browser.request('history','POST','/api/conversations/history',{body:{after:0,limit:100}}));
  return {profile,session:summary(session),send:submit.steps,runner:outcome,stream,history:{...summary(history),events:history.body?.events?.length??null},
   renewals:browser.renewals,core:c.core,effects:c.effects,hostClockSteps:c.hostClockSteps};
 }finally{await c.close();}
}

/** D3 f and g: a double submit, then Stop while the reply streams, then Stop again. `stopMs` is the native original stop. */
export async function rehearseDuplicateAndStop({profile,stopMs}){
 const c=compose({profile,stopMs}),appended=new Map(),browser=browserSession(c);
 try{
  const session=await browser.issue();
  const body={requestId:id(89),prompt:'Write 10 numbered sentences about appropriations.'};
  const [first,second]=await Promise.all([1,2].map(()=>send(c,browser,body)));
  const changed=await send(c,browser,{...body,prompt:'Different bytes, same request id.'});
  const run=runner(c,{profile,deltas:20,appended});
  while(!appended.size)await delay(100);
  await delay(4*PUBLISH_MS[profile]); // the reply is streaming: starting, running and two deltas are durable
  const stopAtMs=c.at(),stop=await c.json(await browser.request('cancel','POST','/api/conversations/cancel',{body:{}}));
  const outcome=await run.done;
  const again=await c.json(await browser.request('cancel','POST','/api/conversations/cancel',{body:{}}));
  const history=await c.json(await browser.request('history','POST','/api/conversations/history',{body:{after:0,limit:100}}));
  const statuses=(history.body?.events??[]).filter(e=>e.type==='run.status').map(e=>e.data.state);
  return {profile,stopMs,session:summary(session),sends:[first.steps,second.steps],sameRun:first.ok&&second.ok&&first.body?.run?.binding?.runId===second.body?.run?.binding?.runId,
   changedBytes:changed.steps,stopAtMs,stop:summary(stop),runner:outcome,stopAgain:summary(again),statuses,renewals:browser.renewals,core:c.core,effects:c.effects,hostClockSteps:c.hostClockSteps};
 }finally{await c.close();}
}

for(const profile of Object.keys(CORE_PROFILES))
 test(`D3 stream, refresh and history under the ${profile} Core profile (reported)`,{timeout:600000},async t=>{
  const r=await rehearseStreamAndRefresh({profile});t.diagnostic(JSON.stringify(r));
  assert.equal(r.stream.terminal,'completed',JSON.stringify(r));
 });
for(const profile of Object.keys(CORE_PROFILES))for(const stopMs of [1000,20000])
 test(`D3 double submit and Stop mid-stream under the ${profile} Core profile, native stop ${stopMs} ms`,{timeout:600000},async t=>{
  const r=await rehearseDuplicateAndStop({profile,stopMs});t.diagnostic(JSON.stringify(r));
  // Stop answers the committed fence inside its request, however long the native stop takes (D5); a repeat answers the same.
  assert.equal(r.stop.status,200,JSON.stringify(r.stop));assert.equal(r.stopAgain.status,200,JSON.stringify(r.stopAgain));assert.equal(r.statuses.at(-1),'cancelled');
 });

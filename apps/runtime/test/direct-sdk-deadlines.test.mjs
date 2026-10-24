/** Synthetic SDK iterator over actual activity/options/lifetimes; no model, network, DB or browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
import {runnerStartupBudget,ACTIVITY_PREPARATION_MAX_MS} from '../../../packages/runtime/runner-load-budget.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

function fixture({remainingMs=371351,mode='success',cleanupUnknown=false,terminalUnknown=false}={}){
 let clock=1_000_000,n=100,queries=0,closes=0,state='queued',publishAttempts=0;
 const expiry=clock+remainingMs,budget=runnerStartupBudget({requestMs:25000,shutdownMs:1000,originalExpiresAtMs:expiry}),s=budget.stages;
 const events=[],stages=[],entered=Promise.withResolvers();
 const saved={run:{binding,scopes,versions,state:'queued',policyRevision:scopes[0].policyRevision,createdAt:new Date(clock).toISOString()},request:{requestId:id(90),prompt:'Synthetic only',skill:null,window:null,windowRequest:null}};
 const runOwner={async load(){return saved;},async append({event,signal}){
  if(['completed','failed','cancelled'].includes(event.data?.state)&&terminalUnknown){publishAttempts++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}
  events.push(event);if(event.type==='run.status')state=event.data.state;
 },async recordUsage(){return {status:'unavailable'};}};
 const execute=createConversationActivity({runOwner,now:()=>clock,newId:()=>id(n++),cleanupAttemptMs:15,terminalAttemptMs:terminalUnknown?15:s.session.maxMs,
  loadMaxMs:s.load.maxMs,loadExpiresAtMs:s.load.expiresAtMs,runtimeMaxMs:Math.min(s.runtime.maxMs+s.local.maxMs,ACTIVITY_PREPARATION_MAX_MS),runtimeExpiresAtMs:s.local.expiresAtMs,setupBudget:s.setup,modelDeadlineMs:s.session.expiresAtMs,executionDeadlineMs:expiry,
  diagnostics:{stage:value=>stages.push(value)},
  prepareRuntime:async()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,...SDK_MODEL_CONFIGURATION,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:expiry,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),
  query({options}){queries++;entered.resolve();return {async *[Symbol.asyncIterator](){
   if(mode==='cancel')await new Promise((_,reject)=>options.abortController.signal.addEventListener('abort',()=>reject(options.abortController.signal.reason),{once:true}));
   if(mode==='throw')throw Error('synthetic SDK failure');
   if(mode==='cutoff')clock=s.session.expiresAtMs;
   if(mode==='last-instant')clock=s.session.expiresAtMs-1;
   yield {type:'result',subtype:'success',is_error:false};
  },close(){closes++;if(cleanupUnknown)return new Promise(()=>{});}};}
 });
 return {execute:signal=>execute({binding,signal}),entered,events,stages,expiry,budget,state:()=>state,queries:()=>queries,closes:()=>closes,publishAttempts:()=>publishAttempts};
}
for(const remainingMs of [900000,371351])test(`actual direct SDK activity completes once with ${remainingMs}ms left on its unchanged original`,async()=>{
 const f=fixture({remainingMs});assert.deepEqual(await f.execute(),{state:'completed'});assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'completed');assert.deepEqual(f.events.map(e=>e.data.state),['starting','running','completed']);assert.equal(f.budget.stages.session.expiresAtMs+23000,f.expiry);
});
for(const remainingMs of [23000,0,-1])test(`original with ${remainingMs}ms left refuses before claim or query`,async()=>{const f=fixture({remainingMs});await assert.rejects(f.execute(),/EXECUTION_FAILED/);assert.equal(f.queries(),0);assert.equal(f.state(),'queued');assert.equal(f.events.length,0);});
test('result just before model cutoff can use the remaining completion window',async()=>{const f=fixture({mode:'last-instant'});assert.deepEqual(await f.execute(),{state:'completed'});assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'completed');});
test('result at model cutoff cannot be published as completion',async()=>{const f=fixture({mode:'cutoff'});await assert.rejects(f.execute(),/EXECUTION_FAILED/);assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'failed');assert.ok(!f.events.some(e=>e.data.state==='completed'));});
test('cancellation closes the single query and terminalizes only the claimant',async()=>{const controller=new AbortController(),f=fixture({mode:'cancel'}),pending=f.execute(controller.signal);await f.entered.promise;controller.abort();await assert.rejects(pending,/EXECUTION_STOPPED/);assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'cancelled');});
test('SDK failure still closes and records failure without replay',async()=>{const f=fixture({mode:'throw'});await assert.rejects(f.execute(),/EXECUTION_FAILED/);assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'failed');});
test('stalled terminal publication remains bounded and nonterminal for the existing reconciler',{timeout:1000},async()=>{const f=fixture({mode:'throw',terminalUnknown:true});await assert.rejects(f.execute(),/EXECUTION_FAILED/);assert.equal(f.publishAttempts(),4);assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.equal(f.state(),'running');});
test('unknown query cleanup remains an explicit unknown outcome',{timeout:1000},async()=>{const f=fixture({mode:'throw',cleanupUnknown:true});await assert.rejects(f.execute(),/SDK_CLEANUP_UNKNOWN/);assert.equal(f.queries(),1);assert.equal(f.closes(),1);assert.ok(!f.events.some(e=>e.data.state==='completed'));});

test('assembled runner terminal calls use original expiry, not removed pre-reservations',async()=>{
 const at=Date.now(),expiry=at+371351,executionKey=hash(binding),calls=[];
 const configuration={binding,versions,sourceEnabled:false,limits:{requestMs:25000,shutdownMs:1000},remoteTask:{original:{binding,versions,executionKey,executionId:executionKey,planSha256:'0'.repeat(64),expiresAtMs:expiry}}};
 const execute=assembleConversationRunner({configuration,now:()=>at,native:{async call(path,input,options){calls.push({path,input,options});
  if(path==='runner/load')return {run:{binding,scopes,versions,state:'queued',policyRevision:scopes[0].policyRevision,createdAt:new Date(at).toISOString()},request:{requestId:id(95),prompt:'Synthetic only',skill:null,window:null,windowRequest:null}};
  if(path==='runner/publish')return {};if(path==='runner/runtime')throw Error('synthetic preparation refusal');if(path==='runner/record-usage')return {status:'unavailable'};throw Error('unexpected operation');
 }},query(){throw Error('query must not be reached');}});
 await assert.rejects(execute({binding}),/EXECUTION_FAILED/);
 const terminal=calls.find(c=>c.path==='runner/publish'&&c.input.event.data.state==='failed');assert.ok(terminal);assert.equal(terminal.options.deadlineMs,expiry);assert.equal(terminal.options.maxRequestMs,23000);
 const load=calls.find(c=>c.path==='runner/load');assert.equal(load.options.deadlineMs,expiry-23000);
 assert.ok(calls.every(c=>c.options.deadlineMs===undefined||c.options.deadlineMs<=expiry));
});

test('native terminal transport cannot dispatch at original expiry',async()=>{
 const expiry=1_000_000;let calls=0;
 const native=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:131072},credential:'synthetic-task',now:()=>expiry,fetch:async()=>{calls++;throw Error('transport forbidden');}});
 await assert.rejects(native.call('runner/publish',{binding,event:{eventId:id(96),createdAt:new Date(expiry).toISOString(),type:'run.status',data:{state:'failed',reasonCode:'EXECUTION_FAILED'}}},{deadlineMs:expiry,maxRequestMs:23000}));assert.equal(calls,0);
});

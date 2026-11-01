import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,scopes} from './application-fixture.mjs';
import {createConversationApplication} from '../http.mjs';
import {createHistoryDiagnostics,historyTraceHeader,reportHistoryStage} from '../history-diagnostics.mjs';

const trace='h1_'+'a'.repeat(32);
const request=(credential,header=trace,body='{}')=>new Request('https://control.invalid/api/conversations/history',{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json',[historyTraceHeader]:header},body});

for(const failure of ['none','session','retention','store','missing','release_session','release_retention']){
 test(`history diagnoses ${failure} with unchanged response and authority checks`,async()=>{
  const observed=[];
  for(const enabled of [false,true]){
   let f,reads=0,retentionCalls=0;
   const lines=[],store={accept(){throw Error('unused');},append(){throw Error('unused');},async read(){
    reads++;if(failure==='store')throw Error('private database error and content');
    if(failure==='missing')return null;
    if(failure==='release_session')f.state.revoked=true;
    return {run:{scopes},events:[],request:{prompt:'private synthetic prompt'}};
   }};
   f=await applicationFixture({serviceOptions:{store},retention:{async assertServable(){
    retentionCalls++;if(failure==='retention'||failure==='release_retention'&&retentionCalls===2)throw Error('private retention error');
   }}});
   try{
    if(failure==='session')f.state.revoked=true;
    const app=createConversationApplication({service:f.service,historyDiagnostics:enabled?createHistoryDiagnostics({write:line=>lines.push(line)}):()=>undefined});
    const result=await app.handle(request(f.credential));
    observed.push({status:result.status,body:await result.text(),headers:[...result.headers],reads,retentionCalls});
    if(enabled){
     assert.equal(lines.length,1);
     assert.deepEqual(JSON.parse(lines[0]),{event:'MERI_HISTORY_CONTROL',trace,stage:failure==='none'?'response':failure==='missing'?'store':failure,outcome:failure==='none'?'response':'refused',status:failure==='none'?200:['session','release_session'].includes(failure)?403:failure==='missing'?404:502});
    }
   }finally{f.close();}
  }
  assert.deepEqual(observed[1],observed[0]);
 });
}

test('invalid inbound trace is replaced; malformed body stays a request refusal',async()=>{
 const f=await applicationFixture(),lines=[];
 try{
  const app=createConversationApplication({service:f.service,historyDiagnostics:createHistoryDiagnostics({write:line=>lines.push(line),newTrace:()=>trace})});
  const result=await app.handle(request(f.credential,'raw-secret-not-a-trace','{"private":'));
  assert.equal(result.status,400);
  assert.deepEqual(JSON.parse(lines[0]),{event:'MERI_HISTORY_CONTROL',trace,stage:'request',outcome:'refused',status:400});
  assert.equal(lines.length,1);
 }finally{f.close();}
});

test('diagnostic failures cannot replace history or stage outcomes',async()=>{
 const f=await applicationFixture();
 try{
  for(const diagnostics of [
   createHistoryDiagnostics({write(){throw Error('sink unavailable');}}),
   createHistoryDiagnostics({newTrace(){throw Error('random unavailable');}}),
  ]){
   const result=await createConversationApplication({service:f.service,historyDiagnostics:diagnostics}).handle(request(f.credential,'invalid'));
   assert.equal(result.status,404);
   assert.deepEqual(await result.json(),{error:{code:'NOT_FOUND'}});
  }
  assert.doesNotThrow(()=>reportHistoryStage(()=>{throw Error('observer');},'store'));
  let called=false;reportHistoryStage(()=>{called=true;},'private');assert.equal(called,false);
 }finally{f.close();}
});

test('only history is observed; same trace cannot authorize access',async()=>{
 const f=await applicationFixture(),lines=[];
 try{
  const app=createConversationApplication({service:f.service,historyDiagnostics:createHistoryDiagnostics({write:line=>lines.push(line)})});
  const denied=await app.handle(request('not-a-session'));
  assert.equal(denied.status,403);
  assert.equal(JSON.parse(lines[0]).stage,'session');
  lines.length=0;
  await app.handle(new Request('https://control.invalid/api/conversations/cancel',{method:'POST',headers:{authorization:`Bearer ${f.credential}`,'content-type':'application/json',[historyTraceHeader]:trace},body:'{}'}));
  assert.equal(lines.length,0);
 }finally{f.close();}
});

test('bounded terminal-only output admits closed stages and no error fields',()=>{
 let time=0;const lines=[],begin=createHistoryDiagnostics({write:line=>lines.push(line),now:()=>time,newTrace:()=>trace});
 for(let i=0;i<25;i++){
  const d=begin('invalid');d.stage('private');d.finish(502);d.stage('store');d.finish(200);
 }
 assert.equal(lines.length,21);assert.equal(lines[20],'MERI_HISTORY_CONTROL_SUPPRESSED');
 assert.deepEqual(JSON.parse(lines[0]),{event:'MERI_HISTORY_CONTROL',trace,stage:'request',outcome:'refused',status:502});
 time=60000;begin(null).finish(200);assert.equal(lines.length,22);
});

test('deadline still aborts a pending history read and emits one terminal stage',async()=>{
 const lines=[];let aborted=false;
 const service={submit(){},cancel(){},async history({historyStage,signal}){
  historyStage('store');
  await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));
  signal.throwIfAborted();
 }};
 const app=createConversationApplication({service,maxRequestMs:20,historyDiagnostics:createHistoryDiagnostics({write:line=>lines.push(line)})});
 const result=await app.handle(request('synthetic-session'));
 assert.equal(aborted,true);assert.equal(result.status,408);
 assert.equal(lines.length,1);
 assert.deepEqual(JSON.parse(lines[0]),{event:'MERI_HISTORY_CONTROL',trace,stage:'store',outcome:'refused',status:408});
});

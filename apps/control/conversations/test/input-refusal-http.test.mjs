/** SYNTHETIC: the three conversation input routes map a reached monthly cap and an unusable attachment to their own refusals,
 * and every remaining unavailable answer writes one code-only log line. No socket, store or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationInputApplication} from '../input/http.mjs';
import {createConversationInitialInputApplication} from '../initial-input/http.mjs';
import {createConversationApplication} from '../http.mjs';
const input={requestId:'00000000-0000-4000-8000-000000000001',prompt:'Hello'};
const post=(path,body=input)=>new Request('https://meri.invalid'+path,{method:'POST',headers:{authorization:'Bearer synthetic-credential','content-type':'application/json'},body:JSON.stringify(body)});
const coded=code=>Object.assign(new Error(code),{code});
const throwing=error=>async()=>{throw error;};
function routes(error){
 const lines=[],writeDiagnostic=line=>lines.push(line),fails=throwing(error);
 const conversations=createConversationApplication({service:{submit:fails,history:fails,cancel:fails},writeDiagnostic,historyDiagnostics:()=>undefined});
 return {lines,
  admit:()=>createConversationInputApplication({service:{admitInput:fails},writeDiagnostic}).handle(post('/api/conversations/input/admit')),
  allocate:()=>createConversationInitialInputApplication({service:{allocateInput:fails},writeDiagnostic}).handle(post('/api/conversations/input/allocate')),
  submit:()=>conversations.handle(post('/api/conversations/submit')),
  cancel:()=>conversations.handle(post('/api/conversations/cancel',{}))};
}
const answer=async response=>({status:response.status,body:await response.json()});

test('a reached tenant monthly cap answers 429 TENANT_MONTHLY_CAP_REACHED on admit, submit and allocate without a log line',async()=>{
 const r=routes(coded('TENANT_MONTHLY_CAP_REACHED'));
 for(const route of ['admit','submit'])assert.deepEqual(await answer(await r[route]()),{status:429,body:{error:{code:'TENANT_MONTHLY_CAP_REACHED'}}},route);
 assert.deepEqual(await answer(await r.allocate()),{status:429,body:{error:{code:'TENANT_MONTHLY_CAP_REACHED',outcome:'NOT_DISPATCHED'}}});
 assert.deepEqual(r.lines,[]);
});

test('an attachment admission refusal answers 400 INVALID_REQUEST; an upload outage stays unavailable and is logged',async()=>{
 for(const code of ['UPLOAD_EXTRACTION_UNAVAILABLE','UPLOAD_NOT_CLEAN','UPLOAD_ACCESS_DENIED','UPLOAD_NOT_FOUND','UPLOAD_EXPIRED']){
  const r=routes(coded(code));
  for(const route of ['admit','submit'])assert.deepEqual(await answer(await r[route]()),{status:400,body:{error:{code:'INVALID_REQUEST'}}},`${route} ${code}`);
  assert.deepEqual(await answer(await r.allocate()),{status:400,body:{error:{code:'INVALID_REQUEST',outcome:'NOT_DISPATCHED'}}},code);
  assert.deepEqual(r.lines,[],code);
 }
 for(const code of ['UPLOAD_UNAVAILABLE','UPLOAD_STORE_CORRUPT']){
  const r=routes(coded(code));
  assert.deepEqual(await answer(await r.admit()),{status:502,body:{error:{code:'CONVERSATION_UNAVAILABLE'}}},code);
  assert.deepEqual(r.lines.map(line=>JSON.parse(line)),[{event:'MERI_INPUT_CONTROL',route:'/api/conversations/input/admit',outcome:'unavailable',code}]);
 }
});

test('an unmapped code answers unavailable and writes exactly one code-only line naming the route',async()=>{
 const r=routes(coded('SDK_USAGE_STORE_CORRUPT'));
 assert.deepEqual(await answer(await r.admit()),{status:502,body:{error:{code:'CONVERSATION_UNAVAILABLE'}}});
 assert.deepEqual(await answer(await r.submit()),{status:502,body:{error:{code:'CONVERSATION_UNAVAILABLE'}}});
 assert.deepEqual(await answer(await r.cancel()),{status:502,body:{error:{code:'CONVERSATION_UNAVAILABLE'}}});
 assert.deepEqual(await answer(await r.allocate()),{status:503,body:{error:{code:'INITIAL_INPUT_UNAVAILABLE',outcome:'UNKNOWN'}}});
 assert.deepEqual(r.lines.map(line=>JSON.parse(line)),['/api/conversations/input/admit','/api/conversations/submit','/api/conversations/cancel','/api/conversations/input/allocate']
  .map(route=>({event:'MERI_INPUT_CONTROL',route,outcome:'unavailable',code:'SDK_USAGE_STORE_CORRUPT'})));
});

test('a message that is not a closed code is never logged, and a failing log sink cannot change the answer',async()=>{
 const secret='lookup failed for tenant 123e4567-e89b-42d3-a456-426614174000 prompt Hello',r=routes(new Error(secret));
 assert.equal((await r.admit()).status,502);assert.equal((await r.submit()).status,502);assert.equal((await r.allocate()).status,503);
 assert.equal(r.lines.length,3);for(const line of r.lines){assert.deepEqual(Object.keys(JSON.parse(line)),['event','route','outcome','code']);assert.equal(JSON.parse(line).code,'UNNAMED');assert.ok(!line.includes('123e4567')&&!line.includes('Hello'));}
 const app=createConversationInputApplication({service:{admitInput:throwing(coded('SDK_USAGE_STORE_CORRUPT'))},writeDiagnostic:()=>{throw Error('sink down');}});
 assert.deepEqual(await answer(await app.handle(post('/api/conversations/input/admit'))),{status:502,body:{error:{code:'CONVERSATION_UNAVAILABLE'}}});
});

test('known codes keep their existing statuses and write no line',async()=>{
 for(const [code,admit,allocate] of [
  ['MODEL_SETTINGS_UNAVAILABLE',[503,'MODEL_SETTINGS_UNAVAILABLE'],[503,'MODEL_SETTINGS_UNAVAILABLE','NOT_DISPATCHED']],
  ['SESSION_REFUSED',[403,'SESSION_REFUSED'],[403,'SESSION_REFUSED','NOT_DISPATCHED']],
  ['SKILL_UNAVAILABLE',[400,'INVALID_REQUEST'],[400,'INVALID_REQUEST','NOT_DISPATCHED']],
  ['DEADLINE',[408,'DEADLINE'],[408,'DEADLINE','UNKNOWN']],
  ['INITIAL_INPUT_CONFLICT',[400,'REQUEST_REPLAY_REFUSED'],[409,'INITIAL_INPUT_CONFLICT','NOT_DISPATCHED']],
 ]){
  const r=routes(coded(code));
  assert.deepEqual(await answer(await r.admit()),{status:admit[0],body:{error:{code:admit[1]}}},code);
  assert.deepEqual(await answer(await r.allocate()),{status:allocate[0],body:{error:{code:allocate[1],outcome:allocate[2]}}},code);
  assert.deepEqual(r.lines,[],code);
 }
 const r=routes(coded('CONVERSATION_UNAVAILABLE'));assert.equal((await r.submit()).status,502);
 assert.deepEqual(r.lines.map(line=>JSON.parse(line)),[{event:'MERI_INPUT_CONTROL',route:'/api/conversations/submit',outcome:'unavailable',code:'CONVERSATION_UNAVAILABLE'}]);
});

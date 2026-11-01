/** A run that ends while a clarifying question is still pending settles that question durably, ahead of its terminal event.
 * Real service and store composition over the scripted pool; no SDK, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {allocatedApplicationFixture,binding,id} from './application-fixture.mjs';
const event=(n,type,data)=>({eventId:id(n),createdAt:new Date().toISOString(),type,data});
const status=(n,state,reasonCode=null)=>event(n,'run.status',{state,reasonCode});
const question={question:'How should I format the output?',header:'Format',options:[{label:'Summary',description:'Brief overview'},{label:'Detailed',description:'Full explanation'}],multiSelect:false};
const pending=(n,questionId)=>event(n,'question.pending',{questionId,toolUseId:`toolu_${n}`,questionsSha256:'a'.repeat(64),expiresAt:new Date(Date.now()+900000).toISOString(),questions:[question]});
const answered=(n,questionId)=>event(n,'question.answered',{questionId,outcome:'answered',reasonCode:null});
async function running(){const f=await allocatedApplicationFixture();await f.post('submit');for(const [n,state] of [[20,'starting'],[21,'running']])await f.runOwner.append({binding,event:status(n,state)});return f;}
const outcomes=h=>h.events.filter(e=>e.type==='question.answered').map(e=>[e.data.questionId,e.data.outcome,e.data.reasonCode]);

test('a user Stop settles every still-pending question as cancelled ahead of the cancellation, which stays the last sequence',async()=>{
 const f=await running();try{
  await f.runOwner.append({binding,event:pending(22,id(50))});await f.runOwner.append({binding,event:pending(23,id(51))});await f.runOwner.append({binding,event:answered(24,id(50))});
  assert.deepEqual(await f.service.cancel({credential:f.credential}),{state:'cancelled'});
  const h=await f.service.history({credential:f.credential}),[settled,cancelled]=h.events.slice(-2);
  assert.equal(settled.type,'question.answered');assert.deepEqual(settled.data,{questionId:id(51),outcome:'cancelled',reasonCode:'USER_CANCELLED'});
  assert.equal(cancelled.type,'run.status');assert.equal(cancelled.data.state,'cancelled');assert.equal(cancelled.sequence,h.lastSequence);
  assert.deepEqual(outcomes(h),[[id(50),'answered',null],[id(51),'cancelled','USER_CANCELLED']],'an answered question is not settled again, a pending one exactly once');
  assert.deepEqual(await f.store.lifecycle.readStopFence({binding,scopes:h.run.scopes,eventId:cancelled.eventId},()=>{}),{state:'cancelled',cancelCommitted:true});
  // The worker's own late cancellation record and any answer are refused: the run is terminal.
  await assert.rejects(f.runOwner.append({binding,event:event(25,'question.answered',{questionId:id(51),outcome:'cancelled',reasonCode:'USER_QUESTION_CANCELLED'})}));
  assert.equal(outcomes(await f.service.history({credential:f.credential})).length,2);
 }finally{f.close();}
});

test('a worker terminal event settles a still-pending question as RUN_ENDED, and a run without a pending question gains no event',async()=>{
 const f=await running();try{
  await f.runOwner.append({binding,event:pending(22,id(50))});
  await f.runOwner.append({binding,event:status(23,'failed','EXECUTION_FAILED')});
  const h=await f.service.history({credential:f.credential});
  assert.deepEqual(outcomes(h),[[id(50),'cancelled','RUN_ENDED']]);assert.equal(h.events.at(-1).data.state,'failed');assert.equal(h.events.at(-2).type,'question.answered');
 }finally{f.close();}
 const g=await running();try{
  const before=(await g.service.history({credential:g.credential})).lastSequence;
  await g.runOwner.append({binding,event:status(22,'completed')});
  const h=await g.service.history({credential:g.credential});assert.equal(h.lastSequence,before+1);assert.deepEqual(outcomes(h),[]);
 }finally{g.close();}
});

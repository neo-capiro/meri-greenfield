/** A streamed `message.delta` publication may ride the credential's complete session observation made within PUBLISH_REUSE_MS;
 * everything else observes fresh, and a refused observation drops the entry. Real service and session owner, scripted store. */
import test from 'node:test';import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {allocatedApplicationFixture,binding,id} from './application-fixture.mjs';
import {PUBLISH_REUSE_MS} from '../service.mjs';
const event=(n,type,data)=>({eventId:id(n),createdAt:new Date().toISOString(),type,data});
const delta=(n,text)=>event(n,'message.delta',{messageId:id(90),text});
const status=(n,state)=>event(n,'run.status',{state,reasonCode:null});
/** Every complete session observation resolves the current context once; the fixture lets the test count those resolves. */
async function fixture(){const f=await allocatedApplicationFixture();await f.post('submit');let resolves=0;f.state.checkCurrentBinding=async()=>{resolves++;};return {f,resolves:()=>resolves};}
const published=f=>[...f.state.events.values()].flat().map(row=>row.event).filter(e=>e.type==='message.delta').map(e=>e.data.text);

test('a message.delta within the bound reuses the last complete observation of its binding; after the bound it observes fresh',async()=>{
 assert.equal(PUBLISH_REUSE_MS,2000);
 const {f,resolves}=await fixture();try{
  await f.runOwner.append({binding,event:status(20,'starting')});const after=resolves();assert.equal(after,2,'a status publication observes at both ends');
  await f.runOwner.append({binding,event:delta(21,'a ')});await f.runOwner.append({binding,event:delta(22,'b ')});
  assert.equal(resolves(),after,'deltas inside the bound ride the status publication\'s observation');
  await sleep(PUBLISH_REUSE_MS+100);
  await f.runOwner.append({binding,event:delta(23,'c ')});assert.equal(resolves(),after+2,'an observation older than the bound is replaced by a fresh pass');
  await f.runOwner.append({binding,event:delta(24,'d ')});assert.equal(resolves(),after+2,'which is reused in turn');
  const h=await f.service.history({credential:f.credential});assert.deepEqual(h.events.filter(e=>e.type==='message.delta').map(e=>e.data.text),['a ','b ','c ','d ']);
 }finally{f.close();}
});

test('only a message.delta reuses: a status or question publication observes fresh, and another binding never matches',async()=>{
 const {f,resolves}=await fixture();try{
  await f.runOwner.append({binding,event:status(20,'starting')});let count=resolves();
  await f.runOwner.append({binding,event:status(21,'running')});assert.equal(resolves(),count+2);count+=2;
  await f.runOwner.append({binding,event:event(22,'question.answered',{questionId:id(50),outcome:'cancelled',reasonCode:'USER_QUESTION_CANCELLED'})});assert.equal(resolves(),count+2);count+=2;
  await assert.rejects(f.runOwner.append({binding:{...binding,runId:id(77)},event:delta(23,'x ')}),/STALE_WRITER/);assert.ok(resolves()>count,'a delta for another binding is observed fresh, then refused');
 }finally{f.close();}
});

test('a revocation is observed at the latest when the bound elapses',async()=>{
 const {f}=await fixture();try{
  await f.runOwner.append({binding,event:status(20,'starting')});
  f.state.revoked=true;
  await sleep(PUBLISH_REUSE_MS+100);
  await assert.rejects(f.runOwner.append({binding,event:delta(21,'a ')}));
  assert.deepEqual(published(f),[],'nothing is published after the bound elapsed');
 }finally{f.close();}
});

test('a revocation any fresh pass observed refuses the next message.delta at once, inside the bound',async()=>{
 const {f,resolves}=await fixture();try{
  await f.runOwner.append({binding,event:status(20,'starting')});
  f.state.revoked=true;
  // A status publication always observes fresh: it is refused and the credential's observation goes with it ...
  await assert.rejects(f.runOwner.append({binding,event:status(21,'running')}));
  // ... so the delta that follows, well inside the bound, is refused immediately instead of served from the dropped observation.
  const before=resolves();await assert.rejects(f.runOwner.append({binding,event:delta(22,'b ')}));
  assert.ok(resolves()>=before);assert.deepEqual(published(f),[]);
 }finally{f.close();}
});

/** Authority observations behind one Send (allocate, admit, submit) through the canonical conversation service and session owner.
 * Every session resolve here is one identity and one context read; live it also carries two membership rechecks, so it is four
 * Core calls. Live 2026-10-20 08:23Z these three requests took 11.4 s, 15.7 s and 11.7 s. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture} from './application-fixture.mjs';

test('one Send pins its session resolves: each fresh() pass resolves the session twice',async()=>{
 const f=await applicationFixture({initialInput:true});
 try{
  let resolves=0;f.state.checkCurrentBinding=async()=>{resolves++;};
  const counted=async call=>{resolves=0;await call();return resolves;};
  const input=JSON.parse(JSON.stringify(f.input));
  const allocate=await counted(()=>f.service.allocateInput({credential:f.credential,input}));
  const admit=await counted(()=>f.service.admitInput({credential:f.credential,input}));
  const submit=await counted(()=>f.service.submit({credential:f.credential,input}));
  // fresh() passes: allocate 4 (start, after admission, after facts, end); admit 5 (start, before accept, release before and
  // after, end); submit replays the admitted request: 4 (start, release before and after dispatch, end). Each pass is
  // authenticateSession + readCurrentState, i.e. two complete resolves (only the load path fuses them into one).
  assert.deepEqual({allocate,admit,submit},{allocate:8,admit:10,submit:8});
  assert.equal(f.state.starts,1,'only submit dispatches');
 }finally{f.close();}
});

/** Hearing name selection remains unavailable under the actual ID-only owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {storedCase,id,clientId} from './fixture.mjs';

test('authorized client IDs and a selected task client cannot turn a hearing name into authority',async()=>{
 for(const reference of ['Synthetic client','  SYNTHETIC CLIENT  ',clientId+'suffix','Synthetic client'+' '.repeat(80)+'ignored']){
  const scene=storedCase(id,{request:{clientId}});scene.arguments={clientId:reference};
  const f=await ownerFixture(id,{scene,clientIds:[clientId,uuid('d')]});
  try{
   await assert.rejects(f.owner.nativeReadContextPorts.readCurrent(f.proof()),{message:'UNAVAILABLE'});
   assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.secrets,0);
   assert.equal(f.stateOwner.entryReads,0);assert.equal(f.core.state.calls.length,0);assert.equal(f.wire.length,0);
  }finally{f.scope.abort();}
 }
});

test('a captured hearing UUID loses authority when current native client membership is revoked',async()=>{
 const f=await ownerFixture(id,{scene:storedCase(id,{request:{clientId}})});
 try{
  const context=JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof())).context;
  assert.deepEqual(context.clientResolution,{reference:clientId,clientId});
  f.core.state.clientIds=[];f.core.state.membershipRevision='e'.repeat(64);
  await assert.rejects(f.owner.getCredentials(f.credentials(context)),{message:'ACCESS_DENIED'});
  assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
 }finally{f.scope.abort();}
});

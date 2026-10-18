/** Missing native name observation cannot be replaced by the current roster or selected client. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {storedCase,id,clientId} from './fixture.mjs';
import {createNativeReadCredentialOwner} from '../../../../runtime/native-authority/native-read-credentials/owner.mjs';

test('a current authorized UUID roster cannot replace a missing native reference reader for a tracked client name',async()=>{
 for(const reference of ['Synthetic client','  SYNTHETIC CLIENT  ',clientId+'suffix','Synthetic client'+' '.repeat(80)+'ignored']){
  const scene=storedCase();scene.arguments={clientId:reference};
  const f=await ownerFixture(id,{scene,clientIds:[clientId,uuid('d')]});
  const {readClientReference,...coreAuthority}=f.configuration.coreAuthority;
  f.owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority});
  try{
   await assert.rejects(f.owner.nativeReadContextPorts.readCurrent(f.proof()),{message:'UNAVAILABLE'});
   assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.secrets,0);
   assert.equal(f.stateOwner.entryReads,0);assert.equal(f.core.state.calls.length,0);assert.equal(f.wire.length,0);
  }finally{f.scope.abort();}
 }
});

test('a prior tracked UUID context cannot survive current client-membership revocation',async()=>{
 const f=await ownerFixture(id,{scene:storedCase()});
 try{
  const context=JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof())).context;
  assert.equal(context.subject.entityIds[0],clientId);
  f.core.state.clientIds=[];f.core.state.membershipRevision='e'.repeat(64);
  await assert.rejects(f.owner.getCredentials(f.credentials(context)),{message:'ACCESS_DENIED'});
  assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
 }finally{f.scope.abort();}
});

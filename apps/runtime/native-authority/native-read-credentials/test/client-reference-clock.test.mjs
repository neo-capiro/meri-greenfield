import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {ownerFixture} from './fixture.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';

test('a legitimate delayed reference-reader start stays within the outer observation window',async()=>{
 const clientId='a1234567-b123-4c12-8d12-e123456789ab',reference='Synthetic named client';
 const f=await ownerFixture('search_tracked_bills',{scene:nativeFamilyCase('tracked-bills','search_tracked_bills',{request:{clientId:reference}})});
 f.core.state.response=(value,path)=>path.endsWith('/clients/check-ref')?Response.json({ok:true,clientId},{status:201}):Response.json(value);
 const native=f.configuration.coreAuthority;
 const coreAuthority={...native,async readClientReference(call){f.state.now++;return native.readClientReference(call);}};
 const owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority}),started=f.now();
 try{const observation=JSON.parse(await owner.nativeReadContextPorts.readCurrent(f.proof()));assert.equal(observation.context.clientReference,reference);assert.equal(observation.expiresAtMs,started+3000);
  const repeated=JSON.parse(await owner.nativeReadContextPorts.readCurrent(f.proof()));assert.equal(repeated.expiresAtMs,observation.expiresAtMs);assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);
 }finally{f.scope.abort();}
});

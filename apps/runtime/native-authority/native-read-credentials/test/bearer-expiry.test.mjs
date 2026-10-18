/** A native bearer that carries its own authority expiry (`{credential, expiresAtMs}`, the live action session of RC1 option A)
 * bounds every later Core call and the credentials handed to the source transport; it is re-checked before dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture} from './fixture.mjs';

async function bearerOwner(getNativeCredential){
 const f=await ownerFixture('search_acquisition_personnel'),calls=[];
 const owner=createNativeReadCredentialOwner({...f.configuration,getNativeCredential:async request=>{calls.push(request);return getNativeCredential(calls.length,f);}});
 const context=async()=>JSON.parse(await owner.nativeReadContextPorts.readCurrent(f.proof()));
 return {f,owner,calls,context};
}

test('an object bearer caps the context and the transport credentials at its expiry',async()=>{
 const x=await bearerOwner((n,f)=>Object.freeze({credential:'SYNTHETIC_NATIVE',expiresAtMs:f.now()+5000}));
 try{
  const read=await x.context();assert.ok(read.expiresAtMs<=x.f.now()+5000);
  const credentials=await x.owner.getCredentials(x.f.credentials(read.context));
  assert.equal(credentials.bearerToken,'SYNTHETIC_NATIVE');assert.ok(credentials.expiresAtMs<=x.f.now()+5000,'transport deadline is the session expiry or earlier');
  assert.ok(x.f.core.state.nativeExpiry>x.f.now()+5000,'Core authority alone would have allowed longer');
 }finally{x.f.scope.abort();}
});

test('a string bearer keeps its existing semantics',async()=>{
 const x=await bearerOwner(()=>'SYNTHETIC_NATIVE');
 try{const read=await x.context(),credentials=await x.owner.getCredentials(x.f.credentials(read.context));assert.equal(credentials.bearerToken,'SYNTHETIC_NATIVE');}
 finally{x.f.scope.abort();}
});

for(const [label,issued] of [['that has expired',f=>({credential:'SYNTHETIC_NATIVE',expiresAtMs:f.now()})],['missing its expiry',()=>({credential:'SYNTHETIC_NATIVE'})],
 ['carrying extra fields',f=>({credential:'SYNTHETIC_NATIVE',expiresAtMs:f.now()+5000,extra:true})],['holding a malformed token',f=>({credential:'two words',expiresAtMs:f.now()+5000})]])
 test(`an object bearer ${label} refuses before any Core call`,async()=>{
  const x=await bearerOwner((n,f)=>issued(f));
  try{await assert.rejects(x.context());assert.equal(x.f.core.state.calls.length,0);}
  finally{x.f.scope.abort();}
 });

test('the bearer is re-checked before dispatch: a different credential at the final check is refused',async()=>{
 const x=await bearerOwner((n,f)=>({credential:n>=4?'SYNTHETIC_NATIVE_REPLACED':'SYNTHETIC_NATIVE',expiresAtMs:f.now()+5000}));
 try{
  const read=await x.context();assert.equal(x.calls.length,1);
  await assert.rejects(x.owner.getCredentials(x.f.credentials(read.context)),{message:'ACCESS_DENIED'});
  assert.equal(x.calls.length,4,'context, before, after, final');assert.equal(x.f.stateOwner.secrets,1);
 }finally{x.f.scope.abort();}
});

test('a bearer that expires at the final check is refused before dispatch',async()=>{
 const x=await bearerOwner((n,f)=>({credential:'SYNTHETIC_NATIVE',expiresAtMs:n>=4?f.now():f.now()+5000}));
 try{const read=await x.context();await assert.rejects(x.owner.getCredentials(x.f.credentials(read.context)));assert.equal(x.calls.length,4);}
 finally{x.f.scope.abort();}
});

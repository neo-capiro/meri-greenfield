/** SYNTHETIC: the memory credential broker over scripted secret files and a fake live-session relay. No file, session or Core. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMemoryCredentialBroker} from '../memory-credentials.mjs';
const NOW=1_760_000_000_000,CLIENT='00000000-0000-4000-8000-000000000901';
const files={'/run/cand/identity':'cand-identity','/run/cand/task':'cand-task','/run/cand/control':'cand-control','/run/cand/proxy':'cand-proxy','/run/memory/secret':'memory-secret-1'};
const configuration={nativeCandidate:{identity:{credentialFile:'/run/cand/identity'},taskCapabilityFile:'/run/cand/task',controlCapabilityFile:'/run/cand/control',proxyCredentialFile:'/run/cand/proxy'}};
const binding={tenantId:'t1',actorId:'a1',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002'};
const code=c=>e=>e?.code===c;
function setup({relay,now=()=>NOW}={}){
 const reads=[];const readSecret=async path=>{reads.push(path);if(!(path in files))throw Error('ENOENT');return Buffer.from(files[path]+'\n');};
 return {reads,broker:createMemoryCredentialBroker({configuration,serviceSecretFile:'/run/memory/secret',readSecret,now,...(relay?{nativeCredentials:relay}:{})})};
}
const call=(tenantId='t1',actorId='a1')=>({tenantId,actorId,purpose:'memory.submit',signal:undefined,deadlineMs:NOW+1000});

test('configuration: the secret file is never a candidate credential file, paths are absolute, the relay is a plain port',()=>{
 assert.throws(()=>createMemoryCredentialBroker({configuration,serviceSecretFile:'/run/cand/task',readSecret:async()=>Buffer.alloc(1)}),code('MEMORY_CREDENTIAL_CONFIGURATION'));
 assert.throws(()=>createMemoryCredentialBroker({configuration,serviceSecretFile:'relative',readSecret:async()=>Buffer.alloc(1)}),code('MEMORY_CREDENTIAL_CONFIGURATION'));
 assert.throws(()=>createMemoryCredentialBroker({configuration,serviceSecretFile:'/run/memory/secret',readSecret:async()=>Buffer.alloc(1),nativeCredentials:{}}),/INVALID_COMMAND|MEMORY_CREDENTIAL_CONFIGURATION/u);
 assert.equal(setup().broker.runAvailable,false);assert.equal(setup({relay:{nativeCredentialFor(){}}}).broker.runAvailable,true);
});

test('surface: the admitted bearer plus the secret re-read per call; a candidate credential, the secret itself, another identity or an expired admission refuses',async()=>{
 const t=setup();const get=t.broker.surface({tenantId:'t1',actorId:'a1',credential:'user-session',expiresAtMs:NOW+5000});
 assert.deepEqual(await get(call()),{tenantId:'t1',actorId:'a1',bearerToken:'user-session',serviceSecret:'memory-secret-1',expiresAtMs:NOW+5000});
 files['/run/memory/secret']='memory-secret-2';
 assert.equal((await get(call())).serviceSecret,'memory-secret-2','rotation without restart');
 assert.deepEqual(t.reads.filter(p=>p==='/run/memory/secret').length,2);assert.equal(t.reads.filter(p=>p.startsWith('/run/cand/')).length,4,'candidate digests are read once');
 await assert.rejects(get(call('t2','a1')),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'cand-control',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'memory-secret-2',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'user-session',expiresAtMs:NOW})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'bad token',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 // A secret file that now holds a candidate credential fails closed.
 files['/run/memory/secret']='cand-proxy';
 await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 files['/run/memory/secret']='memory-secret-1';
});

test('run: the live session credential for exactly this binding and client, looked up before and after the secret read; no session or a replaced one refuses',async()=>{
 let credential='session-1',lookups=0;
 const relay={nativeCredentialFor({binding:b,selectedClientId,signal}){lookups++;assert.deepEqual(b,binding);assert.equal(selectedClientId,CLIENT);assert.equal(signal,undefined);if(credential===null)throw Error('SESSION_UNAVAILABLE');return {credential,expiresAtMs:NOW+300000};}};
 const t=setup({relay});const get=t.broker.run({binding,selectedClientId:CLIENT});
 assert.deepEqual(await get(call()),{tenantId:'t1',actorId:'a1',bearerToken:'session-1',serviceSecret:'memory-secret-1',expiresAtMs:NOW+300000});
 assert.equal(lookups,2);
 await assert.rejects(get(call('t1','a2')),code('MEMORY_CREDENTIAL_REFUSED'));
 credential=null;await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 credential='cand-task';await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 // The session is replaced between the two lookups: the first bearer is not used.
 let n=0;const replacing={nativeCredentialFor(){n++;return {credential:n===1?'session-a':'session-b',expiresAtMs:NOW+1000};}};
 await assert.rejects(setup({relay:replacing}).broker.run({binding,selectedClientId:CLIENT})(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 assert.throws(()=>setup().broker.run({binding,selectedClientId:CLIENT}),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 assert.throws(()=>t.broker.run({binding:{tenantId:'t1'},selectedClientId:CLIENT}),code('MEMORY_CREDENTIAL_CONFIGURATION'));
 assert.throws(()=>t.broker.run({binding,selectedClientId:'client'}),code('MEMORY_CREDENTIAL_CONFIGURATION'));
 assert.equal(t.broker.selectedClientOf([{kind:'client',resourceId:CLIENT.toUpperCase()}]),CLIENT);
 assert.equal(t.broker.selectedClientOf([{kind:'client',resourceId:CLIENT},{kind:'tenant',resourceId:'t1'}]),null);
 assert.equal(t.broker.selectedClientOf([]),null);
});

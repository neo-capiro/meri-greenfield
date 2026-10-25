/** SYNTHETIC: the memory credential broker over scripted secret files and a fake live-session relay. No file, session or Core. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createMemoryCredentialBroker} from '../memory-credentials.mjs';
const NOW=1_760_000_000_000,CLIENT='00000000-0000-4000-8000-000000000901';
const configuration={nativeCandidate:{identity:{credentialFile:'/run/cand/identity'},taskCapabilityFile:'/run/cand/task',controlCapabilityFile:'/run/cand/control'}};
const binding={tenantId:'t1',actorId:'a1',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',
 attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
const clientScope={tenantId:'t1',kind:'client',resourceId:CLIENT,policyRevision:'policy-1'};
const privateScope={tenantId:'t1',kind:'private-user',resourceId:'a1',policyRevision:'policy-1'};
const selections=[{label:'client',scopes:[clientScope],selectedClientId:CLIENT},{label:'General',scopes:[privateScope],selectedClientId:null}];
const code=c=>e=>e?.code===c;
function setup({relay,now=()=>NOW,onRead}={}){
 const files={'/run/cand/identity':'cand-identity','/run/cand/task':'cand-task','/run/cand/control':'cand-control','/run/memory/secret':'memory-secret-1'};
 const reads=[];const readSecret=async path=>{reads.push(path);await onRead?.(path);if(!(path in files))throw Error('ENOENT');return Buffer.from(files[path]+'\n');};
 return {reads,files,broker:createMemoryCredentialBroker({configuration,serviceSecretFile:'/run/memory/secret',readSecret,now,...(relay?{nativeCredentials:relay}:{})})};
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
 t.files['/run/memory/secret']='memory-secret-2';
 assert.equal((await get(call())).serviceSecret,'memory-secret-2','rotation without restart');
 assert.deepEqual(t.reads.filter(p=>p==='/run/memory/secret').length,2);assert.equal(t.reads.filter(p=>p.startsWith('/run/cand/')).length,3,'candidate digests are read once');
 await assert.rejects(get(call('t2','a1')),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'cand-control',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'memory-secret-2',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'user-session',expiresAtMs:NOW})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(t.broker.surface({tenantId:'t1',actorId:'a1',credential:'bad token',expiresAtMs:NOW+5000})(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 // A secret file that now holds a candidate credential fails closed.
 t.files['/run/memory/secret']='cand-control';
 await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
});

for(const {label,scopes,selectedClientId} of selections)test(`run ${label}: explicit native scope, live-session lookup and rotating secret; missing, replaced or reserved credentials refuse`,async()=>{
 let credential='session-1',lookups=0;
 const relay={nativeCredentialFor({binding:b,selectedClientId:client,signal}){lookups++;assert.deepEqual(b,binding);assert.equal(client,selectedClientId);assert.equal(signal,undefined);if(credential===null)throw Error('SESSION_UNAVAILABLE');return {credential,expiresAtMs:NOW+300000};}};
 const t=setup({relay});const get=t.broker.run({binding,scopes,selectedClientId});
 assert.equal(lookups,0);assert.equal(t.reads.length,0,'composition does not read credentials');
 assert.deepEqual(await get(call()),{tenantId:'t1',actorId:'a1',bearerToken:'session-1',serviceSecret:'memory-secret-1',expiresAtMs:NOW+300000});
 assert.equal(lookups,2);
 credential='session-2';t.files['/run/memory/secret']='memory-secret-2';
 assert.deepEqual(await get(call()),{tenantId:'t1',actorId:'a1',bearerToken:'session-2',serviceSecret:'memory-secret-2',expiresAtMs:NOW+300000},'neither bearer nor service secret is cached');
 await assert.rejects(get(call('t1','a2')),code('MEMORY_CREDENTIAL_REFUSED'));
 await assert.rejects(get(call('t2','a1')),code('MEMORY_CREDENTIAL_REFUSED'));
 credential=null;await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 for(const reserved of ['cand-identity','cand-task','cand-control','memory-secret-2']){
  credential=reserved;await assert.rejects(get(call()),code('MEMORY_CREDENTIAL_REFUSED'));
 }
 // The secret read itself replaces the live session; the earlier bearer cannot escape.
 let current='session-before';const replacing={nativeCredentialFor(){return {credential:current,expiresAtMs:NOW+1000};}};
 const replaced=setup({relay:replacing,onRead:path=>{if(path==='/run/memory/secret')current='session-after';}});
 await assert.rejects(replaced.broker.run({binding,scopes,selectedClientId})(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 assert.throws(()=>setup().broker.run({binding,scopes,selectedClientId}),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
});

test('run selection: missing, ambiguous, foreign and malformed scopes refuse before any relay or secret read',()=>{
 let lookups=0;const t=setup({relay:{nativeCredentialFor(){lookups++;return {credential:'session',expiresAtMs:NOW+1000};}}});
 const valid={binding,scopes:[privateScope],selectedClientId:null};
 const invalid=[
  {binding,selectedClientId:null},{binding,scopes:[privateScope]},
  {...valid,selectedClientId:undefined},{...valid,scopes:[]},{...valid,scopes:[clientScope]},
  {...valid,scopes:[privateScope,clientScope]},{...valid,scopes:[privateScope,privateScope]},
  {...valid,scopes:[{...privateScope,resourceId:'other-actor'}]},
  {...valid,scopes:[{...privateScope,tenantId:'other-tenant'}]},
  {...valid,scopes:[{...privateScope,kind:'tenant'}]},
  {...valid,binding:{tenantId:'t1'}},{...valid,selectedClientId:'client'},
  {...valid,selectedClientId:CLIENT},{binding,scopes:[{...clientScope,resourceId:binding.runId}],selectedClientId:CLIENT},
  {binding,scopes:[{...clientScope,tenantId:'other-tenant'}],selectedClientId:CLIENT},
  {binding,scopes:[clientScope,{...privateScope,policyRevision:'policy-2'}],selectedClientId:CLIENT},
 ];
 for(const value of invalid)assert.throws(()=>t.broker.run(value),code('MEMORY_CREDENTIAL_CONFIGURATION'));
 assert.equal(lookups,0);assert.deepEqual(t.reads,[]);
});

test('run selection pins a snapshot; later caller mutation cannot switch the borrowed session',async()=>{
 const selected=structuredClone({binding,scopes:[privateScope],selectedClientId:null}),seen=[];
 const t=setup({relay:{nativeCredentialFor(value){seen.push(value);return {credential:'session',expiresAtMs:NOW+1000};}}});
 const get=t.broker.run(selected);
 selected.binding.actorId='other-actor';selected.scopes[0].resourceId='other-actor';selected.selectedClientId=CLIENT;
 await get(call());assert.equal(seen.length,2);
 for(const value of seen){assert.deepEqual(value.binding,binding);assert.equal(value.selectedClientId,null);assert.equal(Object.isFrozen(value.binding),true);}
});

for(const {label,scopes,selectedClientId} of selections)test(`run ${label}: expiry during secret read refuses and successful expiry is the tighter session bound`,async()=>{
 let at=NOW,lookups=0;
 const relay={nativeCredentialFor(){lookups++;return {credential:'session',expiresAtMs:NOW+1000};}};
 const t=setup({relay,now:()=>at,onRead:path=>{if(path==='/run/memory/secret')at=NOW+1000;}});
 await assert.rejects(t.broker.run({binding,scopes,selectedClientId})(call()),code('MEMORY_CREDENTIAL_UNAVAILABLE'));
 assert.equal(lookups,2);
 let n=0;const bounded=setup({relay:{nativeCredentialFor(){return {credential:'session',expiresAtMs:NOW+(++n===1?2000:1000)};}}});
 assert.equal((await bounded.broker.run({binding,scopes,selectedClientId})(call())).expiresAtMs,NOW+1000);
});

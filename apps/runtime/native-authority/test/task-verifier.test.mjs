import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resources,NOW,listenFetch} from './task-verifier-fixture.mjs';
import {createAdmittedTaskAuthority} from '../admitted-task-authority.mjs';
import {createNativeTaskAuthority} from '../task-authority.mjs';import {createNativeCapabilityClient} from '../../native-client.mjs';
import {createDurableSdkSessionOwner} from '../session-owner.mjs';import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeSdkSessionClient} from '../session-client.mjs';import {createNativeSdkSessionApplication} from '../session-http.mjs';
import {isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),control='synthetic-existing-control';
async function setup(t,{enabled=true,operations=['load','runner/session/register','runner/session/append','runner/session/load'],lease=NOW+8000}={}){
 const r=await resources();
 const config={pool:r.pool,allocationJson:JSON.stringify(r.f.allocation),grantFactsJsons:[JSON.stringify(r.f.context())],grantId:r.f.invocation.grantId,identity:r.identity,operations,callerCapabilitySha256:sha(control),binding:r.binding,expiresAtMs:lease,limits:{maxRequestMs:1000,maxFactBytes:65536},enabled,now:r.f.now};
 const supervisor=createAdmittedTaskAuthority(config);t.after(()=>supervisor.close());
 return {...r,config,supervisor,key:{projectKey:'native SDK opaque project key',sessionId:'11111111-1111-4111-8111-000000000005'}};
}
const verify=(x,extra={})=>x.supervisor.taskVerifier.verify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:hash({binding:x.binding}),...extra});
test('actual native authorization HTTP/client returns canonical task receipt with original authority expiry',async t=>{
 const x=await setup(t),listener=await listenFetch(x.supervisor.application);t.after(()=>listener.close());
 const native=createNativeCapabilityClient({configuration:{origin:listener.origin,maxResponseBytes:131072},credential:control,now:x.f.now});
 const authority=createNativeTaskAuthority({native,enabled:true,now:x.f.now,maxRequestMs:1000});
 const receipt=await authority.verify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:hash({binding:x.binding})});
 assert.deepEqual(receipt.binding,x.binding);assert.equal(receipt.identityCredential,x.identity.credential);assert.equal(receipt.expiresAtMs,NOW+8000,'request1000ms must not shorten original authority lease');
 assert.equal(receipt.scopes[0].resourceId,x.clientId);assert.equal(x.reads.filter(s=>s.startsWith('BEGIN ISOLATION')).length,1,'one read-only admitted-run snapshot per operation');assert.equal(x.authorityCalls(),0);assert.equal(x.reads.some(s=>s.includes('FOR UPDATE')),false);assert.equal(x.f.commands.length,0,'verification has no writes/locking transaction');
 const worker=await fetch(listener.origin+'/v1/worker/authorize',{method:'POST',headers:{authorization:'Bearer '+x.f.credential,'content-type':'application/json'},body:JSON.stringify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:'a'.repeat(64)})});assert.equal(worker.status,403);assert.equal((await worker.text()).includes(x.identity.credential),false);
});
test('a refused task stays refused over HTTP and never reaches Core',async t=>{
 const x=await setup(t),listener=await listenFetch(x.supervisor.application);t.after(()=>listener.close());
 const native=createNativeCapabilityClient({configuration:{origin:listener.origin,maxResponseBytes:131072},credential:control,now:x.f.now});
 const authority=createNativeTaskAuthority({native,enabled:true,now:x.f.now,maxRequestMs:1000}),input={capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:hash({binding:x.binding})};
 x.setHook(()=>{throw new TypeError('fetch failed');});
 assert.deepEqual((await authority.verify(input)).binding,x.binding,'an unreachable Core does not matter once the run is admitted');
 x.f.state().grant.state='REVOKED';
 await assert.rejects(authority.verify(input),e=>e.code==='WORKER_AUTHORITY_REFUSED'&&!isAuthorityUnavailable(e));assert.equal(x.authorityCalls(),0);
});
test('foreign capability/binding, unsupported operation and hostile input refuse before SQL/native reads',async t=>{
 const x=await setup(t);for(const extra of [{capability:'wrong'},{binding:{...x.binding,writerFence:9}},{operation:'publish'},{inputSha256:'x'}])await assert.rejects(verify(x,extra));
 let getters=0;await assert.rejects(x.supervisor.taskVerifier.verify({get capability(){getters++;return x.f.credential;},binding:x.binding,operation:'load',inputSha256:'a'.repeat(64)}));assert.equal(getters,0);assert.equal(x.reads.length,0);assert.equal(x.authorityCalls(),0);
});
test('committed task revocation, qualification fence, terminal run and expiry prevent a receipt',async t=>{
 for(const kind of ['revoked','fence','terminal','expiry']){const x=await setup(t);if(kind==='revoked')x.f.state().grant.state='REVOKED';if(kind==='fence')x.f.state().run.fence++;if(kind==='terminal')x.run.state='completed';if(kind==='expiry')x.f.state().grant.expires_at=new Date(NOW);await assert.rejects(verify(x));assert.equal(x.authorityCalls(),0);}
});

test('financial quarantine is not a model run/session authorization dependency',async t=>{
 const x=await setup(t);x.f.state().budget.quarantined=true;assert.deepEqual((await verify(x)).binding,x.binding);
 assert.equal(x.reads.some(sql=>sql.includes('.budget ')||sql.includes('tool_run_allocations')),false);
});
test('an admitted run authorizes every runner operation from local facts with zero Core calls',async t=>{
 const x=await setup(t);
 for(const operation of ['load','runner/session/register','runner/session/append','runner/session/load']){
  const receipt=await verify(x,{operation});assert.equal(receipt.operation,operation);assert.deepEqual(receipt.binding,x.binding);
  assert.equal(receipt.selectedClientId,x.clientId);assert.deepEqual(receipt.scopes,[{kind:'client',tenantId:x.binding.tenantId,resourceId:x.clientId,policyRevision:receipt.policyRevision}]);
  assert.ok(receipt.expiresAtMs<=NOW+8000&&receipt.expiresAtMs>NOW);
 }
 assert.equal(x.authorityCalls(),0,'no Core identity, context or /current call after admission');
});
test('a cancelled or expired run, a wrong capability or a wrong binding is refused without Core',async t=>{
 const cases={cancelled:x=>{x.f.state().grant.state='REVOKED';},expired:x=>{x.f.state().grant.expires_at=new Date(NOW);},capability:()=>({capability:'another-task-capability'}),
  binding:x=>({binding:{...x.binding,runId:'11111111-1111-4111-8111-000000000099'}}),fence:x=>({binding:{...x.binding,writerFence:x.binding.writerFence+1}}),operation:()=>({operation:'runner/session/list-subkeys'})};
 for(const [name,change] of Object.entries(cases)){const x=await setup(t);await verify(x);const extra=change(x)??{};
  await assert.rejects(verify(x,extra),e=>e.code==='NATIVE_TASK_REFUSED'&&!isAuthorityUnavailable(e),name);assert.equal(x.authorityCalls(),0,name);}
});
test('held canonical run can refresh verifier without reacquiring mutation locks',async t=>{
 const x=await setup(t);let inside;
 await x.supervisor.admission.withCurrentRun({binding:x.binding},async()=>{const begin=x.reads.length;inside=await verify(x);assert.equal(x.reads.slice(begin).some(s=>s.includes('FOR UPDATE')||s.includes('pg_advisory')),false);});assert.deepEqual(inside.binding,x.binding);assert.ok(x.reads.some(s=>s.startsWith('SELECT * FROM meri_conversations.runs ')&&s.endsWith('FOR UPDATE')));assert.equal(x.reads.some(s=>s.includes('.budget ')),false);
});
test('canonical durable session owner uses native HTTP verifier inside locked SQL effect',async t=>{
 const x=await setup(t),nativeListener=await listenFetch(x.supervisor.application);t.after(()=>nativeListener.close());
 const native=createNativeCapabilityClient({configuration:{origin:nativeListener.origin,maxResponseBytes:131072},credential:control,now:x.f.now}),authority=createNativeTaskAuthority({native,enabled:true,now:x.f.now,maxRequestMs:1000});
 const owner=createDurableSdkSessionOwner({admission:x.supervisor.admission,authority,enabled:true,now:x.f.now,maxRequestMs:1000}),sessionListener=await listenFetch(createNativeSdkSessionApplication({owner,now:x.f.now,maxRequestMs:1000}));t.after(()=>sessionListener.close());
 const client=createNativeSdkSessionClient({origin:'https://session.synthetic.invalid',credential:x.f.credential,binding:x.binding,now:x.f.now,maxRequestMs:1000,fetchImpl:(url,options)=>fetch(sessionListener.origin+new URL(url).pathname,options)});
 assert.equal((await client.register({key:x.key})).registered,true);
 const entries=[{type:'system',marker:'actual canonical handler with synthetic SQL resources'}];await client.append({key:x.key,appendId:'11111111-1111-4111-8111-000000000090',expectedOffset:0,entriesSha256:hash(entries),entries});assert.deepEqual((await client.load({key:x.key})).entries,entries);
 x.f.state().grant.state='REVOKED';await assert.rejects(client.load({key:x.key}));assert.equal(x.journal.state().entries.length,1);
});
test('disabled composition, canceled request and shared task/control hash cannot authorize',async t=>{
 const x=await setup(t,{enabled:false});await assert.rejects(verify(x));assert.equal(x.reads.length,0);
 const y=await setup(t);assert.throws(()=>createAdmittedTaskAuthority({...y.config,callerCapabilitySha256:y.f.invocation.capabilitySha256}));
 await assert.rejects(verify(y,{signal:AbortSignal.abort()}));assert.equal(y.reads.length,0);
});
test('closing admitted task authority refuses subsequent session reads before SQL',async t=>{
 const x=await setup(t),owner=createDurableSdkSessionOwner({admission:x.supervisor.admission,authority:x.supervisor.taskVerifier,enabled:true,now:x.f.now});
 const request={binding:x.binding,key:x.key};await owner.register({credential:x.f.credential,request});
 assert.deepEqual(x.journal.state().owner.owner.binding,x.binding);assert.equal(x.journal.state().owner.owner.expiresAtMs,NOW+8000);
 assert.equal(Object.hasOwn(x.journal.state().owner.owner,'observationId'),false);
 await x.supervisor.close();const calls=x.reads.length;await assert.rejects(owner.load({credential:x.f.credential,request}));assert.equal(x.reads.length,calls);
});
test('close aborts a parked authorization snapshot without dispatching a process',async t=>{
 const x=await setup(t),entered=Promise.withResolvers(),release=Promise.withResolvers();x.setSqlHook(async sql=>{if(sql.startsWith('SELECT * FROM meri_conversations.conversations')){entered.resolve();await release.promise;}});
 const pending=assert.rejects(verify(x));await entered.promise;await x.supervisor.close();release.resolve();await pending;
 assert.equal(x.authorityCalls(),0);assert.equal(x.reads.some(sql=>sql.startsWith('INSERT')||sql.startsWith('UPDATE')),false);
});

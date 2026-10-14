import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {realpathSync,readFileSync} from 'node:fs';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {resources,NOW,listenFetch} from './task-verifier-fixture.mjs';
import {createAdmittedSessionSupervisor} from '../admitted-supervisor.mjs';
import {createNativeTaskAuthority} from '../task-authority.mjs';import {createNativeCapabilityClient} from '../../native-client.mjs';
import {createDurableSdkSessionOwner} from '../session-owner.mjs';import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeSdkSessionClient} from '../session-client.mjs';import {createNativeSdkSessionApplication} from '../session-http.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),control='synthetic-existing-control';
async function setup(t,{enabled=true,operations=['load','runner/session/register','runner/session/append','runner/session/load'],lease=NOW+8000}={}){
 const r=await resources(),root=await mkdtemp(join(tmpdir(),'meri-task-author-')),workspace=join(root,'workspace'),configDirectory=join(root,'config');await Promise.all([mkdir(workspace),mkdir(configDirectory)]);
 const command=realpathSync(process.execPath),env={CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory},args=[new URL('./launcher-child.mjs',import.meta.url).pathname,workspace,configDirectory,'11111111-1111-4111-8111-000000000005','normal'];
 const launchConfiguration={binding:r.binding,workspace,configDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs:lease,executableSha256:sha(readFileSync(command)),launch:{command,args,env},enabled,now:r.f.now,shutdownMs:300};
 const config={pool:r.pool,allocationJson:JSON.stringify(r.f.allocation),grantFactsJsons:[JSON.stringify(r.f.context())],grantId:r.f.invocation.grantId,identity:r.identity,operations,callerCapabilitySha256:sha(control),launchConfiguration,limits:{maxRequestMs:1000,maxFactBytes:65536},enabled,now:r.f.now};
 const supervisor=createAdmittedSessionSupervisor(config);t.after(async()=>{await supervisor.close();await rm(root,{recursive:true,force:true});});
 return {...r,config,supervisor,launchConfiguration,request:{command,args:[...args],cwd:workspace,env:{...env}},key:{projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:'11111111-1111-4111-8111-000000000005'}};
}
const verify=(x,extra={})=>x.supervisor.taskVerifier.verify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:hash({binding:x.binding}),...extra});
test('actual native authorization HTTP/client returns canonical task receipt with original authority expiry',async t=>{
 const x=await setup(t),listener=await listenFetch(x.supervisor.application);t.after(()=>listener.close());
 const native=createNativeCapabilityClient({configuration:{origin:listener.origin,maxResponseBytes:131072},credential:control,now:x.f.now});
 const authority=createNativeTaskAuthority({native,enabled:true,now:x.f.now,maxRequestMs:1000});
 const receipt=await authority.verify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:hash({binding:x.binding})});
 assert.deepEqual(receipt.binding,x.binding);assert.equal(receipt.identityCredential,x.identity.credential);assert.equal(receipt.expiresAtMs,NOW+8000,'request1000ms must not shorten original authority lease');
 assert.equal(receipt.scopes[0].resourceId,x.clientId);assert.ok(x.reads.filter(s=>s.startsWith('BEGIN ISOLATION')).length>=4);assert.equal(x.reads.some(s=>s.includes('FOR UPDATE')),false);assert.equal(x.f.commands.length,0,'verification has no writes/locking transaction');
 const worker=await fetch(listener.origin+'/v1/worker/authorize',{method:'POST',headers:{authorization:'Bearer '+x.f.credential,'content-type':'application/json'},body:JSON.stringify({capability:x.f.credential,binding:x.binding,operation:'load',inputSha256:'a'.repeat(64)})});assert.equal(worker.status,403);assert.equal((await worker.text()).includes(x.identity.credential),false);
});
test('foreign capability/binding, unsupported operation and hostile input refuse before SQL/native reads',async t=>{
 const x=await setup(t);for(const extra of [{capability:'wrong'},{binding:{...x.binding,writerFence:9}},{operation:'publish'},{inputSha256:'x'}])await assert.rejects(verify(x,extra));
 let getters=0;await assert.rejects(x.supervisor.taskVerifier.verify({get capability(){getters++;return x.f.credential;},binding:x.binding,operation:'load',inputSha256:'a'.repeat(64)}));assert.equal(getters,0);assert.equal(x.reads.length,0);assert.equal(x.authorityCalls(),0);
});
test('committed grant revocation/fence/quarantine/expiry prevents receipt and launch preparation',async t=>{
 for(const kind of ['revoked','fence','quarantine','expiry']){const x=await setup(t);if(kind==='revoked')x.f.state().grant.state='REVOKED';if(kind==='fence')x.f.state().run.fence++;if(kind==='quarantine')x.f.state().budget.quarantined=true;if(kind==='expiry')x.f.state().grant.expires_at=new Date(NOW);await assert.rejects(verify(x));await assert.rejects(x.supervisor.prepareLaunch({capability:x.f.credential}));assert.equal(x.supervisor.status().launcher,null);}
});
test('revocation committed during native context await is caught by a fresh later snapshot',async t=>{
 const x=await setup(t);x.setHook(url=>{if(url.endsWith('/context'))x.f.state().grant.state='REVOKED';});await assert.rejects(verify(x));assert.equal(x.authorityCalls(),2);assert.equal(x.f.state().grant.state,'REVOKED');
});
test('held canonical allocation can refresh verifier without reacquiring budget row lock',async t=>{
 const x=await setup(t);let inside;
 await x.supervisor.admission.withCurrentAllocation({binding:x.binding},async()=>{const begin=x.reads.length;inside=await verify(x);assert.equal(x.reads.slice(begin).some(s=>s.includes('FOR UPDATE')),false);});assert.deepEqual(inside.binding,x.binding);assert.ok(x.reads.some(s=>s==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE'));
});
test('canonical durable session owner uses native HTTP verifier inside locked SQL effect',async t=>{
 const x=await setup(t),nativeListener=await listenFetch(x.supervisor.application);t.after(()=>nativeListener.close());
 const native=createNativeCapabilityClient({configuration:{origin:nativeListener.origin,maxResponseBytes:131072},credential:control,now:x.f.now}),authority=createNativeTaskAuthority({native,enabled:true,now:x.f.now,maxRequestMs:1000});
 const registration={async read(){return {binding:x.binding,key:x.key,sdkVersion:'0.3.295',cliVersion:'2.1.295',observationId:'explicit-synthetic-observation',sessionEventSha256:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+7000};}};
 const owner=createDurableSdkSessionOwner({admission:x.supervisor.admission,authority,registration,enabled:true,now:x.f.now,maxRequestMs:1000}),sessionListener=await listenFetch(createNativeSdkSessionApplication({owner,now:x.f.now,maxRequestMs:1000}));t.after(()=>sessionListener.close());
 const client=createNativeSdkSessionClient({origin:'https://session.synthetic.invalid',credential:x.f.credential,binding:x.binding,now:x.f.now,maxRequestMs:1000,fetchImpl:(url,options)=>fetch(sessionListener.origin+new URL(url).pathname,options)});
 assert.equal((await client.register({key:x.key})).registered,true);
 const entries=[{type:'system',marker:'actual canonical handler with synthetic SQL resources'}];await client.append({key:x.key,appendId:'11111111-1111-4111-8111-000000000090',expectedOffset:0,entriesSha256:hash(entries),entries});assert.deepEqual((await client.load({key:x.key})).entries,entries);
 x.f.state().grant.state='REVOKED';await assert.rejects(client.load({key:x.key}));assert.equal(x.journal.state().entries.length,1);
});
test('admitted preparation preserves immutable launch plan and narrows original lease before real spawn',async t=>{
 const x=await setup(t);x.launchConfiguration.workspace='/tmp/worker-change';x.launchConfiguration.launch.args.push('worker-change');
 const launcher=await x.supervisor.prepareLaunch({capability:x.f.credential});assert.equal(launcher.status().used,false);const child=launcher.spawnClaudeCodeProcess(x.request),chunks=[];child.stdout.on('data',c=>chunks.push(c));const receipt=launcher.registration.read({binding:x.binding,key:x.key});child.stdin.write('emit\n');assert.deepEqual((await receipt).binding,x.binding);assert.equal(launcher.status().process.physicalStopProven,false);await assert.rejects(x.supervisor.prepareLaunch({capability:x.f.credential}));await x.supervisor.close();assert.equal(launcher.status().process.physicalStopProven,true);
});
test('disabled composition, canceled preparation and shared task/control hash cannot allocate',async t=>{
 const x=await setup(t,{enabled:false});await assert.rejects(verify(x));await assert.rejects(x.supervisor.prepareLaunch({capability:x.f.credential}));assert.equal(x.reads.length,0);
 const y=await setup(t);assert.throws(()=>createAdmittedSessionSupervisor({...y.config,callerCapabilitySha256:y.f.invocation.capabilitySha256}));
 const abort=new AbortController();abort.abort();await assert.rejects(y.supervisor.prepareLaunch({capability:y.f.credential,signal:abort.signal}));assert.equal(y.supervisor.status().launcher,null);
});
test('compiled production ports bind admitted real child registration to canonical persistence owner',async t=>{
 const x=await setup(t),launcher=await x.supervisor.prepareLaunch({capability:x.f.credential}),child=launcher.spawnClaudeCodeProcess(x.request);child.stdout.resume();child.stdin.write('emit\n');
 const owner=x.supervisor.productPorts.sdkSessionOwner,app=createNativeSdkSessionApplication({owner,now:x.f.now,maxRequestMs:1000}),listener=await listenFetch(app);t.after(()=>listener.close());
 const client=createNativeSdkSessionClient({origin:'https://session.synthetic.invalid',credential:x.f.credential,binding:x.binding,now:x.f.now,maxRequestMs:1000,fetchImpl:(url,options)=>fetch(listener.origin+new URL(url).pathname,options)});
 assert.equal((await client.register({key:x.key})).registered,true);assert.notEqual(x.journal.state().owner.owner.observationId,'explicit-synthetic-observation');assert.deepEqual(x.journal.state().owner.owner.binding,x.binding);assert.equal(x.journal.state().owner.owner.expiresAtMs,NOW+8000);
 await x.supervisor.close();assert.equal(launcher.status().process.physicalStopProven,true);const calls=x.reads.length;await assert.rejects(client.load({key:x.key}));assert.equal(x.reads.length,calls);
});
test('supervisor close aborts parked launch preparation before any native context or process dispatch',async t=>{
 const x=await setup(t),entered=Promise.withResolvers();x.setHook(()=>{entered.resolve();return new Promise(()=>{});});
 const preparing=x.supervisor.prepareLaunch({capability:x.f.credential});await entered.promise;await x.supervisor.close();await assert.rejects(preparing);assert.equal(x.supervisor.status().launcher,null);assert.equal(x.authorityCalls(),1);
});

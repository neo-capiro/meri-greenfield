import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {realpath,readFile,mkdtemp,mkdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;if(!root)throw Error('MERI_REVIEW_SOURCE_ROOT required');
const {resources,NOW,listenFetch}=await import(root+'/apps/runtime/native-authority/test/task-verifier-fixture.mjs');
const {createAdmittedSessionSupervisor}=await import(root+'/apps/runtime/native-authority/admitted-supervisor.mjs');
const {canonicalSha256:hash}=await import(root+'/packages/contracts/validate.mjs');
const sha=x=>createHash('sha256').update(x).digest('hex'),control='independent-existing-control';
async function fixture(t){
 const r=await resources(),dir=await mkdtemp(join(tmpdir(),'meri-independent-task-')),workspace=join(dir,'workspace'),configDirectory=join(dir,'config');await mkdir(workspace);await mkdir(configDirectory);
 const command=await realpath(process.execPath),env={CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory},session='11111111-1111-4111-8111-000000000088';
 const launch={command,args:[new URL('./native-child.mjs',import.meta.url).pathname,workspace,configDirectory,session],env};
 const launchConfiguration={binding:r.binding,workspace,configDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs:NOW+8000,executableSha256:sha(await readFile(command)),launch,enabled:true,now:r.f.now,shutdownMs:500};
 const config={pool:r.pool,allocationJson:JSON.stringify(r.f.allocation),grantFactsJsons:[JSON.stringify(r.f.context())],grantId:r.f.invocation.grantId,identity:r.identity,operations:['load','runner/session/register','runner/session/load'],callerCapabilitySha256:sha(control),launchConfiguration,limits:{maxRequestMs:1000,maxFactBytes:65536},enabled:true,now:r.f.now};
 const supervisor=createAdmittedSessionSupervisor(config);t.after(async()=>{try{await supervisor.close();}finally{await rm(dir,{recursive:true,force:true});}});
 return {...r,config,supervisor,key:{projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:session},request:{...launch,args:[...launch.args],env:{...env},cwd:workspace}};
}
const verify=(f,extra={})=>f.supervisor.taskVerifier.verify({capability:f.f.credential,binding:f.binding,operation:'load',inputSha256:hash({binding:f.binding}),...extra});
test('all configured task grant hashes are forbidden as trusted-control caller',async t=>{
 const f=await fixture(t),additional={...f.f.context(),grantId:'11111111-1111-4111-8111-000000000099',capabilitySha256:sha('independent-other-task-grant')};
 assert.throws(()=>createAdmittedSessionSupervisor({...f.config,grantFactsJsons:[...f.config.grantFactsJsons,JSON.stringify(additional)],callerCapabilitySha256:additional.capabilitySha256}));assert.equal(f.reads.length,0);assert.equal(f.authorityCalls(),0);
});
test('hostile command context accessors and proxy execute no traps',async t=>{
 const f=await fixture(t);let traps=0;const accessor={get binding(){traps++;return f.binding;},clientResolution:f.identity.commandContext.clientResolution};
 const proxy=new Proxy(f.identity.commandContext,{get(){traps++;throw Error('trap');},ownKeys(){traps++;throw Error('trap');}});
 for(const commandContext of [accessor,proxy])assert.throws(()=>createAdmittedSessionSupervisor({...f.config,identity:{...f.identity,commandContext}}));assert.equal(traps,0);assert.equal(f.reads.length,0);
});
test('native original expiry narrows authorization while request deadline does not renew or shorten it',async t=>{
 const f=await fixture(t),original=f.identity.fetchImpl;
 const identity={...f.identity,async fetchImpl(...args){const response=await original(...args),body=await response.json();return Response.json({...body,expiresAtMs:NOW+2200});}};
 const supervisor=createAdmittedSessionSupervisor({...f.config,identity});t.after(()=>supervisor.close());
 const input={capability:f.f.credential,binding:f.binding,operation:'load',inputSha256:hash({binding:f.binding}),deadlineMs:NOW+100};
 const receipt=await supervisor.taskVerifier.verify(input);assert.equal(receipt.expiresAtMs,NOW+2200);assert.notEqual(receipt.identityCredential,f.f.credential);
 const launcher=await supervisor.prepareLaunch({capability:f.f.credential});const child=launcher.spawnClaudeCodeProcess(f.request);child.stdout.resume();child.stdin.write('observe\n');const witness=await launcher.registration.read({binding:f.binding,key:f.key});assert.equal(witness.expiresAtMs,NOW+2200);await supervisor.close();assert.equal(launcher.status().process.physicalStopProven,true);
});
test('constructed operation allowlist and launch plan are snapshots despite caller mutation',async t=>{
 const f=await fixture(t);f.config.operations.push('publish');f.config.launchConfiguration.launch.args.push('mutated');f.config.launchConfiguration.launch.env.CLAUDE_CONFIG_DIR='/tmp/mutated';
 await assert.rejects(verify(f,{operation:'publish'}));assert.equal(f.reads.length,0);
 const launcher=await f.supervisor.prepareLaunch({capability:f.f.credential});const child=launcher.spawnClaudeCodeProcess(f.request);child.stdout.resume();child.stdin.write('observe\n');assert.deepEqual((await launcher.registration.read({binding:f.binding,key:f.key})).binding,f.binding);await assert.rejects(f.supervisor.prepareLaunch({capability:f.f.credential}));
});
test('supervisor close aborts pending native preparation and subsequent verification dispatch',async t=>{
 const f=await fixture(t),entered=Promise.withResolvers();let observedSignal;
 f.setHook((_url,options)=>{observedSignal=options.signal;entered.resolve();return new Promise(()=>{});});const pending=f.supervisor.prepareLaunch({capability:f.f.credential});const rejected=assert.rejects(pending);await entered.promise;await f.supervisor.close();await rejected;assert.equal(observedSignal.aborted,true);assert.equal(f.supervisor.status().launcher,null);const count=f.authorityCalls();await assert.rejects(verify(f));assert.equal(f.authorityCalls(),count);
});
test('actual protected HTTP refuses worker caller and caller-added authority body fields',async t=>{
 const f=await fixture(t),listener=await listenFetch(f.supervisor.application);t.after(()=>listener.close());
 const input={capability:f.f.credential,binding:f.binding,operation:'load',inputSha256:'a'.repeat(64)};
 for(const [token,body] of [[f.f.credential,input],[control,{...input,identityCredential:f.identity.credential}],[control,{...input,scopes:[]}],[control,{...input,capability:'foreign'}]]){
  const response=await fetch(listener.origin+'/v1/worker/authorize',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,403);assert.equal((await response.text()).includes(f.identity.credential),false);
 }assert.equal(f.reads.length,0);assert.equal(f.authorityCalls(),0);
 const good=await fetch(listener.origin+'/v1/worker/authorize',{method:'POST',headers:{authorization:'Bearer '+control,'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');assert.equal((await good.json()).inputSha256,input.inputSha256);
});
test('verifier snapshots inside held canonical lease contain no row locks or effects',async t=>{
 const f=await fixture(t);await f.supervisor.admission.withCurrentAllocation({binding:f.binding},async()=>{
  const began=f.reads.length;assert.deepEqual((await verify(f)).binding,f.binding);const sql=f.reads.slice(began);assert.equal(sql.filter(s=>s==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY').length,4);assert.equal(sql.some(s=>s.includes('FOR UPDATE')),false);assert.equal(sql.some(s=>/^(INSERT|UPDATE|DELETE)/u.test(s)),false);assert.equal(sql.filter(s=>s==='COMMIT').length,4);
 });assert.ok(f.reads.some(s=>s.includes('FOR UPDATE')));
});
test('changed admitted facts between native reads refuse receipt without restoring revoked state',async t=>{
 const f=await fixture(t);f.setHook(url=>{if(url.endsWith('/context'))f.f.state().budget.quarantined=true;});await assert.rejects(verify(f));assert.equal(f.f.state().budget.quarantined,true);assert.equal(f.authorityCalls(),2);assert.equal(f.supervisor.status().launcher,null);
});

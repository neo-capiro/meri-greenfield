import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,symlinkSync,existsSync,statSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {materializeRunnerBootstrap,releaseRunnerBootstrap,parseExpectedBootstrap} from '../runner-bootstrap-files.mjs';
const binding=()=>({tenantId:'tenant-a',actorId:'actor-a',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1});
const versions={sdk:'0.1.0',cli:'2.1.295',imageDigest:'sha256:'+'a'.repeat(64)};
function fixture(t){const root=mkdtempSync(join(tmpdir(),'meri-bootstrap-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const b=binding(),ca=Buffer.from('-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----\n'),now=1_800_000_000_000;
 const expected={binding:b,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'b'.repeat(32),taskRevision:7,expiresAtMs:now+600000,versions,origin:'https://run-1.synthetic.invalid:8443',caSha256:createHash('sha256').update(ca).digest('hex')};
 const config={binding:b,versions,bootstrap:{expiresAtMs:expected.expiresAtMs,remote:true},proxyOrigin:'https://proxy.synthetic.invalid',workspace:'/workspace/'+b.conversationId,captureOwnsClose:true};
 const calls=[];const delivery={async fetch(q){calls.push(q);return {binding:b,taskArn:expected.taskArn,taskRevision:7,expiresAtMs:expected.expiresAtMs,versions,origin:expected.origin,capability:'synthetic-capability-'+b.runId,config,ca:ca.toString('base64')};}};
 return {root,b,ca,now,expected,config,delivery,calls,directory:join(root,'run-'+b.runId)};}
test('a correlated delivery materializes three fresh owner-only files in a directory this module created; release removes exactly those',async t=>{
 const f=fixture(t),r=await materializeRunnerBootstrap({directory:f.directory,delivery:f.delivery,expected:f.expected,now:()=>f.now});
 for(const p of [r.capabilityFile,r.configFile,r.caFile]){const st=statSync(p);assert.equal(st.mode&0o777,0o600);assert.equal(st.uid,process.getuid());}
 assert.equal(statSync(f.directory).mode&0o777,0o700);assert.equal(readFileSync(r.capabilityFile,'utf8'),'synthetic-capability-'+f.b.runId);assert.deepEqual(JSON.parse(readFileSync(r.configFile,'utf8')).bootstrap,{expiresAtMs:f.expected.expiresAtMs,remote:true});assert.ok(readFileSync(r.caFile).equals(f.ca));
 assert.equal(r.receipt.files.length,3);assert.ok(r.receipt.files.every(x=>!('capability' in x)),'receipts carry sizes and hashes, never material');
 const {signal:_signal,...query}=f.calls[0];assert.deepEqual(query,{binding:f.b,taskArn:f.expected.taskArn,taskRevision:7});assert.ok(_signal instanceof AbortSignal);
 const released=await releaseRunnerBootstrap({directory:f.directory});assert.equal(released.removed,3);assert.equal(existsSync(f.directory),false);assert.deepEqual(await releaseRunnerBootstrap({directory:f.directory}),{removed:0},'release is idempotent');
});
test('wrong binding, task ARN, revision, expiry, versions, origin or CA refuse and leave nothing behind; a pre-existing or linked directory refuses',async t=>{
 const f=fixture(t);const variants={binding:d=>({...d,binding:{...d.binding,runId:randomUUID()}}),taskArn:d=>({...d,taskArn:d.taskArn.slice(0,-1)+'c'}),taskRevision:d=>({...d,taskRevision:8}),expiresAtMs:d=>({...d,expiresAtMs:d.expiresAtMs+1}),versions:d=>({...d,versions:{...versions,cli:'2.1.296'}}),origin:d=>({...d,origin:'https://other.synthetic.invalid'}),ca:d=>({...d,ca:Buffer.from('other').toString('base64')}),capability:d=>({...d,capability:'has space'})};
 for(const [name,mutate] of Object.entries(variants)){const delivery={async fetch(q){return mutate(await f.delivery.fetch(q));}};await assert.rejects(materializeRunnerBootstrap({directory:f.directory,delivery,expected:f.expected,now:()=>f.now}),/RUNNER_BOOTSTRAP_(CORRELATION|CA|CAPABILITY)_REFUSED/,name);assert.equal(existsSync(f.directory),false,name+': nothing left behind');}
 mkdirSync(f.directory);await assert.rejects(materializeRunnerBootstrap({directory:f.directory,delivery:f.delivery,expected:f.expected,now:()=>f.now}),/RUNNER_BOOTSTRAP_DIRECTORY_EXISTS/);rmSync(f.directory,{recursive:true});
 symlinkSync(f.root,f.directory);await assert.rejects(materializeRunnerBootstrap({directory:f.directory,delivery:f.delivery,expected:f.expected,now:()=>f.now}),/RUNNER_BOOTSTRAP_DIRECTORY_EXISTS/,'a link at the target refuses');rmSync(f.directory);
 await assert.rejects(materializeRunnerBootstrap({directory:f.directory,delivery:f.delivery,expected:f.expected,now:()=>f.expected.expiresAtMs+1}),/RUNNER_BOOTSTRAP_EXPIRED/);
 assert.throws(()=>parseExpectedBootstrap({...f.expected,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/short'}),/RUNNER_BOOTSTRAP_EXPECTED_REFUSED/);
 assert.throws(()=>parseExpectedBootstrap({...f.expected,origin:'http://plain.invalid'}),/RUNNER_BOOTSTRAP_EXPECTED_REFUSED/);
});
test('release refuses foreign entries and links instead of deleting them; cancellation during delivery leaves no directory',async t=>{
 const f=fixture(t);await materializeRunnerBootstrap({directory:f.directory,delivery:f.delivery,expected:f.expected,now:()=>f.now});
 writeFileSync(join(f.directory,'foreign.txt'),'x');await assert.rejects(releaseRunnerBootstrap({directory:f.directory}),/RUNNER_BOOTSTRAP_FOREIGN_ENTRY/);assert.ok(existsSync(join(f.directory,'task-capability')),'owned files untouched when a foreign entry is present');
 rmSync(join(f.directory,'foreign.txt'));symlinkSync('/etc/hostname',join(f.directory,'control-ca.pem.link'));await assert.rejects(releaseRunnerBootstrap({directory:f.directory}),/RUNNER_BOOTSTRAP_FOREIGN_ENTRY/);rmSync(join(f.directory,'control-ca.pem.link'));
 assert.equal((await releaseRunnerBootstrap({directory:f.directory})).removed,3);
 const controller=new AbortController();const slow={async fetch(){controller.abort();await new Promise(()=>{});}};
 await assert.rejects(materializeRunnerBootstrap({directory:f.directory,delivery:slow,expected:f.expected,now:()=>f.now,signal:controller.signal}),/RUNNER_BOOTSTRAP_UNKNOWN/);assert.equal(existsSync(f.directory),false);
});

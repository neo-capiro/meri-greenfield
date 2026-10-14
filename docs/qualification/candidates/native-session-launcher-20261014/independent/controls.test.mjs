import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,realpath,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {createNativeSessionLauncher} from '../../../../../apps/runtime/native-authority/session-launcher.mjs';
const binding={tenantId:'independent-synthetic',actorId:'actor',conversationId:'11111111-1111-4111-8111-000000000001',runId:'11111111-1111-4111-8111-000000000002',attemptId:'11111111-1111-4111-8111-000000000003',workerId:'11111111-1111-4111-8111-000000000004',writerFence:1};
const session='11111111-1111-4111-8111-000000000005';
const bounded=(p,ms=2500)=>Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('independent deadline')),ms);t.unref();})]);
async function fixture(t,{mode='hold',lease=10000,signal,...overrides}={}){
 const root=await mkdtemp(join(tmpdir(),'meri-independent-launcher-'));const workspace=join(root,'workspace'),configDirectory=join(root,'config');await mkdir(workspace);await mkdir(configDirectory);
 const command=await realpath(process.execPath),executableSha256=createHash('sha256').update(await readFile(command)).digest('hex');
 const launch={command,args:[new URL('./native-child.mjs',import.meta.url).pathname,workspace,configDirectory,session,mode],env:{CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory}};
 const configuration={binding,workspace,configDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs:Date.now()+lease,executableSha256,launch,enabled:true,shutdownMs:1000,...(signal?{signal}:{}),...overrides};
 const launcher=createNativeSessionLauncher(configuration);let child;
 t.after(async()=>{try{const outcome=await bounded(launcher.close());if(child)assert.equal(outcome.physicalStopProven,true);}finally{await rm(root,{recursive:true,force:true});}});
 return {launcher,configuration,launch,key:{projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:session},spawn(request={}){return child=launcher.spawnClaudeCodeProcess({...launch,cwd:workspace,...request});}};
}
test('trusted immutable plan rejects changed argv and permits one actual spawn',async t=>{
 const f=await fixture(t);assert.throws(()=>f.spawn({args:[...f.launch.args,'changed']}));assert.equal(f.launcher.status().used,false);
 const child=f.spawn();assert.ok(child.pid>1);assert.throws(()=>f.spawn());assert.equal(f.launcher.status().used,true);
});
test('live real stream produces original lease witness and rejects changed binding',async t=>{
 const f=await fixture(t);const child=f.spawn();const chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stdin.write('frames\n');
 const witness=await f.launcher.registration.read({binding,key:f.key});assert.deepEqual(witness.binding,binding);assert.equal(witness.expiresAtMs,f.configuration.expiresAtMs);assert.equal(witness.cliVersion,'2.1.295');
 await assert.rejects(async()=>f.launcher.registration.read({binding:{...binding,writerFence:2},key:f.key}));assert.ok(Buffer.concat(chunks).includes(Buffer.from('independent synthetic child')));
 const outcome=await f.launcher.close();assert.equal(outcome.physicalStopProven,true);assert.equal(f.launcher.status().observer.pendingReads,0);await assert.rejects(async()=>f.launcher.registration.read({binding,key:f.key}));
});
test('expired lease physically retires child even without reads',async t=>{
 const f=await fixture(t,{lease:1500});f.spawn();const outcome=await bounded(f.launcher.completion());assert.equal(outcome.physicalStopProven,true);assert.equal(outcome.reason,'EXPIRED');
});
test('SDK signal cancellation retires group and registration',async t=>{
 const f=await fixture(t),controller=new AbortController();f.spawn({signal:controller.signal});controller.abort();const outcome=await bounded(f.launcher.completion());assert.equal(outcome.physicalStopProven,true);assert.equal(outcome.reason,'SDK_CANCELLED');
});
test('bad bytes invalidate read and cause physical retirement',async t=>{
 const f=await fixture(t);const child=f.spawn();child.stdout.on('error',()=>{});child.stdout.resume();child.stdin.write('bad\n');await assert.rejects(async()=>f.launcher.registration.read({binding,key:f.key}));assert.equal((await bounded(f.launcher.completion())).physicalStopProven,true);
});
test('disabled and wrong executable pin allocate no child',async t=>{
 const off=await fixture(t,{enabled:false});assert.throws(()=>off.spawn());assert.equal(off.launcher.status().used,false);
 const bad=await fixture(t,{executableSha256:'0'.repeat(64)});assert.throws(()=>bad.spawn());assert.equal(bad.launcher.status().used,false);
});
test('lease expiring during executable readback refuses before process allocation',async t=>{
 const started=Date.now();let clocks=0;
 const f=await fixture(t,{now:()=>++clocks<3?started:started+20000});assert.throws(()=>f.spawn());assert.equal(f.launcher.status().used,false);assert.equal(f.launcher.status().process,null);
});
test('provider account bearer environment is refused before allocation',async t=>{
 const f=await fixture(t);for(const name of ['ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION'])assert.throws(()=>createNativeSessionLauncher({...f.configuration,launch:{...f.launch,env:{...f.launch.env,[name]:'independent-forbidden-value'}}}));
});
test('stubborn child escalates SIGTERM to SIGKILL and proves group absence',async t=>{
 const f=await fixture(t,{mode:'stubborn'}),child=f.spawn();child.stdout.resume();child.stdin.write('frames\n');await f.launcher.registration.read({binding,key:f.key});
 const outcome=await bounded(f.launcher.close());assert.equal(outcome.physicalStopProven,true);assert.equal(outcome.signal,'SIGKILL');assert.equal(outcome.closed,true);
});
test('natural child completion preserves stdout buffered for slow SDK reader',async t=>{
 const f=await fixture(t,{mode:'natural'});const child=f.spawn();const iterator=child.stdout[Symbol.asyncIterator]();const first=await bounded(iterator.next());assert.equal(first.done,false);
 await new Promise(resolve=>setTimeout(resolve,120));let bytes=Buffer.from(first.value);for await(const chunk of {[Symbol.asyncIterator]:()=>iterator})bytes=Buffer.concat([bytes,chunk]);
 const frames=bytes.toString('utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(frames.map(f=>f.type),['system','transcript_mirror','result']);assert.equal((await bounded(f.launcher.completion())).physicalStopProven,true);
});

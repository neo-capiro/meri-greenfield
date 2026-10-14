import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {realpathSync,readFileSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {Writable} from 'node:stream';
import {createNativeSessionLauncher} from '../session-launcher.mjs';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function bounded(p,ms=2000){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TEST_TIMEOUT')),ms);})]);}finally{clearTimeout(timer);}}
async function until(check){const start=performance.now();while(!check()){if(performance.now()-start>1000)throw Error('TEST_TIMEOUT');await new Promise(resolve=>setImmediate(resolve));}}
async function fixture(t,{mode='normal',leaseMs=5000,signal,limits,shutdownMs=300,enabled=true}={}){
 const root=await mkdtemp(join(tmpdir(),'meri-launcher-author-')),workspace=join(root,'workspace'),configDirectory=join(root,'config');await Promise.all([mkdir(workspace),mkdir(configDirectory)]);
 const command=realpathSync(process.execPath),args=[new URL('./launcher-child.mjs',import.meta.url).pathname,workspace,configDirectory,id(5),mode];
 const env={CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory};
 let launcher;t.after(async()=>{if(launcher){await bounded(launcher.close());if(launcher.status().used)assert.equal(launcher.status().process.physicalStopProven,true);}await rm(root,{recursive:true,force:true});});
 const executableSha256=sha(readFileSync(command));
 const config={binding:structuredClone(binding),workspace,configDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs:Date.now()+leaseMs,executableSha256,launch:{command,args,env},enabled,shutdownMs,...(signal?{signal}:{}),...(limits?{limits}:{})};
 launcher=createNativeSessionLauncher(config);const request={command,args:[...args],cwd:workspace,env:{...env}},key={projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:id(5)};
 return {config,launcher,request,key,root};
}
test('owned genuine process bytes establish immutable receipt through readable SDK transport',async t=>{
 const x=await fixture(t),child=x.launcher.spawnClaudeCodeProcess(x.request),chunks=[];
 assert.equal(child.stdout instanceof Writable,false,'worker cannot write observation tap');
 const drain=(async()=>{for await(const chunk of child.stdout)chunks.push(chunk);})();
 const pending=x.launcher.registration.read({binding,key:x.key});child.stdin.write('emit\n');
 const receipt=await bounded(pending);assert.deepEqual(receipt.binding,binding);assert.deepEqual(receipt.key,x.key);assert.equal(receipt.expiresAtMs,x.config.expiresAtMs);
 await until(()=>chunks.length>0);const bytes=Buffer.concat(chunks),frames=bytes.toString().trimEnd().split('\n');
 assert.equal(receipt.sessionEventSha256,sha(Buffer.concat([Buffer.from('native-init\n'),Buffer.from(frames[0]),Buffer.from('\nnative-main-mirror\n'),Buffer.from(frames[1])])));
 assert.equal(child.exitCode,null);assert.equal(x.launcher.status().process.physicalStopProven,false);
 child.stdin.write('exit\n');await bounded(drain);const done=await bounded(x.launcher.completion());assert.equal(done.code,0);assert.equal(done.signal,null);assert.equal(done.physicalStopProven,true);
 await assert.rejects(async()=>x.launcher.registration.read({binding,key:x.key}));
});
test('altered SDK inputs and second spawn refuse, original compiled data survives caller mutation',async t=>{
 const x=await fixture(t);for(const request of [{...x.request,cwd:'/tmp'},{...x.request,args:[...x.request.args,'worker-change']},{...x.request,env:{...x.request.env,INJECT:'yes'}}])assert.throws(()=>x.launcher.spawnClaudeCodeProcess(request));
 assert.equal(x.launcher.status().used,false);x.config.launch.args.push('later');x.config.launch.env.INJECT='later';x.config.binding.writerFence=9;
 const child=x.launcher.spawnClaudeCodeProcess(x.request);child.stdout.resume();assert.throws(()=>x.launcher.spawnClaudeCodeProcess(x.request));await x.launcher.close();
});
test('hostile descriptors/proxies and bad pins fail before child allocation',async t=>{
 const x=await fixture(t);let traps=0;
 assert.throws(()=>createNativeSessionLauncher({...x.config,get binding(){traps++;return binding;}}));
 assert.throws(()=>createNativeSessionLauncher(new Proxy(x.config,{ownKeys(){traps++;return [];}})));assert.equal(traps,0);
 const bad=createNativeSessionLauncher({...x.config,executableSha256:'0'.repeat(64)});assert.throws(()=>bad.spawnClaudeCodeProcess(x.request),{code:'NATIVE_LAUNCH_PREFLIGHT'});assert.equal(bad.status().used,false);await bad.close();
 assert.throws(()=>createNativeSessionLauncher({...x.config,launch:{...x.config.launch,env:{...x.request.env,ANTHROPIC_API_KEY:'forbidden'}}}));
});
test('launch uses explicit environment without ambient inheritance',async t=>{
 const x=await fixture(t),before=process.env.MERI_LAUNCH_AMBIENT;process.env.MERI_LAUNCH_AMBIENT='ambient';
 try{const child=x.launcher.spawnClaudeCodeProcess(x.request),chunks=[];child.stdout.on('data',c=>chunks.push(c));child.stdin.write('env\n');await until(()=>chunks.length>0);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).ambient,null);}finally{if(before===undefined)delete process.env.MERI_LAUNCH_AMBIENT;else process.env.MERI_LAUNCH_AMBIENT=before;}
});
test('cancelled SDK request and disabled launcher allocate no child',async t=>{
 const x=await fixture(t),abort=new AbortController();abort.abort();assert.throws(()=>x.launcher.spawnClaudeCodeProcess({...x.request,signal:abort.signal}));assert.equal(x.launcher.status().used,false);
 const y=await fixture(t,{enabled:false});assert.throws(()=>y.launcher.spawnClaudeCodeProcess(y.request));assert.equal(y.launcher.status().used,false);
});
test('expiry with no stdout reads physically retires owned group and refuses registration',async t=>{
 const x=await fixture(t,{leaseMs:1500});x.launcher.spawnClaudeCodeProcess(x.request);const done=await bounded(x.launcher.completion());assert.equal(done.reason,'EXPIRED');assert.equal(done.physicalStopProven,true);await assert.rejects(async()=>x.launcher.registration.read({binding,key:x.key}));
});
test('supervisor cancellation retires pending registration and closes exactly owned group',async t=>{
 const abort=new AbortController(),x=await fixture(t,{signal:abort.signal}),child=x.launcher.spawnClaudeCodeProcess(x.request);child.stdout.resume();const pending=x.launcher.registration.read({binding,key:x.key});abort.abort();await assert.rejects(pending);const done=await bounded(x.launcher.completion());assert.equal(done.reason,'CANCELLED');assert.equal(done.physicalStopProven,true);assert.equal(x.launcher.status().observer.pendingReads,0);assert.deepEqual(await x.launcher.close(),await x.launcher.close());
});
test('malformed native stream retires owned child rather than merely refusing receipts',async t=>{
 const x=await fixture(t,{mode:'bad'}),child=x.launcher.spawnClaudeCodeProcess(x.request);child.stdout.resume();child.stdin.write('emit\n');const done=await bounded(x.launcher.completion());assert.equal(done.reason,'STREAM_ERROR');assert.equal(done.physicalStopProven,true);assert.equal(x.launcher.status().observer.refused,true);
});

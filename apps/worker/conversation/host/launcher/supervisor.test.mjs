import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,enabledPolicy,installation} from '../../browser/test/fixtures.mjs';
import {browserPaths} from '../../browser/workspace.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createHostLauncher,startConfinedLocalRelay} from './supervisor.mjs';
import {createSdkLaunchGate} from './sdk-quiescence.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+300000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(6),
 conversationId:binding.conversationId,hostId:allocation.hostId};
const policySha256='a'.repeat(64);
const readCurrent=async()=>({allocation,binding,policySha256,phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+1000});
const authority={policySha256,readCurrent,maxFreshMs:2000};
const proof=kind=>({verified:true,kind,allocationSha256:canonicalSha256(allocation),bindingSha256:canonicalSha256(binding),
 namespacePath:`/run/netns/${kind}-ns`,namespaceDev:'42',namespaceIno:'84',localRelays:kind==='sdk'?
 [{name:'model-proxy',localPort:42001,hostAddress:'198.18.0.1',hostRelayPort:44001},
  {name:'control',localPort:42002,hostAddress:'198.18.0.1',hostRelayPort:44002}]:
 [{name:'browser-http',localPort:3128,hostAddress:'198.18.0.1',hostRelayPort:44003}]});
const network=kind=>({plan:{kind,namespaceName:`${kind}-ns`,routes:kind==='browser'?[{name:'browser-http',localPort:3128}]:
 [{name:'model-proxy',localPort:42001},{name:'control',localPort:42002}]},proof:proof(kind),verify:async()=>proof(kind)});
const env={ANTHROPIC_BASE_URL:'https://127.0.0.1:42001/',ANTHROPIC_AUTH_TOKEN:'short-lived-synthetic',
 CLAUDE_CONFIG_DIR:'/tmp/sdk-config',CLAUDE_SECURESTORAGE_CONFIG_DIR:'/tmp/sdk-secure',
 CLAUDE_CODE_MAX_OUTPUT_TOKENS:'8192',MAX_THINKING_TOKENS:'0',
 NODE_EXTRA_CA_CERTS:'/run/meri/poststart/bootstrap/control-ca.pem'};
const sdkDescriptor={command:'/opt/meri/node',args:['/opt/meri/cli.js'],cwd:'/tmp/run',env};
class Child extends EventEmitter {
 constructor(pid,mode){super();this.pid=pid;this.exitCode=null;this.signalCode=null;
  this.stdin=new PassThrough();this.stdout=new PassThrough();this.stderr=new PassThrough();
  this.stdio=[this.stdin,this.stdout,this.stderr,new PassThrough(),new PassThrough(),new PassThrough()];
  this.stdio[4].on('data',value=>{this.go=(this.go??'')+value.toString();});
  queueMicrotask(()=>this.stdio[3].write(mode==='broker'?'L\n':'R\n'));
 }
 kill(signal){this.signalCode=signal;this.stdio[3].end();this.emit('exit',null,signal);return true;}
}
function fixture(overrides={}){
 const children=[],calls=[];let pid=300;
 const spawnNative=(command,args,options)=>{calls.push({command,args,options});const child=new Child(++pid,args[0]);children.push(child);return child;};
 const launcher=createHostLauncher({allocation,binding,hostIdentity,helperPath:'/opt/meri/bin/meri-host-launcher',
  shimPath:'/opt/meri/bin/meri-mcp-shim',sdkNetwork:network('sdk'),browserNetwork:network('browser'),
  authorities:[authority],sdkUid:2001,sdkGid:2001,browserUid:2002,browserGid:2002,
  validateSdkDescriptor:x=>x,onSdkPrepared:async value=>{calls.push({prepared:'sdk',...value});},
  onBrowserPrepared:async value=>{calls.push({prepared:'browser',...value});},spawnNative,
  sdkLaunchGate:createSdkLaunchGate(),
  readSocketDirectory:async()=>({uid:0,gid:2001,mode:0o40710}),...overrides});
 return {launcher,children,calls};
}
test('single existing SDK Query process client pauses exact descriptor before GO and refuses a second client',async()=>{
 const f=fixture();const client=f.launcher.createSdkProcessClient();
 assert.throws(()=>f.launcher.createSdkProcessClient(),/HOST_LAUNCH_REFUSED/);
 const process=client.spawnClaudeCodeProcess({...sdkDescriptor,signal:new AbortController().signal});
 assert.equal(f.children.length,0);
 await client.startPreparedProcess();
 assert.equal(f.children.length,1);assert.equal(f.children[0].go,'G');
 assert.equal(f.calls[0].args[0],'run');assert.equal(f.calls[0].args[4],'sdk');
 assert.equal(f.calls[0].options.env.ANTHROPIC_AUTH_TOKEN,'short-lived-synthetic');
 assert.equal(f.calls[1].prepared,'sdk');assert.equal(f.calls[1].sdkLeaderPid,f.children[0].pid);
 assert.equal(process.killed,false);
 await client.close();assert.equal(process.killed,true);
});
test('SDK descriptor cannot add host credentials and failed preexec observer never releases GO',async()=>{
 const f=fixture({onSdkPrepared:async()=>{throw Error('arm failed');}}),client=f.launcher.createSdkProcessClient();
 assert.throws(()=>client.spawnClaudeCodeProcess({...sdkDescriptor,env:{...env,AWS_ACCESS_KEY_ID:'bad'}}),/HOST_LAUNCH_ENV_REFUSED/);
 // A refused descriptor cannot be retried on the same one-use client.
 await f.launcher.close();
 const g=fixture({onSdkPrepared:async()=>{throw Error('arm failed');}}),other=g.launcher.createSdkProcessClient();
 other.spawnClaudeCodeProcess(sdkDescriptor);
 await assert.rejects(other.startPreparedProcess(),/arm failed/);
 assert.notEqual(g.children[0].go,'G');assert.equal(g.children[0].signalCode,'SIGKILL');
});
test('conversation SDK requires exact TLS loopback model relay and pinned CA before any native spawn',async()=>{
 for(const changes of [{ANTHROPIC_BASE_URL:'https://proxy.example/'},
  {ANTHROPIC_BASE_URL:'https://127.0.0.1:42002/'},{NODE_EXTRA_CA_CERTS:'/tmp/ca.pem'},
  {NODE_EXTRA_CA_CERTS:undefined}]){
  const f=fixture(),client=f.launcher.createSdkProcessClient();
  const changed={...env,...changes};if(changes.NODE_EXTRA_CA_CERTS===undefined)delete changed.NODE_EXTRA_CA_CERTS;
  client.spawnClaudeCodeProcess({...sdkDescriptor,env:changed});
  await assert.rejects(client.startPreparedProcess(),/HOST_LAUNCH_MODEL_ROUTE_REFUSED/);
  assert.equal(f.children.length,0);
 }
});
test('readiness bwrap probe uses the paused native SDK path without model relay credential',async()=>{
 const native=[];const f=fixture({sdkMode:'readiness',probeCommand:'/opt/bin/bwrap',probeNodePath:'/opt/node',
  spawnNative:(command,args,options)=>{native.push({command,args,options});const child=new Child(601,'run');
   child.stdio[4].on('data',()=>setImmediate(()=>{child.exitCode=0;child.emit('exit',0,null);}));return child;}});
 const {namespaceProbeArgs}=await import('../../sandbox-readiness/readiness.mjs');
 assert.equal(await f.launcher.runReadinessProbe('/opt/bin/bwrap',namespaceProbeArgs(true,'/opt/node')),true);
 assert.equal(native[0].args[4],'sdk');assert.deepEqual(native[0].options.env,{});
 assert.equal(await f.launcher.runReadinessProbe('/opt/bin/sh',[]).catch(error=>error.code),'HOST_LAUNCH_PROBE_REFUSED');
 await f.launcher.close();
});
test('browser broker exposes only bound one-shot shim and waits for browser observer before GO',async()=>{
 const f=fixture(),cwd=`/tmp/${binding.conversationId}`,paths=browserPaths(cwd);
 const held=await f.launcher.prepareBrowserBroker({policy:enabledPolicy(),installation,paths});
 assert.deepEqual(held.descriptor,f.launcher.descriptor);
 assert.equal(held.descriptor.socketPath,`/run/meri-launch/${canonicalSha256(binding)}.sock`);
 assert.equal(f.calls[0].args[0],'broker');assert.equal(f.calls[0].options.env&&Object.keys(f.calls[0].options.env).length,0);
 assert.ok(f.calls[0].args.includes('/opt/scripted/@playwright/mcp/cli.js'));
 assert.ok(!Object.values(held.descriptor).join(' ').includes('/opt/scripted/node'));
 f.children[0].stdio[3].write('R 400\n');await held.failure;
 assert.equal(f.calls.at(-1).prepared,'browser');assert.equal(f.children[0].go,'G');
 await held.close();
});
test('browser broker receives only the one prepared SDK leader PID over private fd before accepting shim',async()=>{
 const f=fixture(),paths=browserPaths(`/tmp/${binding.conversationId}`);
 await f.launcher.prepareBrowserBroker({policy:enabledPolicy(),installation,paths});
 let leader='';f.children[0].stdio[5].on('data',chunk=>{leader+=chunk.toString();});
 const client=f.launcher.createSdkProcessClient();client.spawnClaudeCodeProcess(sdkDescriptor);
 await client.startPreparedProcess();
 assert.equal(leader,`${f.children[1].pid}\n`);
 assert.equal(f.calls[0].options.stdio.length,6);
 await f.launcher.close();
});
test('relay helper uses separate exact cgroup, no environment and two authority checks',async()=>{
 const children=[],calls=[];const handle=await startConfinedLocalRelay({allocation,binding,hostIdentity,
  helperPath:'/opt/meri/bin/meri-host-launcher',networkProof:proof('sdk'),kind:'sdk',
  command:'/opt/meri/node',args:['/opt/meri/relay.mjs'],cwd:'/tmp/run',uid:2003,gid:2003,
  authorize:async()=>{calls.push('authorize');},spawnNative:(command,args,options)=>{calls.push({command,args,options});
   const child=new Child(501,'run');children.push(child);return child;}});
 assert.equal(calls.filter(value=>value==='authorize').length,2);
 assert.equal(calls[1].args[4],'relay-sdk');assert.deepEqual(calls[1].options.env,{});
 assert.equal(children[0].go,'G');assert.deepEqual(await handle.close(),{closed:true});
});
test('close during SDK preexec callback stops the owned child before acknowledging cleanup',async()=>{
 let entered;const ready=new Promise(resolve=>{entered=resolve;});
 const f=fixture({onSdkPrepared:async()=>{entered();return new Promise(()=>{});}}),client=f.launcher.createSdkProcessClient();
 client.spawnClaudeCodeProcess(sdkDescriptor);
 const starting=client.startPreparedProcess();starting.catch(()=>{});await ready;
 const closed=await f.launcher.close();
 assert.deepEqual(closed,{closed:true,processAbsenceProven:false});
 assert.equal(f.children[0].signalCode,'SIGKILL');assert.notEqual(f.children[0].go,'G');
 await assert.rejects(starting,/HOST_LAUNCH_UNKNOWN|HOST_LAUNCH_CANCELLED/);
});

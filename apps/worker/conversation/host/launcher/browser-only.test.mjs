/** Scripted native child/authority ports; not Linux confinement qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createBrowserOnlyHostLauncher} from './supervisor.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,installation,enabledPolicy} from '../../browser/test/fixtures.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';

const {launch,...contextInstallation}=installation,policy=validateBrowserPolicy(enabledPolicy()),policySha256=canonicalSha256(policy);
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostMode:'browser-only',
 hostId:'00000000-0000-4000-8000-000000000002',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+300000};
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:'00000000-0000-4000-8000-000000000003',conversationId:binding.conversationId,hostId:allocation.hostId};
const paths={root:'/workspace/'+binding.conversationId+'/.browser'};
for(const key of ['home','profile','output'])paths[key]=paths.root+'/'+key;
class Child extends EventEmitter{
 constructor(){super();this.pid=301;this.exitCode=null;this.signalCode=null;this.stdin=new PassThrough();this.stdout=new PassThrough();this.stderr=new PassThrough();this.stdio=[this.stdin,this.stdout,this.stderr,new PassThrough(),new PassThrough()];this.go='';this.stdio[4].on('data',chunk=>{this.go+=chunk;});queueMicrotask(()=>this.stdio[3].write('R\n'));}
 kill(signal){this.signalCode=signal;this.emit('exit',null,signal);return true;}
}
function fixture(overrides={}){
 const events=[],calls=[],children=[];let current=true;
 const proof={verified:true,kind:'browser',allocationSha256:canonicalSha256(allocation),bindingSha256:canonicalSha256(binding),namespacePath:'/run/netns/browser-ns',namespaceDev:'42',namespaceIno:'84',localRelays:[{name:'browser-http',localPort:3128,hostAddress:'198.18.0.1',hostRelayPort:44003}]};
 const args={allocation,binding,hostIdentity,helperPath:'/opt/meri/bin/meri-host-launcher',browserUid:2002,browserGid:2002,
  browserNetwork:{plan:{kind:'browser',namespaceName:'browser-ns',routes:[{name:'browser-http',localPort:3128}]},proof,verify:async()=>{events.push('network');return proof;}},
  authority:{policySha256,maxFreshMs:1000,readCurrent:async()=>{events.push('current');if(!current)throw Error('revoked');return {allocation,binding,policySha256,phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+500};}},
  onBrowserPrepared:async({leaderPid,kind,...rest})=>{assert.equal(leaderPid,301);assert.equal(kind,'browser');assert.deepEqual(rest,{});assert.equal(children[0].go,'');events.push('observer');},
  spawnNative:(command,args,options)=>{calls.push({command,args,options});const child=new Child();children.push(child);return child;},...overrides};
 return {launcher:createBrowserOnlyHostLauncher(args),events,calls,children,args,revoke:()=>{current=false;}};
}
const prepare=launcher=>launcher.prepareBrowserContext({policy,installation:contextInstallation,paths});
const linuxOnly={skip:process.platform!=='linux'?'Requires the image-pinned Linux executable path; no Windows path substitution.':false};

test('browser-only launcher uses existing READY/observer/currentness/GO without SDK route, shim or environment',linuxOnly,async()=>{
 const f=fixture(),native=await prepare(f.launcher);
 assert.deepEqual(f.events,['network','current','observer','network','current']);
 assert.equal(f.children[0].go,'G');assert.equal(f.calls.length,1);assert.equal(f.calls[0].args[4],'browser');assert.deepEqual(f.calls[0].options.env,{});
 assert.deepEqual(native.installation,contextInstallation);assert.equal(native.readable,f.children[0].stdout);
 assert.deepEqual(Object.keys(f.launcher).sort(),['close','prepareBrowserContext','signal']);
 await assert.rejects(prepare(f.launcher),/HOST_LAUNCH_REFUSED/);
 assert.deepEqual(await native.close(),{closed:true,processAbsenceProven:false});assert.equal(f.children[0].signalCode,'SIGKILL');
});

test('failed browser preexec observer never releases GO and closes the owned child',linuxOnly,async()=>{
 const f=fixture({onBrowserPrepared:async()=>{throw Error('workspace unproved');}});
 await assert.rejects(prepare(f.launcher),/workspace unproved/);
 assert.equal(f.children[0].go,'');assert.equal(f.children[0].signalCode,'SIGKILL');
});

test('revoked authority before GO stops the child and a foreign policy never spawns',linuxOnly,async()=>{
 let f;f=fixture({onBrowserPrepared:async()=>{f.revoke();}});
 await assert.rejects(prepare(f.launcher),/revoked/);assert.equal(f.children[0].go,'');assert.equal(f.children[0].signalCode,'SIGKILL');
 const g=fixture();await assert.rejects(g.launcher.prepareBrowserContext({policy:validateBrowserPolicy(enabledPolicy({tools:['browser_snapshot']})),installation:contextInstallation,paths}),/HOST_LAUNCH_CONFIGURATION/);
 assert.equal(g.calls.length,0);await g.launcher.close();
});

test('closed browser owner rejects SDK/provider configuration and never restarts after cancellation',async()=>{
 const controller=new AbortController(),f=fixture({signal:controller.signal});
 for(const forbidden of ['sdkNetwork','sdkUid','model','validateSdkDescriptor','sdkLaunchGate'])assert.throws(()=>createBrowserOnlyHostLauncher({...f.args,[forbidden]:{}}));
 const {hostMode,...legacy}=allocation;assert.throws(()=>createBrowserOnlyHostLauncher({...f.args,allocation:legacy}),/HOST_LAUNCH_CONFIGURATION/);
 controller.abort();await assert.rejects(prepare(f.launcher),/HOST_LAUNCH_REFUSED/);assert.equal(f.calls.length,0);
 const g=fixture();await assert.rejects(g.launcher.prepareBrowserContext({policy,installation,paths}));assert.equal(g.calls.length,0);await g.launcher.close();
});

test('Windows cannot substitute a host executable path for the Linux browser child',{skip:process.platform!=='win32'},async()=>{
 const f=fixture();await assert.rejects(prepare(f.launcher),/HOST_LAUNCH_CONFIGURATION/);
 assert.equal(f.calls.length,0);await f.launcher.close();
});

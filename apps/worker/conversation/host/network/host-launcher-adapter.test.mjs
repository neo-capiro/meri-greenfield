import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createNetworkPlan} from './plan.mjs';
import {createNativeHostRelayPort} from './host-launcher-adapter.mjs';
import {HOST_RELAY_READY_SCHEMA} from './host-relay-entry.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:'tenant-a',conversationId:uuid(1),generation:1,
 hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1792425600000};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),
 workerId:uuid(5),writerFence:1};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(6),
 conversationId:allocation.conversationId,hostId:allocation.hostId};
const plan=createNetworkPlan({allocation,binding,kind:'browser',routes:[{name:'browser-http',localPort:41001,targetPort:41001}]});
const fault=code=>error=>error?.code===code;

function fixture({malformedReady=false,killFails=false}={}){
 const calls=[],group={identity:{dev:'10',ino:'20'},populated:true,
  kill(){calls.push('group.kill');if(killFails)throw Error('kill failed');this.populated=false;return {killed:true};},
  readEvents(){return `populated ${this.populated?1:0}\n`;},
  close(){calls.push('group.close');return {closed:true};}};
 class Child extends EventEmitter{
  constructor(args){super();this.pid=321;this.exitCode=null;this.signalCode=null;
   this.stdout=new PassThrough();this.stdio=[null,this.stdout,new PassThrough(),new PassThrough(),new PassThrough()];
   this.stdio[4].on('data',chunk=>{calls.push(`GO ${chunk.toString()}`);
    const config=JSON.parse(Buffer.from(args.at(-1),'base64url').toString());
    const ready={schema:HOST_RELAY_READY_SCHEMA,pid:this.pid,kind:config.kind,hostAddress:config.hostAddress,
     routes:config.routes.map((route,i)=>({name:route.name,port:44000+i}))};
    this.stdout.write(`${JSON.stringify(malformedReady?{...ready,pid:999}:ready)}\n`);
   });
   queueMicrotask(()=>this.stdio[3].write('R\n'));
  }
  kill(signal){calls.push(`leader.kill ${signal}`);this.signalCode=signal;queueMicrotask(()=>this.emit('exit',null,signal));return true;}
 }
 const port=createNativeHostRelayPort({allocation,binding,hostIdentity,helperPath:'/usr/local/bin/meri-host-relay-launcher',
  nodePath:'/usr/local/bin/node',uid:24011,gid:24012,forbiddenUids:[24001,24002,24003,24004],
  forbiddenGids:[24001,24002,24003,24004],authorize:async()=>{calls.push('authorize');},
  spawnNative:(file,args,options)=>{calls.push('spawn');assert.equal(file,'/usr/local/bin/meri-host-relay-launcher');
   assert.equal(options.cwd,'/');assert.deepEqual(options.env,{});assert.equal(args[5],'5');assert.equal(args[6],'55');
   return new Child(args);},openGroup:path=>{calls.push('openGroup');assert.equal(path,plan.hostRelayCgroupPath);return group;},
  readyMs:500,stopMs:500});
 return {port,calls,group};
}

test('host relay pins the native R/cgroup before GO and revokes the entire cgroup on close',async()=>{
 const f=fixture(),handle=await f.port({plan,hostNamespace:{namespaceDev:'5',namespaceIno:'55'}});
 assert.equal(handle.pid,321);assert.equal(handle.uid,24011);assert.equal(handle.gid,24012);
 assert.equal(handle.routes[0].port,44000);assert.equal(handle.verify().verified,true);
 assert.deepEqual(f.calls.slice(0,5),['authorize','spawn','openGroup','authorize','GO G']);
 assert.deepEqual(await handle.close(),{closed:true});
 assert.ok(f.calls.indexOf('group.kill')<f.calls.indexOf('leader.kill SIGKILL'));
 assert.ok(f.calls.includes('group.close'));assert.throws(()=>handle.verify(),fault('HOST_NETWORK_HOST_RELAY_UNKNOWN'));
});

test('malformed ready is killed through the pinned cgroup; failed cgroup kill is sticky UNKNOWN',async()=>{
 const bad=fixture({malformedReady:true});
 await assert.rejects(bad.port({plan,hostNamespace:{namespaceDev:'5',namespaceIno:'55'}}),fault('HOST_NETWORK_HOST_RELAY_UNKNOWN'));
 assert.ok(bad.calls.includes('group.kill'));assert.ok(bad.calls.includes('group.close'));
 const uncertain=fixture({killFails:true}),handle=await uncertain.port({plan,hostNamespace:{namespaceDev:'5',namespaceIno:'55'}});
 await assert.rejects(handle.close(),fault('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN'));
 assert.equal(uncertain.group.populated,true);
 assert.throws(()=>handle.revoke(),fault('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN'));
});

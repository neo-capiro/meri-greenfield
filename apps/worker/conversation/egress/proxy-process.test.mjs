import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {startProxyProcess} from './proxy-process.mjs';

/** A scripted child: records spawn options, answers GO with ready, forwards admissions, exits on close. */
function fakeSpawn({readyPort=4100,answerReady=true,exitOnClose=true}={}){
 const spawned=[];
 const spawnNode=(file,args,options)=>{
  const child=Object.assign(new EventEmitter(),{pid:4242,exitCode:null,signalCode:null,sent:[],
   send(m){child.sent.push(m);
    if(m.type==='go'&&answerReady)setImmediate(()=>child.emit('message',{type:'ready',port:readyPort}));
    if(m.type==='close'&&exitOnClose)setImmediate(()=>{child.emit('message',{type:'closed'});child.exitCode=0;child.emit('exit',0);});
    return true;},
   kill(signal){child.signalCode=signal;setImmediate(()=>child.emit('exit',null,signal));return true;}});
  spawned.push({file,args,options,child});return child;
 };
 return {spawnNode,spawned};
}
const base=(over={})=>({control:{async admitProxyRequest(request){return request.target==='https://example.com:443'?{ok:true,connect:{address:'93.184.215.14',port:443}}:{ok:false,code:'BROWSER_URL_NOT_PUBLIC'};}},
 nodePath:'/usr/local/bin/node',uid:3003,gid:3003,place:async()=>{},readyMs:500,stopMs:500,admitMs:500,...over});

test('the proxy child is spawned under the proxy identity with an empty environment, placed before GO, and admissions are answered by the parent control',async()=>{
 const {spawnNode,spawned}=fakeSpawn();const placed=[];const records=[];
 const proxy=await startProxyProcess(base({spawnNode,place:async pid=>{placed.push(pid);},onDecision:d=>records.push(d)}));
 const [s]=spawned;
 assert.equal(s.file,'/usr/local/bin/node');assert.ok(s.args[0].endsWith('proxy-child-entry.mjs'));
 assert.deepEqual([s.options.uid,s.options.gid,s.options.cwd,s.options.env,s.options.stdio],[3003,3003,'/',{},['ignore','ignore','ignore','ipc']]);
 assert.deepEqual(placed,[4242]);assert.equal(s.child.sent[0].type,'go');
 assert.deepEqual(proxy.ports,{http:4100});assert.equal(proxy.pid,4242);
 s.child.emit('message',{type:'admit',id:1,request:{method:'CONNECT',target:'https://example.com:443',headers:{}}});
 s.child.emit('message',{type:'admit',id:2,request:{method:'CONNECT',target:'https://10.0.0.5:443',headers:{}}});
 s.child.emit('message',{type:'record',decision:{kind:'connect',ok:true}});
 await new Promise(resolve=>setTimeout(resolve,20));
 const decisions=s.child.sent.filter(m=>m.type==='decision');
 assert.deepEqual(decisions,[{type:'decision',id:1,decision:{ok:true,connect:{address:'93.184.215.14',port:443}}},{type:'decision',id:2,decision:{ok:false,code:'BROWSER_URL_NOT_PUBLIC'}}]);
 assert.deepEqual(records,[{kind:'connect',ok:true}]);
 assert.deepEqual(await proxy.close(),{closed:true});assert.equal(s.child.sent.at(-1).type,'close');
 assert.deepEqual(await proxy.close(),{closed:true},'close settles once');
});
test('a failed placement or a child that never reports ready is killed before any listener is accepted',async()=>{
 const refused=fakeSpawn();
 await assert.rejects(startProxyProcess(base({spawnNode:refused.spawnNode,place:async()=>{throw Error('cgroup');}})),{code:'EGRESS_PROXY_PLACEMENT_UNKNOWN'});
 assert.equal(refused.spawned[0].child.signalCode,'SIGKILL');assert.equal(refused.spawned[0].child.sent.length,0,'GO is never sent');
 const silent=fakeSpawn({answerReady:false});
 await assert.rejects(startProxyProcess(base({spawnNode:silent.spawnNode})),{code:'EGRESS_PROXY_UNAVAILABLE'});
 assert.equal(silent.spawned[0].child.signalCode,'SIGKILL');
});
test('a control that throws answers the child with a refusal, and a stuck close ends in SIGKILL',async()=>{
 const {spawnNode,spawned}=fakeSpawn({exitOnClose:false});
 const proxy=await startProxyProcess(base({spawnNode,control:{async admitProxyRequest(){throw Error('control gone');}}}));
 spawned[0].child.emit('message',{type:'admit',id:7,request:{method:'GET',target:'http://example.com/',headers:{}}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(spawned[0].child.sent.filter(m=>m.type==='decision'),[{type:'decision',id:7,decision:{ok:false,code:'EGRESS_REFUSED'}}]);
 assert.deepEqual(await proxy.close(),{closed:true});assert.equal(spawned[0].child.signalCode,'SIGKILL');
});
test('the owner refuses a control without admission, a non-absolute node path, a privileged or shared identity and unbounded budgets',()=>{
 for(const bad of [{control:{}},{nodePath:'node'},{uid:0},{gid:70000},{place:undefined},{readyMs:50},{admitMs:60000}])
  assert.rejects(startProxyProcess(base({spawnNode:fakeSpawn().spawnNode,...bad})),{code:'EGRESS_PROXY_CONFIGURATION'});
});

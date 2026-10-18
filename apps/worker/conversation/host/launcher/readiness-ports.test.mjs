import test from 'node:test';
import assert from 'node:assert/strict';
import {createConfinedReadinessPorts,prepareSdkReadinessDirectory} from './readiness-ports.mjs';

test('trusted temp preparation grants SDK only traverse on root and private owned children',()=>{
 const path='/tmp/meri-sandbox-readiness-Ab12Cd/workspace-Zy98Xw',root='/tmp/meri-sandbox-readiness-Ab12Cd';
 const entries=new Map([[root,{uid:0,gid:0,mode:0o40700}],[path,{uid:0,gid:0,mode:0o40700}]]);
 const fs={realpath:value=>value,stat:value=>({...entries.get(value),isDirectory:()=>true}),
  chown(value,uid,gid){Object.assign(entries.get(value),{uid,gid});},
  chmod(value,mode){entries.get(value).mode=0o40000|mode;}};
 assert.equal(prepareSdkReadinessDirectory(path,2001,2001,fs),path);
 assert.deepEqual(entries.get(root),{uid:0,gid:2001,mode:0o40710});
 assert.deepEqual(entries.get(path),{uid:2001,gid:2001,mode:0o40700});
 assert.throws(()=>prepareSdkReadinessDirectory('/tmp/other',2001,2001,fs),/HOST_READINESS_PORT_REFUSED/);
});

test('canonical readiness calls cannot use direct host probes or unconfined SDK startup',async()=>{
 const calls=[];let sdkClose=0,clientClose=0,hostClose=0;
 const base={findExecutable:name=>`/opt/bin/${name}`,exists:()=>false,makeTempDir:()=>'/tmp/readiness',removeDir:()=>{},
  sdkVersion:'0.3.295',nodePath:'/opt/node',pathEnv:'/opt/bin',runProbe(){throw Error('UNCONFINED_PROBE');},
  query({options}){calls.push('sdk-query');
   return {async initializationResult(){calls.push('sdk-initialize');options.spawnClaudeCodeProcess({command:'/opt/node',args:['cli'],cwd:'/tmp',env:{}});
     return {ready:true};},async *[Symbol.asyncIterator](){},close(){sdkClose++;}};},
  close(){hostClose++;}};
 const client={spawnClaudeCodeProcess(){calls.push('native-sdk-bind');return {stdin:{},stdout:{}};},
  async startPreparedProcess(){calls.push('native-sdk-start');},async close(){clientClose++;}};
 const launcher={async runReadinessProbe(command,args){calls.push([command,args]);return true;},
  createSdkProcessClient(){calls.push('client-created');return client;},async close(){calls.push('launcher-close');}};
 const prepared=[];const ports=await createConfinedReadinessPorts({pathEnv:'/opt/bin',sdkUid:2001,sdkGid:2001,
  prepareDirectory:(path,uid,gid)=>{prepared.push({path,uid,gid});return path;},createBasePorts:async()=>base,
  makeLauncher:async pins=>{assert.deepEqual(pins,{probeCommand:'/opt/bin/bwrap',probeNodePath:'/opt/node'});return launcher;}});
 assert.equal(ports.makeTempDir('workspace'),'/tmp/readiness');
 assert.deepEqual(prepared,[{path:'/tmp/readiness',uid:2001,gid:2001}]);
 assert.equal(await ports.runProbe('/opt/bin/bwrap',['--unshare-all']),true);
 await assert.rejects(ports.runProbe('/opt/bin/sh',[]),/HOST_READINESS_PORT_REFUSED/);
 const q=ports.query({prompt:'held',options:{sandbox:{enabled:true}}});
 assert.deepEqual(await q.initializationResult(),{ready:true});
 assert.deepEqual(calls.slice(1,5),['client-created','sdk-query','sdk-initialize','native-sdk-bind']);
 assert.equal(calls[5],'native-sdk-start');
 q.close();await ports.close();
 assert.equal(sdkClose,1);assert.ok(clientClose>=1);assert.equal(hostClose,1);
});
test('missing native probe dependencies refuses preparation and closes borrowed host ports',async()=>{
 let closed=0;
 const base={findExecutable:name=>name==='socat'?'/opt/bin/socat':undefined,query(){throw Error('UNCONFINED_QUERY');},
  close(){closed++;},exists:()=>false,makeTempDir:()=>'',removeDir:()=>{},sdkVersion:'0.3.295',nodePath:'/opt/node'};
 await assert.rejects(createConfinedReadinessPorts({pathEnv:'/opt/bin',sdkUid:2001,sdkGid:2001,
  createBasePorts:async()=>base,
  makeLauncher:()=>{throw Error('SHOULD_NOT_START');}}),/HOST_READINESS_PORT_REFUSED/);
 assert.equal(closed,1);
});

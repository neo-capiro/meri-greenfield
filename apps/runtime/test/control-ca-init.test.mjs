import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,constants} from 'node:fs';
import {createHash,X509Certificate} from 'node:crypto';
import rdsLock from '../certs/rds-global-bundle.lock.json' with {type:'json'};

// Public committed roots only. All writes below use an in-memory filesystem.
const rdsBundle=readFileSync(new URL('../certs/rds-global-bundle.pem',import.meta.url));
const privateCa=Buffer.from(rdsBundle.toString('ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canary='synthetic-private-material-must-not-be-logged';
let cliState,ioState;

mock.module('../material-init.mjs',{namedExports:{
 parseStaticProductMaterialExpected:value=>{cliState.expected=value;return value;},
 async materializeStaticProductMaterial({expected,delivery}){
  cliState.order.push('materialize');assert.equal(expected,cliState.expected);
  assert.equal(Object.hasOwn(cliState.environment,'MERI_STATIC_MATERIAL_BUNDLE'),false);
  const bundle=await delivery.fetch({signal:new AbortController().signal});
  assert.deepEqual(bundle,{files:[{base64:canary}]});
  await cliState.beforeMaterialized?.();cliState.order.push('materialized');
  return {configurationPath:'/run/meri/control.json',receipt:cliState.receipt};
 },
 async releaseStaticProductMaterial(receipt){
  assert.equal(receipt,cliState.receipt);cliState.order.push('release');await cliState.release?.();
 }
}});
mock.module('../control-ca-bundle.mjs',{namedExports:{
 async materializeControlCaBundle(input){
  assert.deepEqual(input,{configurationPath:'/run/meri/control.json',expected:cliState.expected});
  cliState.order.push('composite');await cliState.composite?.();
 }
}});
const {runMaterialInitCli}=await import('../material-init-cli.mjs');

function cli(role='control'){
 const state={expected:{role},receipt:Object.freeze({role,fileCount:2}),order:[],out:'',error:''};
 state.environment={MERI_STATIC_MATERIAL_EXPECTED:JSON.stringify(state.expected),MERI_STATIC_MATERIAL_BUNDLE:JSON.stringify({files:[{base64:canary}]})};
 state.ports={environment:state.environment,writeOut:line=>{state.order.push('ready');state.out+=line;},writeError:line=>{state.error+=line;}};
 cliState=state;return state;
}

test('control CA flag rejects another role before canonical materialization and consumes the secret slot',async()=>{
 const state=cli('temporal-worker');
 assert.equal(await runMaterialInitCli(['write','--control-node-ca'],state.ports),78);
 assert.deepEqual(state.order,[]);assert.equal(state.out,'');assert.equal(state.error,'STATIC_INIT_REFUSED\n');
 assert.equal(Object.hasOwn(state.environment,'MERI_STATIC_MATERIAL_BUNDLE'),false);
 assert.doesNotMatch(state.out+state.error,new RegExp(canary));
});

test('ready is emitted after canonical materialization and composite initialization both complete',async()=>{
 const state=cli();
 state.beforeMaterialized=async()=>{assert.equal(state.out,'');};
 state.composite=async()=>{assert.equal(state.out,'');assert.deepEqual(state.order,['materialize','materialized','composite']);};
 assert.equal(await runMaterialInitCli(['write','--control-node-ca'],state.ports),0);
 assert.deepEqual(state.order,['materialize','materialized','composite','ready']);
 assert.deepEqual(JSON.parse(state.out),{ready:true,role:'control',fileCount:2});assert.equal(state.error,'');
 assert.doesNotMatch(state.out,new RegExp(canary));
});

test('composite refusal releases the exact static receipt, emits no ready and hides private error text',async()=>{
 const state=cli();state.composite=async()=>{throw Object.assign(Error(canary),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});};
 assert.equal(await runMaterialInitCli(['write','--control-node-ca'],state.ports),78);
 assert.deepEqual(state.order,['materialize','materialized','composite','release']);assert.equal(state.out,'');
 assert.equal(state.error,'STATIC_INIT_CONTROL_CA_REFUSED\n');assert.doesNotMatch(state.error,new RegExp(canary));
});

test('static failure never starts the composite; rollback failure keeps the cleanup failure exit',async()=>{
 let state=cli();state.beforeMaterialized=async()=>{throw Object.assign(Error(canary),{code:'STATIC_INIT_CONTENT_REFUSED'});};
 assert.equal(await runMaterialInitCli(['write','--control-node-ca'],state.ports),78);
 assert.deepEqual(state.order,['materialize']);assert.equal(state.out,'');assert.equal(state.error,'STATIC_INIT_CONTENT_REFUSED\n');
 state=cli();state.composite=async()=>{throw Error(canary);};
 state.release=async()=>{throw Object.assign(Error(canary),{code:'STATIC_INIT_CLEANUP_REFUSED'});};
 assert.equal(await runMaterialInitCli(['write','--control-node-ca'],state.ports),1);
 assert.deepEqual(state.order,['materialize','materialized','composite','release']);assert.equal(state.out,'');
 assert.equal(state.error,'STATIC_INIT_CLEANUP_REFUSED\n');assert.doesNotMatch(state.error,new RegExp(canary));
});

test('plain write retains its existing canonical initialization path',async()=>{
 const state=cli();assert.equal(await runMaterialInitCli(['write'],state.ports),0);
 assert.deepEqual(state.order,['materialize','materialized','ready']);assert.equal(state.error,'');
});

function stat(entry){return {dev:1,ino:entry.ino,uid:entry.uid,gid:entry.gid,mode:entry.mode,nlink:1,
 size:entry.bytes?.length??0,isFile:()=>entry.kind==='file',isDirectory:()=>entry.kind==='directory',isSymbolicLink:()=>entry.kind==='symlink'};}
const missing=()=>Object.assign(Error('synthetic missing file'),{code:'ENOENT'});
// Windows omits Linux-only flags. Supply them at the mocked Linux syscall boundary.
const ioConstants={...constants,O_NOFOLLOW:constants.O_NOFOLLOW??0x20000,O_NONBLOCK:constants.O_NONBLOCK??0x800};
mock.module('node:fs',{namedExports:{constants:ioConstants}});
mock.module('node:fs/promises',{namedExports:{
 async open(path,flags,mode){
  ioState.calls.push(['open',path,flags,mode]);let entry=ioState.files.get(path);
  if(!(flags&constants.O_CREAT)&&path===realComposer.CONTROL_NODE_CA_FILE&&ioState.failOutputRead)throw Object.assign(Error(canary),{code:'EIO'});
  if(flags&constants.O_CREAT){if(entry)throw Object.assign(Error('exists'),{code:'EEXIST'});
   entry={kind:'file',uid:1000,gid:1000,mode,ino:++ioState.sequence,bytes:Buffer.alloc(0)};ioState.files.set(path,entry);
  }else if(!entry)throw missing();
  return {async stat(){return stat(entry);},async read(buffer,offset,length,position){return {bytesRead:entry.bytes.copy(buffer,offset,position,position+length)};},
   async writeFile(bytes){entry.bytes=Buffer.from(bytes);},async sync(){},async close(){}};
 },
 async mkdir(path,{mode}){
  ioState.calls.push(['mkdir',path,mode]);if(ioState.files.has(path))throw Object.assign(Error('exists'),{code:'EEXIST'});
  ioState.files.set(path,{kind:'directory',uid:1000,gid:1000,mode,ino:++ioState.sequence});
 },
 async lstat(path){const entry=ioState.files.get(path);if(!entry)throw missing();return stat(entry);},
 async realpath(path){return path;},
 async unlink(path){ioState.calls.push(['unlink',path]);ioState.files.delete(path);},
 async rmdir(path){ioState.calls.push(['rmdir',path]);ioState.files.delete(path);}
}});
// A distinct module URL loads the production composer rather than the CLI dependency stub.
const realComposer=await import('../control-ca-bundle.mjs?control-ca-init-io');
const {CONTROL_NODE_CA_DIRECTORY:directory,CONTROL_NODE_CA_FILE:output}=realComposer;

function filesystem(t){
 for(const [key,value] of Object.entries({platform:'linux',getuid:()=>1000,getgid:()=>1000})){
  const before=Object.getOwnPropertyDescriptor(process,key);Object.defineProperty(process,key,{value,configurable:true});
  t.after(()=>{if(before)Object.defineProperty(process,key,before);else delete process[key];});
 }
 const configuration={native:{serverCaFile:'/run/meri/control-ca.pem',serverCaSha256:hash(new X509Certificate(privateCa).raw)}};
 const configBytes=Buffer.from(JSON.stringify(configuration)),files=new Map();let sequence=0;
 const put=(path,bytes,uid=1000,gid=1000,mode=0o600)=>files.set(path,{kind:'file',uid,gid,mode,ino:++sequence,bytes:Buffer.from(bytes)});
 put('/run/meri/control.json',configBytes);put('/run/meri/control-ca.pem',privateCa);put(rdsLock.imagePath,rdsBundle,0,0,0o444);
 const state={files,sequence,calls:[],configuration,expected:{role:'control',sha256ByPath:{'/run/meri/control.json':hash(configBytes),'/run/meri/control-ca.pem':hash(privateCa)}}};
 ioState=state;return state;
}
const removed=state=>state.calls.filter(([operation])=>operation==='unlink'||operation==='rmdir');

test('production composer creates exact shared bytes with exclusive private permissions and verifies startup readback',async t=>{
 const state=filesystem(t),receipt=await realComposer.materializeControlCaBundle({configurationPath:'/run/meri/control.json',expected:state.expected});
 assert.equal(receipt.path,output);assert.equal(state.files.get(directory).mode,0o700);assert.equal(state.files.get(output).mode,0o600);
 assert.deepEqual(state.files.get(output).bytes,Buffer.concat([rdsBundle,Buffer.from('\n'),privateCa]));
 const create=state.calls.find(([operation,path,,mode])=>operation==='open'&&path===output&&mode===0o600);
 assert.ok(create[2]&ioConstants.O_EXCL);assert.ok(create[2]&ioConstants.O_NOFOLLOW);
 assert.equal(await realComposer.verifyControlCaBundle(state.configuration,{environment:{NODE_EXTRA_CA_CERTS:output}}),true);
 assert.deepEqual(removed(state),[]);
});

test('production startup rejects missing and changed composite output without removing material',async t=>{
 const state=filesystem(t);await realComposer.materializeControlCaBundle({configurationPath:'/run/meri/control.json',expected:state.expected});
 const written=state.files.get(output);state.files.delete(output);
 await assert.rejects(realComposer.verifyControlCaBundle(state.configuration,{environment:{NODE_EXTRA_CA_CERTS:output}}),{code:'ENOENT'});
 state.files.set(output,{...written,bytes:Buffer.from('changed')});
 await assert.rejects(realComposer.verifyControlCaBundle(state.configuration,{environment:{NODE_EXTRA_CA_CERTS:output}}),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});
 assert.deepEqual(removed(state),[]);
});

test('production composer rolls back only its derived paths when output readback fails',async t=>{
 const state=filesystem(t);state.failOutputRead=true;
 await assert.rejects(realComposer.materializeControlCaBundle({configurationPath:'/run/meri/control.json',expected:state.expected}),{code:'EIO'});
 assert.deepEqual(removed(state),[['unlink',output],['rmdir',directory]]);
 assert.equal(state.files.has(output),false);assert.equal(state.files.has(directory),false);
 assert.equal(state.files.has('/run/meri/control.json'),true);assert.equal(state.files.has('/run/meri/control-ca.pem'),true);
});

test('production composer preserves a preexisting foreign directory and refuses a foreign configuration path',async t=>{
 const state=filesystem(t),foreign={kind:'directory',uid:0,gid:0,mode:0o755,ino:999};state.files.set(directory,foreign);
 await assert.rejects(realComposer.materializeControlCaBundle({configurationPath:'/run/meri/control.json',expected:state.expected}),{code:'EEXIST'});
 assert.equal(state.files.get(directory),foreign);assert.deepEqual(removed(state),[]);
 state.calls=[];
 await assert.rejects(realComposer.materializeControlCaBundle({configurationPath:'/tmp/foreign.json',expected:state.expected}),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});
 assert.deepEqual(state.calls,[]);assert.deepEqual(removed(state),[]);
});

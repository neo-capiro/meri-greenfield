/** FINITE83: the FIXED authenticated lifecycle route on the REAL entrypoint listener. The producer is the real
 *  openNativeLifecycle; only kernel/TLS/socket/program effects are inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';
import {definitionsSnapshotId,UPLOAD_DEFINITIONS_SCHEMA} from '../uploads/native-definitions.mjs';
import {createHash} from 'node:crypto';
import {nativeProcessingConfig} from './config.mjs';
import {nativeLifecycleRequest} from './lifecycle-contract.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const IMAGE=`sha256:${'b'.repeat(64)}`;
const TENANT=uuid(1),CONV=uuid(3),HOST=uuid(7);
const LEASE=Date.now()+600000;
const BINDING={tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1};
const BOOT=uuid(8),INSTANCE='i-0123456789abcdef0';
const EVENTS0='populated 0'+String.fromCharCode(10)+'frozen 0'+String.fromCharCode(10);
const ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'10.0.0.5',MERI_NATIVE_PROCESSING_CONTROL_PORT:'9443',
 MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.meri.internal',
 MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64),
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY:'/run/meri/client.key',MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT:'/run/meri/client.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CA:'/run/meri/control-ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,
 MERI_NATIVE_PROCESSING_HOST_ID:HOST,MERI_NATIVE_PROCESSING_GENERATION:'3',
 MERI_NATIVE_PROCESSING_CONVERSATION_ID:CONV,MERI_NATIVE_PROCESSING_TENANT_ID:TENANT,
 MERI_NATIVE_PROCESSING_INSTANCE_ID:INSTANCE,MERI_NATIVE_PROCESSING_BOOT_ID:BOOT,
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:JSON.stringify(BINDING),
 MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(LEASE),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});
const LSTAT=()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});};
const closedReceipt=()=>({exitCode:0,leaderClosed:true,groupAbsent:true,settlement:'closed'});

/** A fresh published snapshot so the initial probe settles without a new updater run. */
async function publish(root){
 const buffers=[Buffer.from('main fixture'),Buffer.from('daily fixture')];
 const files=['main.cvd','daily.cvd'].map((name,i)=>({name,bytes:buffers[i].length,
  sha256:createHash('sha256').update(buffers[i]).digest('hex'),format:'cvd'}));
 const id=definitionsSnapshotId(files),dir=join(root,'snapshots',id);
 await mkdir(join(dir,'database'),{recursive:true});
 await Promise.all(files.map((f,i)=>writeFile(join(dir,'database',f.name),buffers[i])));
 const at=Date.now()-1000;
 await writeFile(join(dir,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(at).toISOString(),publishedAtMs:at,signatureVerified:true,version:'fixture',files}));
 await writeFile(join(root,'current'),id);
}

const stream=(body,{method='POST',url='/v1/native-processing/lifecycle'}={})=>{
 const req=new EventEmitter();
 Object.assign(req,{method,url,headers:{},socket:{encrypted:true},complete:true});
 req.destroy=()=>{};
 if(body!==undefined)setImmediate(()=>{req.emit('data',Buffer.from(body));req.emit('end');});
 return req;
};
const response=()=>{const r={status:0,body:'',writableEnded:false,headersSent:false,listeners:new Map()};
 r.writeHead=s=>{r.status=s;r.headersSent=true;};r.end=b=>{r.body=String(b??'');r.writableEnded=true;};
 r.once=(e,f)=>{r.listeners.set(e,f);};r.removeListener=e=>{r.listeners.delete(e);};r.once?.('close',()=>{});
 return r;};

async function boot({t,ports,authenticatePeer,definitionsRun}={}){
 const root=await mkdtemp(join(tmpdir(),'meri-83-'));
 const base=nativeProcessingConfig({env:ENV});
 const config={...base,paths:{...base.paths,definitionsRoot:root}};
 await publish(root);
 const counts={reads:0,closes:0,listens:0,serverCloses:0};
 let captured=null;
 const serverFactory=(_o,h)=>{captured=h;return {once(){},listen(_p,_a,cb){counts.listens+=1;cb();},
  close(cb){counts.serverCloses+=1;cb?.();}};};
 const lifecyclePorts=ports??{async readBootId(){counts.reads+=1;return BOOT;},
  async openGroup(){return {async readEvents(){counts.reads+=1;return EVENTS0;},
   async close(){counts.closes+=1;}};}};
 const started=await startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),config,readFile:()=>Buffer.from('inert'),
  lifecyclePorts,lifecycleLstat:LSTAT,serverFactory,
  definitionsRun:definitionsRun??(async()=>({stdout:Buffer.alloc(0),receipt:closedReceipt()})),
  definitionsChmod:async()=>{},
  authenticatePeer:authenticatePeer??(async()=>({verified:true,notAfterMs:Date.now()+600000}))});
 return {root,config,started,counts,listener:()=>captured};
}
const closedRequest=config=>({schema:'meri-native-host-lifecycle/1',action:'close',
 allocation:{schema:'meri-conversation-host-allocation/1',tenantId:config.allocation.tenantId,
  conversationId:config.allocation.conversationId,generation:config.allocation.generation,
  hostId:config.allocation.hostId,imageDigest:config.image.digest,
  leaseDeadlineMs:config.allocation.leaseDeadlineMs,hostMode:config.allocation.hostMode},
 binding:config.binding,
 hostIdentity:{schema:'meri-d005-host-identity/1',instanceId:config.allocation.instanceId,
  bootId:config.allocation.bootId,conversationId:config.allocation.conversationId,hostId:config.allocation.hostId}});

test('ROUTE: original tuple close -> processes -> observe while the listener stays open',async t=>{
 const {root,config,started,counts,listener}=await boot({t});
 try{
  assert.equal(nativeLifecycleRequest(JSON.parse(JSON.stringify(closedRequest(config))),{config}).action,'close','round-tripped payload validates');
  const call=async action=>{const req=stream(JSON.stringify({...closedRequest(config),action}));
   const res=response();await listener()(req,res);return res;};
  const closed=await call('close');
  assert.equal(closed.status,200,closed.body);
  assert.equal(JSON.parse(closed.body).status,'closed');
  const processes=await call('processes');
  assert.equal(processes.status,200,processes.body);
  assert.equal(JSON.parse(processes.body).exited,true);
  const observe=await call('observe');
  assert.equal(observe.status,200,observe.body);
  assert.equal(JSON.parse(observe.body).status,'absent');
  assert.equal(counts.serverCloses,0,'the listener is not closed by a lifecycle request');
 }finally{await started.close();await rm(root,{recursive:true,force:true});}
});

test('ADMISSION: inspection is gated after lifecycle closure',async t=>{
 const {root,config,started,listener}=await boot({t});
 try{
  const closeRes=response();
  await listener()(stream(JSON.stringify(closedRequest(config))),closeRes);
  assert.equal(closeRes.status,200,closeRes.body);
  const res=response();
  await listener()(stream(undefined,{url:'/internal/upload-inspection'}),res);
  assert.equal(res.status,503,'inspection admission is closed after lifecycle closure');
  assert.equal(JSON.parse(res.body).error,'NATIVE_PROCESSING_CLOSED');
 }finally{await started.close();await rm(root,{recursive:true,force:true});}
});

test('DENIALS: unauthorized peer and malformed bodies cause zero host effects',async t=>{
 let denied=false;
 const {root,config,counts,listener,started}=await boot({t,authenticatePeer:async()=>denied?{verified:false}:{verified:true,notAfterMs:Date.now()+600000}});
 try{
  const base={...closedRequest(config)};
  const send=async body=>{const res=response();await listener()(stream(typeof body==='string'?body:JSON.stringify(body)),res);return res;};
  denied=true;
  const unauthorized=await send(base);
  assert.equal(unauthorized.status,401);
  denied=false;
  const readsBefore=counts.reads;
  const extra=await send({...base,extraField:'x'});
  assert.equal(extra.status,400);
  const wrongImage=await send({...base,allocation:{...base.allocation,imageDigest:`sha256:${'c'.repeat(64)}`}});
  assert.equal(wrongImage.status,400);
  const wrongTuple=await send({...base,binding:{...base.binding,tenantId:uuid(9)}});
  assert.equal(wrongTuple.status,400);
  const wrongBoot=await send({...base,hostIdentity:{...base.hostIdentity,bootId:uuid(9)}});
  assert.equal(wrongBoot.status,400);
  const badJson=await send('{');
  assert.equal(badJson.status,400);
  assert.equal(counts.reads,readsBefore,'refusals perform no kernel read or quiesce');
 }finally{await started.close();await rm(root,{recursive:true,force:true});}
});

test('EXPIRY: an expired authenticated peer cannot reach the producer',async t=>{
 const {root,config,started,listener,counts}=await boot({t,
  authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()-1})});
 try{
  const readsBefore=counts.reads;
  const res=response();
  await listener()(stream(JSON.stringify(closedRequest(config))),res);
  assert.equal(res.status,408,'the verified peer expiry bounds the same request lifetime');
  assert.equal(JSON.parse(res.body).error,'NATIVE_LIFECYCLE_CANCELLED');
  assert.equal(counts.reads,readsBefore,'no kernel read or quiesce happens after peer expiry');
 }finally{await started.close();await rm(root,{recursive:true,force:true});}
});

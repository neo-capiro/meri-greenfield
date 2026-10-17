import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {posix} from 'node:path';
import {parseTemporalProductBootstrapConfiguration,startTemporalProductBootstrap} from './temporal-product-bootstrap.mjs';
import {parseTemporalIssuerDeliveryConfiguration} from './temporal-issuer/client.mjs';

const NOW=1800000000000,ROOT='/run/meri-temporal',ID=ROOT+'/identity',LOCK=ROOT+'/.identity.bootstrap.lock';
const TASK='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/'+'1'.repeat(32);
const unavailable={code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'},unknown={code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'};
const missing=()=>Object.assign(Error('synthetic missing'),{code:'ENOENT'}),exists=()=>Object.assign(Error('synthetic occupied'),{code:'EEXIST'});
const ticks=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};

/** Deterministic Node fs protocol model. No native files, crypto/key generation,
 * listeners, metadata requests or issuer communication occur in these tests. */
function fixture(){
 let at=NOW,serial=1,clientCount=0,generation=0,boot=0,readHook=async()=>{},bootstrapHook=null,closeReply=undefined,fsHook=async()=>{};
 const nodes=new Map(),calls=[],clients=[],keys=[],certs=[],material=[],fences=[],events=[],timed=new Set();
 function node(path,kind='dir',bytes=Buffer.alloc(0),extra={}){const v={kind,bytes:Buffer.from(bytes),dev:1,ino:serial++,uid:1000,gid:1000,mode:kind==='dir'?0o700:0o600,nlink:1,...extra};nodes.set(path,v);return v;}
 node(ROOT);
 const get=path=>{const v=nodes.get(path);if(!v)throw missing();return v;};
 const stat=value=>({...value,size:value.bytes.length,isFile:()=>value.kind==='file',isDirectory:()=>value.kind==='dir',isSymbolicLink:()=>value.kind==='link'});
 const fs={
  async lstat(path){calls.push(['lstat',path]);await fsHook('lstat',path);return stat(get(path));},
  async realpath(path){calls.push(['realpath',path]);await fsHook('realpath',path);const v=get(path);return v.kind==='link'?v.target:path;},
  async readdir(path){calls.push(['readdir',path]);await fsHook('readdir',path);get(path);return [...nodes.keys()].filter(p=>p!==path&&posix.dirname(p)===path).map(p=>posix.basename(p));},
  async mkdir(path,{mode}){calls.push(['mkdir',path,mode]);await fsHook('mkdir',path);if(nodes.has(path))throw exists();if(get(posix.dirname(path)).kind!=='dir')throw missing();node(path,'dir',Buffer.alloc(0),{mode});},
  async rename(from,to){calls.push(['rename',from,to]);await fsHook('rename',to);const source=get(from),target=get(to);
   assert.equal(source.kind,'dir');assert.equal(target.kind,'dir');assert.equal([...nodes.keys()].some(p=>p.startsWith(to+'/')),false,'only owned empty placeholder may be replaced');
   nodes.delete(to);for(const [path,v]of [...nodes])if(path===from||path.startsWith(from+'/')){nodes.delete(path);nodes.set(to+path.slice(from.length),v);}},
  async unlink(path){calls.push(['unlink',path]);await fsHook('unlink',path);assert.equal(get(path).kind,'file');nodes.delete(path);},
  async rmdir(path){calls.push(['rmdir',path]);await fsHook('rmdir',path);assert.equal(get(path).kind,'dir');assert.equal([...nodes.keys()].some(p=>p.startsWith(path+'/')),false);nodes.delete(path);},
  async open(path,flags,mode){calls.push(['open',path,flags,mode]);await fsHook('open',path);let value;
   if(flags&constants.O_CREAT){assert.ok(flags&constants.O_EXCL,'new files are exclusive');assert.equal(mode,0o600);if(nodes.has(path))throw exists();get(posix.dirname(path));value=node(path,'file',Buffer.alloc(0),{mode});}
   else value=get(path);
   let closed=false;return {async stat(){assert.equal(closed,false);return stat(value);},async writeFile(bytes){assert.equal(closed,false);await fsHook('writeFile',path);value.bytes=Buffer.from(bytes);},
    async sync(){assert.equal(closed,false);await fsHook('sync',path);},async close(){closed=true;},
    async read(buffer,offset,length,position){assert.equal(closed,false);const n=Math.max(0,Math.min(length,value.bytes.length-position));value.bytes.copy(buffer,offset,position,position+n);return {bytesRead:n};}};
  },
 };
 const timers={setTimeout(fn,ms){const timer={fn,due:at+ms,unref(){}};timed.add(timer);return timer;},clearTimeout(timer){timed.delete(timer);}};
 function advance(ms){at+=ms;for(const timer of [...timed].sort((a,b)=>a.due-b.due))if(timer.due<=at&&timed.delete(timer))timer.fn();}
 const issuerDelivery={schemaVersion:1,issuerOrigin:'https://issuer.synthetic.invalid:8445',audience:'meri-temporal',namespace:'meri',identity:{role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'},
  publicKey:{kid:'synthetic-key',alg:'RS256',jwkSha256:'a'.repeat(64),manifestFile:'/run/meri/issuer-jwks.json'},
  tls:{serverName:'issuer.synthetic.invalid',issuerCaFile:'/run/meri/issuer-server-ca.pem',clientKeyFile:ID+'/client-key.pem',clientCertFile:ID+'/client-cert.pem'},requestTimeoutMs:200,maxReplyBytes:16384};
 const issuerBootstrap={enabled:true,configuration:{schemaVersion:1,role:'control',clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev',revision:'reviewed-v1',issuerOrigin:issuerDelivery.issuerOrigin,serverName:issuerDelivery.tls.serverName,
  peerSubjectCn:'meri-temporal-control',peerUriBase:'spiffe://issuer.meri.internal/temporal/control/',serverCaSha256:'b'.repeat(64),clientCaSha256:'c'.repeat(64),requestTimeoutMs:100,totalTimeoutMs:2000,maxReplyBytes:16384},
  serverCaFile:'/run/meri/issuer-server-ca.pem',clientCaFile:'/run/meri/issuer-client-ca.pem',directory:ID,keyFile:ID+'/client-key.pem',certFile:ID+'/client-cert.pem'};
 const configuration={temporal:{issuerBootstrap,issuerDelivery,tokenWriter:{enabled:true}}};
 function reply(){const keyPem=Buffer.from('synthetic-private-key-'+(++boot)),certPem=Buffer.from('synthetic-certificate-'+boot);keys.push(keyPem);certs.push(certPem);
  return {schemaVersion:1,role:'control',taskArn:TASK,certificateSha256:'d'.repeat(64),expiresAtMs:at+300000,keyPem,certPem,
   registration:{schemaVersion:1,state:'CURRENT',certificateSha256:'d'.repeat(64),role:'control',peerSanUri:issuerBootstrap.configuration.peerUriBase+encodeURIComponent(TASK),taskArn:TASK,revision:'reviewed-v1',expiresAtMs:at+300000}};}
 const clientModule={parseTemporalIssuerBootstrapClientConfiguration(raw){events.push('parse-client');assert.equal(raw.metadataUri,'http://169.254.170.2/v4/synthetic');assert.equal(Object.isFrozen(raw),false);return Object.freeze(raw);},
  createTemporalIssuerBootstrapClient({configuration:c,serverCaPem,clientCaPem,now}){events.push('create-client');assert.equal(c.role,'control');assert.equal(now(),at);assert.ok(serverCaPem.equals(Buffer.from('synthetic-server-ca')));assert.ok(clientCaPem.equals(Buffer.from('synthetic-client-ca')));
   const index=++clientCount,client={available:()=>true,async bootstrap({signal}){events.push('bootstrap-'+index);assert.ok(signal instanceof AbortSignal);return bootstrapHook?bootstrapHook({signal,index,reply}):reply();},close(){events.push('client-close-'+index);return closeReply;}};clients.push(client);return client;}};
 const testOwners={filesystem:fs,runtimeIdentity:{platform:'linux',uid:1000,gid:1000},environment:{ECS_CONTAINER_METADATA_URI_V4:'http://169.254.170.2/v4/synthetic'},
  stagingId:()=> '11111111-1111-4111-8111-'+String(++generation).padStart(12,'0'),
  async readMaterial(path){events.push('public-read');assert.ok([issuerBootstrap.serverCaFile,issuerBootstrap.clientCaFile].includes(path),'no private file read');await readHook(path);const bytes=Buffer.from(path===issuerBootstrap.serverCaFile?'synthetic-server-ca':'synthetic-client-ca');material.push(bytes);return bytes;},
  async loadClient(){events.push('load-client');return clientModule;}};
 const options={now:()=>at,timers,testOwners,onUnavailable:code=>{fences.push(code);events.push('fence');}};
 return {configuration,options,fs,nodes,calls,clients,keys,certs,material,fences,events,timed,reply,advance,node,now:()=>at,
  readHook:fn=>{readHook=fn;},bootstrapHook:fn=>{bootstrapHook=fn;},fsHook:fn=>{fsHook=fn;},closeReply:value=>{closeReply=value;}};
}

test('closed pure bootstrap config defaults off, joins delivery templates, and never accepts JSON metadata or identities',async()=>{
 assert.deepEqual(parseTemporalProductBootstrapConfiguration(),{enabled:false});assert.deepEqual(parseTemporalProductBootstrapConfiguration({enabled:false}),{enabled:false});
 for(const change of [
  c=>{c.temporal.issuerBootstrap.metadataUri='http://foreign.invalid';},c=>{c.temporal.issuerBootstrap.configuration.metadataUri='http://169.254.170.2/v4/body';},
  c=>{c.temporal.issuerBootstrap.configuration.role='temporal-worker';},c=>{c.temporal.issuerBootstrap.configuration.issuerOrigin='https://foreign.invalid';},
  c=>{c.temporal.issuerBootstrap.configuration.serverName='foreign.invalid';},c=>{c.temporal.issuerBootstrap.directory=ROOT;},
  c=>{c.temporal.issuerBootstrap.configuration.issuerOrigin=c.temporal.issuerDelivery.issuerOrigin='https://issuer.synthetic.invalid';},
  c=>{c.temporal.issuerBootstrap.configuration.issuerOrigin=c.temporal.issuerDelivery.issuerOrigin='https://issuer.synthetic.invalid:8446';},
  c=>{c.temporal.issuerBootstrap.keyFile='/run/meri/static-key.pem';},c=>{c.temporal.issuerDelivery.tls.clientCertFile='/run/meri/static-cert.pem';},
  c=>{c.temporal.issuerDelivery.tls.issuerCaFile='/run/meri/other-ca.pem';},
  c=>{c.temporal.issuerBootstrap.clientCaFile=c.temporal.issuerBootstrap.serverCaFile;},c=>{c.temporal.issuerBootstrap.serverCaFile='/run/meri/../private.pem';},
 ]){const f=fixture();change(f.configuration);assert.throws(()=>parseTemporalProductBootstrapConfiguration(f.configuration.temporal.issuerBootstrap,f.configuration.temporal.issuerDelivery),unavailable);assert.deepEqual(f.calls,[]);}
 const f=fixture();delete f.configuration.temporal.issuerBootstrap;await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options),unavailable);assert.deepEqual(f.events,[]);assert.deepEqual(f.calls,[]);
 assert.equal(await startTemporalProductBootstrap({temporal:{}},{}),null);
});

test('initial genuine-client reply installs one immutable owned generation and returns no key material',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options),current=await owner.ensureCurrent();
 assert.equal(owner.healthy(),true);assert.equal(current.revision,1);assert.ok(Object.isFrozen(current.issuerDeliveryConfiguration));
 assert.equal(parseTemporalIssuerDeliveryConfiguration(current.issuerDeliveryConfiguration).issuer,'https://issuer.synthetic.invalid:8445/');
 const keyFile=current.issuerDeliveryConfiguration.tls.clientKeyFile,certFile=current.issuerDeliveryConfiguration.tls.clientCertFile;
 assert.equal(posix.dirname(keyFile),posix.dirname(certFile));assert.ok(keyFile.startsWith(ID+'/generation-'));assert.equal(f.nodes.has(ID+'/client-key.pem'),false);
 assert.equal(f.nodes.get(keyFile).bytes.toString(),'synthetic-private-key-1');assert.equal(f.nodes.get(certFile).bytes.toString(),'synthetic-certificate-1');
 assert.ok(f.keys.every(bytes=>bytes.every(n=>n===0)));assert.ok(f.certs.every(bytes=>bytes.every(n=>n===0)));assert.ok(f.material.every(bytes=>bytes.every(n=>n===0)));
 assert.equal(JSON.stringify(current).includes('synthetic-private'),false);assert.equal(f.clients.length,1);assert.equal(f.calls.filter(c=>c[0]==='rename').length,1);
 assert.equal(f.nodes.get(ID).mode,0o700);assert.equal(f.nodes.get(keyFile).mode,0o600);assert.equal(f.nodes.get(certFile).mode,0o600);
 assert.equal(owner.status().physicalStopProven,false);assert.deepEqual(await owner.close(),{closed:true,unsettledOperations:0,physicalStopProven:false});
 assert.deepEqual([...f.nodes.keys()],[ROOT]);assert.equal(f.timed.size,0);
});

test('existing identity, parent lock, symlink or changed parent permissions are refused and preserved',async()=>{
 for(const change of [f=>f.node(ID),f=>f.node(LOCK,'file',Buffer.from('foreign-lock')),f=>f.node(ID,'link',Buffer.alloc(0),{target:'/foreign'}),f=>{f.nodes.get(ROOT).mode=0o755;},f=>{f.nodes.get(ROOT).uid=0;}]){
  const f=fixture();change(f);const before=[...f.nodes].map(([path,value])=>[path,{...value,bytes:Buffer.from(value.bytes)}]);await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));
  assert.deepEqual([...f.nodes],before);assert.equal(f.calls.some(call=>['unlink','rmdir','rename'].includes(call[0])),false);assert.equal(f.keys.length,0);
 }
});

test('rotation drains old delivery before NEW bootstrap and keeps at most current plus candidate immutable pair',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options),first=await owner.ensureCurrent();
 f.advance(298000);const second=await owner.ensureCurrent({beforeRotation:()=>{f.events.push('old-delivery-drained');return {closed:true,unsettledOperations:0,physicalStopProven:false};}});
 assert.equal(second.revision,2);assert.notEqual(first.issuerDeliveryConfiguration.tls.clientKeyFile,second.issuerDeliveryConfiguration.tls.clientKeyFile);
 assert.equal(f.clients.length,2);assert.ok(f.events.indexOf('old-delivery-drained')<f.events.indexOf('bootstrap-2'));
 assert.equal(f.nodes.has(first.issuerDeliveryConfiguration.tls.clientKeyFile),false);assert.equal(f.nodes.has(second.issuerDeliveryConfiguration.tls.clientKeyFile),true);
 assert.equal([...f.nodes.keys()].filter(path=>path.endsWith('/client-key.pem')).length,1);await owner.close();assert.deepEqual([...f.nodes.keys()],[ROOT]);
});

test('rotation without drain or with unsettled old-client receipt never issues or reuses old material',async()=>{
 for(const beforeRotation of [undefined,()=>undefined,()=>({unsettledOperations:1,physicalStopProven:false})]){
  const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options);f.advance(298000);
  await assert.rejects(owner.ensureCurrent({beforeRotation}));assert.equal(f.clients.length,1);assert.equal(owner.healthy(),false);assert.equal(f.fences.length,1);assert.equal(f.keys.length,1);
 }
});

test('original nonzero drain evidence survives subsequent successful local cleanup',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options);f.advance(298000);
 await assert.rejects(owner.ensureCurrent({beforeRotation:()=>({unsettledOperations:2,physicalStopProven:false})}),error=>{
  assert.equal(error.code,'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN');assert.deepEqual(error.cause,{unsettledOperations:2,physicalStopProven:false});return true;
 });
 assert.deepEqual([...f.nodes.keys()],[ROOT]);assert.equal(f.clients.length,1);
});

test('an already queued predecessor expiry cannot fence its replacement generation',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options),oldTimer=[...f.timed].find(timer=>timer.due===NOW+300000);
 assert.ok(oldTimer);f.advance(298000);await owner.ensureCurrent({beforeRotation:()=>({unsettledOperations:0,physicalStopProven:false})});
 oldTimer.fn();assert.equal(owner.healthy(),true);assert.equal(f.fences.length,0);assert.equal(owner.status().revision,2);await owner.close();
});

test('malformed or mismatched verified-client reply never publishes a pair and always erases received keys',async()=>{
 for(const change of [reply=>{reply.role='temporal-worker';},reply=>{reply.registration.taskArn=TASK.replace(/1$/u,'2');},reply=>{reply.registration.peerSanUri='spiffe://foreign.invalid/';},
  reply=>{reply.expiresAtMs=NOW+2000;reply.registration.expiresAtMs=reply.expiresAtMs;},reply=>{reply.keyPem=Buffer.alloc(65537,107);},reply=>{reply.registration.revision='other';}]){
  const f=fixture();let received;f.bootstrapHook(({reply})=>{received=reply();change(received);return received;});
  await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));assert.ok(received.keyPem.every(n=>n===0));assert.ok(received.certPem.every(n=>n===0));assert.equal(f.calls.some(call=>call[0]==='rename'),false);assert.deepEqual([...f.nodes.keys()],[ROOT]);
 }
});

test('expiry synchronously fences once and no automatic issuer renewal is started',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options);let watched=0;owner.watch(()=>{watched++;assert.equal(owner.healthy(),false);});
 f.advance(300000);assert.equal(f.fences.length,1);assert.equal(watched,1);assert.equal(owner.healthy(),false);assert.equal(f.clients.length,1);await owner.close();assert.deepEqual([...f.nodes.keys()],[ROOT]);
 await assert.rejects(owner.ensureCurrent(),unavailable);
});

test('late bootstrap reply after cancellation is erased and original cleanup uncertainty is retained',async()=>{
 const f=fixture();let deliver,ready;const reached=new Promise(resolve=>{ready=resolve;});
 f.bootstrapHook(({reply})=>new Promise(resolve=>{deliver=()=>resolve(reply());ready();}));
 const pending=startTemporalProductBootstrap(f.configuration,f.options);await reached;f.advance(2000);await assert.rejects(pending,unknown);
 deliver();await ticks();assert.equal(f.keys.length,1);assert.ok(f.keys[0].every(n=>n===0));assert.ok(f.certs[0].every(n=>n===0));assert.equal(f.calls.some(c=>c[0]==='rename'),false);assert.deepEqual([...f.nodes.keys()],[ROOT]);
});

test('material delivered at cutoff is erased before publication; unexpected original filesystem replacement is preserved',async()=>{
 const f=fixture();f.bootstrapHook(({reply})=>{const value=reply();f.advance(2000);return value;});await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));assert.ok(f.keys.every(bytes=>bytes.every(n=>n===0)));assert.equal(f.calls.some(c=>c[0]==='rename'),false);
 const g=fixture(),owner=await startTemporalProductBootstrap(g.configuration,g.options),current=await owner.ensureCurrent(),path=current.issuerDeliveryConfiguration.tls.clientKeyFile;
 const foreign=g.node(path,'file',Buffer.from('foreign-key'));await assert.rejects(owner.close(),unknown);assert.equal(g.nodes.get(path),foreign);assert.equal(g.nodes.get(path).bytes.toString(),'foreign-key');assert.equal(g.nodes.has(LOCK),true);
});

test('foreign extra files and changed owned bytes block cleanup without deleting any generation',async()=>{
 for(const change of [(f,path)=>f.node(posix.dirname(path)+'/foreign','file',Buffer.from('foreign')),(f,path)=>{f.nodes.get(path).bytes=Buffer.from('tampered');}]){
  const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options),current=await owner.ensureCurrent();change(f,current.issuerDeliveryConfiguration.tls.clientCertFile);
  const removed=f.calls.filter(c=>c[0]==='unlink'||c[0]==='rmdir').length;await assert.rejects(owner.close(),unknown);assert.equal(f.calls.filter(c=>c[0]==='unlink'||c[0]==='rmdir').length,removed);
 }
});

test('lock or root created as cutoff fires remains owned and is removed after the syscall settles',async()=>{
 for(const phase of ['lock','directory']){
  const f=fixture();let fired=false;
  f.fsHook((method,path)=>{if(!fired&&(phase==='lock'&&method==='sync'&&path===LOCK||phase==='directory'&&method==='lstat'&&path===ID&&f.nodes.has(ID))){fired=true;f.advance(2000);}});
  await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));assert.equal(fired,true);assert.deepEqual([...f.nodes.keys()],[ROOT]);
  assert.equal(f.keys.length,0);assert.equal(f.calls.some(call=>call[0]==='rename'),false);
 }
});

test('certificate lifetime over five minutes is rejected before installing any generation',async()=>{
 const f=fixture();let received;f.bootstrapHook(({reply})=>{received=reply();received.expiresAtMs=f.now()+300001;received.registration.expiresAtMs=received.expiresAtMs;return received;});
 await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options),unavailable);
 assert.equal(f.calls.some(call=>call[0]==='mkdir'&&call[1].includes('/generation-')),false);
 assert.equal(f.calls.some(call=>call[0]==='rename'),false);assert.ok(received.keyPem.every(n=>n===0));assert.deepEqual([...f.nodes.keys()],[ROOT]);
});

test('file open crossing cutoff records ownership but never writes private bytes after the cutoff',async()=>{
 const f=fixture(),writes=[],syncs=[];let cutoffFired=false;
 f.fsHook((method,path)=>{
  if(!cutoffFired&&method==='open'&&path.includes('.next/client-key.pem')){cutoffFired=true;f.advance(2000);}
  if(f.now()>=NOW+2000&&path.endsWith('/client-key.pem')){if(method==='writeFile')writes.push(path);if(method==='sync')syncs.push(path);}
 });
 await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));assert.equal(cutoffFired,true);
 assert.deepEqual(writes,[]);assert.deepEqual(syncs,[]);assert.equal(f.calls.some(call=>call[0]==='rename'),false);
 assert.ok(f.keys.every(bytes=>bytes.every(n=>n===0)));assert.deepEqual([...f.nodes.keys()],[ROOT]);
});

test('directory and already-issued rename completing at cutoff retain ownership without returning a ready generation',async()=>{
 for(const phase of ['directory','rename']){
  const f=fixture();let cutoffFired=false;
  f.fsHook((method,path)=>{
   if(!cutoffFired&&(phase==='directory'&&method==='mkdir'&&path.startsWith(ID+'/generation-')||phase==='rename'&&method==='rename')){cutoffFired=true;f.advance(2000);}
  });
  await assert.rejects(startTemporalProductBootstrap(f.configuration,f.options));assert.equal(cutoffFired,true);assert.equal(f.fences.length,1);
  assert.deepEqual([...f.nodes.keys()],[ROOT]);assert.ok(f.keys.every(bytes=>bytes.every(n=>n===0)));
  assert.equal(f.calls.filter(call=>call[0]==='rename').length,phase==='rename'?1:0,'an issued rename may settle late; no generation is returned or adopted');
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {posix} from 'node:path';
import {parseTemporalProductBootstrapConfiguration,startTemporalProductBootstrap,temporalBootstrapStartupWindowMs,
 TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS,TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS,TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS} from './temporal-product-bootstrap.mjs';
import {parseTemporalIssuerDeliveryConfiguration} from './temporal-issuer/client.mjs';

const NOW=1800000000000,ROOT='/run/meri-temporal',ID=ROOT+'/identity',LOCK=ROOT+'/.identity.bootstrap.lock';
const TASK='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/'+'1'.repeat(32);
const unavailable={code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'},unknown={code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'};
const missing=()=>Object.assign(Error('synthetic missing'),{code:'ENOENT'}),exists=()=>Object.assign(Error('synthetic occupied'),{code:'EEXIST'});
const ticks=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};

/** Deterministic Node fs protocol model. No native files, crypto/key generation,
 * listeners, metadata requests or issuer communication occur in these tests. */
function fixture(){
 let at=NOW,serial=1,clientCount=0,generation=0,boot=0,readHook=async()=>{},bootstrapHook=null,settleHook=null,closeReply=undefined,fsHook=async()=>{};
 const nodes=new Map(),calls=[],clients=[],keys=[],certs=[],material=[],fences=[],events=[],timed=new Set(),scheduled=[];
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
 const timers={setTimeout(fn,ms){scheduled.push(ms);const timer={fn,ms,due:at+ms,unref(){}};timed.add(timer);return timer;},clearTimeout(timer){timed.delete(timer);}};
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
   const index=++clientCount;let issued=false;
   const client={available:()=>true,issuanceRequested:()=>issued,
    async bootstrap({signal}){events.push('bootstrap-'+index);assert.ok(signal instanceof AbortSignal);
     const value=bootstrapHook?await bootstrapHook({signal,index,reply,issue:()=>{issued=true;}}):reply();issued=true;return value;},
    settle({signal}){events.push('settle-'+index);assert.ok(signal instanceof AbortSignal);return settleHook?settleHook({signal,index}):Promise.resolve();},
    close(){events.push('client-close-'+index);return closeReply;}};clients.push(client);return client;}};
 const testOwners={filesystem:fs,runtimeIdentity:{platform:'linux',uid:1000,gid:1000},environment:{ECS_CONTAINER_METADATA_URI_V4:'http://169.254.170.2/v4/synthetic'},
  stagingId:()=> '11111111-1111-4111-8111-'+String(++generation).padStart(12,'0'),
  async readMaterial(path){events.push('public-read');assert.ok([issuerBootstrap.serverCaFile,issuerBootstrap.clientCaFile].includes(path),'no private file read');await readHook(path);const bytes=Buffer.from(path===issuerBootstrap.serverCaFile?'synthetic-server-ca':'synthetic-client-ca');material.push(bytes);return bytes;},
  async loadClient(){events.push('load-client');return clientModule;}};
 const options={now:()=>at,timers,testOwners,onUnavailable:code=>{fences.push(code);events.push('fence');}};
 return {configuration,options,fs,nodes,calls,clients,keys,certs,material,fences,events,timed,reply,advance,node,now:()=>at,
  sleeps:()=>scheduled.filter(ms=>ms===TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS),
  readHook:fn=>{readHook=fn;},bootstrapHook:fn=>{bootstrapHook=fn;},settleHook:fn=>{settleHook=fn;},fsHook:fn=>{fsHook=fn;},closeReply:value=>{closeReply=value;}};
}
const refusedByIssuer=()=>Object.assign(Error('TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
/** Drives a startup through the scripted clock: each retry sleep is the only
 * timer due at now+interval, and advancing fires it. Nothing else advances. */
async function drive(f,promise,limit=600){
 let done=false;promise.then(()=>{done=true;},()=>{done=true;});
 for(let n=0;n<limit&&!done;n++){await ticks();if(done)break;
  const sleeper=[...f.timed].find(timer=>timer.ms===TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS&&timer.due===f.now()+TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS);
  if(sleeper)f.advance(TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS);}
 assert.equal(done,true,'startup settled under the scripted clock');return promise;
}
const lockCreations=f=>f.calls.filter(call=>call[0]==='open'&&call[1]===LOCK&&(call[2]&constants.O_CREAT)).length;

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

test('startup window constants follow cli.mjs limits.startupMs with a reserve for the rest of startup',()=>{
 assert.equal(temporalBootstrapStartupWindowMs(undefined),TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS);
 assert.equal(temporalBootstrapStartupWindowMs({startupMs:'30000'}),TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS);
 assert.equal(temporalBootstrapStartupWindowMs({startupMs:30000}),30000-TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS);
 assert.ok(temporalBootstrapStartupWindowMs({startupMs:5000})<=0,'a startup budget inside the reserve leaves no retry window');
 assert.ok(TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS<30000-TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS,'the live 30s startupMs admits retries');
});

test('issuer refusals before any issuance are retried on fresh clients until the issuer accepts',async()=>{
 const f=fixture();let refusals=2;
 f.bootstrapHook(({reply})=>{if(refusals-->0)throw refusedByIssuer();return reply();});
 const owner=await drive(f,startTemporalProductBootstrap(f.configuration,f.options)),current=await owner.ensureCurrent();
 assert.equal(owner.healthy(),true);assert.equal(current.revision,1);assert.deepEqual(f.fences,[]);
 assert.deepEqual(f.sleeps(),[TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS,TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS]);
 assert.equal(f.clients.length,3,'every attempt uses a fresh client');
 assert.deepEqual(f.events.filter(e=>/^(bootstrap|settle|client-close)-/u.test(e)),
  ['bootstrap-1','settle-1','client-close-1','bootstrap-2','settle-2','client-close-2','bootstrap-3','client-close-3'],'a refused client settles, then closes, before the next attempt');
 assert.equal(f.events.filter(e=>e==='public-read').length,6,'CA material is re-read for each fresh client');
 assert.ok(f.material.every(bytes=>bytes.every(n=>n===0)),'material buffers of every attempt are zeroed');
 assert.equal(lockCreations(f),1,'the lock and identity root are acquired once');assert.equal(f.calls.filter(c=>c[0]==='rename').length,1);
 assert.equal(f.keys.length,1);assert.ok(f.keys.every(bytes=>bytes.every(n=>n===0)));
 assert.equal(f.now(),NOW+2*TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS);
 assert.deepEqual(await owner.close(),{closed:true,unsettledOperations:0,physicalStopProven:false});assert.deepEqual([...f.nodes.keys()],[ROOT]);
 // The generic unavailable code from the client path is retried the same way.
 const g=fixture();let once=true;g.bootstrapHook(({reply})=>{if(once){once=false;throw Object.assign(Error('TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'),{code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'});}return reply();});
 const second=await drive(g,startTemporalProductBootstrap(g.configuration,g.options));assert.equal(second.healthy(),true);assert.equal(g.sleeps().length,1);await second.close();
});

test('an exhausted startup window keeps the same content-free terminal refusal and cleanup',async()=>{
 const f=fixture();f.bootstrapHook(()=>{throw refusedByIssuer();});
 await assert.rejects(drive(f,startTemporalProductBootstrap(f.configuration,f.options)),unavailable);
 const attempts=f.events.filter(e=>e.startsWith('bootstrap-')).length;
 assert.equal(attempts,f.sleeps().length+1);assert.ok(attempts>1);assert.equal(f.clients.length,attempts);
 assert.ok(f.now()-NOW<TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS,'no attempt starts after the window');
 assert.ok(f.now()-NOW+TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS>=TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS,'the whole window was used');
 assert.deepEqual(f.fences,['TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE']);assert.deepEqual([...f.nodes.keys()],[ROOT],'lock and identity root are released');
 assert.equal(f.keys.length,0);assert.equal(f.timed.size,0);assert.equal(f.events.filter(e=>e.startsWith('client-close-')).length,attempts);
 // cli.mjs ends startup at limits.startupMs: the window shrinks to fit under it.
 const g=fixture();g.configuration.limits={startupMs:30000,shutdownMs:10000,requestMs:3000,requestBytes:131072};g.bootstrapHook(()=>{throw refusedByIssuer();});
 await assert.rejects(drive(g,startTemporalProductBootstrap(g.configuration,g.options)),unavailable);
 const window=30000-TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS;
 assert.ok(g.now()-NOW<window);assert.ok(g.now()-NOW+TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS>=window);assert.ok(g.sleeps().length<f.sleeps().length);
 assert.deepEqual([...g.nodes.keys()],[ROOT]);
 // A startup budget inside the reserve keeps the one-shot behaviour.
 const h=fixture();h.configuration.limits={startupMs:5000,shutdownMs:1000,requestMs:1000,requestBytes:131072};h.bootstrapHook(()=>{throw refusedByIssuer();});
 await assert.rejects(drive(h,startTemporalProductBootstrap(h.configuration,h.options)),unavailable);
 assert.deepEqual(h.sleeps(),[]);assert.equal(h.clients.length,1);assert.deepEqual([...h.nodes.keys()],[ROOT]);
});

test('startup attempts never outlive the window: the attempt deadline is capped at its end',async()=>{
 const f=fixture();f.configuration.limits={startupMs:30000,shutdownMs:10000,requestMs:3000,requestBytes:131072};
 f.configuration.temporal.issuerBootstrap.configuration.totalTimeoutMs=25000;
 let reached;const hanging=new Promise(resolve=>{reached=resolve;});f.bootstrapHook(()=>{reached();return new Promise(()=>{});});
 const pending=startTemporalProductBootstrap(f.configuration,f.options);await hanging;
 const window=30000-TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS;
 assert.ok([...f.timed].some(timer=>timer.due===NOW+window),'the attempt lifetime ends with the window, not at totalTimeoutMs');
 assert.ok(![...f.timed].some(timer=>timer.due===NOW+25000));
 f.advance(window);await assert.rejects(pending,unknown);assert.deepEqual(f.sleeps(),[]);assert.equal(f.clients.length,1);
 // Rotations are never capped by the startup window.
 const g=fixture();g.configuration.limits={startupMs:30000,shutdownMs:10000,requestMs:3000,requestBytes:131072};
 g.configuration.temporal.issuerBootstrap.configuration.totalTimeoutMs=25000;
 const owner=await startTemporalProductBootstrap(g.configuration,g.options);g.advance(298000);
 let rotating;const rotation=new Promise(resolve=>{rotating=resolve;});g.bootstrapHook(()=>{rotating();return new Promise(()=>{});});
 const refresh=owner.ensureCurrent({beforeRotation:()=>({unsettledOperations:0,physicalStopProven:false})});await rotation;
 assert.ok([...g.timed].some(timer=>timer.due===g.now()+2000),'a rotation is bounded by the remaining certificate lifetime only');
 g.advance(2000);await assert.rejects(refresh,unknown);
});

test('material and configuration refusals fail before any retry',async()=>{
 const cases=[
  ['readMaterial throws',f=>f.readHook(()=>{throw Error('synthetic read refused');})],
  ['identity root already present',f=>f.node(ID)],
  ['foreign lock present',f=>f.node(LOCK,'file',Buffer.from('foreign-lock'))],
 ];
 for(const [name,change]of cases){
  const f=fixture();change(f);f.bootstrapHook(()=>{throw refusedByIssuer();});
  await assert.rejects(drive(f,startTemporalProductBootstrap(f.configuration,f.options)),undefined,name);
  assert.deepEqual(f.sleeps(),[],name);assert.equal(f.events.filter(e=>e.startsWith('bootstrap-')).length,0,name+': the issuer is never asked');
  assert.equal(f.events.filter(e=>e==='load-client').length,1,name);assert.ok(f.material.every(bytes=>bytes.every(n=>n===0)),name);
 }
 // Empty material is refused by the owner itself, before a client exists.
 const f=fixture();const original=f.options.testOwners.readMaterial;
 f.options.testOwners.readMaterial=async path=>{const bytes=await original(path);return path===f.configuration.temporal.issuerBootstrap.clientCaFile?Buffer.alloc(0):bytes;};
 await assert.rejects(drive(f,startTemporalProductBootstrap(f.configuration,f.options)),unavailable);assert.deepEqual(f.sleeps(),[]);assert.equal(f.clients.length,0);
 // A client constructor refusal (CA pin mismatch) is a material refusal too.
 const g=fixture();const module=await g.options.testOwners.loadClient();const create=module.createTemporalIssuerBootstrapClient;
 module.createTemporalIssuerBootstrapClient=()=>{throw refusedByIssuer();};
 try{await assert.rejects(drive(g,startTemporalProductBootstrap(g.configuration,g.options)),unavailable);}finally{module.createTemporalIssuerBootstrapClient=create;}
 assert.deepEqual(g.sleeps(),[]);assert.equal(g.clients.length,0);assert.deepEqual(g.fences,['TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE']);
});

test('a stop request during the retry wait, or during an attempt, ends startup at once',async()=>{
 const f=fixture(),stopping=new AbortController();f.options.signal=stopping.signal;f.bootstrapHook(()=>{throw refusedByIssuer();});
 const pending=startTemporalProductBootstrap(f.configuration,f.options);
 for(let n=0;n<50&&![...f.timed].some(timer=>timer.ms===TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS);n++)await ticks();
 assert.equal(f.sleeps().length,1,'startup is waiting for the next attempt');
 stopping.abort();await assert.rejects(pending,unavailable);
 assert.equal(f.timed.size,0,'the wait timer is cleared');assert.equal(f.clients.length,1);assert.deepEqual(f.fences,['TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE']);
 assert.deepEqual([...f.nodes.keys()],[ROOT]);assert.equal(f.now(),NOW,'no clock advanced: the stop did not wait out the interval');
 // During an attempt the stop cancels it; a cancelled attempt is terminal, not retried.
 const g=fixture(),stop=new AbortController();g.options.signal=stop.signal;let reached;const started=new Promise(resolve=>{reached=resolve;});
 g.bootstrapHook(({signal})=>{reached();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(refusedByIssuer()),{once:true}));});
 const attempt=startTemporalProductBootstrap(g.configuration,g.options);await started;stop.abort();
 await assert.rejects(attempt);assert.deepEqual(g.sleeps(),[]);assert.equal(g.clients.length,1);assert.deepEqual([...g.nodes.keys()],[ROOT]);
 // An already stopped startup never asks the issuer.
 const h=fixture(),done=new AbortController();done.abort();h.options.signal=done.signal;
 await assert.rejects(startTemporalProductBootstrap(h.configuration,h.options),unavailable);assert.equal(h.clients.length,0);assert.deepEqual(h.sleeps(),[]);
});

test('an attempt that requested issuance, delivered material, or left unsettled transport is never retried',async()=>{
 // The redeem request was sent: the issuer may hold a certificate for this task.
 const f=fixture();f.bootstrapHook(({issue})=>{issue();throw refusedByIssuer();});
 await assert.rejects(drive(f,startTemporalProductBootstrap(f.configuration,f.options)),unavailable);
 assert.deepEqual(f.sleeps(),[]);assert.equal(f.clients.length,1);assert.deepEqual(f.fences,['TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE']);assert.deepEqual([...f.nodes.keys()],[ROOT]);
 assert.equal(f.events.includes('settle-1'),false);
 // Delivered material that fails verification is erased and terminal.
 const g=fixture();g.bootstrapHook(({reply})=>{const value=reply();value.role='temporal-worker';return value;});
 await assert.rejects(drive(g,startTemporalProductBootstrap(g.configuration,g.options)),unavailable);
 assert.deepEqual(g.sleeps(),[]);assert.equal(g.clients.length,1);assert.ok(g.keys[0].every(n=>n===0));
 // A refused client whose transport never settles is cut by the attempt deadline: cleanup unknown, as before.
 const h=fixture();let reached;const settling=new Promise(resolve=>{reached=resolve;});h.bootstrapHook(()=>{throw refusedByIssuer();});h.settleHook(()=>{reached();return new Promise(()=>{});});
 const pending=startTemporalProductBootstrap(h.configuration,h.options);await settling;h.advance(2000);
 await assert.rejects(pending,unknown);assert.deepEqual(h.sleeps(),[]);assert.equal(h.clients.length,1);
 // A settled client whose receipt is still UNKNOWN is terminal through the fence.
 const i=fixture();i.bootstrapHook(()=>{throw refusedByIssuer();});i.closeReply({schemaVersion:1,state:'CLEANUP_UNKNOWN',pendingOperations:1});
 await assert.rejects(drive(i,startTemporalProductBootstrap(i.configuration,i.options)),unknown);assert.deepEqual(i.sleeps(),[]);assert.equal(i.clients.length,1);
 // Only the two client-path codes are retried.
 const j=fixture();j.bootstrapHook(()=>{throw new TypeError('synthetic client defect');});
 await assert.rejects(drive(j,startTemporalProductBootstrap(j.configuration,j.options)),unavailable);assert.deepEqual(j.sleeps(),[]);assert.equal(j.clients.length,1);
});

test('rotation refusals are terminal: only the initial bootstrap is retried',async()=>{
 const f=fixture(),owner=await startTemporalProductBootstrap(f.configuration,f.options);f.advance(298000);
 f.bootstrapHook(()=>{throw refusedByIssuer();});
 await assert.rejects(owner.ensureCurrent({beforeRotation:()=>({unsettledOperations:0,physicalStopProven:false})}),unavailable);
 assert.deepEqual(f.sleeps(),[]);assert.equal(f.clients.length,2);assert.equal(owner.healthy(),false);assert.deepEqual(f.fences,['TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE']);
 assert.equal(f.events.includes('settle-2'),false);await assert.rejects(owner.ensureCurrent(),unavailable);
});

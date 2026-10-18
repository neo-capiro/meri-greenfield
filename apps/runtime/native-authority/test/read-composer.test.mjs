/** Control read composer over real installation, credential and gateway owners; synthetic secret files and Core HTTP only.
 * Pins the Core #83 invariant: no read route ever receives the marked control credential or another candidate credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createNativeReadCredentialBroker,createControlReadsComposer,READ_GATEWAY_INPUTS} from '../reads-composer.mjs';
import {installationFixture} from '../general-read-installation/test/fixture.mjs';
import {origin as coreOrigin} from '../native-read-credentials/test/fixture.mjs';

const CONTROL='MARKED_CONTROL_SYNTHETIC',CANDIDATE={identity:'/run/meri/identity',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-capability'};
const READ={nativeReadCredential:'/run/meri/native-read-credential',serviceSecret:'/run/meri/core-tool-service-secret',readModeServiceSecret:'/run/meri/core-read-mode-service-secret'};
const code=expected=>error=>error.message===expected;
function secretFixture(){
 const files=new Map([[CANDIDATE.identity,CONTROL],[CANDIDATE.task,'TASK_CAPABILITY_SYNTHETIC'],[CANDIDATE.control,'CONTROL_CAPABILITY_SYNTHETIC'],[CANDIDATE.proxy,'PROXY_CAPABILITY_SYNTHETIC'],
  [READ.nativeReadCredential,'SYNTHETIC_NATIVE'],[READ.serviceSecret,'SYNTHETIC_SERVICE'],[READ.readModeServiceSecret,'SYNTHETIC_SERVICE']]),reads=[];
 const readSecret=async path=>{reads.push(path);if(!files.has(path))throw Error('PRIVATE missing');return Buffer.from(files.get(path)+'\n');};
 const configuration={nativeCandidate:{identity:{origin:coreOrigin,credentialFile:CANDIDATE.identity},taskCapabilityFile:CANDIDATE.task,controlCapabilityFile:CANDIDATE.control,proxyCredentialFile:CANDIDATE.proxy}};
 return {files,reads,readSecret,configuration};
}

test('broker returns the native read bearer and service secrets from their own files, never a candidate credential',async()=>{
 const s=secretFixture(),broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret});
 assert.equal(broker.available,true);assert.deepEqual([...broker.configured],['nativeReadCredential','serviceSecret','readModeServiceSecret']);
 assert.equal(await broker.getNativeCredential({}),'SYNTHETIC_NATIVE');assert.equal(await broker.getServiceSecret({}),'SYNTHETIC_SERVICE');assert.equal(await broker.getReadModeServiceSecret({}),'SYNTHETIC_SERVICE');
 assert.equal(Object.values(broker).includes(CONTROL),false);
});

for(const [label,candidate] of Object.entries(CANDIDATE))for(const key of Object.keys(READ))test(`startup refuses ${key} at the ${label} credential path`,async()=>{
 const s=secretFixture();await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:{...READ,[key]:candidate},readSecret:s.readSecret}),code('CONFIGURATION'));
});

for(const [label,candidate] of Object.entries(CANDIDATE))for(const key of Object.keys(READ))test(`startup refuses ${key} holding the ${label} credential bytes`,async()=>{
 const s=secretFixture();s.files.set(READ[key],s.files.get(candidate));
 await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret}),code('CONFIGURATION'));
});

test('the native read bearer is never the service secret, by path or by bytes',async()=>{
 const s=secretFixture();
 await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:{...READ,nativeReadCredential:READ.serviceSecret},readSecret:s.readSecret}),code('CONFIGURATION'));
 s.files.set(READ.nativeReadCredential,'SYNTHETIC_SERVICE');
 await assert.rejects(createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret}),code('CONFIGURATION'));
});

test('a read secret file that later holds the control credential fails closed per call',async()=>{
 const s=secretFixture(),broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:READ,readSecret:s.readSecret});
 for(const [key,name] of [['nativeReadCredential','getNativeCredential'],['serviceSecret','getServiceSecret'],['readModeServiceSecret','getReadModeServiceSecret']]){
  const before=s.files.get(READ[key]);s.files.set(READ[key],CONTROL);await assert.rejects(broker[name]({}),code('UNAVAILABLE'));
  s.files.delete(READ[key]);await assert.rejects(broker[name]({}),code('UNAVAILABLE'));s.files.set(READ[key],before);
 }
});

test('without the bearer or service secret file the broker is unavailable and exposes no getter',async()=>{
 const s=secretFixture();
 for(const omit of ['nativeReadCredential','serviceSecret']){const {[omit]:ignored,...rest}=READ,broker=await createNativeReadCredentialBroker({configuration:s.configuration,secretFiles:rest,readSecret:s.readSecret});
  assert.equal(broker.available,false);assert.equal(broker[omit==='nativeReadCredential'?'getNativeCredential':'getServiceSecret'],undefined);}
});

async function composed({secretFiles=READ,gateway}={}){
 const f=await installationFixture(),s=secretFixture(),outbound=[];
 // One Core origin: authority routes reach the fake Core, tool routes the bill-text source. Every request is recorded.
 const fetchImpl=async(url,init)=>{outbound.push({path:new URL(url).pathname,headers:{...init.headers}});
  return new URL(url).pathname.startsWith('/api/clio/application-authority/')?f.core.fetchImpl(url,init):f.transport.fetchImpl(url,init);};
 const ports=gateway??{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits,discoveryOwner:f.gatewayConfiguration.discoveryOwner,
  readCurrentInstallation:proof=>f.installationOwner.readCurrent({signal:proof.signal})};
 const composer=await createControlReadsComposer({configuration:s.configuration,secretFiles,readSecret:s.readSecret,now:f.now,fetchImpl,gateway:ports,defaultCongress:119,familyIds:[f.family]});
 const mounted=f.prepared({createReadsRuntime:inner=>composer.createReadsRuntime({...f.tuple,...inner})});
 const client=createNativeReadsClient({origin:'https://native.synthetic.invalid',credential:f.tuple.taskCapability,binding:f.binding,approvedReads:f.tuple.approvedReads,fetchImpl:(url,init)=>mounted.application.handle(new Request(url,init)),now:f.now});
 return {f,s,outbound,composer,client};
}
const carries=(request,secret)=>Object.values(request.headers).some(value=>String(value).includes(secret));

test('composed native read sends the native read bearer and service secret; no request carries a candidate credential',async()=>{
 const x=await composed();
 try{
  assert.deepEqual(x.composer.missing,[]);assert.deepEqual(x.composer.familyIds,[x.f.family]);
  const raw=await x.client.execute({operation:x.f.operation,arguments:x.f.request,deliveryId:'composer:native-read:1'});assert.deepEqual(JSON.parse(raw).binding,x.f.binding);
  assert.equal(x.f.wire.length,1);assert.equal(x.f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(x.f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.ok(x.outbound.some(r=>r.path==='/api/clio/application-authority/identity'));assert.ok(x.outbound.some(r=>r.path.startsWith('/api/clio/tools/')));
  for(const request of x.outbound)for(const candidate of Object.values(CANDIDATE))assert.equal(carries(request,x.s.files.get(candidate)),false,`${request.path} carries ${candidate}`);
  for(const request of x.outbound.filter(r=>/^\/api\/clio\/application-authority\/(identity|context|membership)$/u.test(r.path)))assert.equal(request.headers['x-internal-service-secret'],undefined,request.path);
 }finally{x.f.scope.abort();}
});

test('composed read fails closed before Core when the bearer file is replaced by the control credential',async()=>{
 const x=await composed();
 try{
  x.s.files.set(READ.nativeReadCredential,CONTROL);
  await assert.rejects(x.client.execute({operation:x.f.operation,arguments:x.f.request,deliveryId:'composer:control-substitute:1'}));
  assert.equal(x.f.wire.length,0);assert.equal(x.outbound.some(r=>carries(r,CONTROL)),false);assert.equal(x.f.state.reservations.size,0);
 }finally{x.f.scope.abort();}
});

for(const omit of READ_GATEWAY_INPUTS)test(`missing gateway.${omit} composes the unavailable runtime without credentials or source IO`,async()=>{
 const f0=await installationFixture(),ports={authority:f0.gatewayConfiguration.authority,limits:f0.gatewayConfiguration.limits,discoveryOwner:f0.gatewayConfiguration.discoveryOwner,readCurrentInstallation:()=>{throw Error('UNREACHABLE');}};
 f0.scope.abort();delete ports[omit];const x=await composed({gateway:ports});
 try{
  assert.deepEqual(x.composer.missing,[`gateway.${omit}`]);
  await assert.rejects(x.client.readAvailability());await assert.rejects(x.client.execute({operation:x.f.operation,arguments:x.f.request,deliveryId:`composer:missing-${omit}:1`}));
  assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);
 }finally{x.f.scope.abort();}
});

test('missing secret files compose the unavailable runtime and report only key names',async()=>{
 const x=await composed({secretFiles:{readModeServiceSecret:READ.readModeServiceSecret}});
 try{
  assert.deepEqual(x.composer.missing,['secretFiles.nativeReadCredential','secretFiles.serviceSecret']);
  await assert.rejects(x.client.readAvailability());assert.equal(x.outbound.length,0);assert.equal(x.f.wire.length,0);
  assert.equal(JSON.stringify(x.composer.missing).includes('SYNTHETIC'),false);
 }finally{x.f.scope.abort();}
});

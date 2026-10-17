import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {productControlFixture} from '../../proxy/product/test/control-fixture.mjs';
import {validateConfiguration} from '../config.mjs';
import {compileProductMaterialPlan} from '../material-init-plan.mjs';
import {validateStaticProductDelivery} from '../material-init.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {inspectTemporalProductTokenDelivery} from '../temporal-product-token-writer.mjs';
import {startRuntimeTemporalAuthorization} from '../temporal-product-runtime.mjs';
import {main} from '../cli.mjs';

function configuration(role='control'){
 const c=productControlFixture().configuration;
 c.nativeCandidate.multiRun.materialDirectory='/tmp/meri-material';
 c.temporal.namespace='meri';c.temporal.taskQueue='meri-conversations';
 c.temporal.authorization={tokenFile:'/run/meri-temporal/token.json',namespace:'meri',audience:'meri-temporal',issuer:'https://issuer.synthetic.invalid:8445/',refreshMs:5000,maxLifetimeMs:60000};
 c.temporal.tokenWriter={enabled:true,role,subject:role==='control'?'meri-temporal-control:v1':'meri-temporal-worker:v1',
  workloadPrincipal:role==='control'?'meri-workload-control:v1':'meri-workload-worker:v1',maxRequestMs:1000,authorization:c.temporal.authorization};
 c.temporal.issuerDelivery={schemaVersion:1,issuerOrigin:'https://issuer.synthetic.invalid:8445',namespace:'meri',audience:'meri-temporal',
  identity:{role,subject:c.temporal.tokenWriter.subject,workloadPrincipal:c.temporal.tokenWriter.workloadPrincipal},
  publicKey:{kid:'synthetic-v1',alg:'RS256',jwkSha256:'c'.repeat(64),manifestFile:'/run/meri/issuer-jwks.json'},
  tls:{serverName:'issuer.synthetic.invalid',issuerCaFile:'/run/meri/issuer-ca.pem',clientCertFile:'/run/meri-temporal/identity/client-cert.pem',clientKeyFile:'/run/meri-temporal/identity/client-key.pem'},requestTimeoutMs:1000,maxReplyBytes:16384};
 c.temporal.issuerBootstrap={enabled:true,configuration:{schemaVersion:1,role,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/synthetic',revision:'synthetic-v1',issuerOrigin:c.temporal.issuerDelivery.issuerOrigin,serverName:'issuer.synthetic.invalid',peerSubjectCn:'synthetic-'+role,peerUriBase:'spiffe://synthetic.invalid/temporal/',serverCaSha256:'a'.repeat(64),clientCaSha256:'b'.repeat(64),requestTimeoutMs:1000,totalTimeoutMs:3000,maxReplyBytes:16384},serverCaFile:c.temporal.issuerDelivery.tls.issuerCaFile,clientCaFile:'/run/meri/issuer-client-ca.pem',directory:'/run/meri-temporal/identity',keyFile:c.temporal.issuerDelivery.tls.clientKeyFile,certFile:c.temporal.issuerDelivery.tls.clientCertFile};
 if(role==='temporal-worker'){
  for(const k of ['database','sessions','versions','nativeCandidate','privateHttp','taskRouter'])delete c[k];
  c.native.preparedKickoff=true;c.http.port=8081;
 }
 return c;
}

test('control and poller configuration join one writer, exact issuer identity and a separate initially empty token path',()=>{
 for(const role of ['control','temporal-worker']){
  const c=configuration(role);validateConfiguration(c,role);
  const plan=compileProductMaterialPlan({role,configuration:c,runtimeUser:'1000:1000'}),paths=plan.requiredFiles.map(f=>f.path);
  assert.deepEqual(plan.temporalTokenWriter,{directory:'/run/meri-temporal',tokenFile:'/run/meri-temporal/token.json',identityDirectory:'/run/meri-temporal/identity',role});
  assert.equal(paths.includes(c.temporal.authorization.tokenFile),false);
  for(const p of [c.temporal.issuerDelivery.publicKey.manifestFile,c.temporal.issuerDelivery.tls.issuerCaFile,c.temporal.issuerBootstrap.clientCaFile])assert.ok(paths.includes(p));
  for(const p of [c.temporal.issuerBootstrap.keyFile,c.temporal.issuerBootstrap.certFile])assert.equal(paths.includes(p),false);
  const files=plan.requiredFiles.map(f=>({path:f.path,base64:Buffer.from(f.path===plan.configurationPath?JSON.stringify(c):'synthetic-existing-material').toString('base64')}));
  const contract={schemaVersion:1,role,runtimeUser:'1000:1000',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),
   sha256ByPath:Object.fromEntries(files.map(f=>[f.path,createHash('sha256').update(Buffer.from(f.base64,'base64')).digest('hex')]))};
  const expected={...contract,materialContractSha256:canonicalSha256(contract)};
  const receipt=validateStaticProductDelivery({expected,bundle:{files}});assert.equal(receipt.fileCount,files.length);
  assert.equal(JSON.stringify(receipt).includes('synthetic-existing-material'),false);
  files.push({path:'/run/meri/temporal-token.json',base64:Buffer.from('obsolete-static-token').toString('base64')});
  assert.throws(()=>validateStaticProductDelivery({expected,bundle:{files}}),/STATIC_INIT_/);
 }
});

test('issuer/role/path/dual-owner drift fails before any file read or connection',()=>{
 for(const change of [
  c=>{c.temporal.tokenWriter.role='temporal-worker';},c=>{c.temporal.tokenWriter.authorization={...c.temporal.authorization,tokenFile:'/run/meri/token.json'};},
  c=>{delete c.temporal.issuerDelivery;},c=>{c.temporal.issuerDelivery.issuerOrigin+='/' ;},
  c=>{c.temporal.issuerDelivery.identity.subject='other';},c=>{c.temporal.issuerDelivery.publicKey.alg='HS256';},
  c=>{c.temporal.issuerDelivery.tls.serverName='foreign.invalid';},c=>{c.temporal.issuerDelivery.requestTimeoutMs=3000;},
 ]){const c=configuration();change(c);assert.throws(()=>validateConfiguration(c,'control'));}
 const c=configuration();delete c.temporal.tokenWriter;assert.throws(()=>validateConfiguration(c,'control'));
});

test('real startup function orders authenticated delivery, canonical publication validation, provider and rotation before service readiness',async()=>{
 const c=configuration(),events=[],watchers=new Set();let token,current=false,losses=0,serial=0;
 const delivery={async read(request){events.push('issuer');assert.equal(request.issuer,c.temporal.issuerDelivery.issuerOrigin+'/');
  const at=Date.now();return {schemaVersion:1,state:'CURRENT',identity:c.temporal.issuerDelivery.identity,observedAtMs:at,validUntilMs:at+9000,
   token:{token:'synthetic-existing-token-'+(++serial),expiresAtMs:at+8000,claims:{namespace:'meri',audience:'meri-temporal',issuer:request.issuer}}};}};
 const writer={async refresh({signal}={}){const at=Date.now(),v=await delivery.read({schemaVersion:1,...c.temporal.issuerDelivery.identity,
  namespace:'meri',audience:'meri-temporal',issuer:c.temporal.authorization.issuer,signal});
  await inspectTemporalProductTokenDelivery({configuration:c.temporal.tokenWriter,value:v,requestStartedAtMs:at,nowMs:Date.now()});
  token=v.token;current=true;events.push('publish');},async start(v){return writer.refresh(v);},async close(){current=false;watchers.clear();events.push('writer-close');},
  healthy:()=>current,status:()=>({expiresAtMs:token?.expiresAtMs}),watch(fn){watchers.add(fn);return ()=>watchers.delete(fn);}};
 const authorization=await startRuntimeTemporalAuthorization(c,{delivery,onUnavailable:()=>{losses++;},testOwners:{createWriter:()=>writer,
  createReader:()=>({async read(){events.push('read-file');return token;}})}});
 assert.deepEqual(events,['issuer','publish','read-file']);assert.equal(authorization.healthy(),true);
 const rotated=[];authorization.attach({async setApiKey(t){rotated.push(t);events.push('rotate');}});
 await authorization.refresh();assert.equal(rotated.length,1);assert.equal(events.at(-1),'rotate');
 current=false;for(const w of [...watchers])w('revoked');assert.equal(losses,1);assert.equal(authorization.healthy(),false);
 assert.throws(()=>authorization.apiKey(),/UNAVAILABLE/);await authorization.close();assert.equal(events.at(-1),'writer-close');
});

test('actual CLI rejects a static-token product control before starting any runtime owner',async()=>{
 const c=configuration();delete c.temporal.tokenWriter;delete c.temporal.issuerDelivery;delete c.temporal.issuerBootstrap;
 c.taskRouter.poststart={enabled:true,runnerCaKeyFile:'/run/meri/runner-ca.key',controlCaFile:'/run/meri/control-ca.pem'};
 const directory=await mkdtemp(join(tmpdir(),'meri-product-cli-')),path=join(directory,'control.json'),old=process.env.MERI_PRODUCT_PREVIEW_REQUIRED;
 try{await writeFile(path,JSON.stringify(c));process.env.MERI_PRODUCT_PREVIEW_REQUIRED='1';assert.equal(await main(['control','--config',path]),2);}
 finally{if(old===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=old;await rm(directory,{recursive:true,force:true});}
});

test('actual issuer startup keeps a fulfilled pending cleanup receipt visible instead of masking it as the original failure',async()=>{
 const original=Error('synthetic writer allocation refused');let closed=0;
 await assert.rejects(startRuntimeTemporalAuthorization(configuration(),{onUnavailable(){},testOwners:{
  createBootstrap:async()=>({ensureCurrent:async()=>({revision:1,issuerDeliveryConfiguration:configuration().temporal.issuerDelivery}),close(){}}),
  createDelivery:()=>({read:async()=>{throw original;},close(){closed++;return {unsettledOperations:1,physicalStopProven:false};}}),
  createWriter({delivery}){return {async refresh({signal}){await delivery.read({signal});},start:async()=>{},close:async()=>{},status:()=>({}),healthy:()=>false,watch:()=>()=>{}};},createReader:()=>({read:async()=>{throw Error('unused');}}),
 }}),error=>error.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'&&error.cause instanceof AggregateError&&error.cause.errors[1]?.cause?.unsettledOperations===1);
 assert.equal(closed,1);
});

test('compiled delivery mount drains the old client before rotating identity and creating its replacement',async()=>{
 const c=configuration(),events=[];let generation=0,token,current=false,writerDelivery;
 const writer={async refresh({signal}={}){const at=Date.now(),value=await writerDelivery.read({schemaVersion:1,...c.temporal.issuerDelivery.identity,namespace:'meri',audience:'meri-temporal',issuer:c.temporal.authorization.issuer,signal});
  await inspectTemporalProductTokenDelivery({configuration:c.temporal.tokenWriter,value,requestStartedAtMs:at,nowMs:Date.now()});token=value.token;current=true;},start:async()=>{},async close(){current=false;},status:()=>({expiresAtMs:token?.expiresAtMs}),healthy:()=>current,watch:()=>()=>{}};
 const authorization=await startRuntimeTemporalAuthorization(c,{onUnavailable(){},testOwners:{
  createBootstrap:async()=>({async ensureCurrent({beforeRotation}){if(generation)await beforeRotation();generation++;events.push('bootstrap'+generation);return {revision:generation,issuerDeliveryConfiguration:c.temporal.issuerDelivery};},close(){events.push('bootstrap-close');}}),
  createDelivery:()=>{const ownGeneration=generation;events.push('create'+ownGeneration);return {async read(request){events.push('read'+ownGeneration);const at=Date.now();return {schemaVersion:1,state:'CURRENT',identity:c.temporal.issuerDelivery.identity,observedAtMs:at,validUntilMs:at+9000,token:{token:'synthetic-existing-token-'+ownGeneration,expiresAtMs:at+8000,claims:{namespace:'meri',audience:'meri-temporal',issuer:request.issuer}}};},close(){events.push('close'+ownGeneration);return {unsettledOperations:0};}};},
  createWriter:({delivery})=>{writerDelivery=delivery;return writer;},createReader:()=>({read:async()=>token}),
 }});
 await authorization.refresh();assert.deepEqual(events,['bootstrap1','create1','read1','close1','bootstrap2','create2','read2']);
 assert.equal(authorization.healthy(),true);await authorization.close();assert.ok(events.includes('close2'));
});

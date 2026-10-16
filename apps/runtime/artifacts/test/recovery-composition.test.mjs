/** SYNTHETIC actual artifact/retention owners with scripted SQL and SDK replies. No services, credentials, renderer or children. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createArtifactRecoveryBinding} from '../recovery-binding.mjs';
import {createRuntimeArtifactStorage,createRuntimeDocumentOptionsComposer,runtimeArtifactRecovery} from '../composition.mjs';
import {captureRuntimePorts,composeRuntimePorts,readRuntimeArtifactRecovery} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {assembleControl} from '../../control.mjs';
import {createRetentionStartup} from '../../../control/retention/startup.mjs';
import {composeStartup} from '../../../control/retention/test/fixture.mjs';
import {versions as contractVersions} from '../../../control/conversations/test/store-fixture.mjs';
import {artifactValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const unused=()=>assert.fail('unrelated owner or service IO');
const artifactId='00000000-0000-4000-8000-000000000001';
const pool={connect:unused},now=()=>1800000000000;
function fixture({preview=true,enabled=true,failProjection=false,orphan=false}={}){
 const f=composeStartup(),events=[];let inventory=0,inside=0,s3Calls=0,records=0;
 const journal={...f.journal,async exclusive(body){assert.equal(inside,0,'no nested recovery exclusion');return f.journal.exclusive(async()=>{inside++;try{return await body();}finally{inside--;}});},
  async tx(body,options){assert.equal(inside,1);assert.equal(options.exclusive,true);return body({async query(sql){
   if(sql.startsWith('SELECT artifact_id FROM')){inventory++;events.push('versions');return {rows:orphan?[{artifact_id:artifactId}]:[]};}
   if(sql.startsWith('SELECT a.*,p.record')){events.push('previews');if(failProjection)throw Error('SYNTHETIC_PROJECTION_FAILURE');return {rows:[]};}
   assert.fail('unexpected recovery SQL: '+sql);
  }});},readProjection:unused};
 const binding=createArtifactRecoveryBinding({journal});
 const client={async send(command){s3Calls++;assert.equal(inside,1,'SDK reads remain within the existing exclusion');assert.equal(command.input.ExpectedBucketOwner,'111122223333');
  if(command.constructor.name==='GetBucketVersioningCommand')return {Status:'Enabled'};
  if(command.constructor.name==='GetObjectCommand')throw Object.assign(Error('synthetic empty evidence'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});
  assert.fail('recovery must not publish or write objects');
 }};
 const s3={client,bucket:'synthetic-mount-bucket',prefix:'runtime-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001'};
 const storage=createRuntimeArtifactStorage({s3,versionsPool:pool,now:f.clock.now,custody:{...binding.context,tenantId:'tenant-a',evidenceS3:s3,enabled,...(preview?{artifactId}:{})}});
 const ports=composeRuntimePorts({},captureRuntimePorts({artifactStore:storage}));
 const callback=binding.configure(readRuntimeArtifactRecovery(ports),true);
 const watermark={...f.watermark,async record(...args){records++;events.push('watermark');return f.watermark.record(...args);}};
 const startup=createRetentionStartup({journal,watermark,ledgerSink:f.sink,purge:{enabled:false},now:f.clock.now,recoverPrerequisitesExclusive:callback});binding.bindRetention(startup.gate);
 return {f,journal,binding,storage,ports,startup,events,s3,counts:()=>({inventory,inside,s3Calls,records})};
}
for(const preview of [false,true])test(`canonical ${preview?'preview':'publication-only'} recovery restores versions once under the same exclusion, even with no preview rows`,async()=>{
 const x=fixture({preview});assert.deepEqual(x.counts(),{inventory:0,inside:0,s3Calls:0,records:0});assert.equal(x.startup.serving.isEnabled(),false);
 await x.startup.start();assert.equal(x.startup.serving.isEnabled(),true);assert.equal(x.counts().inventory,1);assert.equal(x.counts().records,1);assert.equal(x.counts().inside,0);
 assert.deepEqual(x.events,preview?['versions','previews','watermark']:['versions','watermark']);assert.equal(x.f.journal.lock.state().waiting,0);
 const proof=readRuntimeArtifactRecovery(x.ports);assert.equal(proof.versions,x.storage.versions);assert.equal(proof.journal,x.journal);assert.equal(proof.retention,x.binding.context.retention);
});
for(const options of [{failProjection:true},{orphan:true}])test(`recovery ${options.orphan?'unverified SQL inventory':'projection failure'} cannot record a watermark or open serving`,async()=>{
 const x=fixture(options);await assert.rejects(x.startup.start(),options.orphan?/PUBLICATION_UNVERIFIED/:/PREVIEW_STORE_UNAVAILABLE/);
 assert.equal(x.counts().inventory,1);assert.equal(x.counts().records,0);assert.equal(x.counts().inside,0);assert.equal(x.startup.serving.isEnabled(),false);
});
test('disabled canonical storage stays unavailable without any SQL or SDK calls',async()=>{
 const x=fixture({enabled:false});assert.equal(x.binding.state().state,'disabled');await assert.rejects(x.startup.start(),/ARTIFACT_RECOVERY_UNAVAILABLE/);
 assert.deepEqual(x.counts(),{inventory:0,inside:0,s3Calls:0,records:0});assert.equal(x.startup.serving.isEnabled(),false);
 const status=productReadiness({ports:x.ports,retention:{artifactRecovery:x.binding.state},sourceEnabled:false});assert.equal(status.ready,false);
 assert.deepEqual(status.owners.find(row=>row.name==='retention.artifactRecovery'),{name:'retention.artifactRecovery',state:'disabled'});
});
test('missing and caller-authored recovery cannot qualify a declared artifact store',async()=>{
 const f=composeStartup(),binding=createArtifactRecoveryBinding({journal:f.journal});let called=false;
 const ports=captureRuntimePorts({artifactStore:{verifyPrivate:unused,recoverPrerequisitesExclusive(){called=true;}}});assert.equal(readRuntimeArtifactRecovery(ports),null);
 const recover=binding.configure(null,true);binding.bindRetention({assertServable:unused});await assert.rejects(recover(),/ARTIFACT_RECOVERY_UNAVAILABLE/);assert.equal(called,false);
 assert.throws(()=>captureRuntimePorts({artifactStore:new Proxy({verifyPrivate:unused},{})}),/CONFIGURATION/);
});
test('canonical provenance survives recapture; mismatched raw journal or retention forwarder refuses',()=>{
 const x=fixture(),captured=composeRuntimePorts({},{artifactStore:x.ports.artifactStore});assert.equal(readRuntimeArtifactRecovery(captured),runtimeArtifactRecovery(x.storage));
 const another=createArtifactRecoveryBinding({journal:composeStartup().journal});assert.throws(()=>another.configure(readRuntimeArtifactRecovery(captured),true),/PRODUCT_PORTS_CONFIGURATION/);
 const sameJournal=createArtifactRecoveryBinding({journal:x.journal});assert.throws(()=>sameJournal.configure(readRuntimeArtifactRecovery(captured),true),/PRODUCT_PORTS_CONFIGURATION/);
});
test('absent capability leaves the existing optional callback absent; invalid enable values cannot normalize to disabled',()=>{
 const f=composeStartup(),binding=createArtifactRecoveryBinding({journal:f.journal});assert.equal(binding.configure(null,false),null);assert.deepEqual(binding.state(),{required:false,state:'not-required'});
 const x=fixture(),record=runtimeArtifactRecovery(x.storage);assert.throws(()=>createRuntimeArtifactStorage({s3:x.s3,versionsPool:pool,now,custody:{journal:record.journal,retention:record.retention,tenantId:'tenant-a',evidenceS3:x.s3,enabled:null}}),/ARTIFACT_RUNTIME_CONFIGURATION/);
 assert.throws(()=>binding.configure(null,false),/PRODUCT_PORTS_CONFIGURATION/);
});
test('document composition uses the SAME canonical versions and preview owners and refuses a competing preview store',()=>{
 const x=fixture(),compose=createRuntimeDocumentOptionsComposer({storage:x.storage,executor:{},budgetPool:{},sessions:{},now});
 const output=compose({selectedClientId:'synthetic',credential:'synthetic',limits:{},artifactOptions:{pool:{},allocationJson:{},producerContext:{},descriptor:{},context:{},validators:artifactValidators,authority:{},authorize:unused,versions:{},objects:{},executor:{},now,ids:{},newReservationId:unused,limits:{}});
 assert.equal(output.artifactOptions.versions,x.storage.versions);assert.equal(output.previewOptions.previews,x.storage.previews);
 assert.throws(()=>createRuntimeDocumentOptionsComposer({storage:x.storage,executor:{},budgetPool:{},sessions:{},now,previews:{}}),/ARTIFACT_RUNTIME_CONFIGURATION/);
});
test('actual control factory receives its canonical raw journal/forwarder before port capture, without constructor IO',()=>{
 const configuration={versions:contractVersions,sourceEnabled:false,retention:{},sessions:{maxSessions:10,maxTtlMs:30000},limits:{requestMs:1000,requestBytes:131072},native:{maxResponseBytes:2097152},temporal:{taskQueue:'synthetic'}};
 let storage,context;const assembly=assembleControl({configuration,pool,client:{workflow:{start:unused,getHandle:unused}},native:{call:unused},now,productPortsFactory(c){context=c.artifactRecovery;
  const s3={client:{send:unused},bucket:'synthetic-mount-bucket',prefix:'runtime-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001'};
  storage=createRuntimeArtifactStorage({s3,versionsPool:c.pool,now:c.now,custody:{...context,tenantId:'tenant-a',evidenceS3:s3,artifactId,enabled:true}});return {artifactStore:storage};
 }});
 try{assert.equal(runtimeArtifactRecovery(storage).journal,context.journal);assert.deepEqual(assembly.retention.artifactRecovery(),{required:true,state:'composed'});assert.equal(assembly.retention.serving.isEnabled(),false);assert.equal(assembly.productReadiness().ready,false);}finally{assembly.close();}
});

/** SYNTHETIC S3 client, pool and Core artifact authority only. The actual artifact storage, recovery binding, product-port
 * composer and control assembly run; no AWS, database, credential or network is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createDocumentsFamily,documentsFamily,bindDocumentsSessions} from '../documents.mjs';
import {compileRuntimeArtifactsConfiguration} from '../../artifacts/configuration.mjs';
import {runtimeArtifactRecovery} from '../../artifacts/composition.mjs';
import {createArtifactRecoveryBinding} from '../../artifacts/recovery-binding.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {assembleControl} from '../../control.mjs';
import {createPostgresRetentionJournal} from '../../../control/retention/postgres-journal.mjs';
import {versions as contractVersions} from '../../../control/conversations/test/store-fixture.mjs';
import {artifactValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';

const unused=()=>assert.fail('no SQL, SDK or native call during composition');
const now=()=>1800000000000,pool=Object.freeze({connect:unused});
const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001';
const artifacts=(extra={})=>({enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,...extra});
const base=(extra={})=>({versions:contractVersions,sourceEnabled:false,sessions:{maxSessions:10,maxTtlMs:30000},limits:{requestMs:1000,requestBytes:131072},native:{maxResponseBytes:2097152},temporal:{taskQueue:'synthetic'},...extra});
const code=c=>e=>e?.code===c;
function privateBucketClient(){
 const sent=[];
 const replies={GetPublicAccessBlockCommand:{PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true}},
  GetBucketPolicyStatusCommand:{PolicyStatus:{IsPublic:false}},GetBucketOwnershipControlsCommand:{OwnershipControls:{Rules:[{ObjectOwnership:'BucketOwnerEnforced'}]}},GetBucketVersioningCommand:{Status:'Enabled'}};
 return {sent,client:{async send(command){sent.push(command.constructor.name);assert.equal(command.input.ExpectedBucketOwner,'111122223333');assert.equal(command.input.Bucket,'synthetic-artifact-bucket');
  const reply=replies[command.constructor.name];if(!reply)assert.fail('unexpected SDK command '+command.constructor.name);return structuredClone(reply);}}};
}
function family(owners={}){const clients=[];const s3=privateBucketClient();
 return {clients,s3,factory:documentsFamily({...owners,createS3Client(options){clients.push(options);return s3.client;}})};}

test('the artifacts declaration is closed: required storage keys, same-region KMS key, tenantId exactly with retention',()=>{
 assert.equal(compileRuntimeArtifactsConfiguration({}),null);
 assert.deepEqual(compileRuntimeArtifactsConfiguration({artifacts:{enabled:false}}),{enabled:false});
 assert.ok(Object.isFrozen(compileRuntimeArtifactsConfiguration({artifacts:artifacts()})));
 assert.equal(compileRuntimeArtifactsConfiguration({retention:{enabled:true},artifacts:artifacts({tenantId:'tenant-a'})}).tenantId,'tenant-a');
 for(const [label,configuration] of Object.entries({
  missingBucket:{artifacts:(({bucket:_,...rest})=>rest)(artifacts())},unknownKey:{artifacts:artifacts({endpoint:'https://s3.invalid'})},
  nonBooleanEnabled:{artifacts:artifacts({enabled:'true'})},directoryBucket:{artifacts:artifacts({bucket:'synthetic--use1-az4--x-s3'})},
  kmsAlias:{artifacts:artifacts({kmsKeyId:'alias/meri-artifacts'})},kmsOtherRegion:{artifacts:artifacts({kmsKeyId:kmsKeyId.replace('us-east-1','us-west-2')})},
  ownerShape:{artifacts:artifacts({expectedBucketOwner:'1111'})},trailingPrefix:{artifacts:artifacts({prefix:'meri/'})},
  tenantWithoutRetention:{artifacts:artifacts({tenantId:'tenant-a'})},retentionWithoutTenant:{retention:{enabled:true},artifacts:artifacts()},
  invalidWhileDisabled:{artifacts:{enabled:false,bucket:'UPPER'}},getter:{artifacts:Object.defineProperty(artifacts(),'bucket',{get:()=>'x',enumerable:true})},
 }))assert.throws(()=>compileRuntimeArtifactsConfiguration(configuration),code('ARTIFACT_CONFIGURATION'),label);
});

test('absent or disabled artifacts compose no port and construct no client',()=>{
 const f=family();
 for(const configuration of [base(),base({artifacts:{enabled:false}}),base({artifacts:{...artifacts(),enabled:false}})])
  assert.deepEqual(f.factory(Object.freeze({configuration,pool,now})),{ports:{}});
 assert.equal(f.clients.length,0);
 assert.throws(()=>f.factory(Object.freeze({configuration:base({artifacts:artifacts({kmsKeyId:'alias/x'})}),pool,now})),code('PRODUCT_PORTS_CONFIGURATION'));
});

test('an enabled store composes through the production composer without IO and proves the bucket private only when asked',async()=>{
 const f=family(),context=Object.freeze({configuration:base({artifacts:artifacts()}),pool,now,canonicalProductPorts:captureRuntimePorts({})});
 const ports=createProductPortsFactory({families:[['documents',f.factory]]})(context);
 assert.deepEqual(Object.keys(ports),['artifactStore']);assert.deepEqual(f.clients,[{region:'us-east-1'}]);assert.deepEqual(f.s3.sent,[]);
 const captured=captureRuntimePorts(ports);assert.deepEqual(captured.configuredOwners,['artifactStore']);
 assert.deepEqual(await captured.artifactStore.verifyPrivate({}),{publicAccessBlocked:true,policyPublic:false,objectOwnership:'BucketOwnerEnforced',versioning:'Enabled'});
 assert.deepEqual(f.s3.sent,['GetPublicAccessBlockCommand','GetBucketPolicyStatusCommand','GetBucketOwnershipControlsCommand','GetBucketVersioningCommand']);
 // Without publication custody the versions owner refuses before SQL (postgres-versions.mjs:11); the pool stays untouched.
 await assert.rejects(ports.artifactStore.versions.read('00000000-0000-4000-8000-000000000002'),/ARTIFACT_PUBLICATION_UNAVAILABLE/u);
});

test('the production registration constructs the pinned SDK client synchronously with no request',()=>{
 const ports=createDocumentsFamily(Object.freeze({configuration:base({artifacts:artifacts()}),pool,now}));
 assert.equal(typeof ports.ports.artifactStore.verifyPrivate,'function');assert.equal('artifactOptionsOwner' in ports.ports,false);
});

test('declared retention binds enabled publication custody to control\'s own recovery forwarder, and refuses to compose without it',()=>{
 const f=family(),recovery=createArtifactRecoveryBinding({journal:createPostgresRetentionJournal({pool,now})});
 const configuration=base({retention:{enabled:true},artifacts:artifacts({tenantId:'tenant-a'})});
 assert.deepEqual(f.factory(Object.freeze({configuration,pool,now})),{ports:{}},'no recovery forwarder, no store');assert.equal(f.clients.length,0);
 const {ports}=f.factory(Object.freeze({configuration,pool,now,artifactRecovery:recovery.context}));
 const record=runtimeArtifactRecovery(ports.artifactStore);assert.equal(record.journal,recovery.context.journal);assert.equal(record.retention,recovery.context.retention);assert.equal(record.state,'composed');
 assert.deepEqual(f.s3.sent,[]);
});

test('actual control assembly: the store composes, retention recovery is composed, options stay a named gap, documents answer 503',async()=>{
 const f=family();let seen;
 const assembly=assembleControl({configuration:base({retention:{enabled:true},artifacts:artifacts({tenantId:'tenant-a'})}),pool,client:{workflow:{start:unused,getHandle:unused}},native:{call:unused},now,
  productPortsFactory:createProductPortsFactory({families:[['documents',context=>{seen=context;return f.factory(context);}]]})});
 try{
  assert.ok(seen.artifactRecovery);assert.deepEqual(assembly.retention.artifactRecovery(),{required:true,state:'composed'});
  const readiness=assembly.productReadiness(),state=name=>readiness.owners.find(o=>o.name===name)?.state;
  assert.equal(state('artifacts.privateStore'),'composed');assert.equal(state('artifacts.options'),'unavailable');assert.equal(state('retention.artifactRecovery'),'composed');
  const response=await assembly.application.handle(new Request('https://control.invalid/api/documents/create',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,503);assert.deepEqual(f.s3.sent,[]);
 }finally{assembly.close();}
});

test('a supplied Core authority composes a late-bound options owner that answers null until control binds its sessions',async()=>{
 const calls=[],mode={reply:'valid'},authority={async resolve(call){if(mode.reply==='null')return null;if(mode.reply==='extra')return {artifactOptions:{},selectedClientId:'x',credential:'y',limits:{},recheck(){},sessions:{}};calls.push(call);return {artifactOptions:{pool:{},allocationJson:{},producerContext:{},descriptor:{},context:{},validators:artifactValidators,authority:{},authorize:unused,versions:{},objects:{},executor:{},now,ids:{},newReservationId:unused,limits:{}},
  selectedClientId:'synthetic-client',credential:'synthetic-artifact-credential',limits:{},recheck(check){calls.push(['recheck',check.phase]);return {};}};}};
 const executor={execute:unused},budgetPool={connect:unused},f=family({authority,executor}),context=Object.freeze({configuration:base({artifacts:artifacts()}),pool:budgetPool,now});
 const {ports}=f.factory(context);assert.deepEqual(Object.keys(ports),['artifactStore','artifactOptionsOwner']);
 const owner=captureRuntimePorts(ports).artifactOptionsOwner,call={credential:'c',intent:'create',body:{},requestSha256:'a'.repeat(64),deadlineMs:now()+1000,signal:new AbortController().signal};
 assert.equal(await owner.resolve(call),null);assert.equal(calls.length,0,'no Core call before the sessions binding');
 const sessions={};assert.equal(bindDocumentsSessions(context,sessions),true);bindDocumentsSessions(context,sessions);
 assert.throws(()=>bindDocumentsSessions(context,{}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.equal(bindDocumentsSessions(Object.freeze({}),sessions),false,'a context without an options owner is a no-op');
 assert.throws(()=>f.factory(context),code('PRODUCT_PORTS_CONFIGURATION'),'one options owner per trusted context');
 const resolved=await owner.resolve(call);
 assert.equal(calls[0].sessions,sessions);assert.equal(calls[0].credential,'c');assert.equal(resolved.documentOptions.sessions,sessions);assert.equal(resolved.documentOptions.now,now);
 assert.equal(resolved.documentOptions.artifactOptions.versions,ports.artifactStore.versions);assert.equal(resolved.documentOptions.artifactOptions.objects,ports.artifactStore.objects);
 assert.equal(resolved.documentOptions.artifactOptions.pool,budgetPool);assert.equal(resolved.documentOptions.artifactOptions.executor,executor);
 await resolved.recheck({phase:'admission'});assert.deepEqual(calls.at(-1),['recheck','admission']);
 // A caller-shaped reply cannot add owners; a null reply stays unavailable.
 mode.reply='extra';await assert.rejects(owner.resolve(call));
 mode.reply='null';assert.equal(await owner.resolve(call),null);
 assert.throws(()=>documentsFamily({authority}),code('PRODUCT_PORTS_CONFIGURATION'),'authority without executor');
 assert.throws(()=>documentsFamily({executor}),code('PRODUCT_PORTS_CONFIGURATION'),'executor without authority');
 assert.throws(()=>documentsFamily({createS3Client:async()=>({})}),code('PRODUCT_PORTS_CONFIGURATION'));
});

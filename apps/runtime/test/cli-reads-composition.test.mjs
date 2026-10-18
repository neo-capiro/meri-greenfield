/** SYNTHETIC control startup through the actual cli.mjs: the routines warning follows late candidate binding; the reads composer
 * receives exactly the configured P2 installation (the measurement
 * parsed from its pinned material file and re-hashed against the configured pin) and P1 discovery (the G2 run capability policy producer, only
 * with `capabilityPlatform`). No listener, SQL, network or real secret: control.mjs, the composer and the live-session relay are mocked at
 * their module boundaries and the measurement bytes are synthetic (the real issuer's catalog/descriptor checks live in the composer tests). */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,normalize} from 'node:path';import {brotliCompressSync} from 'node:zlib';
import * as configurationModule from '../config.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy} from '../product-ports/capability-policy.mjs';

const OP={id:'read_bill_text',version:'0.2.0'},FILE='/run/meri/general-read-installation.json',SERVICE='/run/meri/core-service-secret';
const MEASUREMENT={schema:'meri.general-read-installation-measurement.v1',baseCatalogSha256:'b'.repeat(64),operations:[{operation:OP,family:'bill-text',descriptorSha256:'c'.repeat(64),handlerSourceSha256:'d'.repeat(64)}]};
const PIN=canonicalSha256(MEASUREMENT);
const material=value=>brotliCompressSync(Buffer.from(typeof value==='string'?value:JSON.stringify(value)));
const state={composer:[],returned:[],control:[],secrets:[],bytes:material(MEASUREMENT),startupCandidate:undefined};
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(path){state.secrets.push(path);return Buffer.from(state.bytes);}}});
mock.module('../read-credential-relay.mjs',{namedExports:{createReadCredentialRelay(){return {port:{nativeCredentialFor(){throw Error('not reached');}}};}}});
mock.module('../native-authority/reads-composer.mjs',{namedExports:{async createControlReadsComposer(options){state.composer.push(options);const composed={createReadsRuntime(){},familyIds:Object.freeze([]),missing:Object.freeze([]),
 ...(options.delegation?.enabled?{readDelegation:{runOptions:{async stopRun(){return {stopped:false,revoked:false};}}}}:{})};state.returned.push(composed);return composed;}}});
mock.module('../control.mjs',{namedExports:{async startControl(configuration,ports){state.control.push(ports);if(state.startupCandidate!==undefined)ports.routinesCandidateBinder?.(state.startupCandidate);return {address:{port:0},completion:Promise.resolve(),async close(){}};}}});
const {main}=await import('../cli.mjs');

/** A control configuration with the reads block, on this host's path semantics (the runtime only ever runs on Linux). */
function configuration(reads,extra={}){
 const c=structuredClone(candidateFixture().configuration),intent=c.nativeCandidate.preparationIntent;
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])intent[k]=normalize(intent[k]);
 intent.launchTemplate.command=normalize(intent.launchTemplate.command);intent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=intent.secureStorageDirectory;
 return {...c,...extra,reads};
}
async function start(reads,extra,{candidate}={}){
 const dir=await mkdtemp(join(tmpdir(),'meri-cli-reads-')),file=join(dir,'control.json'),out=[],err=[],o=process.stdout.write.bind(process.stdout),e=process.stderr.write.bind(process.stderr);
 const before=state.composer.length;state.secrets=[];state.startupCandidate=candidate;
 process.stdout.write=t=>{out.push(String(t));return true;};process.stderr.write=t=>{err.push(String(t));return true;};
 try{await writeFile(file,JSON.stringify(configuration(reads,extra)));return {code:await main(['control','--config',file]),out:out.join(''),err:err.join(''),composer:state.composer.slice(before),secrets:[...state.secrets]};}
 finally{state.startupCandidate=undefined;process.stdout.write=o;process.stderr.write=e;await rm(dir,{recursive:true,force:true});}
}

test('routines warning is decided after candidate binding and only for missing attended owners',async()=>{
 const {publicKey}=generateKeyPairSync('ed25519'),jwk=publicKey.export({format:'jwk'});
 const routines={enabled:true,core:{origin:'https://core.synthetic.invalid',serviceSecretFile:join(tmpdir(),'routine-core-secret'),
  cancellationProof:{issuer:'core.synthetic.invalid/meri-routines',kid:'routine-cancel-1',publicKey:{kty:'OKP',crv:'Ed25519',x:jwk.x}}},
 task:{taskId:candidateFixture().binding.runId,version:1},workflow:{taskQueue:'meri-routines',workflowIdPrefix:'meri/routines'}};
 const bound=await start(undefined,{routines},{candidate:{}});
 assert.equal(bound.code,0,bound.err);assert.equal(typeof state.control.at(-1).routinesCandidateBinder,'function');
 assert.doesNotMatch(bound.err,/runtime\.routines\.attended\.unavailable/u);
 const missing=await start(undefined,{routines:{...routines,workflow:undefined}},{candidate:{}});
 assert.equal(missing.code,0,missing.err);
 assert.deepEqual(missing.err.trim().split('\n').map(line=>JSON.parse(line)),[{event:'runtime.routines.attended.unavailable'}]);
});

test('cli passes exactly installation {enabled, measurement, measurementSha256, revokedOperations} and discovery {enabled, capabilityPolicy} to the reads composer',async()=>{
 const r=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:true,measurementSha256:PIN,measurementFile:FILE,revokedOperations:[OP]},discovery:{enabled:true}},{capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM});
 assert.equal(r.code,0,r.err);assert.match(r.out,/runtime\.listening/u);assert.equal(r.composer.length,1);
 const o=r.composer[0];
 assert.deepEqual(Object.keys(o),['configuration','secretFiles','nativeCredentials','gateway','installation','discovery','familyIds']);
 assert.deepEqual(o.secretFiles,{serviceSecret:SERVICE});assert.equal(typeof o.nativeCredentials.nativeCredentialFor,'function');
 assert.equal(typeof o.gateway.authority.identify,'function');assert.equal(typeof o.gateway.authority.check,'function');assert.equal(typeof o.gateway.limits.maxRequestMs,'number');
 assert.deepEqual(o.installation,{enabled:true,measurement:MEASUREMENT,measurementSha256:PIN,revokedOperations:[OP]});
 assert.deepEqual(o.familyIds,['bill-text']);
 assert.deepEqual(Object.keys(o.discovery),['enabled','capabilityPolicy']);assert.equal(o.discovery.enabled,true);
 assert.equal(typeof o.discovery.capabilityPolicy.forRun,'function');
 assert.equal(o.discovery.capabilityPolicy.profileSha256,createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profileSha256);
 // The measurement bytes come from the configured material file only, and the composer's runtime factory reaches control.
 assert.deepEqual(r.secrets,[FILE]);assert.equal(state.control.at(-1).createReadsRuntime,state.returned.at(-1).createReadsRuntime);
});

test('a signed selected-client receipt composes only its genuine task port when Option B is enabled',async()=>{
 const saved=state.bytes,operation={id:'get_client_context',version:'0.3.0'};
 const measurement={...MEASUREMENT,operations:[{...MEASUREMENT.operations[0],operation,family:'client-knowledge-profile'}]};
 state.bytes=material(measurement);
 try{
  const r=await start({enabled:true,serviceSecretFile:SERVICE,delegation:{enabled:true},
   installation:{enabled:true,measurementSha256:canonicalSha256(measurement),measurementFile:FILE}});
  assert.equal(r.code,0,r.err);assert.equal(r.composer.length,1);
  assert.deepEqual(r.composer[0].familyIds,['client-knowledge-profile']);
  assert.equal(typeof r.composer[0].retainedTaskPorts,'function');
  const selected=r.composer[0].retainedTaskPorts({task:{approvedReads:{schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:65536}},
   getSignedSourceCredentials:async()=>{throw Error('NO_LIVE_CALL');}});
  assert.deepEqual(Object.keys(selected.families),['client-knowledge-profile']);
 }finally{state.bytes=saved;}
});

test('disabled installation and discovery pass their toggles only; absent blocks pass no key; discovery without capabilityPlatform is refused by configuration',async()=>{
 const off=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:false},discovery:{enabled:false}});
 assert.equal(off.code,0,off.err);assert.deepEqual(off.composer[0].installation,{enabled:false});assert.deepEqual(off.composer[0].discovery,{enabled:false});assert.deepEqual(off.secrets,[]);
 const plain=await start({enabled:true,serviceSecretFile:SERVICE,defaultCongress:119});
 assert.equal(plain.code,0,plain.err);assert.deepEqual(Object.keys(plain.composer[0]),['configuration','secretFiles','nativeCredentials','gateway','defaultCongress']);assert.deepEqual(plain.secrets,[]);
 const refused=await start({enabled:true,serviceSecretFile:SERVICE,discovery:{enabled:true}});
 assert.equal(refused.code,2);assert.equal(refused.err,'RUNTIME_CONFIGURATION\n');assert.equal(refused.composer.length,0);
});

test('enabled read delegation passes its run stop hook to control without invoking it during startup',async()=>{
 const r=await start({enabled:true,serviceSecretFile:SERVICE,delegation:{enabled:true}});
 assert.equal(r.code,0,r.err);
 assert.equal(r.composer.length,1);
 assert.equal(typeof state.control.at(-1).readDelegationRunOptions.stopRun,'function');
 assert.equal(state.control.at(-1).readDelegationRunOptions,state.returned.at(-1).readDelegation.runOptions);
});

test('fail closed: material bytes that do not hash to the pin, are not brotli JSON, or do not match the pin stop startup before the composer',async()=>{
 const saved=state.bytes;
 try{
  state.bytes=material({...MEASUREMENT,baseCatalogSha256:'0'.repeat(64)});
  const drifted=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:true,measurementSha256:PIN,measurementFile:FILE}});
  assert.equal(drifted.code,3);assert.match(drifted.err,/RUNTIME_UNAVAILABLE/u);assert.equal(drifted.composer.length,0);assert.deepEqual(drifted.secrets,[FILE]);
  for(const bytes of [Buffer.from('not brotli'),material('not json'),Buffer.from(JSON.stringify(MEASUREMENT))]){
   state.bytes=bytes;
   const broken=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:true,measurementSha256:PIN,measurementFile:FILE}});
   assert.equal(broken.code,3);assert.match(broken.err,/RUNTIME_UNAVAILABLE/u);assert.equal(broken.composer.length,0);
  }
  state.bytes=saved;
  const other=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:true,measurementSha256:'e'.repeat(64),measurementFile:FILE}});
  assert.equal(other.code,3);assert.equal(other.composer.length,0);
 }finally{state.bytes=saved;}
});

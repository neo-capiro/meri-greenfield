/** SYNTHETIC control startup through the actual cli.mjs: the reads composer receives exactly the configured P2 installation (the measurement
 * parsed from its pinned material file and re-hashed against the configured pin) and P1 discovery (the G2 run capability policy producer, only
 * with `capabilityPlatform`). No listener, SQL, network or real secret: control.mjs, the composer and the live-session relay are mocked at
 * their module boundaries and the measurement bytes are synthetic (the real issuer's catalog/descriptor checks live in the composer tests). */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,normalize} from 'node:path';import {brotliCompressSync} from 'node:zlib';
import * as configurationModule from '../config.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy} from '../product-ports/capability-policy.mjs';

const OP={id:'read_bill_text',version:'0.2.0'},FILE='/run/meri/general-read-installation.json',SERVICE='/run/meri/core-service-secret';
const MEASUREMENT={schema:'meri.general-read-installation-measurement.v1',baseCatalogSha256:'b'.repeat(64),operations:[{operation:OP,family:'bill-text',descriptorSha256:'c'.repeat(64),handlerSourceSha256:'d'.repeat(64)}]};
const PIN=canonicalSha256(MEASUREMENT);
const material=value=>brotliCompressSync(Buffer.from(typeof value==='string'?value:JSON.stringify(value)));
const state={composer:[],returned:[],control:[],secrets:[],bytes:material(MEASUREMENT)};
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(path){state.secrets.push(path);return Buffer.from(state.bytes);}}});
mock.module('../read-credential-relay.mjs',{namedExports:{createReadCredentialRelay(){return {port:{nativeCredentialFor(){throw Error('not reached');}}};}}});
mock.module('../native-authority/reads-composer.mjs',{namedExports:{async createControlReadsComposer(options){state.composer.push(options);const composed={createReadsRuntime(){},familyIds:Object.freeze([]),missing:Object.freeze([])};state.returned.push(composed);return composed;}}});
mock.module('../control.mjs',{namedExports:{async startControl(configuration,ports){state.control.push(ports);return {address:{port:0},completion:Promise.resolve(),async close(){}};}}});
const {main}=await import('../cli.mjs');

/** A control configuration with the reads block, on this host's path semantics (the runtime only ever runs on Linux). */
function configuration(reads,extra={}){
 const c=structuredClone(candidateFixture().configuration),intent=c.nativeCandidate.preparationIntent;
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])intent[k]=normalize(intent[k]);
 intent.launchTemplate.command=normalize(intent.launchTemplate.command);intent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=intent.secureStorageDirectory;
 return {...c,...extra,reads};
}
async function start(reads,extra){
 const dir=await mkdtemp(join(tmpdir(),'meri-cli-reads-')),file=join(dir,'control.json'),out=[],err=[],o=process.stdout.write.bind(process.stdout),e=process.stderr.write.bind(process.stderr);
 const before=state.composer.length;state.secrets=[];
 process.stdout.write=t=>{out.push(String(t));return true;};process.stderr.write=t=>{err.push(String(t));return true;};
 try{await writeFile(file,JSON.stringify(configuration(reads,extra)));return {code:await main(['control','--config',file]),out:out.join(''),err:err.join(''),composer:state.composer.slice(before),secrets:[...state.secrets]};}
 finally{process.stdout.write=o;process.stderr.write=e;await rm(dir,{recursive:true,force:true});}
}

test('cli passes exactly installation {enabled, measurement, measurementSha256, revokedOperations} and discovery {enabled, capabilityPolicy} to the reads composer',async()=>{
 const r=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:true,measurementSha256:PIN,measurementFile:FILE,revokedOperations:[OP]},discovery:{enabled:true}},{capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM});
 assert.equal(r.code,0,r.err);assert.match(r.out,/runtime\.listening/u);assert.equal(r.composer.length,1);
 const o=r.composer[0];
 assert.deepEqual(Object.keys(o),['configuration','secretFiles','nativeCredentials','installation','discovery']);
 assert.deepEqual(o.secretFiles,{serviceSecret:SERVICE});assert.equal(typeof o.nativeCredentials.nativeCredentialFor,'function');
 assert.deepEqual(o.installation,{enabled:true,measurement:MEASUREMENT,measurementSha256:PIN,revokedOperations:[OP]});
 assert.deepEqual(Object.keys(o.discovery),['enabled','capabilityPolicy']);assert.equal(o.discovery.enabled,true);
 assert.equal(typeof o.discovery.capabilityPolicy.forRun,'function');
 assert.equal(o.discovery.capabilityPolicy.profileSha256,createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profileSha256);
 // The measurement bytes come from the configured material file only, and the composer's runtime factory reaches control.
 assert.deepEqual(r.secrets,[FILE]);assert.equal(state.control.at(-1).createReadsRuntime,state.returned.at(-1).createReadsRuntime);
});

test('disabled installation and discovery pass their toggles only; absent blocks pass no key; discovery without capabilityPlatform is refused by configuration',async()=>{
 const off=await start({enabled:true,serviceSecretFile:SERVICE,installation:{enabled:false},discovery:{enabled:false}});
 assert.equal(off.code,0,off.err);assert.deepEqual(off.composer[0].installation,{enabled:false});assert.deepEqual(off.composer[0].discovery,{enabled:false});assert.deepEqual(off.secrets,[]);
 const plain=await start({enabled:true,serviceSecretFile:SERVICE,defaultCongress:119});
 assert.equal(plain.code,0,plain.err);assert.deepEqual(Object.keys(plain.composer[0]),['configuration','secretFiles','nativeCredentials','defaultCongress']);assert.deepEqual(plain.secrets,[]);
 const refused=await start({enabled:true,serviceSecretFile:SERVICE,discovery:{enabled:true}});
 assert.equal(refused.code,2);assert.equal(refused.err,'RUNTIME_CONFIGURATION\n');assert.equal(refused.composer.length,0);
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

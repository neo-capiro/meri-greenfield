/** Launch measurement packaging against the recorded 3dc993ef run (measurement build d441f856): the repository wrapper template and
 * the finalizer must reproduce the exact payload, pinned bootstrap and start request that run used. Nothing reaches AWS; the Python
 * bootstrap check replaces AWS and the wrapper. Needs Python 3 (MERI_TEST_PYTHON overrides). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hash,checkedJson,PROJECT_ARN,PROJECT_ROLE_ARN} from './receipt-joins.mjs';
import {createPayload,decodePayload,validatePayloadPin,createPinnedPayloadBuildspec,renderWrapper,payloadKey,VERIFIER_SHA256,PAYLOAD_KMS_KEY_ARN,WRAPPER_SOURCE_PLACEHOLDER} from './measurement-payload.mjs';

const here=fileURLToPath(new URL('.',import.meta.url)),root=join(here,'..','..','..'),python=process.env.MERI_TEST_PYTHON??'python';
const COMMIT='3dc993ef81846730ac696bb482b653162da8920c',RUN=join(here,'fixtures','3dc993ef');
const template=readFileSync(join(here,'measurement-build-wrapper.py'));
const planBytes=readFileSync(join(RUN,'measurement-plan.json')),plan=checkedJson(planBytes),prepared=checkedJson(readFileSync(join(RUN,'preparation-hashes.json')));
const pin=checkedJson(readFileSync(join(RUN,'payload-pin.json'))),finalized=checkedJson(readFileSync(join(RUN,'packet-hashes.json')));
const wrapper=renderWrapper(template,COMMIT),payloadBytes=createPayload(planBytes,wrapper);
const pinned=()=>({plan:checkedJson(planBytes),payloadBytes,pin:{...pin},sourceCommit:COMMIT});
const withTemporary=run=>{const directory=mkdtempSync(join(tmpdir(),'meri-measurement-test-'));try{return run(directory);}finally{rmSync(directory,{recursive:true,force:true});}};

test('the rendered template and the recorded plan reproduce the exact payload of the d441f856 run',()=>{
 assert.equal(hash(wrapper),prepared.wrapperSha256);assert.equal(hash(payloadBytes),prepared.payloadSha256);assert.equal(payloadBytes.length,prepared.payloadBytes);
 assert.equal(payloadKey(plan),prepared.payloadKey);assert.equal(prepared.sourceCommit,COMMIT);
 const decoded=decodePayload(payloadBytes);assert.deepEqual(decoded.plan,planBytes);assert.deepEqual(decoded.wrapper,wrapper);
 assert.equal(hash(Buffer.from(createPinnedPayloadBuildspec(pinned()))),finalized.buildspecSha256,'the bootstrap CodeBuild ran');
});

test('wrapper template: one source placeholder, rendered from the operator argument only; its pins match the reviewed constants',()=>{
 const text=template.toString('utf8');
 assert.equal(text.split(WRAPPER_SOURCE_PLACEHOLDER).length,2);
 const changed=wrapper.toString('utf8').split('\n').filter((line,i)=>line!==text.split('\n')[i]);
 assert.deepEqual(changed,[`SOURCE = "${COMMIT}"`],'rendering changes only the source line');
 for(const commit of ['3dc993ef','3DC993EF81846730AC696BB482B653162DA8920C',undefined])assert.throws(()=>renderWrapper(template,commit),/--source-commit/);
 assert.throws(()=>renderWrapper(Buffer.from('print(1)\n'),COMMIT),/exactly one source placeholder/);
 assert.throws(()=>renderWrapper(Buffer.from(text+WRAPPER_SOURCE_PLACEHOLDER+'\n'),COMMIT),/exactly one source placeholder/);
 const literal=name=>new RegExp(`^${name} = "([^"]+)"$`,'mu').exec(text)?.[1];
 assert.equal(literal('PROJECT_ARN'),PROJECT_ARN);assert.equal(literal('PROJECT_ROLE_ARN'),PROJECT_ROLE_ARN);assert.equal(literal('VERIFIER'),VERIFIER_SHA256);
 // The wrapper and bootstrap pin the canonical verifier bytes; a verifier change must update this reviewed pin deliberately.
 assert.equal(hash(readFileSync(join(root,'infra/product-preview/image-build-source.py'))),VERIFIER_SHA256);
 withTemporary(directory=>{const file=join(directory,'wrapper.py');writeFileSync(file,wrapper);
  const r=spawnSync(python,['-I','-B','-S','-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read())',file],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);});
});

for(const [name,change]of [['bucket',v=>v.pin.bucket='wrong'],['key',v=>v.pin.key+='wrong'],['null-version',v=>v.pin.versionId='null'],['length',v=>v.pin.bytes++],
 ['sha256',v=>v.pin.sha256='0'.repeat(64)],['checksum',v=>v.pin.checksumSha256='wrong'],['KMS algorithm',v=>v.pin.serverSideEncryption='AES256'],
 ['KMS account',v=>v.pin.kmsKeyArn=v.pin.kmsKeyArn.replace('967807252336','111111111111')],['another KMS key',v=>v.pin.kmsKeyArn=PAYLOAD_KMS_KEY_ARN.replace('1cca74fc','00000000')],
 ['another operator source commit',v=>v.sourceCommit='0'.repeat(40)],['plan for another commit',v=>v.plan.request.sourceCommit='0'.repeat(40)]])
 test('refuses payload pin: '+name,()=>{const v=pinned();change(v);assert.throws(()=>validatePayloadPin(v));});

test('refuses payload hash tampering and oversize',()=>{
 const p=checkedJson(payloadBytes);p.wrapperSha256='0'.repeat(64);
 assert.throws(()=>decodePayload(Buffer.from(JSON.stringify(p))));assert.throws(()=>decodePayload(Buffer.alloc(1048577)));
});

test('the generated Python bootstrap reconstructs the exact bytes and refuses altered downloads, without AWS or the wrapper',()=>withTemporary(directory=>{
 const files={buildspec:createPinnedPayloadBuildspec(pinned()),payload:payloadBytes,plan:planBytes,wrapper};
 for(const [name,bytes] of Object.entries(files))writeFileSync(join(directory,name),bytes);
 const r=spawnSync(python,['-I','-B','-S',join(here,'payload-bootstrap-check.py'),...Object.keys(files).flatMap(name=>[`--${name}`,join(directory,name)]),'--source-root',root],
  {encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 assert.equal(r.status,0,r.stderr);
 const result=JSON.parse(r.stdout);assert.deepEqual(result.cases.map(c=>c.case),['exact-roundtrip','wrong-head-version','download-byte-tamper']);
 assert.equal(result.awsExecuted,false);assert.equal(result.wrapperExecuted,false);
}));

test('finalize reproduces the recorded pin, bootstrap and start request; refuses another commit and a second run',()=>withTemporary(directory=>{
 const finalize=(packet,commit)=>spawnSync(process.execPath,[join(here,'finalize-measurement.mjs'),'--packet',packet,'--payload-pin',join(RUN,'payload-pin.json'),'--source-commit',commit],{encoding:'utf8',timeout:20000});
 const packet=name=>{const dir=join(directory,name);mkdirSync(dir);
  writeFileSync(join(dir,'measurement-plan.json'),planBytes);writeFileSync(join(dir,'measurement-payload.json'),payloadBytes);
  writeFileSync(join(dir,'preparation-hashes.json'),readFileSync(join(RUN,'preparation-hashes.json')));return dir;};
 const ok=packet('ok');let r=finalize(ok,COMMIT);
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/OFFLINE_MEASUREMENT_REQUEST_FINALIZED/);
 assert.deepEqual(readFileSync(join(ok,'packet-hashes.json')),readFileSync(join(RUN,'packet-hashes.json')),'same payload pin, buildspec and start request hashes as the d441f856 run');
 const start=checkedJson(readFileSync(join(ok,'measurement-start.request.json')));
 assert.equal(start.artifactsOverride.path,`results/launch-measurement/${COMMIT}/${plan.attempt}`);assert.equal(start.idempotencyToken,plan.attempt);
 r=finalize(ok,COMMIT);assert.equal(r.status,2);assert.match(r.stderr,/finalization output exists/);
 r=finalize(packet('other-commit'),'0'.repeat(40));assert.equal(r.status,2);assert.match(r.stderr,/MEASUREMENT_FINALIZE_REFUSED/);
 r=finalize(packet('no-commit'),'HEAD');assert.equal(r.status,2);assert.match(r.stderr,/--source-commit must be 40 lowercase hex/);
}));

test('prepare and verify require the source commit and their pins as arguments',()=>{
 for(const script of ['prepare-measurement.mjs','verify-measurement.mjs']){
  const help=spawnSync(process.execPath,[join(here,script),'--help'],{encoding:'utf8',timeout:20000});
  assert.equal(help.status,0);assert.match(help.stdout,/--source-commit SHA40/);
  const r=spawnSync(process.execPath,[join(here,script),'--source-root',root],{encoding:'utf8',timeout:20000});
  assert.equal(r.status,2);assert.match(r.stderr,/_REFUSED/);
 }
 assert.match(spawnSync(process.execPath,[join(here,'prepare-measurement.mjs'),'--help'],{encoding:'utf8'}).stdout,/--baseline-commit SHA40 --baseline-path PATH --baseline-sha256 HEX64/);
});

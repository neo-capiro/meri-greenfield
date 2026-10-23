import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {hash,checkedJson} from './receipt-joins.mjs';
import {createPayload,decodePayload,validatePayloadPin,createPinnedPayloadBuildspec,payloadKey,PAYLOAD_KMS_KEY_ARN} from './measurement-payload.mjs';
const packet=resolve('../pr193-retention-measurement-prepared'),planBytes=readFileSync(join(packet,'measurement-plan.json')),plan=checkedJson(planBytes),wrapper=readFileSync('measurement-build-wrapper.py'),payloadBytes=readFileSync(join(packet,'measurement-payload.json'));
const fixture=()=>({plan,payloadBytes,pin:{bucket:plan.request.archive.bucket,key:payloadKey(plan),versionId:'synthetic-version-for-local-tests',bytes:payloadBytes.length,sha256:hash(payloadBytes),checksumSha256:Buffer.from(hash(payloadBytes),'hex').toString('base64'),serverSideEncryption:'aws:kms',kmsKeyArn:PAYLOAD_KMS_KEY_ARN}});
test('real public payload reconstructs exact unchanged plan and wrapper bytes',()=>{assert.deepEqual(createPayload(planBytes,wrapper),payloadBytes);const decoded=decodePayload(payloadBytes);assert.deepEqual(decoded.plan,planBytes);assert.deepEqual(decoded.wrapper,wrapper);});
for(const [name,change]of [['bucket',v=>v.pin.bucket='wrong'],['key',v=>v.pin.key+='wrong'],['null-version',v=>v.pin.versionId='null'],['length',v=>v.pin.bytes++],['sha256',v=>v.pin.sha256='0'.repeat(64)],['checksum',v=>v.pin.checksumSha256='wrong'],['KMS algorithm',v=>v.pin.serverSideEncryption='AES256'],['KMS account',v=>v.pin.kmsKeyArn=v.pin.kmsKeyArn.replace('967807252336','111111111111')]])test('refuses payload pin '+name,()=>{const v=fixture();change(v);assert.throws(()=>validatePayloadPin(v));});
test('refuses payload individual hash tampering and oversize',()=>{const p=checkedJson(payloadBytes);p.wrapperSha256='0'.repeat(64);assert.throws(()=>decodePayload(Buffer.from(JSON.stringify(p))));assert.throws(()=>decodePayload(Buffer.alloc(1048577)));});
test('refuses another KMS key in the same account',()=>{const value=fixture();value.pin.kmsKeyArn=value.pin.kmsKeyArn.replace('1cca74fc','00000000');assert.throws(()=>validatePayloadPin(value));});
test('actual generated Python bootstrap reconstructs exact bytes and refuses altered downloads without running AWS or wrapper',()=>{
 const buildspec=createPinnedPayloadBuildspec(fixture());assert.ok(Buffer.byteLength(buildspec)<=25600);
 const directory=mkdtempSync(join(tmpdir(),'meri-payload-test-'));
 try{const file=join(directory,'synthetic-buildspec.json');writeFileSync(file,buildspec);const r=spawnSync(process.env.MERI_TEST_PYTHON,['-I','-B','-S','payload-bootstrap-check.py','--buildspec',file,'--payload',join(packet,'measurement-payload.json'),'--plan',join(packet,'measurement-plan.json'),'--wrapper',resolve('measurement-build-wrapper.py'),'--source-root',resolve('../ml-measure-source')],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.cases.length,3);assert.equal(result.awsExecuted,false);assert.equal(result.wrapperExecuted,false);}finally{rmSync(directory,{recursive:true,force:true});}
});

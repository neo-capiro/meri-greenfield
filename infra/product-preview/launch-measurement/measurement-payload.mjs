// Offline public-payload packaging. This module performs no I/O or AWS calls.
import assert from 'node:assert/strict';
import {hash,checkedJson,sourceCommitArgument,ARTIFACT_NAMES} from './receipt-joins.mjs';
export const VERIFIER_SHA256='c373ff556873823e1fd7cb5a00945ed2f70f41acb74c96d2d9756d0f12bf461d';
export const PAYLOAD_KMS_KEY_ARN='arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042';
export const MAX_PAYLOAD_BYTES=1048576;
export const payloadKey=plan=>'inputs/launch-measurement/'+plan.request.sourceCommit+'/'+plan.attempt+'/measurement-payload.json';
// measurement-build-wrapper.py is a template: its only variable line is the measured source commit, filled here, so the Linux
// wrapper still carries the literal pin it checks the plan against. Every other byte is shipped unchanged.
export const WRAPPER_SOURCE_PLACEHOLDER='SOURCE = "{{MERI_MEASUREMENT_SOURCE_COMMIT}}"';
export function renderWrapper(templateBytes,sourceCommit){
 const text=templateBytes.toString('utf8');
 assert.equal(text.split(WRAPPER_SOURCE_PLACEHOLDER).length,2,'wrapper template must hold exactly one source placeholder');
 return Buffer.from(text.replace(WRAPPER_SOURCE_PLACEHOLDER,`SOURCE = "${sourceCommitArgument(sourceCommit)}"`));
}
export function createPayload(planBytes,wrapperBytes){
 const encoded={schema:'meri.operator-launch-measurement-payload.v1',plan:planBytes.toString('base64'),planBytes:planBytes.length,planSha256:hash(planBytes),wrapper:wrapperBytes.toString('base64'),wrapperBytes:wrapperBytes.length,wrapperSha256:hash(wrapperBytes)};
 const bytes=Buffer.from(JSON.stringify(encoded)+'\n');assert.ok(bytes.length<=MAX_PAYLOAD_BYTES,'payload bound');return bytes;
}
export function decodePayload(bytes){
 assert.ok(bytes.length>0&&bytes.length<=MAX_PAYLOAD_BYTES,'payload bound');const p=checkedJson(bytes);
 assert.equal(p.schema,'meri.operator-launch-measurement-payload.v1');
 const result={};for(const key of ['plan','wrapper']){assert.match(p[key],/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);const raw=Buffer.from(p[key],'base64');assert.equal(raw.length,p[key+'Bytes']);assert.equal(hash(raw),p[key+'Sha256']);result[key]=raw;}return result;
}
export function validatePayloadPin({plan,payloadBytes,pin,sourceCommit}){
 assert.equal(plan.request.sourceCommit,sourceCommitArgument(sourceCommit));assert.equal(plan.request.verifierSha256,VERIFIER_SHA256);
 assert.equal(pin.bucket,plan.request.archive.bucket);assert.equal(pin.key,payloadKey(plan));
 assert.ok(typeof pin.versionId==='string'&&pin.versionId!=='null');assert.match(pin.versionId,/^[A-Za-z0-9._~+/=-]{1,1024}$/);
 assert.equal(pin.bytes,payloadBytes.length);assert.ok(pin.bytes>0&&pin.bytes<=MAX_PAYLOAD_BYTES);assert.equal(pin.sha256,hash(payloadBytes));
 assert.equal(pin.checksumSha256,Buffer.from(pin.sha256,'hex').toString('base64'));assert.equal(pin.serverSideEncryption,'aws:kms');
 assert.equal(pin.kmsKeyArn,PAYLOAD_KMS_KEY_ARN);
 return pin;
}
export function createPinnedPayloadBuildspec({plan,payloadBytes,pin,sourceCommit}){
 validatePayloadPin({plan,payloadBytes,pin,sourceCommit});const decoded=decodePayload(payloadBytes);
 assert.equal(hash(decoded.plan),hash(Buffer.from(JSON.stringify(plan)+'\n')),'plan bytes');
 const encodedPin=Buffer.from(JSON.stringify(pin)).toString('base64');
 // Follow image-build-producer.py download(): exact VersionId HEAD bound,
 // exact VersionId GET, response identity, file length and SHA256 before use.
 const script=`import base64,hashlib,importlib.util,json,os,pathlib,subprocess,tempfile,time
deadline=time.monotonic()+540
def need(v):
 if not v:raise ValueError('MEASUREMENT_PAYLOAD_REFUSED')
pin=json.loads(base64.b64decode('${encodedPin}',validate=True))
phase='SOURCE_VERIFY'
verifier=pathlib.Path(os.environ['CODEBUILD_SRC_DIR'])/'infra/product-preview/image-build-source.py'
need(verifier.is_file() and not verifier.is_symlink() and verifier.stat().st_size<=1048576)
need(hashlib.sha256(verifier.read_bytes()).hexdigest()=='${VERIFIER_SHA256}')
spec=importlib.util.spec_from_file_location('meri_payload_source',verifier);source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
os.environ.update(AWS_PAGER='',AWS_MAX_ATTEMPTS='1',AWS_RETRY_MODE='standard')
def aws(args):
 remaining=min(20,deadline-time.monotonic());need(remaining>0)
 code,raw=source.bounded_command(['aws','--region','us-east-1','--no-cli-pager','s3api',*args,'--output','json'],timeout=remaining)
 need(code==0 and len(raw)<=2097152);return source.decode(raw)
with tempfile.TemporaryDirectory(prefix='meri-measure-bootstrap-') as directory:
 d=pathlib.Path(directory);d.chmod(0o700)
 phase='PAYLOAD_HEAD'
 head=aws(['head-object','--bucket',pin['bucket'],'--key',pin['key'],'--version-id',pin['versionId']])
 need(head.get('VersionId')==pin['versionId'] and type(head.get('ContentLength')) is int and head['ContentLength']==pin['bytes'] and 0<pin['bytes']<=1048576)
 need(head.get('ServerSideEncryption')=='aws:kms' and head.get('SSEKMSKeyId')==pin['kmsKeyArn'])
 phase='PAYLOAD_GET'
 target=d/'payload.json';got=aws(['get-object','--bucket',pin['bucket'],'--key',pin['key'],'--version-id',pin['versionId'],str(target)])
 need(got.get('VersionId')==pin['versionId'] and target.stat().st_size==pin['bytes'] and source.file_sha(target,1048576)==pin['sha256'])
 phase='PAYLOAD_DECODE'
 p=source.decode(target.read_bytes());need(p.get('schema')=='meri.operator-launch-measurement-payload.v1')
 for key,expected,size in (('plan','${hash(decoded.plan)}',${decoded.plan.length}),('wrapper','${hash(decoded.wrapper)}',${decoded.wrapper.length})):
  v=base64.b64decode(p[key],validate=True)
  need(len(v)==size and p[key+'Bytes']==size and p[key+'Sha256']==expected and hashlib.sha256(v).hexdigest()==expected)
  f=d/(key+'.'+('py' if key=='wrapper' else 'json'));f.write_bytes(v);f.chmod(0o600)
 phase='WRAPPER'
 remaining=deadline-time.monotonic();need(remaining>=500)
 r=subprocess.run(['python3','-I','-B','-S',str(d/'wrapper.py'),'--plan',str(d/'plan.json')],timeout=remaining)
 raise SystemExit(r.returncode)`;
 const bootstrap="python3 -I -B -S - <<'MERI_MEASURE_BOOTSTRAP'\nphase='PRECHECK'\ntry:\n"+script.split('\n').map(line=>' '+line).join('\n')+"\nexcept Exception:\n print('MEASUREMENT_BOOTSTRAP_REFUSED phase='+phase)\n raise SystemExit(2)\nMERI_MEASURE_BOOTSTRAP";
 const buildspec=JSON.stringify({version:0.2,phases:{build:{'on-failure':'ABORT',commands:[bootstrap]}},artifacts:{files:ARTIFACT_NAMES}})+'\n';
 assert.ok(Buffer.byteLength(buildspec)<=25600,'buildspec exceeds CodeBuild inline limit');return buildspec;
}

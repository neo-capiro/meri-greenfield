import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createProductImageBuildRecipe} from './image-build-recipe.mjs';

const verifier=fileURLToPath(new URL('./image-build-source.py',import.meta.url));
const producer=fileURLToPath(new URL('./image-build-producer.py',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const python=(args,options={})=>spawnSync(process.env.MERI_IMAGE_BUILD_TEST_PYTHON??(process.platform==='win32'?'python':'python3'),['-I','-B','-S',...args],{encoding:'utf8',timeout:30000,...options});
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'meri-image-source-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const repo=join(root,'repo');mkdirSync(join(repo,'apps/runtime'),{recursive:true});mkdirSync(join(repo,'infra/product-preview'),{recursive:true});
 writeFileSync(join(repo,'apps/runtime/Dockerfile'),'ARG NODE_IMAGE\nFROM ${NODE_IMAGE}\n');
 writeFileSync(join(repo,'apps/runtime/conversation-runner.mjs'),'export const runner=7;\n');
 writeFileSync(join(repo,'infra/product-preview/image-build-source.py'),readFileSync(verifier));
 writeFileSync(join(repo,'infra/product-preview/image-build-producer.py'),readFileSync(producer));
 git(repo,'init','--quiet');git(repo,'add','.');git(repo,'-c','user.name=Offline Fixture','-c','user.email=fixture@invalid.example','commit','--quiet','-m','Synthetic source only');
 const sourceCommit=git(repo,'rev-parse','HEAD'),archive=join(root,'source.zip'),manifest=join(root,'members.json');
 const sealed=python([verifier,'seal','--repository',repo,'--commit',sourceCommit,'--archive',archive,'--output',manifest]);
 assert.equal(sealed.status,0,sealed.stderr);const seals=JSON.parse(sealed.stdout);
 const pin={sourceCommit,archive:{bucket:'meri-synthetic-input',key:'source/product.zip',versionId:'archive-version-1',sha256:seals.archiveSha256},manifest:{bucket:'meri-synthetic-input',key:'source/product-members.json',versionId:'manifest-version-1',sha256:seals.sourceManifestSha256},dockerfileSha256:hash(readFileSync(join(repo,'apps/runtime/Dockerfile'))),nodeImageUri:'public.ecr.aws/docker/library/node@sha256:'+'e'.repeat(64),nodeVersion:'v24.21.0',runnerSha256:hash(readFileSync(join(repo,'apps/runtime/conversation-runner.mjs'))),runtimeUser:'1000:1000',codeBuildProjectArn:'arn:aws:codebuild:us-east-1:967807252336:project/meri-product-preview-build',ecrRepositoryUri:'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/product-runtime',imageTag:`product-${sourceCommit}-${'1'.repeat(32)}`,verifierSha256:hash(readFileSync(verifier)),producerSha256:hash(readFileSync(producer))};
 const request=join(root,'request.json');writeFileSync(request,JSON.stringify(pin));
 const verify=()=>python([verifier,'verify','--request',request,'--archive',archive,'--manifest',manifest]);
 return {root,repo,sourceCommit,archive,manifest,pin,request,verify};
}

test('offline recipe produces deterministic reviewable override bytes with digest pins and verifier bootstrap',t=>{
 const f=fixture(t),result=createProductImageBuildRecipe(f.pin);assert.equal(result.status,'OFFLINE_RECIPE_ONLY');
 assert.equal(result.buildspecSha256,hash(result.buildspecJson));assert.deepEqual(result,createProductImageBuildRecipe(structuredClone(f.pin)));
 const spec=JSON.parse(result.buildspecJson);assert.equal(spec.version,0.2);assert.equal(spec.phases.build['on-failure'],'ABORT');
 const script=spec.phases.build.commands[0];assert.ok(script.indexOf(f.pin.verifierSha256)<script.indexOf('str(producer)'));assert.match(script,/timeout=1600/u);
 assert.deepEqual(spec.artifacts.files,['product-image-receipt.json','product-image-diagnostic.json']);
 for(const change of [p=>{p.nodeImageUri='node:24';},p=>{p.archive.versionId='null';},p=>{p.runtimeUser='root';},p=>{p.imageTag='latest';},p=>{p.runnerSha256='';},p=>{p.secret='unexpected';},p=>{p.archive.key='x\nprintenv';}]){const pin=structuredClone(f.pin);change(pin);assert.throws(()=>createProductImageBuildRecipe(pin),/PRODUCT_IMAGE_RECIPE_REFUSED/u);}
});

test('bootstrap failures produce bounded artifact before and after producer import',async t=>{
 const scenarios=['source-hash','producer-import','request-decode','request-decode-cleanup','child-timeout','child-receipt-timeout','producer-check','bootstrap-cleanup'];
 for(const scenario of scenarios)await t.test(scenario,t=>{
  const f=fixture(t),producerFile=join(f.repo,'infra/product-preview/image-build-producer.py');
  if(scenario==='producer-import'){
   writeFileSync(producerFile,'not valid python secret=top-secret\n');
   f.pin.producerSha256=hash(readFileSync(producerFile));
  }
  if(scenario==='child-timeout'){
   writeFileSync(producerFile,'import time\ntime.sleep(5)\n');
   f.pin.producerSha256=hash(readFileSync(producerFile));
  }
  if(scenario==='child-receipt-timeout'){
   writeFileSync(producerFile,`import json,os,pathlib,time
row={'schemaVersion':1,'status':'FAILED','phase':'DOCKER_BUILD','diagnosticOwner':os.environ['MERI_PRODUCT_DIAGNOSTIC_OWNER'],'primary':{'phase':'DOCKER_BUILD','category':'CHECK','code':'PRODUCT_IMAGE_CHECK_FAILED','detail':{'errorType':'UNEXPECTED','errno':None}},'cleanup':{'status':'NOT_RUN','failure':None,'additionalFailures':[]}}
pathlib.Path('product-image-diagnostic.json').write_text(json.dumps(row))
time.sleep(5)
`);
   f.pin.producerSha256=hash(readFileSync(producerFile));
  }
  const recipe=createProductImageBuildRecipe(f.pin);
  const script=JSON.parse(recipe.buildspecJson).phases.build.commands[0];
  let body=script.slice(script.indexOf('\n')+1,script.lastIndexOf('\nMERI_PRODUCT_BUILD'));
  if(scenario==='source-hash')writeFileSync(join(f.repo,'infra/product-preview/image-build-source.py'),'secret=top-secret\n');
  if(['request-decode','request-decode-cleanup'].includes(scenario))body=body.replace(/base64\.b64decode\('[^']+',validate=True\)/u,"base64.b64decode('not valid!',validate=True)");
  if(scenario==='child-timeout')body=body.replace('timeout=1600,check=False','timeout=0.01,check=False');
  if(scenario==='child-receipt-timeout')body=body.replace('timeout=1600,check=False','timeout=0.4,check=False');
  if(['bootstrap-cleanup','request-decode-cleanup'].includes(scenario))body=body.replace('owner=os.urandom(16).hex()',`owner=os.urandom(16).hex()
real_temp=tempfile.TemporaryDirectory
class FailingTemp:
 def __init__(self,*args,**kwargs):self.inner=real_temp(*args,**kwargs)
 def __enter__(self):return self.inner.__enter__()
 def __exit__(self,*args):self.inner.__exit__(*args);raise OSError('secret=never-log-this')
tempfile.TemporaryDirectory=FailingTemp`);
  const result=python(['-c',body],{cwd:f.repo});
  assert.equal(result.status,2,result.stderr);
  assert.equal(result.stdout,'');
  assert.ok(!result.stderr.includes('top-secret'));
  const diagnostic=JSON.parse(readFileSync(join(f.repo,'product-image-diagnostic.json'),'utf8'));
  assert.equal(diagnostic.status,'FAILED');
  assert.equal(diagnostic.schemaVersion,1);
  if(['producer-check','bootstrap-cleanup','child-receipt-timeout'].includes(scenario)){
   assert.equal(diagnostic.primary.category,'CHECK');
   assert.ok(['PRODUCT_IMAGE_PRODUCER_PLATFORM_OR_OUTPUT','PRODUCT_IMAGE_BUILD_IDENTITY','PRODUCT_IMAGE_CHECK_FAILED'].includes(diagnostic.primary.code));
   assert.notEqual(diagnostic.primary.phase,'BOOTSTRAP_CHILD');
   assert.ok(result.stderr.includes(`PRODUCT_IMAGE_CHECK_FAILED phase=${diagnostic.primary.phase} category=CHECK code=${diagnostic.primary.code} errorType=${scenario==='child-receipt-timeout'?'UNEXPECTED':'VALUE'} errno=none`));
   if(scenario==='bootstrap-cleanup'){
    assert.equal(diagnostic.bootstrapCleanup.code,'PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN');
    assert.ok(result.stderr.includes('phase=BOOTSTRAP_CLEANUP category=BOOTSTRAP code=PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN'));
   }
   if(scenario==='child-receipt-timeout'){
    assert.equal(diagnostic.bootstrapFailure.code,'PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT');
    assert.equal(diagnostic.childCleanupStatus,'UNKNOWN');
    assert.ok(result.stderr.includes('PRODUCT_IMAGE_CHILD_CLEANUP_UNKNOWN phase=BOOTSTRAP_CHILD'));
   }
  }else assert.equal(diagnostic.primary.category,'BOOTSTRAP');
  const expected={'source-hash':'PRODUCT_IMAGE_VERIFIER_SHA_MISMATCH','producer-import':'PRODUCT_IMAGE_BOOTSTRAP_CHILD_FAILED','request-decode':'PRODUCT_IMAGE_BOOTSTRAP_REQUEST_UNAVAILABLE','request-decode-cleanup':'PRODUCT_IMAGE_BOOTSTRAP_REQUEST_UNAVAILABLE','child-timeout':'PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT'};
  if(!['producer-check','bootstrap-cleanup','child-receipt-timeout'].includes(scenario))assert.equal(diagnostic.primary.code,expected[scenario]);
  if(scenario==='request-decode-cleanup'){
   assert.equal(diagnostic.bootstrapCleanup.code,'PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN');
   assert.ok(result.stderr.includes('phase=BOOTSTRAP_REQUEST category=BOOTSTRAP code=PRODUCT_IMAGE_BOOTSTRAP_REQUEST_UNAVAILABLE'));
   assert.ok(result.stderr.includes('phase=BOOTSTRAP_CLEANUP category=BOOTSTRAP code=PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN'));
  }
  if(['producer-import','child-timeout'].includes(scenario)){
   assert.equal(diagnostic.cleanup.status,'UNKNOWN');
   assert.ok(result.stderr.includes('PRODUCT_IMAGE_CHILD_CLEANUP_UNKNOWN phase=BOOTSTRAP_CHILD'));
  }
  assert.ok(!JSON.stringify(diagnostic).includes('top-secret'));
 });
});

test('sealing proves ZIP file bytes and modes against exact Git objects; verification joins all sealed pins',t=>{
 const f=fixture(t),result=f.verify();assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{status:'VERIFIED_SOURCE_ONLY',sourceCommit:f.sourceCommit,archiveSha256:f.pin.archive.sha256,sourceManifestSha256:f.pin.manifest.sha256,fileCount:4,runnerBytes:23});
 const uncommitted='uncommitted replacement';writeFileSync(join(f.repo,'apps/runtime/conversation-runner.mjs'),uncommitted);assert.equal(f.verify().status,0);
 const wrong=structuredClone(f.pin);wrong.runnerSha256='0'.repeat(64);writeFileSync(f.request,JSON.stringify(wrong));assert.equal(f.verify().status,2);
});

test('altered archive/manifest, extra, duplicate, unsafe and symlink members refuse even after outer archive hash is updated',async t=>{
 for(const mode of ['alter','extra','duplicate','unsafe','symlink'])await t.test(mode,t=>{
  const f=fixture(t),changed=join(f.root,'changed.zip');
  const source=`import pathlib,sys,zipfile\nsrc,dst,mode=sys.argv[1:]\nwith zipfile.ZipFile(src) as old,zipfile.ZipFile(dst,'w') as out:\n for row in old.infolist():\n  payload=old.read(row)\n  if mode=='alter' and row.filename=='apps/runtime/conversation-runner.mjs':payload=b'changed'\n  out.writestr(row,payload)\n if mode=='extra':out.writestr('extra.mjs',b'x')\n if mode=='duplicate':out.writestr('apps/runtime/conversation-runner.mjs',b'x')\n if mode=='unsafe':out.writestr('../escape',b'x')\n if mode=='symlink':\n  row=zipfile.ZipInfo('linked');row.create_system=3;row.external_attr=0o120777<<16;out.writestr(row,b'apps/runtime/conversation-runner.mjs')\n`;
  const mutation=python(['-c',source,f.archive,changed,mode]);assert.equal(mutation.status,0,mutation.stderr);
  writeFileSync(f.archive,readFileSync(changed));f.pin.archive.sha256=hash(readFileSync(f.archive));writeFileSync(f.request,JSON.stringify(f.pin));const result=f.verify();assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(result.stderr.trim(),'PRODUCT_IMAGE_CHECK_FAILED');
 });
 const f=fixture(t);writeFileSync(f.manifest,'{}');assert.equal(f.verify().status,2);
});

test('Python entrypoint help/import/missing configuration are bounded and inert',()=>{
 assert.equal(python([verifier,'--help']).status,0);assert.equal(python([producer]).status,2);
 const code=`import importlib.util\ns=importlib.util.spec_from_file_location('build_source',${JSON.stringify(verifier)})\nm=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(m.CONTRACT)\n`;
 const result=python(['-c',code]);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'meri.runner-entrypoint.v1');
});
test('subprocess adapter caps stdout and stderr while the command is running',()=>{
 const code=`import importlib.util,sys
s=importlib.util.spec_from_file_location('build_source',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
for channel in ('stdout','stderr'):
 script='import sys;sys.'+channel+'.buffer.write(b"x"*(17*1024*1024))'
 try:m.run([sys.executable,'-c',script],timeout=10)
 except ValueError as error:print(str(error))
 else:print('UNBOUNDED')
`;
 const result=python(['-c',code,verifier]);assert.equal(result.status,0,result.stderr);
 assert.deepEqual(result.stdout.trim().split(/\r?\n/u),['PRODUCT_IMAGE_COMMAND_BOUND','PRODUCT_IMAGE_COMMAND_BOUND']);
});
test('producer rejects an oversized exact S3 version before get-object writes scratch',t=>{
 const directory=mkdtempSync(join(tmpdir(),'meri-image-head-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const code=`import importlib.util,pathlib,sys
s=importlib.util.spec_from_file_location('producer',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
calls=[]
def aws(*args):
 calls.append(args[:2])
 if args[:2]==('s3api','head-object'):return {'VersionId':'exact-v1','ContentLength':1024**3+1}
 raise AssertionError('get-object must not run')
m.aws=aws
try:m.download({'bucket':'synthetic','key':'source.zip','versionId':'exact-v1','sha256':'0'*64},pathlib.Path(sys.argv[2]),1024**3)
except ValueError as error:print(str(error),len(calls),pathlib.Path(sys.argv[2]).exists())
else:print('UNBOUNDED')
`;
 const result=python(['-c',code,producer,join(directory,'source.zip')]);assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.trim(),'PRODUCT_IMAGE_OBJECT_BOUND 1 False');
});

test('producer gates auth/push on measured image bytes and emits joined receipt only after clean scan',async t=>{
 for(const scenario of ['success','runner-mismatch','linux-test-hold','scan-hold','source-mismatch','cleanup-unknown'])await t.test(scenario,t=>{
  const f=fixture(t),output=join(f.root,'receipt.json');
  const harness=`import importlib.util,json,pathlib,shutil,sys,types,os
s=importlib.util.spec_from_file_location('build_source',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=json.loads(pathlib.Path(sys.argv[2]).read_text());archive,manifest,output,scenario=map(str,sys.argv[3:]);events=[]
m.sys.platform='linux';os.environ['CODEBUILD_PROJECT_ARN']=p['codeBuildProjectArn'];os.environ['CODEBUILD_BUILD_ID']='meri-product-preview-build:12345678-1234-1234-1234-123456789abc'
def aws(*args):
 events.append('aws:'+args[0]+':'+args[1])
 if args[:2]==('codebuild','batch-get-builds'):return {'builds':[{'projectName':'meri-product-preview-build','sourceVersion':p['archive']['versionId'],'source':{'type':'S3','location':p['archive']['bucket']+'/'+p['archive']['key']}}]}
 if args[:2]==('ecr','describe-repositories'):return {'repositories':[{'repositoryUri':p['ecrRepositoryUri'],'imageTagMutability':'IMMUTABLE','imageScanningConfiguration':{'scanOnPush':True}}]}
 if args[:2]==('ecr','describe-images'):return {'imageDetails':[{'imageDigest':'sha256:'+'d'*64}]}
 if args[:2]==('ecr','describe-image-scan-findings'):return {'imageScanStatus':{'status':'COMPLETE'},'imageScanFindings':{'findingSeverityCounts':{'HIGH':1} if scenario=='scan-hold' else {'MEDIUM':2}}}
 raise AssertionError('unexpected AWS operation')
def download(pin,target,maximum):shutil.copyfile(archive if pin is p['archive'] else manifest,target)
def run(args,timeout=30,input_bytes=None):
 if args[0]=='aws':events.append('credentials');return b'never-log-this-value'
 if 'ls' in args:return b''
 if 'build' in args:events.append('docker-build');return b''
 if 'inspect' in args:return json.dumps([{'Os':'linux','Architecture':'amd64','Size':1,'Config':{'Entrypoint':['node','apps/runtime/cli.mjs'],'Labels':{'org.opencontainers.image.revision':p['sourceCommit'],'org.opencontainers.image.base.name':p['nodeImageUri']}}}]).encode()
 if 'run' in args and '--test' in args:
  events.append('linux-tests:'+','.join(args[args.index('--test')+1:]))
  if scenario=='linux-test-hold':raise ValueError('scripted Linux test failure')
  return b''
 if 'run' in args and '--input-type=module' in args:
  events.append('image-measurement');return json.dumps({'node':p['nodeVersion'],'runtimeUser':p['runtimeUser'],'executableSha256':'a'*64,'runner':{'contract':m.CONTRACT,'path':m.RUNNER,'runnerSha256':'0'*64 if scenario=='runner-mismatch' else p['runnerSha256'],'bytes':23}}).encode()
 if 'login' in args:events.append('login');assert input_bytes==b'never-log-this-value';return b''
 if 'push' in args:events.append('push');return b''
 if '--help' in args:return b'help'
 raise AssertionError('unexpected subprocess')
m.aws=aws;m.download=download;m.run=run
def cleanup(args,**kwargs):
 events.append('cleanup');assert not pathlib.Path(output).exists();return (1 if scenario=='cleanup-unknown' else 0,b'')
m._source.bounded_command=cleanup
if scenario=='source-mismatch':p['runnerSha256']='0'*64
try:result=m.produce(p,pathlib.Path(output));status='success'
except Exception:status='refused'
print(json.dumps({'status':status,'events':events,'receipt':json.loads(pathlib.Path(output).read_text()) if pathlib.Path(output).exists() else None}))
`;
  const result=python(['-c',harness,producer,f.request,f.archive,f.manifest,output,scenario]);assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes('never-log-this-value'));const observed=JSON.parse(result.stdout);
  const linuxTests='linux-tests:apps/runtime/test/prepared-candidate-bootstrap.test.mjs,apps/runtime/test/remote-conversation-runner.test.mjs,apps/runtime/temporal-product-token-writer.test.mjs';
  if(scenario==='success'){assert.equal(observed.status,'success');assert.ok(observed.events.indexOf('image-measurement')<observed.events.indexOf(linuxTests));assert.ok(observed.events.indexOf(linuxTests)<observed.events.indexOf('credentials'));assert.ok(observed.events.indexOf('credentials')<observed.events.indexOf('push'));assert.equal(observed.receipt.runnerMeasurement.runnerSha256,f.pin.runnerSha256);assert.equal(observed.receipt.sourceManifestSha256,f.pin.manifest.sha256);assert.equal(observed.receipt.scanStatus,'COMPLETE');}
  else{assert.equal(observed.status,'refused');assert.equal(observed.receipt,null);if(['runner-mismatch','linux-test-hold','source-mismatch'].includes(scenario))assert.equal(observed.events.includes('credentials'),false);if(['runner-mismatch','linux-test-hold'].includes(scenario))assert.equal(observed.events.includes('image-measurement'),true);if(scenario==='linux-test-hold')assert.equal(observed.events.includes(linuxTests),true);if(['scan-hold','cleanup-unknown'].includes(scenario))assert.equal(observed.events.includes('push'),true);if(scenario==='source-mismatch')assert.equal(observed.events.includes('docker-build'),false);}
 });
});

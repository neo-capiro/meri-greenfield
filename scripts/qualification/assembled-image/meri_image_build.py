"""One existing-project image-only build, no runtime services or new security grants."""
import argparse, base64, hashlib, importlib.util, json, os, pathlib, subprocess, tarfile, tempfile, time, uuid, zipfile
ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = 'd741792b1672d6eac4c1c37835c3c3d1931e66a8'
# Shipping must bind the reviewed qualification commit in a NEW staging copy.
# This unsealed repair candidate does not authorize or prepare another paid attempt.
QUALIFICATION_SOURCE = None
PROBE_HASHES = {'image_probe.mjs': 'd86f1978bae8e7a544adc86ceb0b284b2bb750b8693c07116f2df800bad7239d', 'native-cli.mjs': '2626146c704b7ffc87a1dcfea4de7aa7be0e736e30aa02c328c6f794178d5e91', 'source-manifest.json': 'd7f743dcf6b0514310ccf5b2b7bdcf2a5ed40d4359caac3d78add7310c74587f', 'temporal-binding.mjs': 'a0fbd5f94e93736c1b061a8e2ee9b23f18530f5c97ee123d580f736615f6a2dc'}
CODE = None # New build recipe is not qualified as historical 0898fadd; shipping must bind it.
ARCHIVE = 'runtime-source-'+SOURCE[:12]+'.tar.gz'
ARCHIVE_SHA = '8c110a12036443071030bd0f66ca407310e109c78759e7599daa267e9b969e39'
MANIFEST_SHA = 'eb1956ca385e1ec79b694a4daef177c512bbc9c3b126d8c8df2c88ee0a1fe764'
NODE = 'public.ecr.aws/docker/library/node@sha256:9af606de2e947cfb3f276633b7c5130c4cd22365aa10f5a647b7675d5cfce0c0'
ACCOUNT='967807252336'; REGION='us-east-1'; PROJECT='meri-greenfield-qualification-build'
BUCKET='meri-greenfield-qual-build-967807252336-us-east-1'; KEY='inputs/qualification-source.zip'
REPO='meri-greenfield/qualification-worker'; REGISTRY=ACCOUNT+'.dkr.ecr.'+REGION+'.amazonaws.com'
KMS='arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042'
ROLE='arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H'
BUILD_HELPER_HASHES={'apps/runtime/build/materialize-swc.mjs':'cd34a83e28ebbd70ff6acdfaf636938d30d609d86a1f509d8c0d8a7abda897fe','apps/runtime/build/swc-diagnostic.mjs':'de82332711daf9af8a3475eb0f97305ee2b127696c08f78b04e2b9f72a2ad329'}
AWS='C:/Program Files/Amazon/AWSCLIV2/aws.exe' if os.name=='nt' else 'aws'
def need(c,m):
 if not c: raise RuntimeError(m)
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,v,exclusive=False):
 with (ROOT/n).open('x' if exclusive else 'w',encoding='utf-8') as f: json.dump(v,f,indent=2);f.write('\n')
def run(args,timeout=120,input_bytes=None):
 with tempfile.TemporaryFile() as output:
  p=subprocess.Popen(args,stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT)
  if input_bytes is not None: p.stdin.write(input_bytes);p.stdin.close()
  deadline=time.monotonic()+timeout
  while p.poll() is None:
   if time.monotonic()>deadline or os.fstat(output.fileno()).st_size>32000000:p.kill();p.wait();raise RuntimeError('Owned command bound exceeded')
   time.sleep(.2)
  output.seek(0);s=output.read(32000000).decode('utf-8','replace')
 need(p.returncode==0,'Command failed: '+args[0]+'\n'+s[-5000:]);return s
def aws(*a,query=None):
 args=[AWS,*a,'--region',REGION,'--output','json','--no-cli-pager','--no-cli-auto-prompt','--cli-connect-timeout','5','--cli-read-timeout','20']
 if os.name=='nt':args+=['--profile','capiro-dev']
 if query:args+=['--query',query]
 return json.loads(run(args))
def context(extract=False):
 need(sha((ROOT/ARCHIVE).read_bytes())==ARCHIVE_SHA,'Archive differs');raw=(ROOT/'BUILD-INPUT-MANIFEST.json').read_bytes();need(sha(raw)==MANIFEST_SHA,'Manifest differs')
 m=json.loads(raw);need(m['source']==SOURCE and m['codeSource']==CODE and len(m['files'])==2389,'Source binding differs');rows={x['path']:x for x in m['files']};seen=set();total=0;target=ROOT/'build-context'
 need(all((rows.get(name) or {}).get('sha256')==expected for name,expected in BUILD_HELPER_HASHES.items()),'Canonical build helper bindings missing or mismatched')
 if extract:need(not target.exists(),'Context exists; inspect prior attempt');target.mkdir()
 with tarfile.open(ROOT/ARCHIVE,'r:gz') as t:
  for x in t:
   p=pathlib.PurePosixPath(x.name);need(not p.is_absolute() and '..' not in p.parts and '\\' not in x.name and ':' not in x.name,'Unsafe tar path')
   if x.isdir():continue
   need(x.isfile() and x.name in rows and x.name not in seen,'Unexpected tar member');b=t.extractfile(x).read();row=rows[x.name];need(len(b)==row['bytes'] and sha(b)==row['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['gitBlob'],'Member mismatch');need(bool(x.mode&0o111)==(row['mode']=='100755'),'Mode mismatch');total+=len(b);seen.add(x.name)
   if extract:q=target/x.name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b);q.chmod(0o755 if row['mode']=='100755' else 0o644)
 need(len(seen)==2389 and total==68457591,'Incomplete archive');return target
def validate_proof(proof):
 need(proof['node']=='v24.21.0' and proof['uid']==1000 and proof['platform']=='linux' and proof['architecture']=='x64' and proof['sdk']=='0.3.295','Probe runtime pin')
 native=proof['nativeCli'];need(native['package']=='@anthropic-ai/claude-agent-sdk-linux-x64' and native['packageVersion']==native['sdkVersion']=='0.3.295' and native['libc']=='glibc','Native owner pin')
 need(proof['sdkCliPath']==native['path'] and proof['sdkCliSha256']==native['sha256'] and proof['cli']==native['version'] and native['version'].split()[0]=='2.1.295','Native receipt mismatch')
 image_path=lambda p:isinstance(p,str) and p.startswith('/opt/meri/') and '..' not in pathlib.PurePosixPath(p).parts and '\\' not in p
 digest=lambda d:isinstance(d,str) and len(d)==64 and all(c in '0123456789abcdef' for c in d)
 need(image_path(native['packageRoot']) and native['path']==native['packageRoot']+'/claude' and native['packageRoot'].endswith('/@anthropic-ai/claude-agent-sdk-linux-x64') and digest(native['sha256']),'Native executable binding')
 bundle=proof['workflowBundle'];need(bundle['nativeTemporalBundling'] is True and bundle['networkAttempts']==0 and bundle['temporalVersion']=='1.24.0' and 0<bundle['bytes']<=16*1024*1024 and digest(bundle['sha256']),'Native workflow bundle binding')
 need(bundle['temporalPackage']=='@temporalio/worker' and image_path(bundle['temporalPackageRoot']) and bundle['temporalEntry'].startswith(bundle['temporalPackageRoot']+'/') and image_path(bundle['temporalEntry']) and digest(bundle['temporalEntrySha256']),'Temporal receipt binding')
 need(proof['qualifiedManifestFilesMatched']==45 and proof['restoredSourceModulesMatched']==6 and proof['ordinaryRuntimeImports'] is True and proof['providerRequests']==proof['modelTurns']==0 and proof['network']=='none' and proof['liveAcceptance'] is False,'Probe binding')

def validate_probe_files():
 need(isinstance(QUALIFICATION_SOURCE,str) and len(QUALIFICATION_SOURCE)==40 and all(c in '0123456789abcdef' for c in QUALIFICATION_SOURCE),'Qualification source UNSEALED; bind reviewed commit in a new staging packet before upload/start')
 need(QUALIFICATION_SOURCE==SOURCE and SOURCE not in {'d741792b1672d6eac4c1c37835c3c3d1931e66a8','258082eb5e1097812159045689c0131a8cbd6726'},'Qualification/runtime source mismatch or stale pre-diagnostic source; seal fresh exact-commit archive and manifest')
 need(CODE==SOURCE,'Recipe code source UNSEALED; bind the same fresh reviewed source commit')
 need(set(PROBE_HASHES)=={'image_probe.mjs','native-cli.mjs','temporal-binding.mjs','source-manifest.json'},'Qualification file inventory differs')
 for name,expected in PROBE_HASHES.items():need(sha((ROOT/name).read_bytes())==expected,'Qualification file differs: '+name)
 proof=json.loads((ROOT/'source-manifest.json').read_bytes());need(proof.get('sourceHead')==CODE and proof.get('publicationSource')==SOURCE,'Proof source pins UNSEALED or mismatched')

def prepare():
 need(not (ROOT/'IMAGE-START-INTENT.json').exists() and not (ROOT/'IMAGE-UPLOAD-INTENT.json').exists(),'Prior attempt exists; reconcile, never restart');validate_probe_files();context()
 files=[ARCHIVE,'BUILD-INPUT-MANIFEST.json','meri_image_build.py','image_probe.mjs','native-cli.mjs','temporal-binding.mjs','source-manifest.json'];packet=ROOT/'meri-image-source.zip'
 with zipfile.ZipFile(packet,'w') as z:
  for n in files:
   i=zipfile.ZipInfo(n,(2026,10,14,0,0,0));i.compress_type=zipfile.ZIP_STORED;i.external_attr=0o100644<<16;z.writestr(i,(ROOT/n).read_bytes())
  z.comment=SOURCE.encode()
 sh=sha((ROOT/'meri_image_build.py').read_bytes());commands="python3 -I -B -S - <<'MERI_BOOTSTRAP'\nimport hashlib,pathlib,subprocess,sys\np=pathlib.Path('meri_image_build.py')\nassert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(sh)+"\nsubprocess.run([sys.executable,'-I','-B','-S',str(p),'--producer'],check=True)\nMERI_BOOTSTRAP"
 spec={'version':.2,'env':{'shell':'bash'},'phases':{'build':{'commands':[commands]}}};(ROOT/'IMAGE-BUILDSPEC.json').write_text(json.dumps(spec,indent=2)+'\n');v={'source':SOURCE,'qualificationSource':QUALIFICATION_SOURCE,'codeSource':CODE,'packetSha256':sha(packet.read_bytes()),'packetBytes':packet.stat().st_size,'producerSha256':sh,'nodeImage':NODE,'project':PROJECT,'reservationUSD':3,'timeoutMinutes':30,'queueMinutes':5,'maximumAttempts':1,'automaticRetries':0};save('IMAGE-PACKAGING.json',v);print(json.dumps(v),flush=True);return v,spec
def producer():
 need(os.name!='nt','Producer requires build Linux');validate_probe_files();tag=os.environ['IMAGE_TAG'];need(tag.startswith('runtime-'+SOURCE[:12]+'-'),'Tag binding');target=context(True);image=REGISTRY+'/'+REPO+':'+tag
 run(['docker','build','--platform','linux/amd64','--build-arg','NODE_IMAGE='+NODE,'--label','org.opencontainers.image.revision='+SOURCE,'--label','meri.qualified-code='+CODE,'-f',str(target/'apps/runtime/Dockerfile'),'-t',image,str(target)],timeout=1500)
 inspected=json.loads(run(['docker','image','inspect',image]))[0];cfg=inspected['Config'];need(inspected['Os']=='linux' and inspected['Architecture']=='amd64' and cfg['User']=='node','Image identity');need(cfg['Entrypoint']==['node','apps/runtime/cli.mjs'],'Entrypoint mismatch');need(inspected['Size']<=3*1024**3,'Image size bound');need(cfg['Labels']['org.opencontainers.image.revision']==SOURCE,'Image source label')
 common=['docker','run','--rm','--init','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','1g','--tmpfs','/tmp:rw,nosuid,nodev,size=128m,uid=1000,gid=1000','--entrypoint','/usr/local/bin/node']
 run(common+[image,'apps/runtime/cli.mjs','--help'],timeout=30)
 mounts=['--mount','type=bind,src='+str(ROOT.resolve())+',dst=/probe,readonly'];probe_common=list(common);probe_common[probe_common.index('1g')]='2g';proof=json.loads(run(probe_common+mounts+[image,'/probe/image_probe.mjs'],timeout=120));validate_proof(proof)
 save('IMAGE-MEASUREMENTS.json',{'source':SOURCE,'codeSource':CODE,'nodeImage':NODE,'imageId':inspected['Id'],'imageBytes':inspected['Size'],'entrypoint':cfg['Entrypoint'],'cmd':cfg['Cmd'],'probe':proof,'liveAcceptance':False});print('MERI_IMAGE_MEASUREMENTS '+json.dumps(json.loads((ROOT/'IMAGE-MEASUREMENTS.json').read_text())),flush=True)
 # Existing builder-role registry authentication is piped in memory; no value is logged or sent outside this account's registry.
 password=run([AWS,'ecr','get-login-password','--region',REGION]).encode();auth=ROOT/'owned-docker-auth';auth.mkdir();run(['docker','--config',str(auth),'login','--username','AWS','--password-stdin',REGISTRY],input_bytes=password);run(['docker','--config',str(auth),'push',image],timeout=180)
 detail=aws('ecr','describe-images','--repository-name',REPO,'--image-ids','imageTag='+tag,query='imageDetails[0].{digest:imageDigest,size:imageSizeInBytes}')
 result={'source':SOURCE,'codeSource':CODE,'tag':tag,'digest':detail['digest'],'imageURI':REGISTRY+'/'+REPO+'@'+detail['digest'],'imageBytes':detail['size'],'measurements':json.loads((ROOT/'IMAGE-MEASUREMENTS.json').read_text()),'runtimeServicesStarted':False,'providerRequests':0};save('PRODUCER-RESULT.json',result)
 aws('s3api','put-object','--bucket',BUCKET,'--key','results/'+tag+'/image-result.json','--body',str(ROOT/'PRODUCER-RESULT.json'),'--server-side-encryption','aws:kms','--ssekms-key-id',KMS)
 print('MERI_IMAGE_RESULT '+json.dumps(result),flush=True)
def start():
 v,spec=prepare();need(aws('sts','get-caller-identity',query='{Account:Account,Arn:Arn}')=={'Account':ACCOUNT,'Arn':'arn:aws:iam::'+ACCOUNT+':user/capirocli'},'Caller differs')
 p=aws('codebuild','batch-get-projects','--names',PROJECT,query='projects[0].{role:serviceRole,type:environment.type,image:environment.image,compute:environment.computeType,privileged:environment.privilegedMode,sourceType:source.type,sourceLocation:source.location,variables:environment.environmentVariables[].{name:name,type:type},fleet:environment.fleet,dockerServer:environment.dockerServer}');need(p['role']==ROLE and p['compute']=='BUILD_GENERAL1_SMALL' and p['image']=='aws/codebuild/standard:7.0' and p['privileged'] and p['sourceLocation']==BUCKET+'/'+KEY and p['sourceType']=='S3' and not p['fleet'] and not p['dockerServer'] and all(x['type']=='PLAINTEXT' for x in p['variables']),'Builder binding differs')
 ids=aws('codebuild','list-builds-for-project','--project-name',PROJECT,'--sort-order','DESCENDING','--no-paginate')['ids'][:20]
 if ids:need(all(aws('codebuild','batch-get-builds','--ids',*ids,query='builds[].buildComplete')),'An active build exists')
 need(aws('s3api','get-bucket-versioning','--bucket',BUCKET).get('Status')=='Enabled','Bucket versioning missing');repository=aws('ecr','describe-repositories','--repository-names',REPO,query='repositories[0].{registry:registryId,mutable:imageTagMutability,scan:imageScanningConfiguration.scanOnPush}');need(repository=={'registry':ACCOUNT,'mutable':'IMMUTABLE','scan':True},'Registry binding differs')
 attempt=uuid.uuid4().hex;tag='runtime-'+SOURCE[:12]+'-'+attempt;save('IMAGE-UPLOAD-INTENT.json',{'attempt':attempt,**v},True);checksum=base64.b64encode(bytes.fromhex(v['packetSha256'])).decode();upload=aws('s3api','put-object','--bucket',BUCKET,'--key',KEY,'--body',str(ROOT/'meri-image-source.zip'),'--server-side-encryption','aws:kms','--ssekms-key-id',KMS,'--checksum-algorithm','SHA256','--checksum-sha256',checksum);need(upload.get('VersionId') and upload.get('ChecksumSHA256')==checksum,'Upload binding');save('IMAGE-UPLOAD-RESULT.json',upload)
 request={'projectName':PROJECT,'sourceVersion':upload['VersionId'],'buildspecOverride':json.dumps(spec),'computeTypeOverride':'BUILD_GENERAL1_SMALL','timeoutInMinutesOverride':30,'queuedTimeoutInMinutesOverride':5,'autoRetryLimitOverride':0,'idempotencyToken':attempt,'artifactsOverride':{'type':'NO_ARTIFACTS'},'cacheOverride':{'type':'NO_CACHE'},'environmentVariablesOverride':[{'name':'IMAGE_TAG','value':tag,'type':'PLAINTEXT'}]};save('IMAGE-START-REQUEST.json',request);save('IMAGE-START-INTENT.json',{'attempt':attempt,'source':SOURCE,'tag':tag,'version':upload['VersionId'],'reservationUSD':3,'projectCeilingUSD':150,'submitted':time.time()},True)
 bid=aws('codebuild','start-build','--cli-input-json','file://'+str(ROOT/'IMAGE-START-REQUEST.json'),query='build.id');need(bid.startswith(PROJECT+':'),'Build identity differs');save('IMAGE-START-RESULT.json',{'buildId':bid,'attempt':attempt,'tag':tag});print(json.dumps({'buildId':bid,'tag':tag,'status':'STARTED'}),flush=True);deadline=time.monotonic()+2200;prior=None
 while True:
  status=aws('codebuild','batch-get-builds','--ids',bid,query='builds[0].{status:buildStatus,phase:currentPhase,complete:buildComplete,logs:logs}')
  if (status['status'],status['phase'])!=prior:print(json.dumps(status),flush=True);prior=(status['status'],status['phase'])
  if status['complete']:save('IMAGE-BUILD-RESULT.json',{'buildId':bid,'tag':tag,'source':SOURCE,**status});need(status['status']=='SUCCEEDED','Build failed; no retry');break
  if time.monotonic()>deadline:aws('codebuild','stop-build','--id',bid);raise RuntimeError('Owned build deadline; stop requested; reconcile')
  time.sleep(15)
 result=aws('s3api','get-object','--bucket',BUCKET,'--key','results/'+tag+'/image-result.json',str(ROOT/'IMAGE-RESULT.json'));image=json.loads((ROOT/'IMAGE-RESULT.json').read_text());need(image['source']==SOURCE and image['tag']==tag,'Result binding')
 deadline=time.monotonic()+600
 while True:
  scan=aws('ecr','describe-image-scan-findings','--repository-name',REPO,'--image-id','imageDigest='+image['digest'],query='{status:imageScanStatus.status,counts:imageScanFindings.findingSeverityCounts}')
  if scan['status']=='COMPLETE':break
  need(scan['status'] in ['IN_PROGRESS','PENDING'] and time.monotonic()<deadline,'Image scan unavailable');time.sleep(15)
 image.update({'buildId':bid,'sourceVersion':upload['VersionId'],'scan':scan,'admissible':not any((scan['counts'] or {}).get(x,0) for x in ['HIGH','CRITICAL']),'runtimeServicesStarted':False});save('IMAGE-RESULT.json',image);print(json.dumps(image),flush=True);need(image['admissible'],'Scan HIGH/CRITICAL: image unadmitted; no deploy or retry')
if __name__=='__main__':
 try:
  p=argparse.ArgumentParser();p.add_argument('--producer',action='store_true');p.add_argument('--start',action='store_true');a=p.parse_args();producer() if a.producer else start() if a.start else prepare()
 except Exception as e:print('HOLD: '+str(e),flush=True);raise SystemExit(1)

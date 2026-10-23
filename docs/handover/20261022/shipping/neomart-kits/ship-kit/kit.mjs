#!/usr/bin/env node
/** Meri first-chat ship kit: one step per invocation, all constants from kit.json beside this file (written by
 * make-ship-kit.mjs for one commit). Every AWS call is an argument array (no shell), every mutating step refuses when its
 * outputs already exist or its preconditions fail, and nothing prints a secret value. Private steps touch the private
 * working directory W and the PKI directory by path; they never echo file contents.
 * Usage: node kit.mjs <step> [--client-id UUID]      Exit 0 done, 2 refused, 3 uncertain (read back before rerunning). */
import {readFileSync,writeFileSync,existsSync,mkdirSync,statSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url)).replaceAll('\\','/');
const K=JSON.parse(readFileSync(join(HERE,'kit.json'),'utf8'));
const O=K.outDir,SRC=K.sourceRoot,W=K.privateWorkDir;
const p=(...parts)=>parts.join('/');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const shaFile=path=>sha(readFileSync(path));
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const say=line=>process.stdout.write(line+'\n');
class Refused extends Error{constructor(m){super(m);this.exit=2;}}
class Uncertain extends Error{constructor(m){super(m);this.exit=3;}}
const refuse=m=>{throw new Refused(m);};
const need=(ok,m)=>{if(!ok)refuse(m);};
const writeNew=(path,data)=>{need(!existsSync(path),`${path} already exists`);writeFileSync(path,typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return path;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function aws(args,{allowFail=false,text=false}={}){
 const r=spawnSync('aws',[...args,'--profile',K.profile,'--region',K.region,'--output',text?'text':'json'],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,AWS_PAGER:'',AWS_MAX_ATTEMPTS:'1'}});
 if(r.status!==0){if(allowFail)return {failed:true,stderr:(r.stderr??'').slice(0,400)};throw new Uncertain(`aws ${args.slice(0,2).join(' ')} exited ${r.status}: ${(r.stderr??'').trim().slice(0,400)}`);}
 return text?r.stdout.trim():(r.stdout.trim()?JSON.parse(r.stdout):{});
}
function node(args,{cwd=SRC,env}={}){
 const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,...env}});
 if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
 if(r.status!==0)refuse(`node ${args[0].split('/').slice(-1)[0]} ${args[1]??''} exited ${r.status}`);
 return r.stdout;
}
const b64sha=path=>createHash('sha256').update(readFileSync(path)).digest('base64');

// ---------- shared checks ----------
function caller(){const id=aws(['sts','get-caller-identity']);need(id.Account===K.account,`AWS account ${id.Account} is not ${K.account}`);return id;}
function activeBuilds(){const ids=aws(['codebuild','list-builds-for-project','--project-name',K.project,'--max-items','5']).ids??[];if(!ids.length)return [];return (aws(['codebuild','batch-get-builds','--ids',...ids]).builds??[]).filter(b=>!b.buildComplete).map(b=>b.id);}
function tagExists(tag){const r=aws(['ecr','list-images','--repository-name',K.ecrRepositoryName,'--filter','tagStatus=TAGGED']);return (r.imageIds??[]).some(i=>i.imageTag===tag);}
function prefixVersions(prefix){const r=aws(['s3api','list-object-versions','--bucket',K.bucket,'--prefix',prefix]);return [...(r.Versions??[]),...(r.DeleteMarkers??[])];}
function putObject(key,file){
 need(prefixVersions(key).length===0,`s3://${K.bucket}/${key} already has versions: read back instead of putting again`);
 const b64=b64sha(file);
 const put=aws(['s3api','put-object','--bucket',K.bucket,'--key',key,'--body',file,'--if-none-match','*','--checksum-algorithm','SHA256','--checksum-sha256',b64,'--server-side-encryption','aws:kms','--ssekms-key-id',K.kmsKeyArn]);
 const head=aws(['s3api','head-object','--bucket',K.bucket,'--key',key,'--version-id',put.VersionId,'--checksum-mode','ENABLED']);
 if(head.VersionId!==put.VersionId||head.ContentLength!==statSync(file).size||head.ChecksumSHA256!==b64||head.ServerSideEncryption!=='aws:kms'||head.SSEKMSKeyId!==K.kmsKeyArn)throw new Uncertain(`HEAD of ${key} does not match the upload`);
 return {put,head,b64};
}
async function waitBuild(id,{label,maxMinutes}){
 const until=Date.now()+maxMinutes*60000;
 for(;;){const b=aws(['codebuild','batch-get-builds','--ids',id]);const build=b.builds?.[0];
  if(!build)throw new Uncertain(`build ${id} not found`);
  say(`${new Date().toISOString()} ${label} ${build.currentPhase} ${build.buildStatus}`);
  if(build.buildComplete)return b;
  if(Date.now()>until)throw new Uncertain(`${label} still running after ${maxMinutes} minutes: rerun this step to keep waiting`);
  await sleep(30000);}
}
function getVersioned(prefix,name,dest){
 const versions=prefixVersions(`${prefix}/${name}`).filter(v=>v.Key===`${prefix}/${name}`);
 need(versions.length===1,`expected exactly one version of ${prefix}/${name}, found ${versions.length}`);
 const v=versions[0];aws(['s3api','get-object','--bucket',K.bucket,'--key',v.Key,'--version-id',v.VersionId,dest]);
 const bytes=readFileSync(dest);need(bytes.length===v.Size,`${name} length`);
 return {name,bucket:K.bucket,key:v.Key,versionId:v.VersionId,bytes:bytes.length,sha256:sha(bytes)};
}
function latestTsv(){
 const lines=[];
 for(const family of K.families)for(const status of ['ACTIVE','INACTIVE'])
  lines.push(`${family}\t${aws(['ecs','list-task-definitions','--family-prefix',family,'--status',status,'--sort','DESC','--max-items','1','--query','taskDefinitionArns[0]'],{text:true}).split(String.fromCharCode(10))[0].trim()}`);
 return lines.join('\n')+'\n';
}
function servicesState(names){
 const r=aws(['ecs','describe-services','--cluster',K.cluster,'--services',...names]);
 return (r.services??[]).map(s=>({name:s.serviceName,desired:s.desiredCount,running:s.runningCount,pending:s.pendingCount,taskDefinition:s.taskDefinition,
  deployments:s.deployments.map(d=>({status:d.status,rollout:d.rolloutState,taskDefinition:d.taskDefinition,running:d.runningCount}))}));
}
async function gateServices(names,expected,{maxMinutes=20,minAgeSeconds=120}={}){
 const until=Date.now()+maxMinutes*60000;
 for(;;){
  const state=servicesState(names);
  const ok=state.length===names.length&&state.every(s=>s.desired===1&&s.running===1&&s.pending===0&&s.deployments.length===1&&s.deployments[0].rollout==='COMPLETED'&&s.taskDefinition===expected[s.name]);
  if(ok){
   const tasks=names.flatMap(n=>aws(['ecs','list-tasks','--cluster',K.cluster,'--service-name',n]).taskArns??[]);
   const described=tasks.length?aws(['ecs','describe-tasks','--cluster',K.cluster,'--tasks',...tasks]).tasks:[];
   const young=described.filter(t=>t.lastStatus!=='RUNNING'||!t.startedAt||Date.now()-Date.parse(t.startedAt)<minAgeSeconds*1000);
   if(described.length===names.length&&!young.length){say(`GATE services ${names.join(', ')}: 1/1/0 on ${names.map(n=>expected[n].split('/').pop()).join(', ')}, running past ${minAgeSeconds} s`);return state;}
  }
  if(Date.now()>until){say(JSON.stringify(state,null,1));throw new Uncertain(`services ${names.join(', ')} not stable on the rendered revisions after ${maxMinutes} minutes`);}
  say(`${new Date().toISOString()} waiting: ${state.map(s=>`${s.name} ${s.running}/${s.desired}/${s.pending} ${s.taskDefinition.split('/').pop()} ${s.deployments.map(d=>d.rollout).join('+')}`).join('; ')}`);
  await sleep(20000);
 }
}
function logHits(group,pattern,sinceMs){const r=aws(['logs','filter-log-events','--log-group-name',group,'--start-time',String(sinceMs),'--filter-pattern',pattern,'--max-items','50']);return (r.events??[]).map(e=>`${e.logStreamName} ${e.message.slice(0,300)}`);}
function stageStart(name){const f=p(O,`${name}.started-at`);if(!existsSync(f))writeFileSync(f,String(Date.now()));return Number(readFileSync(f,'utf8'));}
function expectedTaskDefinitions(){const plan=json(p(O,'bindings','deploy-plan.json'));return plan.expectedTaskDefinitions;}
function serviceName(role){return K.services[role];}
const STAGE_ROLES={model:['model-owner','model-proxy'],issuer:['temporal-issuer'],app:['control','temporal-worker']};
const BAD_PATTERNS=['"RUNTIME_UNAVAILABLE"','"RUNTIME_CONFIGURATION"','"STATIC_INIT"','"REFUSED"'];

// ---------- steps ----------
const steps={
 async '01-source-put'(){
  say(`PLAN put the sealed source of ${K.commit} (zip ${K.archiveSha256.slice(0,12)}, manifest ${K.manifestSha256.slice(0,12)}) into s3://${K.bucket}/inputs/product-runtime/${K.commit}/ with create-only, SHA256 and KMS`);
  need(shaFile(p(O,'product-source.zip'))===K.archiveSha256&&shaFile(p(O,'product-source-members.json'))===K.manifestSha256,'sealed files differ from kit.json');
  need(!existsSync(p(O,'put-product-source.zip.json')),'already uploaded: continue with 02-build-request');
  caller();need(prefixVersions(`inputs/product-runtime/${K.commit}/`).length===0,`the prefix for ${K.commit} is not empty`);
  for(const f of ['product-source.zip','product-source-members.json']){const r=putObject(`inputs/product-runtime/${K.commit}/${f}`,p(O,f));writeNew(p(O,`put-${f}.json`),r.put);writeNew(p(O,`head-${f}.json`),r.head);}
  say('OUTCOME two KMS-encrypted, checksum-verified object versions. NEXT 02-build-request');
 },
 async '02-build-request'(){
  say('PLAN (no mutation) write request.json from the uploaded versions, verify it against the sealed files, build and size-check the buildspec, write start-build.request.json');
  for(const f of ['put-product-source.zip.json','put-product-source-members.json.json'])need(existsSync(p(O,f)),`missing ${f}: run 01-source-put`);
  const rows=Object.fromEntries(json(p(O,'product-source-members.json')).files.map(r=>[r.path,r.sha256]));
  const v=f=>json(p(O,`put-${f}.json`)).VersionId;
  const request={schemaVersion:2,sourceCommit:K.commit,
   archive:{bucket:K.bucket,key:`inputs/product-runtime/${K.commit}/product-source.zip`,versionId:v('product-source.zip'),sha256:K.archiveSha256},
   manifest:{bucket:K.bucket,key:`inputs/product-runtime/${K.commit}/product-source-members.json`,versionId:v('product-source-members.json'),sha256:K.manifestSha256},
   dockerfileSha256:rows['apps/runtime/Dockerfile'],nodeImageUri:K.nodeImageUri,nodeVersion:K.nodeVersion,runtimeBaseImageUri:K.runtimeBaseImageUri,
   runtimePackagesSha256:rows['infra/product-preview/runtime-packages.lock.json'],runnerSha256:rows['apps/runtime/conversation-runner.mjs'],runtimeUser:'1000:1000',
   codeBuildProjectArn:K.projectArn,ecrRepositoryUri:K.ecrRepositoryUri,imageTag:`product-${K.commit}-${K.attempt}`,
   verifierSha256:rows['infra/product-preview/image-build-source.py'],producerSha256:rows['infra/product-preview/image-build-producer.py']};
  need(request.runnerSha256===K.runnerSha256,'runnerSha256 differs from the git blob');
  if(!existsSync(p(O,'request.json')))writeNew(p(O,'request.json'),JSON.stringify(request,null,2)+'\n');
  need(JSON.stringify(json(p(O,'request.json')))===JSON.stringify(request),'request.json differs from the uploaded versions');
  const py=spawnSync('python3',['-I','-B','-S','infra/product-preview/image-build-source.py','verify','--request',p(O,'request.json'),'--archive',p(O,'product-source.zip'),'--manifest',p(O,'product-source-members.json')],{cwd:SRC,encoding:'utf8'});
  need(py.status===0,'image-build-source.py verify refused');
  if(!existsSync(p(O,'product-buildspec.json'))){const {createProductImageBuildRecipe}=await import('file:///'+p(SRC,'infra/product-preview/image-build-recipe.mjs'));
   writeNew(p(O,'product-buildspec.json'),createProductImageBuildRecipe(request).buildspecJson);}
  node([p(SRC,'docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs'),p(O,'request.json')]);
  const start={projectName:K.project,sourceTypeOverride:'S3',sourceLocationOverride:`${K.bucket}/inputs/product-runtime/${K.commit}/product-source.zip`,sourceVersion:request.archive.versionId,
   buildspecOverride:readFileSync(p(O,'product-buildspec.json'),'utf8'),idempotencyToken:K.attempt,timeoutInMinutesOverride:30,queuedTimeoutInMinutesOverride:5,autoRetryLimitOverride:0,
   artifactsOverride:{type:'S3',location:K.bucket,path:`results/product-image/${K.commit}/${K.attempt}`,name:'/',namespaceType:'NONE',packaging:'NONE',encryptionDisabled:false}};
  if(!existsSync(p(O,'start-build.request.json')))writeNew(p(O,'start-build.request.json'),JSON.stringify(start));
  need(readFileSync(p(O,'start-build.request.json'),'utf8')===JSON.stringify(start),'start-build.request.json differs');
  say('OUTCOME request verified, buildspec within limits, start request written. NEXT 03-image-build');
 },
 async '03-image-build'(){
  say(`PLAN start ONE CodeBuild job (${K.project}, 30 min, queue 5, retries 0, idempotency token ${K.attempt}) building image tag product-${K.commit}-${K.attempt}`);
  need(existsSync(p(O,'start-build.request.json')),'run 02-build-request first');need(!existsSync(p(O,'start-build.result.json')),'already started: run 04-image-readback');
  caller();const active=activeBuilds();need(!active.length,`a build is active: ${active.join(', ')}`);need(!tagExists(`product-${K.commit}-${K.attempt}`),'the image tag already exists');
  writeNew(p(O,'start-build.intent.json'),{at:new Date().toISOString(),attempt:K.attempt,intent:'start-once'});
  const r=aws(['codebuild','start-build','--cli-input-json',`file://${p(O,'start-build.request.json')}`]);
  writeNew(p(O,'start-build.result.json'),r);say(`OUTCOME build ${r.build?.id} ${r.build?.buildStatus}. NEXT 04-image-readback (waits up to 40 min)`);
 },
 async '04-image-readback'(){
  say('PLAN (read only) wait for the image build, then authenticate receipt, ECR digest/tag and scan, and write the candidate deployment inputs and scan pins');
  const id=json(p(O,'start-build.result.json')).build.id;
  const builds=await waitBuild(id,{label:'image build',maxMinutes:40});const b=builds.builds[0];
  if(!existsSync(p(O,'product-build.json')))writeNew(p(O,'product-build.json'),builds);
  need(b.buildStatus==='SUCCEEDED',`image build ${b.buildStatus}: stop (no retry); read product-image-diagnostic.json in the artifacts prefix`);
  const prefix=`results/product-image/${K.commit}/${K.attempt}`;
  for(const name of ['product-image-receipt.json','product-image-diagnostic.json'])if(!existsSync(p(O,name)))getVersioned(prefix,name,p(O,name));
  const receipt=json(p(O,'product-image-receipt.json')),request=json(p(O,'request.json'));
  need(receipt.sourceCommit===K.commit&&receipt.runnerSha256===K.runnerSha256&&receipt.buildId===id&&receipt.sourceVersion===request.archive.versionId,'receipt does not join the request');
  need(receipt.scanStatus==='COMPLETE'&&!(receipt.findingSeverityCounts?.HIGH)&&!(receipt.findingSeverityCounts?.CRITICAL),'producer scan gate');
  const image=aws(['ecr','describe-images','--repository-name',K.ecrRepositoryName,'--image-ids',`imageDigest=${receipt.imageDigest}`]);
  need(image.imageDetails?.[0]?.imageTags?.includes(`product-${K.commit}-${K.attempt}`),'ECR tag does not name this digest');
  const scan=aws(['ecr','describe-image-scan-findings','--repository-name',K.ecrRepositoryName,'--image-id',`imageDigest=${receipt.imageDigest}`]);
  const counts=scan.imageScanFindings?.findingSeverityCounts??{};need(scan.imageScanStatus?.status==='COMPLETE'&&!counts.HIGH&&!counts.CRITICAL,'ECR scan gate');
  if(!existsSync(p(O,'ecr-image.json')))writeNew(p(O,'ecr-image.json'),image);if(!existsSync(p(O,'ecr-scan.json')))writeNew(p(O,'ecr-scan.json'),scan);
  const deployment=json(p(O,'baseline-C.deployment-inputs.json'));deployment.images.nodeRuntime=`${K.ecrRepositoryUri}@${receipt.imageDigest}`;deployment.images.nodeRuntimeSourceCommit=K.commit;
  if(!existsSync(p(O,'deployment-inputs.candidate.json')))writeNew(p(O,'deployment-inputs.candidate.json'),JSON.stringify(deployment,null,2)+'\n');
  if(!existsSync(p(O,'image-scans.candidate.json')))writeNew(p(O,'image-scans.candidate.json'),{proxy:K.proxyScanSha256,nodeRuntime:shaFile(p(O,'product-image-receipt.json'))});
  say(`OUTCOME image ${receipt.imageDigest} scan COMPLETE 0 HIGH/0 CRITICAL. NEXT 05-measurement-prepare`);
 },
 async '05-measurement-prepare'(){
  say('PLAN (no mutation) prepare the launch-measurement payload from the authenticated receipt (measurement packet copy in this directory)');
  need(!existsSync(p(O,'measurement-prepared')),'already prepared');
  node([p(O,'measurement-packet','prepare-measurement.mjs'),'--source-root',SRC,'--request',p(O,'request.json'),'--product-receipt',p(O,'product-image-receipt.json'),'--deployment',p(O,'deployment-inputs.candidate.json'),
   '--policy',p(SRC,'infra/product-preview/first-chat/policy.json'),'--allocation',p(SRC,'infra/product-preview/first-chat/allocation.json'),'--project-role-arn',K.projectRoleArn,'--attempt',K.measurementAttempt,'--out',p(O,'measurement-prepared')],{cwd:O});
  say('OUTCOME payload prepared. NEXT 06-measurement-payload-put');
 },
 async '06-measurement-payload-put'(){
  const pins=json(p(O,'measurement-prepared','preparation-hashes.json'));
  say(`PLAN put the measurement payload (${pins.payloadBytes} B, ${pins.payloadSha256.slice(0,12)}) to s3://${pins.payloadBucket}/${pins.payloadKey} create-only with KMS`);
  need(pins.payloadBucket===K.bucket&&pins.sourceCommit===K.commit&&pins.attempt===K.measurementAttempt,'preparation pins');
  mkdirSync(p(O,'measurement-operator'),{recursive:true});need(!existsSync(p(O,'measurement-operator','payload-pin.json')),'payload already put: run 07-measurement-finalize');
  caller();const file=p(O,'measurement-prepared','measurement-payload.json');need(shaFile(file)===pins.payloadSha256,'payload bytes');
  writeNew(p(O,'measurement-operator','payload-put.intent.json'),{at:new Date().toISOString(),bucket:K.bucket,key:pins.payloadKey,bytes:pins.payloadBytes,sha256:pins.payloadSha256,conditionalCreateOnly:true});
  const r=putObject(pins.payloadKey,file);writeNew(p(O,'measurement-operator','payload-put.json'),r.put);writeNew(p(O,'measurement-operator','payload-head.json'),r.head);
  writeNew(p(O,'measurement-operator','payload-pin.json'),{bucket:K.bucket,key:pins.payloadKey,versionId:r.put.VersionId,bytes:pins.payloadBytes,sha256:pins.payloadSha256,checksumSha256:r.b64,serverSideEncryption:'aws:kms',kmsKeyArn:K.kmsKeyArn});
  say('OUTCOME payload version pinned. NEXT 07-measurement-finalize');
 },
 async '07-measurement-finalize'(){
  say('PLAN (no mutation) finalize the measurement start request from the pinned payload');
  node([p(O,'measurement-packet','finalize-measurement.mjs'),'--packet',p(O,'measurement-prepared'),'--payload-pin',p(O,'measurement-operator','payload-pin.json')],{cwd:O});
  say('OUTCOME measurement-start.request.json written. NEXT 08-measurement-build');
 },
 async '08-measurement-build'(){
  const req=json(p(O,'measurement-prepared','measurement-start.request.json'));
  say(`PLAN start ONE measurement CodeBuild job (${req.timeoutInMinutesOverride} min, queue ${req.queuedTimeoutInMinutesOverride}, retries ${req.autoRetryLimitOverride}); no model request`);
  need(req.timeoutInMinutesOverride===10&&req.queuedTimeoutInMinutesOverride===5&&req.autoRetryLimitOverride===0,'measurement limits must be 10/5/0');
  need(!existsSync(p(O,'measurement-operator','measurement-start.json')),'already started: run 09-measurement-readback');
  caller();const active=activeBuilds();need(!active.length,`a build is active: ${active.join(', ')}`);
  writeNew(p(O,'measurement-operator','measurement-start.intent.json'),{at:new Date().toISOString(),attempt:K.measurementAttempt,intent:'start-once'});
  const r=aws(['codebuild','start-build','--cli-input-json',`file://${p(O,'measurement-prepared','measurement-start.request.json')}`]);
  writeNew(p(O,'measurement-operator','measurement-start.result.json'),r);writeNew(p(O,'measurement-operator','measurement-start.json'),{id:r.build.id});
  say(`OUTCOME measurement build ${r.build.id}. NEXT 09-measurement-readback (waits up to 20 min)`);
 },
 async '09-measurement-readback'(){
  say('PLAN (read only) wait for the measurement build, download the six selected-version results, verify all joins and assemble runtime values');
  const op=p(O,'measurement-operator'),id=json(p(op,'measurement-start.json')).id;
  const builds=await waitBuild(id,{label:'measurement build',maxMinutes:20});need(builds.builds[0].buildStatus==='SUCCEEDED',`measurement build ${builds.builds[0].buildStatus}: stop (no retry)`);
  if(!existsSync(p(op,'measurement-build.json')))writeNew(p(op,'measurement-build.json'),builds);
  for(const f of ['product-build.json','ecr-image.json','ecr-scan.json'])if(!existsSync(p(op,f)))writeNew(p(op,f),readFileSync(p(O,f)));
  const results=p(O,'measurement-results');mkdirSync(results,{recursive:true});
  if(!existsSync(p(op,'artifact-downloads.json'))){const prefix=`results/launch-measurement/${K.commit}/${K.measurementAttempt}`;
   const files=['launch-measurement.json','launch-readback.json','runtime-native.json','runtime-packages.json','measurement-provenance.json','measurement-diagnostic.json'].map(n=>getVersioned(prefix,n,p(results,n)));
   writeNew(p(op,'artifact-downloads.json'),{schema:'meri.measurement-artifact-downloads.v1',buildId:id,files});}
  node([p(O,'measurement-packet','verify-measurement.mjs'),'--source-root',SRC,'--packet',p(O,'measurement-prepared'),'--results',results,'--operator-dir',op,'--out',p(O,'runtime-values.measured.json')],{cwd:O});
  say('OUTCOME MEASUREMENT_VERIFIED_AND_ASSEMBLED expected above. NEXT 10-stage3-input');
 },
 async '10-stage3-input'(){
  say('PLAN (read only) read the latest task-definition revisions and predict the revisions the three stacks will register');
  need(existsSync(p(O,'deployment-inputs.candidate.json')),'run 04-image-readback first');need(!existsSync(p(O,'stage3.json')),'stage3.json exists');
  caller();writeNew(p(O,'latest.tsv'),latestTsv());
  node([p(SRC,'infra/product-preview/first-chat/stage3-deploy.mjs'),'stage3-input','--deployment-inputs',p(O,'deployment-inputs.candidate.json'),'--foundation-outputs',p(SRC,'infra/product-preview/first-chat/foundation-outputs.json'),'--latest',p(O,'latest.tsv'),'--out',p(O,'stage3.json')]);
  say('OUTCOME stage3.json. Render must follow without any task-definition registration in between. NEXT 11-private-core');
 },
 async '11-private-core'(){
  say(`PLAN (PRIVATE, operator only) create ${W} (owner only), read the Core bearer to ${W}/identity, POST the membership check to Core, write ${W}/core.json. Nothing is printed except status codes and the summary booleans`);
  need(!existsSync(W),`${W} exists: use a new directory (edit kit.json privateWorkDir)`);
  caller();mkdirSync(W,{recursive:false,mode:0o700});
  const bearer=aws(['secretsmanager','get-secret-value','--secret-id','meri/preview/core/identity-bearer','--version-stage','AWSCURRENT','--query','SecretString'],{text:true}).replace(/[\r\n]/gu,'');
  writeFileSync(p(W,'identity'),bearer,{flag:'wx',mode:0o600});
  need(spawnSync(process.execPath,[p(K.prepDir,'bearer-exp.mjs'),p(W,'identity')],{stdio:'inherit'}).status===0,'the Core bearer expires within 10 minutes or is malformed');
  const response=await fetch(K.coreMembershipUrl,{method:'POST',signal:AbortSignal.timeout(15000),body:'{}',
   headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json',accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(Date.now()+10000)}});
  const body=Buffer.from(await response.arrayBuffer());writeFileSync(p(W,'membership.json'),body,{flag:'wx',mode:0o600});say(`membership HTTP ${response.status}`);
  need(response.status===200,'membership check failed');
  const summary=spawnSync(process.execPath,[p(K.prepDir,'membership-summary.mjs'),p(W,'membership.json'),'--min-seconds','600','--max-age-seconds','900'],{encoding:'utf8'});
  process.stdout.write(summary.stdout??'');need(summary.status===0,'membership summary refused');
  const clientArg=process.argv.indexOf('--client-id');
  const core=spawnSync(process.execPath,[p(SRC,'infra/product-preview/first-chat/stage3-deploy.mjs'),'core-values','--membership',p(W,'membership.json'),'--identity',p(W,'identity'),'--frontend-origin',K.frontendOrigin,...(clientArg>0?['--client-id',process.argv[clientArg+1]]:[]),'--out',p(W,'core.json')],{encoding:'utf8'});
  need(core.status===0,`core-values refused: ${(core.stderr??'').slice(0,200)} (a membership with several clients needs --client-id)`);
  say('OUTCOME private core values written (the status line with ids is not printed). Run 12-private-render within 15 minutes');
 },
 async '12-private-render'(){
  say(`PLAN (PRIVATE, operator only) check certificates, confirm revisions are unchanged, render all five roles into ${W}/rendered`);
  need(existsSync(p(W,'core.json')),'run 11-private-core first');need(!existsSync(p(W,'rendered')),'rendered output exists');
  need(Date.now()-statSync(p(W,'membership.json')).mtimeMs<15*60000,'membership read is older than 15 minutes: rerun 11 with a new privateWorkDir');
  const certs=spawnSync(process.execPath,[p(K.prepDir,'cert-expiry.mjs'),K.pkiDir,'14'],{encoding:'utf8'});process.stdout.write(certs.stdout??'');need(certs.status===0,'certificate validity gate');
  caller();need(latestTsv()===readFileSync(p(O,'latest.tsv'),'utf8'),'task-definition revisions changed since 10-stage3-input: rerun 10 with a fresh stage3.json');
  node([p(SRC,'infra/product-preview/first-chat/render-material.mjs'),'--deployment-inputs',p(O,'deployment-inputs.candidate.json'),'--private',K.pkiDir,'--core',p(W,'core.json'),
   '--runtime',p(O,'runtime-values.measured.json'),'--stage3',p(O,'stage3.json'),'--out',p(W,'rendered')]);
  const d=json(p(O,'deployment-inputs.candidate.json'));
  const verified=spawnSync(process.execPath,[p(K.prepDir,'verify-rendered.mjs'),p(W,'rendered'),d.images.nodeRuntime.split('@sha256:')[1],d.images.proxy.split('@sha256:')[1]],{stdio:'inherit'});
  need(verified.status===0,'rendered roles are not bound to the accepted images');
  say('OUTCOME MERI_FIRST_CHAT_MATERIAL_RENDERED. NEXT 13-secret-upload');
 },
 async '13-secret-upload'(){
  say(`PLAN stage the five rendered bundles as new secret versions under ${K.label} only (AWSCURRENT and earlier labels do not move)`);
  need(existsSync(p(W,'rendered','summary.json')),'run 12-private-render first');need(!existsSync(p(O,'secret-versions.tsv')),'already uploaded: run 14-bindings');
  caller();const deployment=json(p(O,'deployment-inputs.candidate.json'));
  const arns=K.materialSecretKeys.map(key=>deployment.secrets[key]);
  const before=Object.fromEntries(arns.map(arn=>[arn,aws(['secretsmanager','list-secret-version-ids','--secret-id',arn,'--include-deprecated','--max-results','100']).Versions]));
  for(const [arn,versions] of Object.entries(before)){need(!versions.some(v=>(v.VersionStages??[]).includes(K.label)),`label ${K.label} already exists on ${arn}`);need(versions.length<100,`${arn} holds 100 versions`);
   need(new Set(versions.flatMap(v=>v.VersionStages??[])).size<20,`${arn} is at the 20 staging-label quota`);}
  if(!existsSync(p(O,'secret-labels.before.json')))writeNew(p(O,'secret-labels.before.json'),before);
  // PR197: upload-plan requires --secret-labels, a directory of one complete list-secret-version-ids output ({ARN, Versions}) per secret.
  const labelDir=p(O,'secret-labels');if(!existsSync(labelDir)){mkdirSync(labelDir);K.materialSecretKeys.forEach((key,i)=>writeNew(p(labelDir,key.split('/')[0]+'.json'),{ARN:arns[i],Versions:before[arns[i]]}));}
  if(!existsSync(p(O,'upload-plan.json')))node([p(SRC,'infra/product-preview/first-chat/stage3-deploy.mjs'),'upload-plan','--deployment-inputs',p(O,'deployment-inputs.candidate.json'),'--rendered',p(W,'rendered'),'--label',K.label,'--secret-labels',labelDir,'--out',p(O,'upload-plan.json')]);
  const plan=json(p(O,'upload-plan.json'));need(plan.label===K.label,'upload plan label');
  const versions={};
  // The plan's own secret, token, label and bundle path; each retry resends exactly these (same token, same bytes).
  for(const r of plan.roles){need(r.command[r.command.indexOf('--version-stages')+1]===K.label&&r.command[r.command.indexOf('--client-request-token')+1]===r.clientRequestToken,`${r.role}: plan command`);
   const out=aws(['secretsmanager','put-secret-value','--secret-id',r.secretArn,'--client-request-token',r.clientRequestToken,'--version-stages',K.label,'--secret-string',`file://${r.bundleFile.replaceAll('\\','/')}`]);
   need(typeof out.VersionId==='string','PutSecretValue returned no VersionId');versions[r.role]=out.VersionId;say(`${r.role} ${out.VersionId}`);}
  for(const r of plan.roles){const after=aws(['secretsmanager','list-secret-version-ids','--secret-id',r.secretArn,'--include-deprecated','--max-results','100']).Versions;
   const mine=after.find(v=>v.VersionId===versions[r.role]);need(mine&&JSON.stringify(mine.VersionStages)===JSON.stringify([K.label]),`${r.role}: the new version must carry only ${K.label}`);
   for(const old of before[r.secretArn]){const now=after.find(v=>v.VersionId===old.VersionId);need(now&&JSON.stringify([...(now.VersionStages??[])].sort())===JSON.stringify([...(old.VersionStages??[])].sort()),`${r.role}: version ${old.VersionId} changed its labels`);}}
  writeNew(p(O,'secret-versions.tsv'),plan.roles.map(r=>`${r.role}\t${versions[r.role]}`).join('\n')+'\n');
  say('OUTCOME five new versions, labels elsewhere unchanged. On an uncertain error rerun this step: every command reuses its fixed token. NEXT 14-bindings');
 },
 async '14-bindings'(){
  say('PLAN (read only, then local) read live foundation/private-edge outputs and the live app template, build bindings and update templates, then the pre-deploy ship packet');
  need(existsSync(p(O,'secret-versions.tsv')),'run 13-secret-upload first');need(!existsSync(p(O,'bindings')),'bindings exist');
  caller();
  for(const [stack,file] of [[K.stacks.foundation,'foundation-live.json'],[K.stacks.privateEdge,'private-edge-outputs.json']])if(!existsSync(p(O,file)))writeNew(p(O,file),aws(['cloudformation','describe-stacks','--stack-name',stack,'--query','Stacks[0].Outputs']));
  if(!existsSync(p(O,'app.live.template.json')))writeNew(p(O,'app.live.template.json'),aws(['cloudformation','get-template','--stack-name',K.stacks.app,'--template-stage','Original','--query','TemplateBody']));
  node([p(SRC,'infra/product-preview/first-chat/stage3-deploy.mjs'),'bindings','--deployment-inputs',p(O,'deployment-inputs.candidate.json'),'--foundation-outputs',p(O,'foundation-live.json'),
   '--private-edge-outputs',p(O,'private-edge-outputs.json'),'--rendered',p(W,'rendered'),'--secret-versions',p(O,'secret-versions.tsv'),'--image-scans',p(O,'image-scans.candidate.json'),
   '--live-app-template',p(O,'app.live.template.json'),'--out',p(O,'bindings')]);
  node([p(SRC,'infra/product-preview/first-chat/ship-packet.mjs'),'--deployment-inputs',p(O,'deployment-inputs.candidate.json'),'--previous-deployment-inputs',p(O,'release-E.deployment-inputs.json'),
   '--runtime',p(O,'runtime-values.measured.json'),'--node-receipt',p(O,'product-image-receipt.json'),'--image-scans',p(O,'image-scans.candidate.json'),'--stage3',p(O,'stage3.json'),
   '--upload-plan',p(O,'upload-plan.json'),'--work',W,'--ceiling-usd',String(K.ceilingUsd),'--bindings',p(O,'bindings'),'--out',p(O,'ship-packet')]);
  say('OUTCOME bindings + SHIP-PACKET.md. Review ship-packet/SHIP-PACKET.md. NEXT 15-changesets');
 },
 async '15-changesets'(){
  say('PLAN create (do NOT execute) the model, issuer and app change sets from deploy-plan.json and print every resource change');
  const plan=json(p(O,'bindings','deploy-plan.json'));need(JSON.stringify(plan.order)===JSON.stringify(['model','issuer','app']),'deploy order');
  caller();need(latestTsv()===readFileSync(p(O,'latest.tsv'),'utf8'),'task-definition revisions changed since the render: re-render');
  for(const key of plan.order){
   const arnFile=p(O,`changeset-${key}.arn`);if(existsSync(arnFile)){say(`${key}: change set exists`);continue;}
   const cmd=plan.stacks[key].command;need(cmd[0]==='aws'&&cmd.includes('--no-execute-changeset'),'deploy command');
   const r=spawnSync('aws',[...cmd.slice(1),'--profile',K.profile],{encoding:'utf8',env:{...process.env,AWS_PAGER:''}});
   const arn=/arn:aws:cloudformation:us-east-1:\d{12}:changeSet\/[A-Za-z0-9-]+\/[a-f0-9-]+/u.exec(r.stdout??'')?.[0];
   if(!arn)throw new Uncertain(`${key}: no change set created (exit ${r.status}): ${(r.stdout+r.stderr).trim().slice(0,300)}`);
   writeNew(arnFile,arn);const described=aws(['cloudformation','describe-change-set','--change-set-name',arn]);writeNew(p(O,`changeset-${key}.json`),described);
   const changes=described.Changes.map(c=>c.ResourceChange);for(const c of changes)say(`${key}: ${c.Action} ${c.LogicalResourceId} ${c.ResourceType} replacement=${c.Replacement??'-'}`);
   need(changes.every(c=>['AWS::ECS::TaskDefinition','AWS::ECS::Service'].includes(c.ResourceType)),`${key}: change set touches more than task definitions and services: review ${arn} and stop`);
  }
  say('OUTCOME three change sets, TaskDefinition/Service changes only. NEXT 16-execute-model');
 },
 async '16-execute-model'(){await execute('model');},
 async '17-execute-issuer'(){await execute('issuer');},
 async '18-execute-app'(){await execute('app');},
 async '19-verify'(){
  say('PLAN (read only) every deployed task definition must equal the rendered revision; public health');
  for(const key of ['app','model','issuer'])if(!existsSync(p(O,`${key}.outputs.json`)))writeNew(p(O,`${key}.outputs.json`),aws(['cloudformation','describe-stacks','--stack-name',K.stacks[key],'--query','Stacks[0].Outputs']));
  node([p(SRC,'infra/product-preview/first-chat/stage3-deploy.mjs'),'verify-outputs','--bindings',p(O,'bindings'),'--app',p(O,'app.outputs.json'),'--model',p(O,'model.outputs.json'),'--issuer',p(O,'issuer.outputs.json')]);
  const health=await fetch(K.publicHealthUrl,{signal:AbortSignal.timeout(10000)});say(`public health HTTP ${health.status}`);need(health.status===200,'public health');
  say('OUTCOME release deployed. No chat is part of this kit.');
 },
};
// The model owner and proxy each fix their pair identity on first read, so a rolling update of either alone races the
// owner's ~3 min pair wait (candidate 8's model step took 54 min). The model stage therefore stops both, updates both
// while stopped, starts both at the same moment, and gates on a quiet pair (decision O94).
async function stopModelPair(){
 const names=STAGE_ROLES.model.map(serviceName);
 for(const n of names)aws(['ecs','update-service','--cluster',K.cluster,'--service',n,'--desired-count','0']);
 for(const until=Date.now()+10*60000;;){
  const left=names.flatMap(n=>aws(['ecs','list-tasks','--cluster',K.cluster,'--family',n]).taskArns??[]);
  if(!left.length){say(`model pair stopped ${new Date().toISOString()}`);return;}
  if(Date.now()>until)throw new Uncertain(`model pair still has ${left.length} task(s) after 10 minutes`);
  await sleep(5000);
 }
}
function startModelPair(){
 for(const n of STAGE_ROLES.model.map(serviceName))aws(['ecs','update-service','--cluster',K.cluster,'--service',n,'--desired-count','1']);
 say(`model pair started ${new Date().toISOString()}`);
}
async function awaitQuietPair(){
 for(const until=Date.now()+10*60000;;){
  const since=Date.now()-75000;
  if(!logHits(K.logGroups['model-proxy'],'"gate=pair"',since).length&&!logHits(K.logGroups['model-owner'],'UNAVAILABLE',since).length){say(`PAIR_READY ${new Date().toISOString()}`);return;}
  if(Date.now()>until)throw new Uncertain('model pair still refusing after 10 minutes: run tools/repair-model-pair.sh, then rerun this step');
  await sleep(10000);
 }
}
async function execute(key){
 const order=['model','issuer','app'],i=order.indexOf(key);
 say(`PLAN ${key==='model'?'stop the owner and proxy, ':''}execute the ${key} change set, wait for UPDATE_COMPLETE, ${key==='model'?'start both together, ':''}then gate ${STAGE_ROLES[key].join(' and ')}${key==='model'?' and a quiet pair':''}${key==='issuer'?' (control and the worker are refused from here until 18-execute-app: run it immediately after this gate)':''}`);
 for(const prev of order.slice(0,i))need(existsSync(p(O,`gate-${prev}.json`)),`gate ${prev} has not passed`);need(!existsSync(p(O,`gate-${key}.json`)),`${key} already gated`);
 const arn=readFileSync(p(O,`changeset-${key}.arn`),'utf8').trim(),since=stageStart(`stage-${key}`);
 caller();const cs=aws(['cloudformation','describe-change-set','--change-set-name',arn]);
 if(cs.ExecutionStatus==='AVAILABLE'){if(key==='model')await stopModelPair();aws(['cloudformation','execute-change-set','--change-set-name',arn]);say(`${key}: executing`);}
 else need(['EXECUTE_IN_PROGRESS','EXECUTE_COMPLETE'].includes(cs.ExecutionStatus),`${key} change set is ${cs.ExecutionStatus}`);
 const wait=spawnSync('aws',['cloudformation','wait','stack-update-complete','--stack-name',K.stacks[key],'--profile',K.profile,'--region',K.region],{encoding:'utf8'});
 if(wait.status!==0){const s=aws(['cloudformation','describe-stacks','--stack-name',K.stacks[key]]).Stacks[0].StackStatus;throw new Uncertain(`${K.stacks[key]} is ${s}: a rollback burns the rendered revisions (re-render under a new label); do not continue`);}
 if(key==='model')startModelPair();
 const expected=expectedTaskDefinitions(),names=STAGE_ROLES[key].map(serviceName),want=Object.fromEntries(STAGE_ROLES[key].map(role=>[serviceName(role),expected[role]]));
 const state=await gateServices(names,want);
 if(key==='model')await awaitQuietPair();
 const groups=STAGE_ROLES[key].map(role=>K.logGroups[role]);
 const bad=groups.flatMap(g=>BAD_PATTERNS.flatMap(pattern=>logHits(g,pattern,since)));
 if(key!=='model'){for(const role of STAGE_ROLES[key]){const hits=logHits(K.logGroups[role],'"runtime.listening"',since);need(hits.length>0,`${role}: no runtime.listening since the update`);}}
 if(key==='model')for(const id of K.discoveryServiceIds){const n=aws(['servicediscovery','list-instances','--service-id',id]).Instances?.length??0;need(n===1,`Cloud Map ${id} has ${n} instances`);}
 if(key==='app')for(const tg of K.controlTargetGroups){const h=aws(['elbv2','describe-target-health','--target-group-arn',tg]).TargetHealthDescriptions??[];need(h.length===1&&h[0].TargetHealth.State==='healthy',`target group ${tg.split('/').slice(-2).join('/')} not healthy`);}
 for(const line of bad)say(`REVIEW log line since the update: ${line}`);
 writeNew(p(O,`gate-${key}.json`),{at:new Date().toISOString(),state,reviewLines:bad.length});
 say(`OUTCOME gate ${key} passed${bad.length?` with ${bad.length} log line(s) to review (a first owner/worker restart during overlap is expected; the replacement must be healthy, as checked)`:''}. NEXT ${key==='model'?'17-execute-issuer':key==='issuer'?'18-execute-app NOW':'19-verify'}`);
}

const step=process.argv[2];
if(!steps[step]){say(`Usage: node kit.mjs <step>\nSteps: ${Object.keys(steps).join(' ')}`);process.exit(2);}
try{await steps[step]();}
catch(error){process.stderr.write(`${step} ${error instanceof Uncertain?'UNCERTAIN':'REFUSED'}: ${error.message}\n`);process.exitCode=error.exit??2;}

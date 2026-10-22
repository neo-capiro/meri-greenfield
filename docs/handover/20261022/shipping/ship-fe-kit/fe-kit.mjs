#!/usr/bin/env node
/** Frontend (portfolio-preview) ship kit: one step per invocation, all constants from kit.json beside this file (written by
 * make-fe-ship-kit.mjs for one capiro-frontend commit). Every AWS call is an argument array (no shell). A mutating step writes
 * an intent file first, refuses when its outputs exist or the live state is not the baseline the kit was made against, and
 * prints no secret: the stack has no NoEcho parameter and the task's Clerk keys are Secrets Manager references.
 * Usage: node kit.mjs <step>      Exit 0 done, 2 refused, 3 uncertain (read back before rerunning). */
import {readFileSync,writeFileSync,existsSync,mkdirSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url)).replaceAll('\\','/');
const K=JSON.parse(readFileSync(`${HERE}/kit.json`,'utf8'));
const p=(...parts)=>parts.join('/');
const OUT=p(HERE,'out'),RB=p(HERE,'readback'),DRY=p(HERE,'dry');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const say=line=>process.stdout.write(line+'\n');
class Refused extends Error{constructor(m){super(m);this.exit=2;}}
class Uncertain extends Error{constructor(m){super(m);this.exit=3;}}
const refuse=m=>{throw new Refused(m);};
const need=(ok,m)=>{if(!ok)refuse(m);};
const text=data=>typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n';
const writeNew=(path,data)=>{need(!existsSync(path),`${path} already exists`);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text(data),{flag:'wx'});return path;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rev=arn=>Number(arn.split(':').pop());
const short=arn=>arn.split('/').pop();

function aws(args,{allowFail=false}={}){
 // PYTHONUTF8: the Windows AWS CLI otherwise fails on the app's "▲ Next.js" / "✓ Ready" log lines.
 const r=spawnSync('aws',[...args,'--profile',K.profile,'--region',K.region,'--output','json'],{encoding:'utf8',maxBuffer:256*1024*1024,
  env:{...process.env,AWS_PAGER:'',AWS_MAX_ATTEMPTS:'2',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
 if(r.status!==0){if(allowFail)return {failed:true,stderr:(r.stderr??'').trim().slice(0,400)};
  throw new Uncertain(`aws ${args.slice(0,2).join(' ')} exited ${r.status}: ${(r.stderr??'').trim().slice(0,400)}`);}
 return r.stdout.trim()?JSON.parse(r.stdout):{};
}
function run(cmd,args,{cwd=HERE,label=cmd}={}){
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:256*1024*1024});
 if(r.status!==0)refuse(`${label} exited ${r.status}: ${((r.stderr??'')+(r.stdout??'')).trim().slice(0,600)}`);
 return r.stdout;
}
const git=(...args)=>run('git',['-C',K.repo,...args],{label:`git ${args[0]}`}).trim();
const gitBlob=path=>{const r=spawnSync('git',['-C',K.repo,'show',`${K.commit}:${path}`],{maxBuffer:64*1024*1024});need(r.status===0,`git show ${path}`);return r.stdout;};
function shaFile(path){const h=createHash('sha256'),fd=openSync(path,'r'),buf=Buffer.allocUnsafe(8<<20);let n;
 try{while((n=readSync(fd,buf,0,buf.length,null))>0)h.update(buf.subarray(0,n));}finally{closeSync(fd);}return h.digest();}

// ---------- live state ----------
function caller(){const id=aws(['sts','get-caller-identity']);need(id.Account===K.account,`AWS account ${id.Account} is not ${K.account}`);return id;}
const params=list=>[...list].map(({ParameterKey,ParameterValue})=>({ParameterKey,ParameterValue})).sort((a,b)=>a.ParameterKey.localeCompare(b.ParameterKey));
const paramDiff=(a,b)=>{const m=new Map(b.map(x=>[x.ParameterKey,x.ParameterValue]));return [...new Set([...a.map(x=>x.ParameterKey),...b.map(x=>x.ParameterKey)])].filter(k=>a.find(x=>x.ParameterKey===k)?.ParameterValue!==m.get(k));};
function live(){
 const stack=aws(['cloudformation','describe-stacks','--stack-name',K.stack]).Stacks[0];
 const template=aws(['cloudformation','get-template','--stack-name',K.stack,'--template-stage','Original']).TemplateBody;
 const changeSets=aws(['cloudformation','list-change-sets','--stack-name',K.stack]).Summaries??[];
 const service=aws(['ecs','describe-services','--cluster',K.cluster,'--services',K.service]).services[0];
 const resource=aws(['cloudformation','describe-stack-resource','--stack-name',K.stack,'--logical-resource-id','PreviewTaskDefinition']).StackResourceDetail;
 const taskDefinition=aws(['ecs','describe-task-definition','--task-definition',service.taskDefinition]).taskDefinition;
 const health=aws(['elbv2','describe-target-health','--target-group-arn',K.targetGroupArn]).TargetHealthDescriptions??[];
 return {stack,template,changeSets,service,resource,taskDefinition,health};
}
const serviceSteady=(s,td)=>s.desiredCount===1&&s.runningCount===1&&s.pendingCount===0&&s.deployments.length===1&&s.deployments[0].rolloutState==='COMPLETED'&&s.taskDefinition===td;
const serviceLine=s=>`${s.runningCount}/${s.desiredCount}/${s.pendingCount} on ${short(s.taskDefinition)}, deployments ${s.deployments.map(d=>`${short(d.taskDefinition)}:${d.rolloutState}`).join('+')}`;
/** Everything 06/07 must start from: the stack, its template and parameters, the service and its revision exactly as this kit recorded them. */
function baselineProblems(l,{ownChangeSet=false}={}){
 const problems=[],b=K.baseline;
 if(l.stack.StackStatus!=='UPDATE_COMPLETE')problems.push(`stack is ${l.stack.StackStatus}`);
 if(sha(l.template)!==K.templateSha256)problems.push('live template differs from the recorded one');
 const recorded=json(p(RB,'stack-parameters.baseline.json')),changed=paramDiff(params(l.stack.Parameters),recorded);
 if(changed.length)problems.push(`stack parameters changed: ${changed.join(', ')}`);
 const others=l.changeSets.filter(c=>!(ownChangeSet&&c.ChangeSetName===K.changeSetName));
 if(others.length)problems.push(`change sets present: ${others.map(c=>`${c.ChangeSetName} ${c.ExecutionStatus}`).join(', ')}`);
 if(!serviceSteady(l.service,b.taskDefinitionArn))problems.push(`service ${serviceLine(l.service)}`);
 if(l.resource.PhysicalResourceId!==b.taskDefinitionArn)problems.push(`stack PreviewTaskDefinition is ${short(l.resource.PhysicalResourceId)}`);
 if(l.taskDefinition.containerDefinitions[0].image!==b.imageUri)problems.push('the serving image is not the baseline image');
 if(!(l.health.length===1&&l.health[0].TargetHealth.State==='healthy'))problems.push(`target health: ${l.health.map(h=>`${h.Target.Id} ${h.TargetHealth.State}`).join(', ')||'no targets'}`);
 return problems;
}
function activeBuilds(){const ids=aws(['codebuild','list-builds-for-project','--project-name',K.project,'--sort-order','DESCENDING','--max-items','5']).ids??[];
 return ids.length?(aws(['codebuild','batch-get-builds','--ids',...ids]).builds??[]).filter(b=>!b.buildComplete).map(b=>b.id):[];}
const imageByTag=tag=>aws(['ecr','describe-images','--repository-name',K.ecrRepositoryName,'--image-ids',`imageTag=${tag}`],{allowFail:true});
function scanOf(digest){const s=aws(['ecr','describe-image-scan-findings','--repository-name',K.ecrRepositoryName,'--image-id',`imageDigest=${digest}`],{allowFail:true});
 if(s.failed)return {status:'UNAVAILABLE',detail:s.stderr};
 return {status:s.imageScanStatus?.status,completedAt:s.imageScanFindings?.imageScanCompletedAt,counts:s.imageScanFindings?.findingSeverityCounts??{},findings:(s.imageScanFindings?.findings??[]).length};}
const scanClean=s=>s.status==='COMPLETE'&&s.findings===0&&!Object.keys(s.counts).length;
async function publicHealth(){
 try{const r=await fetch(K.publicHealthUrl,{signal:AbortSignal.timeout(10000),redirect:'manual'});const body=(await r.text()).slice(0,200);
  return {reachable:true,status:r.status,ok:r.status===200&&body.includes('"status":"ok"')};}
 catch(error){return {reachable:false,detail:String(error?.cause?.code??error?.name??error).slice(0,80)};}
}
const healthLine=h=>h.reachable?`public ${K.publicHealthUrl} HTTP ${h.status}${h.ok?' status ok':''}`:`public ${K.publicHealthUrl} unreachable from this machine (${h.detail}); the ALB admits only allow-listed IPs`;
/** A task definition with everything ECS derives on registration removed; the image is kept unless asked. */
function normalTaskDefinition(td,{withoutImage=false}={}){
 const t=structuredClone(td);for(const k of ['taskDefinitionArn','revision','status','registeredAt','registeredBy','deregisteredAt'])delete t[k];
 // ECS computes compatibilities and returns it in no fixed order, so it is compared as a set.
 if(t.compatibilities)t.compatibilities.sort();
 for(const c of t.containerDefinitions){if(withoutImage)delete c.image;for(const k of ['environment','secrets'])if(c[k])c[k].sort((a,b)=>a.name.localeCompare(b.name));}
 return JSON.stringify(t);
}
async function waitStack(label,{maxMinutes=40}={}){
 const until=Date.now()+maxMinutes*60000;
 for(;;){const s=aws(['cloudformation','describe-stacks','--stack-name',K.stack]).Stacks[0].StackStatus;
  if(!s.endsWith('_IN_PROGRESS'))return s;
  if(Date.now()>until)throw new Uncertain(`${label}: ${K.stack} still ${s} after ${maxMinutes} minutes; rerun this step to keep waiting`);
  say(`${new Date().toISOString()} ${label}: ${s}`);await sleep(20000);}
}
/** The service on `td` with one healthy target that is its own task, running for at least two minutes. */
async function gateRelease(td,{maxMinutes=20,minAgeSeconds=120}={}){
 const until=Date.now()+maxMinutes*60000;
 for(;;){
  const s=aws(['ecs','describe-services','--cluster',K.cluster,'--services',K.service]).services[0];
  const tasks=serviceSteady(s,td)?aws(['ecs','list-tasks','--cluster',K.cluster,'--service-name',K.service]).taskArns??[]:[];
  const task=tasks.length===1?aws(['ecs','describe-tasks','--cluster',K.cluster,'--tasks',tasks[0]]).tasks[0]:undefined;
  const ip=task?.attachments?.[0]?.details?.find(d=>d.name==='privateIPv4Address')?.value;
  const health=aws(['elbv2','describe-target-health','--target-group-arn',K.targetGroupArn]).TargetHealthDescriptions??[];
  const age=task?.startedAt?(Date.now()-Date.parse(task.startedAt))/1000:0;
  const ok=task&&task.lastStatus==='RUNNING'&&task.taskDefinitionArn===td&&age>=minAgeSeconds&&health.length===1&&health[0].Target.Id===ip&&health[0].TargetHealth.State==='healthy';
  if(ok)return {service:{running:s.runningCount,desired:s.desiredCount,pending:s.pendingCount,taskDefinition:s.taskDefinition},task:{arn:task.taskArn,startedAt:task.startedAt,ip},target:health[0]};
  if(Date.now()>until)throw new Uncertain(`not healthy on ${short(td)} after ${maxMinutes} minutes: service ${serviceLine(s)}; targets ${health.map(h=>`${h.Target.Id} ${h.TargetHealth.State}`).join(', ')||'none'}`);
  say(`${new Date().toISOString()} waiting: service ${serviceLine(s)}; task ${task?`${task.lastStatus} ${Math.round(age)} s`:'-'}; targets ${health.map(h=>`${h.Target.Id} ${h.TargetHealth.State}`).join(', ')||'none'}`);
  await sleep(20000);
 }
}
function startupLines(taskArn){
 const stream=`${K.appLogStreamPrefix}/${K.containerName}/${taskArn.split('/').pop()}`;
 const r=aws(['logs','get-log-events','--log-group-name',K.appLogGroup,'--log-stream-name',stream,'--start-from-head','--limit','200'],{allowFail:true});
 const lines=(r.events??[]).map(e=>e.message);
 return {stream,ready:lines.some(m=>m.includes('Ready in')),errors:lines.filter(m=>m.startsWith('⨯')).length,lines:lines.length};
}
/** Create one change set from the current template with `parametersFile`, and require exactly the two image-only changes. */
async function createImageChangeSet(name,parametersFile,description){
 const arnFile=p(OUT,`${name}.arn`);
 if(!existsSync(arnFile)){
  writeNew(p(OUT,`${name}.intent.json`),{at:new Date().toISOString(),changeSet:name,parameters:parametersFile.split('/').pop(),usePreviousTemplate:true});
  const r=aws(['cloudformation','create-change-set','--stack-name',K.stack,'--change-set-name',name,'--change-set-type','UPDATE','--use-previous-template',
   '--parameters',`file://${parametersFile}`,'--capabilities','CAPABILITY_IAM','--description',description]);
  writeNew(arnFile,r.Id);
 }
 const arn=readFileSync(arnFile,'utf8').trim(),until=Date.now()+5*60000;let d;
 for(;;){d=aws(['cloudformation','describe-change-set','--change-set-name',arn]);if(!d.Status.endsWith('_PENDING')&&!d.Status.endsWith('_IN_PROGRESS'))break;
  if(Date.now()>until)throw new Uncertain(`change set ${name} still ${d.Status}`);await sleep(5000);}
 if(!existsSync(p(OUT,`${name}.json`)))writeNew(p(OUT,`${name}.json`),d);
 need(d.Status==='CREATE_COMPLETE'&&d.ExecutionStatus==='AVAILABLE',`change set ${name} is ${d.Status}/${d.ExecutionStatus}: ${d.StatusReason??''}`);
 need(!paramDiff(params(d.Parameters),json(parametersFile)).length,`change set ${name} parameters differ from ${parametersFile}`);
 const changes=d.Changes.map(c=>c.ResourceChange);for(const c of changes)say(`change: ${c.Action} ${c.LogicalResourceId} ${c.ResourceType} replacement=${c.Replacement} causes=${c.Details.map(x=>x.CausingEntity??`${x.ChangeSource}/${x.Evaluation}`).join(',')}`);
 const td=changes.find(c=>c.LogicalResourceId==='PreviewTaskDefinition'),svc=changes.find(c=>c.LogicalResourceId==='PreviewService');
 need(changes.length===2&&td&&svc,`change set ${name} must change exactly PreviewTaskDefinition and PreviewService: review ${arn} and do not execute it`);
 need(td.Action==='Modify'&&td.Replacement==='True'&&td.Details.some(x=>x.CausingEntity==='ImageUri')&&
  td.Details.every(x=>(x.ChangeSource==='ParameterReference'&&x.CausingEntity==='ImageUri')||(x.ChangeSource==='DirectModification'&&x.Evaluation==='Dynamic')),
  `the task-definition change has a cause other than ImageUri: review ${arn} and do not execute it`);
 need(svc.Action==='Modify'&&svc.Replacement==='False'&&svc.Details.every(x=>x.Target?.Name==='TaskDefinition'&&x.CausingEntity==='PreviewTaskDefinition'),
  `the service change is more than its task definition: review ${arn} and do not execute it`);
 return arn;
}
/** Execute once; a rerun after an uncertain wait finds the change set executing, executed or failed (or removed by CloudFormation). */
async function executeChangeSet(arn,label){
 const cs=aws(['cloudformation','describe-change-set','--change-set-name',arn],{allowFail:true});
 if(cs.failed)need(aws(['cloudformation','describe-stacks','--stack-name',K.stack]).Stacks[0].ChangeSetId===arn,`change set ${arn} is gone and was not the stack's last update`);
 else if(cs.ExecutionStatus==='AVAILABLE'){aws(['cloudformation','execute-change-set','--change-set-name',arn]);say(`${label}: executing ${cs.ChangeSetName}`);}
 else need(['EXECUTE_IN_PROGRESS','EXECUTE_COMPLETE','EXECUTE_FAILED'].includes(cs.ExecutionStatus),`${cs.ChangeSetName} is ${cs.ExecutionStatus}`);
 return waitStack(label);
}

// ---------- steps ----------
const steps={
 async '00-preflight'(){
  say(`PLAN (read only) the live preview must still be the baseline this kit was made against: ${K.stack} UPDATE_COMPLETE with the recorded template and parameters, service 1/1/0 on ${short(K.baseline.taskDefinitionArn)} (${K.baseline.imageTag.slice(0,8)}), one healthy target, no change set, no active build, image tag ${K.commit.slice(0,8)} absent`);
  caller();const l=live(),first=!existsSync(p(RB,'stack-parameters.baseline.json'));
  if(first){
   need(l.taskDefinition.taskDefinitionArn===K.baseline.taskDefinitionArn&&l.taskDefinition.containerDefinitions[0].image===K.baseline.imageUri,'the serving revision is not the one in kit.json');
   need(sha(l.template)===K.templateSha256,'the live template is not the one in kit.json');
   writeNew(p(RB,'stack.json'),l.stack);writeNew(p(RB,'stack-parameters.baseline.json'),params(l.stack.Parameters));writeNew(p(RB,'live-template.yml'),l.template);
   writeNew(p(RB,'service.json'),l.service);writeNew(p(RB,'taskdef-baseline.json'),l.taskDefinition);writeNew(p(RB,'target-health.json'),l.health);
   writeNew(p(RB,'ecr-baseline-image.json'),imageByTag(K.baseline.imageTag));writeNew(p(RB,'ecr-baseline-scan.json'),scanOf(K.baseline.imageUri.split('@')[1]));
   say(`recorded the baseline in ${RB}`);
  }
  const problems=baselineProblems(l);
  const next=aws(['ecs','describe-task-definition','--task-definition',`${K.family}:${rev(K.baseline.taskDefinitionArn)+1}`],{allowFail:true});
  if(!next.failed)problems.push(`${K.family}:${rev(K.baseline.taskDefinitionArn)+1} already exists`);
  const baseImage=imageByTag(K.baseline.imageTag);
  if(baseImage.failed||baseImage.imageDetails?.[0]?.imageDigest!==K.baseline.imageUri.split('@')[1])problems.push('the rollback image is not in ECR under its tag');
  const baseScan=scanOf(K.baseline.imageUri.split('@')[1]);if(!scanClean(baseScan))problems.push(`rollback image scan ${baseScan.status} ${baseScan.findings} finding(s)`);
  if(!existsSync(p(OUT,'start-build.result.json'))){
   const active=activeBuilds();if(active.length)problems.push(`active build(s): ${active.join(', ')}`);
   if(!imageByTag(K.commit).failed)problems.push(`ECR already holds tag ${K.commit} (tags are immutable)`);
  }
  say(healthLine(await publicHealth()));
  for(const problem of problems)say(`DRIFT ${problem}`);
  need(!problems.length,`${problems.length} difference(s) from the baseline: do not ship from this kit until they are understood`);
  say(`OUTCOME PREFLIGHT_OK: ${K.stack} ${l.stack.StackStatus}, service ${serviceLine(l.service)}, target ${l.health[0].Target.Id} healthy, rollback image ${K.baseline.imageTag.slice(0,8)} scan clean`);
 },
 async '01-source-archive'(){
  say(`PLAN (no mutation) zip the tree of ${K.commit} (core.autocrlf=false), then let the commit's own scripts/verify-preview-archive.py append source-commit.txt and check every member against Git`);
  const zip=p(OUT,'portfolio-source.zip');need(!existsSync(zip)&&!existsSync(p(OUT,'archive.json')),'the archive exists: continue with 02-dry');
  need(run('git',['-C',K.worktree,'rev-parse','HEAD']).trim()===K.commit,`${K.worktree} is not at ${K.commit}`);
  need(run('git',['-C',K.worktree,'status','--porcelain=v1','--untracked-files=no']).trim()==='',`${K.worktree} has local changes`);
  need(git('rev-parse',`${K.commit}^{tree}`)===K.tree,'tree');
  mkdirSync(OUT,{recursive:true});git('-c','core.autocrlf=false','archive','--format=zip','-o',zip,K.commit);
  const out=run(K.python,['-I','-B',p(K.worktree,'scripts/verify-preview-archive.py'),zip,K.repo,K.commit,K.commit,K.tree],{label:'verify-preview-archive.py'});
  const a=JSON.parse(out);need(a.commit===K.commit&&a.tree===K.tree&&a.zip_file_members===a.tracked_files+1&&a.zip_bytes===statSync(zip).size,'archive verification output');
  need(shaFile(zip).toString('hex')===a.sha256_hex,'archive sha256');writeNew(p(OUT,'archive.json'),a);
  say(`OUTCOME ${a.zip_file_members} members (${a.tracked_files} tracked + source-commit.txt), ${a.zip_bytes} B, sha256 ${a.sha256_hex}. NEXT 02-dry`);
 },
 async '02-dry'(){
  say('PLAN (no mutation) check the buildspec against the commit, then write the change-set dry run: parameter diff (ImageUri only), template diff (none: the change set reuses the live template), expected task-definition diff (image only)');
  const spec=readFileSync(p(HERE,'buildspec.yml'),'utf8');need(sha(spec)===K.buildspecSha256,'buildspec.yml differs from kit.json');
  need(Buffer.byteLength(spec)<=25600,`buildspec ${Buffer.byteLength(spec)} B exceeds the 25600 B override limit`);
  need(spec.includes(`test "$EXPECTED_SHA" = "${K.commit}"`),'buildspec does not pin the commit');
  const exists=path=>spawnSync('git',['-C',K.repo,'cat-file','-e',`${K.commit}:${path}`]).status===0;
  const missing=[...K.files.required,...K.tests.vitest.map(t=>`apps/web/${t}`),...K.tests.browserModules.map(t=>`apps/web/test/browser/${t}`),...K.tests.browserPortfolio.map(t=>`apps/web/${t}`)].filter(f=>!exists(f));
  need(!missing.length,`missing at ${K.commit}: ${missing.join(', ')}`);
  for(const [file,names] of Object.entries(K.files.npmScripts)){const scripts=JSON.parse(git('show',`${K.commit}:${file}`)).scripts??{};const absent=names.filter(n=>!scripts[n]);need(!absent.length,`${file} lacks npm script(s) ${absent.join(', ')}`);}
  const dockerfile=gitBlob('apps/web/Dockerfile');
  need(sha(dockerfile)===K.dockerfile.sha256,`apps/web/Dockerfile at ${K.commit} is not the pinned ${K.dockerfile.sha256.slice(0,12)}`);
  const patched=dockerfile.toString('utf8').replace(/\n$/u,'').split('\n').flatMap(l=>l==='RUN npm run build'?['ARG CAPIRO_BUILD_NODE_OPTIONS','ARG CAPIRO_BUILD_CIRCLE_NODE_TOTAL','RUN NODE_OPTIONS="$CAPIRO_BUILD_NODE_OPTIONS" CIRCLE_NODE_TOTAL="$CAPIRO_BUILD_CIRCLE_NODE_TOTAL" npm run build']:[l]).join('\n')+'\n';
  need(sha(patched)===K.dockerfile.patchedSha256,'the build-heap Dockerfile patch does not produce the pinned digest');
  // Change-set dry run against the recorded baseline (the candidate digest is only known after 05).
  const base=json(p(RB,'stack-parameters.baseline.json')),pending=`${K.ecrRepositoryUri}@sha256:<digest from 05-image-readback>`;
  const dry=base.map(x=>x.ParameterKey==='ImageUri'?{...x,ParameterValue:pending}:x);need(paramDiff(dry,base).join()==='ImageUri','dry parameters');
  mkdirSync(DRY,{recursive:true});
  if(!existsSync(p(DRY,'parameters.candidate.dry.json')))writeNew(p(DRY,'parameters.candidate.dry.json'),dry);
  const td=json(p(RB,'taskdef-baseline.json')),expected=structuredClone(td);expected.containerDefinitions[0].image=pending;
  need(normalTaskDefinition(expected,{withoutImage:true})===normalTaskDefinition(td,{withoutImage:true}),'expected task definition');
  const template=readFileSync(p(RB,'live-template.yml'),'utf8'),reviewed=existsSync(K.reviewedTemplate)?readFileSync(K.reviewedTemplate,'utf8'):undefined;
  const lines=[`# Change-set dry run for ${K.commit} (written by 02-dry; nothing was created)`,'',
   `Stack ${K.stack}, change set ${K.changeSetName}: --use-previous-template, CAPABILITY_IAM, parameters = readback/stack-parameters.baseline.json with ONLY ImageUri changed.`,'',
   '## Template diff','',`None. The change set reuses the live template (Original, sha256 ${sha(template)}, ${Buffer.byteLength(template)} B).`,
   reviewed===undefined?`The reviewed copy ${K.reviewedTemplate} is absent.`:reviewed===template?`It is byte-identical to the reviewed copy ${K.reviewedTemplate}.`:`It DIFFERS from the reviewed copy ${K.reviewedTemplate}: compare them before shipping.`,'',
   '## Parameter diff','','| Parameter | Baseline (rev '+rev(K.baseline.taskDefinitionArn)+') | Candidate |','| --- | --- | --- |',
   `| ImageUri | \`${K.baseline.imageUri}\` | \`${pending}\` |`,'',`The other ${base.length-1} parameters are passed unchanged with explicit values (no UsePreviousValue).`,'',
   '## Expected changes (06-changeset refuses anything else)','',
   '- `Modify PreviewTaskDefinition` (AWS::ECS::TaskDefinition), Replacement True, caused only by ImageUri (plus the dynamic DirectModification CloudFormation always reports for container definitions).',
   '- `Modify PreviewService` (AWS::ECS::Service), Replacement False, TaskDefinition only.','',
   '## Expected task definition','',`Revision ${rev(K.baseline.taskDefinitionArn)+1} = revision ${rev(K.baseline.taskDefinitionArn)} with only \`containerDefinitions[0].image\` changed (checked: every other field, all ${td.containerDefinitions[0].environment.length} environment variables and both secret references are equal). 08-verify checks this on the registered revision.`,''];
  if(!existsSync(p(DRY,'CHANGE-SET-DRY-RUN.md')))writeNew(p(DRY,'CHANGE-SET-DRY-RUN.md'),lines.join('\n'));
  const validated=aws(['cloudformation','validate-template','--template-body',`file://${p(RB,'live-template.yml')}`]);
  need((validated.Parameters??[]).length===base.length,'validate-template parameter count');
  say(`OUTCOME DRY_OK: buildspec ${Buffer.byteLength(spec)} B pins ${K.commit.slice(0,8)}, ${K.tests.vitest.length} unit suites and ${K.tests.browserModules.length+K.tests.browserPortfolio.length} browser specs exist, Dockerfile pins hold, parameter diff is ImageUri only, template unchanged. NEXT 03-source-put (operator)`);
 },
 async '02b-rehearse'(){
  say(`PLAN (local, no AWS) run this buildspec on this archive in WSL2 ${K.wsl.distro}: every install and build command in order, except the ECR login/push/describe lines, each in its own bash with set -euo pipefail, continuing after a failure; results in dry/rehearsal`);
  need(existsSync(p(OUT,'archive.json')),'run 01-source-archive first');const dir=p(DRY,'rehearsal');need(!existsSync(p(dir,'summary.tsv')),'rehearsal results exist');
  const spec=readFileSync(p(HERE,'buildspec.yml'),'utf8');need(sha(spec)===K.buildspecSha256,'buildspec.yml differs from kit.json');
  const commands=[];let phase,inCommands=false;
  for(const line of spec.split('\n')){const ph=/^ {2}(install|pre_build|build|post_build):$/u.exec(line);if(ph){phase=ph[1];inCommands=false;continue;}
   if(phase&&/^ {4}commands:$/u.test(line)){inCommands=true;continue;}if(inCommands&&line.startsWith('      - '))commands.push({phase,cmd:line.slice(8)});else if(!/^ {6}/u.test(line))inCommands=false;}
  const wsl=path=>path.replace(/^([A-Za-z]):/u,(_,d)=>`/mnt/${d.toLowerCase()}`);
  mkdirSync(dir,{recursive:true});let n=0;const runLines=[];
  for(const {phase,cmd} of commands){if(cmd==='set -euo pipefail')continue;n++;const id=String(n).padStart(2,'0');
   const skipped=/^aws ecr |docker (push|login)|^aws ecr get-login-password/u.test(cmd);
   writeFileSync(p(dir,`cmd-${id}.sh`),`set -euo pipefail\n${cmd}\n`);runLines.push(skipped?`skip ${id} ${phase}`:`step ${id} ${phase}`);}
  writeFileSync(p(dir,'run.sh'),['#!/usr/bin/env bash','set -uo pipefail',`W=${K.wsl.workDir}; D=${wsl(dir)}; rm -rf "$W/src" "$W/logs"; mkdir -p "$W/src" "$W/logs"`,
   `export PATH="${K.wsl.nodeBin}:$PATH" CI=1 EXPECTED_SHA=${K.commit} EXPECTED_S3_VERSION=rehearsal CODEBUILD_SOURCE_VERSION=rehearsal REPOSITORY_URI=${K.ecrRepositoryUri} AWS_DEFAULT_REGION=${K.region}`,
   `unzip -q "${wsl(p(OUT,'portfolio-source.zip'))}" -d "$W/src" || { echo unzip failed; exit 1; }`,'cd "$W/src"',': > "$D/summary.tsv"',
   'step(){ local t=$(date +%s); bash "$D/cmd-$1.sh" > "$W/logs/$1.log" 2>&1; local rc=$?; printf "%s\\t%s\\t%s\\t%ss\\n" "$1" "$2" "$rc" "$(( $(date +%s) - t ))" | tee -a "$D/summary.tsv"; [ $rc = 0 ] || tail -40 "$W/logs/$1.log" > "$D/fail-$1.log"; }',
   'skip(){ printf "%s\\t%s\\tskipped (ECR)\\t-\\n" "$1" "$2" | tee -a "$D/summary.tsv"; }',...runLines,''].join('\n'));
  const r=spawnSync('wsl.exe',['-d',K.wsl.distro,'--','bash',wsl(p(dir,'run.sh'))],{encoding:'utf8',stdio:['ignore','inherit','inherit']});
  const rows=readFileSync(p(dir,'summary.tsv'),'utf8').trim().split('\n').map(l=>l.split('\t'));const failed=rows.filter(r=>r[2]!=='0'&&!r[2].startsWith('skipped'));
  need(r.status===0&&rows.length===n,`rehearsal did not finish (${rows.length}/${n} commands)`);
  need(!failed.length,`rehearsal: ${failed.length} command(s) failed: ${failed.map(f=>f[0]).join(', ')} (dry/rehearsal/fail-*.log)`);
  say(`OUTCOME REHEARSAL_OK: ${rows.filter(r=>r[2]==='0').length} commands passed, ${rows.length-rows.filter(r=>r[2]==='0').length} ECR line(s) skipped`);
 },
 async '03-source-put'(){
  const a=json(p(OUT,'archive.json')),zip=p(OUT,'portfolio-source.zip');
  say(`PLAN put out/portfolio-source.zip (${a.zip_bytes} B, sha256 ${a.sha256_hex.slice(0,12)}) as a NEW VERSION of s3://${K.bucket}/${K.sourceKey} with a full-object SHA-256 checksum (bucket default SSE-S3), then write the start-build request pinned to that version`);
  need(!existsSync(p(OUT,'source-put.json')),'already put: continue with 04-image-build');
  need(shaFile(zip).toString('hex')===a.sha256_hex,'the zip differs from archive.json');
  caller();
  let put;
  if(existsSync(p(OUT,'source-put.intent.json'))){
   // A previous attempt ended uncertain: adopt the newest version only if it is these exact bytes, uploaded after the intent.
   const intent=json(p(OUT,'source-put.intent.json'));
   const latest=(aws(['s3api','list-object-versions','--bucket',K.bucket,'--prefix',K.sourceKey]).Versions??[]).find(v=>v.Key===K.sourceKey&&v.IsLatest);
   const head=latest&&aws(['s3api','head-object','--bucket',K.bucket,'--key',K.sourceKey,'--version-id',latest.VersionId,'--checksum-mode','ENABLED']);
   need(head&&head.ChecksumSHA256===a.sha256_base64&&Date.parse(head.LastModified)>=Date.parse(intent.at)-60000,'an earlier put is uncertain and the newest version is not this archive: rerun after removing out/source-put.intent.json');
   put={VersionId:latest.VersionId,adopted:true};say(`adopting version ${latest.VersionId} from the earlier attempt`);
  } else {
   writeNew(p(OUT,'source-put.intent.json'),{at:new Date().toISOString(),bucket:K.bucket,key:K.sourceKey,bytes:a.zip_bytes,sha256:a.sha256_hex});
   put=aws(['s3api','put-object','--bucket',K.bucket,'--key',K.sourceKey,'--body',zip,'--checksum-algorithm','SHA256','--checksum-sha256',a.sha256_base64]);
  }
  const head=aws(['s3api','head-object','--bucket',K.bucket,'--key',K.sourceKey,'--version-id',put.VersionId,'--checksum-mode','ENABLED']);
  if(!(head.VersionId===put.VersionId&&head.ContentLength===a.zip_bytes&&head.ChecksumSHA256===a.sha256_base64&&head.ServerSideEncryption==='AES256'))throw new Uncertain(`HEAD of version ${put.VersionId} does not match the archive`);
  writeNew(p(OUT,'source-put.json'),put);writeNew(p(OUT,'source-head.json'),head);
  const spec=readFileSync(p(HERE,'buildspec.yml'),'utf8');need(sha(spec)===K.buildspecSha256,'buildspec.yml differs from kit.json');
  writeNew(p(OUT,'start-build.request.json'),{projectName:K.project,sourceVersion:put.VersionId,buildspecOverride:spec,
   environmentVariablesOverride:[{name:'EXPECTED_SHA',value:K.commit,type:'PLAINTEXT'},{name:'REPOSITORY_URI',value:K.ecrRepositoryUri,type:'PLAINTEXT'},
    {name:'EXPECTED_S3_VERSION',value:put.VersionId,type:'PLAINTEXT'},{name:'AWS_DEFAULT_REGION',value:K.region,type:'PLAINTEXT'}],
   timeoutInMinutesOverride:K.build.timeoutMinutes,queuedTimeoutInMinutesOverride:K.build.queuedTimeoutMinutes,autoRetryLimitOverride:0,
   idempotencyToken:`fe-${K.commit.slice(0,8)}-${put.VersionId.slice(0,8)}-${K.build.attempt}`});
  say(`OUTCOME version ${put.VersionId}: ${head.ContentLength} B, SHA-256 and SSE-S3 confirmed; start-build.request.json written. NEXT 04-image-build`);
 },
 async '04-image-build'(){
  say(`PLAN start ONE CodeBuild job (${K.project}, ${K.build.timeoutMinutes} min, queue ${K.build.queuedTimeoutMinutes}, no retry) that tests, builds, smoke-tests and pushes ${K.ecrRepositoryName}:${K.commit}`);
  need(existsSync(p(OUT,'start-build.request.json')),'run 03-source-put first');need(!existsSync(p(OUT,'start-build.result.json')),'already started: run 05-image-readback');
  const req=json(p(OUT,'start-build.request.json'));need(sha(req.buildspecOverride)===K.buildspecSha256&&req.sourceVersion===json(p(OUT,'source-put.json')).VersionId,'start-build request');
  caller();const active=activeBuilds();need(!active.length,`a build is active: ${active.join(', ')}`);need(imageByTag(K.commit).failed,`ECR already holds tag ${K.commit}`);
  writeNew(p(OUT,'start-build.intent.json'),{at:new Date().toISOString(),idempotencyToken:req.idempotencyToken,intent:'start-once'});
  const r=aws(['codebuild','start-build','--cli-input-json',`file://${p(OUT,'start-build.request.json')}`]);
  writeNew(p(OUT,'start-build.result.json'),r);say(`OUTCOME build ${r.build?.id} ${r.build?.buildStatus}. NEXT 05-image-readback (waits up to ${K.build.timeoutMinutes+K.build.queuedTimeoutMinutes} min)`);
 },
 async '05-image-readback'(){
  say('PLAN (read only) wait for the build, require SUCCEEDED and the container-smoke line in its log, read the pushed digest, wait for the ECR scan and require COMPLETE with zero findings, then write the candidate parameters (baseline with only ImageUri changed)');
  need(!existsSync(p(OUT,'parameters.candidate.json')),'already read back: continue with 06-changeset');
  const id=json(p(OUT,'start-build.result.json')).build.id,until=Date.now()+(K.build.timeoutMinutes+K.build.queuedTimeoutMinutes)*60000;let b;
  for(;;){b=aws(['codebuild','batch-get-builds','--ids',id]).builds[0];if(b.buildComplete)break;
   if(Date.now()>until)throw new Uncertain(`build ${id} still ${b.currentPhase}; rerun this step to keep waiting`);say(`${new Date().toISOString()} build ${b.currentPhase} ${b.buildStatus}`);await sleep(30000);}
  if(!existsSync(p(OUT,'build.json')))writeNew(p(OUT,'build.json'),b);
  if(b.buildStatus!=='SUCCEEDED'){for(const ph of b.phases??[])if(ph.phaseStatus&&ph.phaseStatus!=='SUCCEEDED')say(`phase ${ph.phaseType} ${ph.phaseStatus} ${(ph.contexts?.[0]?.message??'').slice(0,300)}`);
   refuse(`build ${b.buildStatus}: stop (no automatic retry). Log: ${b.logs?.groupName} ${b.logs?.streamName}`);}
  const smoke=aws(['logs','filter-log-events','--log-group-name',b.logs.groupName,'--log-stream-names',b.logs.streamName,'--filter-pattern','"Container smoke passed"']).events??[];
  need(smoke.length>0,'the build log has no "Container smoke passed" line');
  const image=imageByTag(K.commit);need(!image.failed,`ECR has no tag ${K.commit}`);const digest=image.imageDetails[0].imageDigest;
  let scan;for(let i=0;i<40;i++){scan=scanOf(digest);if(scan.status==='COMPLETE'||scan.status==='FAILED')break;say(`scan ${scan.status}`);await sleep(15000);}
  writeNew(p(OUT,'image.json'),image);writeNew(p(OUT,'scan.json'),scan);
  need(scanClean(scan),`ECR scan ${scan.status} with ${scan.findings} finding(s) ${JSON.stringify(scan.counts)}: a human decides; do not continue`);
  const candidate=json(p(RB,'stack-parameters.baseline.json')).map(x=>x.ParameterKey==='ImageUri'?{...x,ParameterValue:`${K.ecrRepositoryUri}@${digest}`}:x);
  need(paramDiff(candidate,json(p(RB,'stack-parameters.baseline.json'))).join()==='ImageUri','candidate parameters');
  writeNew(p(OUT,'parameters.candidate.json'),candidate);
  say(`OUTCOME image ${digest} (${image.imageDetails[0].imageSizeInBytes} B), scan COMPLETE with 0 findings, smoke line present. NEXT 06-changeset`);
 },
 async '06-changeset'(){
  say(`PLAN create (do NOT execute) change set ${K.changeSetName} on ${K.stack}: live template, baseline parameters with only ImageUri changed; refuse unless it changes exactly the task definition (ImageUri) and the service`);
  need(existsSync(p(OUT,'parameters.candidate.json')),'run 05-image-readback first');
  caller();const problems=baselineProblems(live(),{ownChangeSet:true});need(!problems.length,`live state is not the baseline: ${problems.join('; ')}`);
  const arn=await createImageChangeSet(K.changeSetName,p(OUT,'parameters.candidate.json'),`Frontend ${K.commit.slice(0,8)} image only (Fable kit)`);
  say(`OUTCOME ${arn} AVAILABLE with exactly the two image-only changes. NEXT 07-rollout`);
 },
 async '07-rollout'(){
  const candidate=`${K.ecrRepositoryUri}@${json(p(OUT,'image.json')).imageDetails[0].imageDigest}`;
  say(`PLAN execute ${K.changeSetName}, wait for UPDATE_COMPLETE (the ECS circuit breaker rolls a failing task back to ${short(K.baseline.taskDefinitionArn)} by itself), then gate: service 1/1/0 on the new revision with image ${candidate.split('@')[1].slice(7,19)}, its task running >= 120 s and the only healthy target, "Ready in" logged, public /healthz`);
  need(existsSync(p(OUT,`${K.changeSetName}.arn`)),'run 06-changeset first');need(!existsSync(p(OUT,'gate.json')),'already gated: run 08-verify');
  caller();const arn=readFileSync(p(OUT,`${K.changeSetName}.arn`),'utf8').trim();
  if(!existsSync(p(OUT,'rollout.intent.json')))writeNew(p(OUT,'rollout.intent.json'),{at:new Date().toISOString(),changeSet:arn});
  const status=await executeChangeSet(arn,'rollout');
  if(status!=='UPDATE_COMPLETE')throw new Uncertain(`${K.stack} ended ${status}: CloudFormation/ECS rolled back. Run R1-rollback-to-${rev(K.baseline.taskDefinitionArn)} (it only verifies in this state) and read the stack events`);
  const td=aws(['cloudformation','describe-stack-resource','--stack-name',K.stack,'--logical-resource-id','PreviewTaskDefinition']).StackResourceDetail.PhysicalResourceId;
  need(rev(td)>rev(K.baseline.taskDefinitionArn),`stack task definition ${short(td)} is not newer than the baseline`);
  need(aws(['ecs','describe-task-definition','--task-definition',td]).taskDefinition.containerDefinitions[0].image===candidate,`${short(td)} does not carry the candidate image`);
  const gate=await gateRelease(td);const logs=startupLines(gate.task.arn);const health=await publicHealth();
  say(`task ${short(gate.task.arn)} ${gate.task.ip} healthy; log ${logs.stream}: ${logs.lines} line(s), Ready ${logs.ready}, ${logs.errors} line(s) starting with ⨯`);say(healthLine(health));
  need(logs.ready,'the new task never logged "Ready in": run R1 if the app does not serve');
  if(health.reachable)need(health.ok,`public health HTTP ${health.status}: run R1-rollback-to-${rev(K.baseline.taskDefinitionArn)}`);
  writeNew(p(OUT,'gate.json'),{at:new Date().toISOString(),taskDefinition:td,image:candidate,...gate,logs,publicHealth:health});
  say(`OUTCOME RELEASED on ${short(td)}${health.reachable?'':' (public health UNVERIFIED from this IP; target health passed)'}. NEXT 08-verify`);
 },
 async '08-verify'(){
  say(`PLAN (read only) the deployed revision must equal ${short(K.baseline.taskDefinitionArn)} except the image, the stack parameters must equal parameters.candidate.json, and the stack outputs must be unchanged`);
  const g=json(p(OUT,'gate.json')),td=aws(['ecs','describe-task-definition','--task-definition',g.taskDefinition]).taskDefinition;
  need(normalTaskDefinition(td,{withoutImage:true})===normalTaskDefinition(json(p(RB,'taskdef-baseline.json')),{withoutImage:true}),`${short(g.taskDefinition)} differs from the baseline in more than the image`);
  need(td.containerDefinitions[0].image===g.image,'image');
  const stack=aws(['cloudformation','describe-stacks','--stack-name',K.stack]).Stacks[0];
  need(!paramDiff(params(stack.Parameters),json(p(OUT,'parameters.candidate.json'))).length,'stack parameters differ from parameters.candidate.json');
  need(JSON.stringify(stack.Outputs)===JSON.stringify(json(p(RB,'stack.json')).Outputs),'stack outputs changed');
  const s=aws(['ecs','describe-services','--cluster',K.cluster,'--services',K.service]).services[0];need(serviceSteady(s,g.taskDefinition),`service ${serviceLine(s)}`);
  if(!existsSync(p(OUT,'verify.json')))writeNew(p(OUT,'verify.json'),{at:new Date().toISOString(),taskDefinition:g.taskDefinition,image:g.image,onlyImageChanged:true});
  say(`OUTCOME VERIFIED: ${short(g.taskDefinition)} = ${short(K.baseline.taskDefinitionArn)} + image ${g.image.split('@')[1].slice(7,19)}; parameters and outputs as planned. The live first-chat check is the operator's.`);
 },
 async rollback(){
  const b=K.baseline,base=short(b.taskDefinitionArn);
  caller();const s0=aws(['cloudformation','describe-stacks','--stack-name',K.stack]).Stacks[0];
  const td0=aws(['cloudformation','describe-stack-resource','--stack-name',K.stack,'--logical-resource-id','PreviewTaskDefinition']).StackResourceDetail.PhysicalResourceId;
  say(`PLAN return the preview to the ${base} content (image ${b.imageTag.slice(0,8)}, recorded parameters). Stack ${s0.StackStatus}, stack task definition ${short(td0)}`);
  let target=b.taskDefinitionArn,mode;
  if(s0.StackStatus==='UPDATE_IN_PROGRESS'){
   mode='cancel';if(!existsSync(p(OUT,'rollback.intent.json')))writeNew(p(OUT,'rollback.intent.json'),{at:new Date().toISOString(),mode});
   aws(['cloudformation','cancel-update-stack','--stack-name',K.stack]);say('cancel-update-stack sent: CloudFormation restores the previous parameters and service revision');
   const end=await waitStack('rollback');need(end==='UPDATE_ROLLBACK_COMPLETE',`stack ended ${end}: needs a human`);
  } else if(s0.StackStatus==='UPDATE_ROLLBACK_COMPLETE'||(s0.StackStatus==='UPDATE_COMPLETE'&&td0===b.taskDefinitionArn)){
   mode='verify-only';say(`nothing to undo: the stack is on ${short(td0)}${s0.StackStatus==='UPDATE_ROLLBACK_COMPLETE'?' after an automatic rollback':''}`);
   need(td0===b.taskDefinitionArn,`the stack task definition is ${short(td0)}, not ${base}`);
  } else if(s0.StackStatus==='UPDATE_COMPLETE'&&rev(td0)>rev(b.taskDefinitionArn)){
   // CloudFormation deregistered the baseline revision when the release completed, and ECS cannot move a service back to an
   // INACTIVE revision; a direct update-service would also drift the stack. So the rollback registers the baseline content
   // again through the stack, with the recorded parameters (the same template).
   mode='changeset';const name=K.rollbackChangeSetName,file=p(RB,'stack-parameters.baseline.json');
   const ours=existsSync(p(OUT,'gate.json'))?json(p(OUT,'gate.json')).taskDefinition:undefined;
   need(!ours||ours===td0,`the stack runs ${short(td0)}, not this kit's release ${short(ours)}: the baseline is stale; roll back by hand`);
   need(sha(aws(['cloudformation','get-template','--stack-name',K.stack,'--template-stage','Original']).TemplateBody)===K.templateSha256,'the live template changed since the kit was made: roll back by hand');
   const arn=await createImageChangeSet(name,file,`Rollback to ${base} content (Fable kit)`);
   const end=await executeChangeSet(arn,'rollback');need(end==='UPDATE_COMPLETE',`rollback stack update ended ${end}: needs a human`);
   target=aws(['cloudformation','describe-stack-resource','--stack-name',K.stack,'--logical-resource-id','PreviewTaskDefinition']).StackResourceDetail.PhysicalResourceId;
   need(normalTaskDefinition(aws(['ecs','describe-task-definition','--task-definition',target]).taskDefinition)===normalTaskDefinition(json(p(RB,'taskdef-baseline.json'))),`${short(target)} is not identical to ${base}`);
  } else refuse(`stack is ${s0.StackStatus} on ${short(td0)}: no automatic rollback from this state`);
  const gate=await gateRelease(target),health=await publicHealth();say(healthLine(health));
  const result={at:new Date().toISOString(),mode,taskDefinition:target,identicalTo:b.taskDefinitionArn,image:b.imageUri,...gate,publicHealth:health};
  if(!existsSync(p(OUT,'rollback.json')))writeNew(p(OUT,'rollback.json'),result);
  say(`OUTCOME ROLLED_BACK (${mode}): service 1/1/0 on ${short(target)}${target===b.taskDefinitionArn?'':` (identical to ${base})`}, image ${b.imageTag.slice(0,8)}, target healthy`);
 },
};
steps[`R1-rollback-to-${rev(K.baseline.taskDefinitionArn)}`]=steps.rollback;delete steps.rollback;

// A mutating step runs only with --execute, which only its NN-*.sh wrapper passes; any other argument is refused.
const MUTATING=new Set(['03-source-put','04-image-build','06-changeset','07-rollout',`R1-rollback-to-${rev(K.baseline.taskDefinitionArn)}`]);
const [step,...rest]=process.argv.slice(2),execute=rest.length===1&&rest[0]==='--execute';
if(!steps[step]||(rest.length&&!(execute&&MUTATING.has(step)))){say(`Usage: node kit.mjs <step>   (mutating steps: bash <step>.sh)\nSteps: ${Object.keys(steps).join(' ')}`);process.exit(2);}
if(MUTATING.has(step)&&!execute){say(`${step} changes AWS: run it as bash ${step}.sh (which passes --execute); nothing was done`);process.exit(2);}
try{await steps[step]();}
catch(error){process.stderr.write(`${step} ${error instanceof Uncertain?'UNCERTAIN':'REFUSED'}: ${error.message}\n`);process.exitCode=error.exit??2;}

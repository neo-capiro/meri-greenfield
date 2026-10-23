#!/usr/bin/env node
/** Builds the Meri first-chat ship kit for one candidate commit, running every NON-mutating step:
 * clean source worktree, seal, measurement packet copy (pins patched to the commit), public candidate inputs, a dry
 * request/verify/recipe/size check, read-only AWS readbacks, the next free secret label, kit.json, kit.mjs and one
 * numbered .sh per step plus SHIP-STEPS.md. It never mutates AWS and never opens a private file.
 * Usage: node make-ship-kit.mjs <commit-ish on fable/meri-first-chat-candidate-20261020> [--ceiling-usd N]  */
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url)).replaceAll('\\','/');
const REPO='C:/dev/fable/wt-candidate',PROFILE='capiro-dev',REGION='us-east-1';
const HANDOFF='origin/handoff/runner-diagnostic-release-20261020',RD='docs/integration/runner-diagnostic-release-20261020';
const OLD_SOURCE='2b4421f612f9fbb728d6da52927aac228d712d40';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',['-C',REPO,...a],{maxBuffer:512*1024*1024});
const say=l=>process.stdout.write(l+'\n');
const fail=m=>{process.stderr.write(`MAKE_SHIP_KIT_REFUSED: ${m}\n`);process.exit(2);};
const aws=args=>{const r=spawnSync('aws',[...args,'--profile',PROFILE,'--region',REGION,'--output','json'],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,AWS_PAGER:''}});if(r.status!==0)fail(`aws ${args.slice(0,2).join(' ')}: ${r.stderr.slice(0,300)}`);return JSON.parse(r.stdout||'{}');};

const target=process.argv[2];if(!target)fail('usage: node make-ship-kit.mjs <commit>');
const ceilingArg=process.argv.indexOf('--ceiling-usd'),ceilingUsd=ceilingArg>0?Number(process.argv[ceilingArg+1]):5;
git('fetch','-q','origin','fable/meri-first-chat-candidate-20261020','handoff/runner-diagnostic-release-20261020');
const X=git('rev-parse',`${target}^{commit}`).toString().trim(),X8=X.slice(0,8);
const O=`C:/dev/fable/ship-${X8}`,SRC=`C:/dev/fable/ship-src-${X8}`;
if(existsSync(O))fail(`${O} exists: a kit for this commit was already made`);

// 1. Clean detached source worktree at X with the shared dependency links (Windows junctions, git-ignored).
if(!existsSync(SRC))git('worktree','add','--detach',SRC,X);
const srcGit=(...a)=>execFileSync('git',['-C',SRC,...a]).toString().trim();
if(srcGit('rev-parse','HEAD')!==X||srcGit('status','--short'))fail(`${SRC} is not a clean checkout of ${X}`);
const link=(target,source)=>{if(!existsSync(target)&&existsSync(source))execFileSync('cmd',['/c','mklink','/J',target.replaceAll('/','\\'),source.replaceAll('/','\\')]);};
for(const d of ['','/apps/runtime','/apps/worker/conversation','/apps/control/conversations','/apps/artifacts/storage','/packages/ui-stream','/packages/window-resolution'])link(`${SRC}${d}/node_modules`,`C:/dev/fable/meri-source${d}/node_modules`);
mkdirSync(`${SRC}/apps/node_modules/@capiro`,{recursive:true});link(`${SRC}/apps/node_modules/@capiro/meri-contracts`,`${SRC}/packages/contracts`);

// 2. Seal.
mkdirSync(O);
const seal=spawnSync('python3',['-I','-B','-S','infra/product-preview/image-build-source.py','seal','--repository','.','--commit',X,'--archive',`${O}/product-source.zip`,'--output',`${O}/product-source-members.json`],{cwd:SRC,encoding:'utf8'});
if(seal.status!==0)fail('seal refused');const sealed=JSON.parse(seal.stdout);say(`sealed ${sealed.fileCount} files, archive ${sealed.archiveSha256}`);
const rows=Object.fromEntries(JSON.parse(readFileSync(`${O}/product-source-members.json`,'utf8')).files.map(r=>[r.path,r.sha256]));
const runnerSha256=sha(git('show',`${X}:apps/runtime/conversation-runner.mjs`));
if(rows['apps/runtime/conversation-runner.mjs']!==runnerSha256)fail('manifest runner row differs from the git blob');

// 3. Measurement packet (release E helpers), source pins patched to X; the verifier pin must still hold.
mkdirSync(`${O}/measurement-packet`);
for(const name of git('ls-tree','--name-only',`${HANDOFF}:${RD}/measurement-packet/`).toString().trim().split('\n'))
 writeFileSync(`${O}/measurement-packet/${name}`,git('show',`${HANDOFF}:${RD}/measurement-packet/${name}`));
for(const name of ['receipt-joins.mjs','measurement-build-wrapper.py']){const f=`${O}/measurement-packet/${name}`,t=readFileSync(f,'utf8');
 if(t.split(OLD_SOURCE).length!==2)fail(`${name} does not pin the old source exactly once`);writeFileSync(f,t.replace(OLD_SOURCE,X));}
const verifierPin=/VERIFIER_SHA256='([a-f0-9]{64})'/u.exec(readFileSync(`${O}/measurement-packet/measurement-payload.mjs`,'utf8'))[1];
if(verifierPin!==rows['infra/product-preview/image-build-source.py'])fail('image-build-source.py changed: the measurement packet verifier pin needs a reviewed update');

// 4. Public candidate inputs: the C measurement baseline (exact pinned blob) and release E for rollback.
const baseline=git('show','5a42ec962677e70e76db5433330b52fd34db5bcd:docs/shipping/20261019/a16cc40d-public-render/deployment-inputs.candidate.json');
if(sha(baseline)!=='0232304892929be91435889b33d86032f0febf178eb2d407a62079f8d092bb88')fail('C baseline blob');
writeFileSync(`${O}/baseline-C.deployment-inputs.json`,baseline);
const releaseE=git('show',`${HANDOFF}:${RD}/public-candidate/deployment-inputs.candidate.json`);writeFileSync(`${O}/release-E.deployment-inputs.json`,releaseE);
const {images:a,...restC}=JSON.parse(baseline),{images:b,...restE}=JSON.parse(releaseE);
if(JSON.stringify(restC)!==JSON.stringify(restE)||a.proxy!==b.proxy||a.temporalServer!==b.temporalServer)fail('release E differs from the C baseline beyond the node image');
const proxyScanSha256=JSON.parse(git('show',`${HANDOFF}:${RD}/public-candidate/image-scans.candidate.json`)).proxy;

// 5. Dry request (placeholder S3 versions) through the real verifier, recipe and size check.
const K={commit:X,outDir:O,sourceRoot:SRC,attempt:randomBytes(16).toString('hex'),measurementAttempt:randomBytes(16).toString('hex'),
 archiveSha256:sealed.archiveSha256,manifestSha256:sealed.sourceManifestSha256,runnerSha256,
 profile:PROFILE,region:REGION,account:'967807252336',bucket:'meri-greenfield-qual-build-967807252336-us-east-1',kmsKeyArn:'arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042',
 project:'meri-greenfield-qualification-build',projectArn:'arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build',
 projectRoleArn:'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H',
 ecrRepositoryName:'meri-greenfield/qualification-worker',ecrRepositoryUri:'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker',
 nodeImageUri:'public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63',nodeVersion:'v24.21.0',
 runtimeBaseImageUri:'cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4',
 proxyScanSha256,ceilingUsd,cluster:'capiro-dev',
 families:['meri-product-preview-control','meri-product-preview-temporal-worker','meri-product-preview-temporal-issuer','meri-product-preview-owner','meri-product-preview-proxy','meri-product-preview-runner'],
 services:{control:'meri-product-preview-control','temporal-worker':'meri-product-preview-temporal-worker','temporal-issuer':'meri-product-preview-temporal-issuer','model-owner':'meri-product-preview-owner','model-proxy':'meri-product-preview-proxy'},
 logGroups:{control:'/meri/product-preview/control','temporal-worker':'/meri/product-preview/worker','temporal-issuer':'/meri/product-preview/issuer','model-owner':'/meri/product-preview/owner','model-proxy':'/meri/product-preview/proxy'},
 stacks:{app:'meri-first-chat-app',model:'meri-first-chat-model',issuer:'meri-first-chat-issuer',foundation:'meri-first-chat-foundation',privateEdge:'meri-first-chat-private-edge'},
 materialSecretKeys:['control/material','worker/material','issuer/material','owner/material','proxy/material'],
 discoveryServiceIds:['srv-fqjjiu4dmuqsg5mo','srv-dv43rzktx7mvrh6m'],
 controlTargetGroups:['arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8082/1732509ee5fbf759','arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8080/03297203fa59801c'],
 coreMembershipUrl:'https://first-chat-preview.app-dev.capiro.ai/api/clio/application-authority/membership',frontendOrigin:'https://portfolio-preview.app.capiro.ai',
 publicHealthUrl:'https://meri-preview.capiro.ai/health/live',
 pkiDir:process.env.MERI_PKI_DIR??'C:/dev/fable/meri-preview-private-pki',prepDir:process.env.MERI_PREP_DIR??'C:/dev/fable/meri-stage3-prep-20261018',
 privateWorkDir:`C:/dev/fable/meri-stage3-${new Date().toISOString().replace(/[-:]/gu,'').replace(/\.\d+Z$/u,'Z')}`};
mkdirSync(`${O}/dry`);
const dry={schemaVersion:2,sourceCommit:X,archive:{bucket:K.bucket,key:`inputs/product-runtime/${X}/product-source.zip`,versionId:'dry-run-placeholder',sha256:K.archiveSha256},
 manifest:{bucket:K.bucket,key:`inputs/product-runtime/${X}/product-source-members.json`,versionId:'dry-run-placeholder',sha256:K.manifestSha256},
 dockerfileSha256:rows['apps/runtime/Dockerfile'],nodeImageUri:K.nodeImageUri,nodeVersion:K.nodeVersion,runtimeBaseImageUri:K.runtimeBaseImageUri,
 runtimePackagesSha256:rows['infra/product-preview/runtime-packages.lock.json'],runnerSha256,runtimeUser:'1000:1000',codeBuildProjectArn:K.projectArn,ecrRepositoryUri:K.ecrRepositoryUri,
 imageTag:`product-${X}-${K.attempt}`,verifierSha256:rows['infra/product-preview/image-build-source.py'],producerSha256:rows['infra/product-preview/image-build-producer.py']};
writeFileSync(`${O}/dry/request.dry.json`,JSON.stringify(dry,null,2)+'\n');
if(spawnSync('python3',['-I','-B','-S','infra/product-preview/image-build-source.py','verify','--request',`${O}/dry/request.dry.json`,'--archive',`${O}/product-source.zip`,'--manifest',`${O}/product-source-members.json`],{cwd:SRC}).status!==0)fail('dry verify refused');
const check=spawnSync(process.execPath,['docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs',`${O}/dry/request.dry.json`],{cwd:SRC,encoding:'utf8'});
if(check.status!==0)fail('dry buildspec check refused');writeFileSync(`${O}/dry/buildspec-check.json`,check.stdout);

// 6. Read-only readbacks and the next free label.
mkdirSync(`${O}/readback`);const rb=(n,v)=>writeFileSync(`${O}/readback/${n}`,JSON.stringify(v,null,2)+'\n');
const caller=aws(['sts','get-caller-identity']);if(caller.Account!==K.account)fail('AWS account');
rb('services.json',aws(['ecs','describe-services','--cluster',K.cluster,'--services',...Object.values(K.services)]).services.map(s=>({name:s.serviceName,desired:s.desiredCount,running:s.runningCount,pending:s.pendingCount,taskDefinition:s.taskDefinition,rollouts:s.deployments.map(d=>d.rolloutState)})));
writeFileSync(`${O}/readback/latest.tsv`,K.families.flatMap(f=>['ACTIVE','INACTIVE'].map(s=>`${f}\t${spawnSync('aws',['ecs','list-task-definitions','--family-prefix',f,'--status',s,'--sort','DESC','--max-items','1','--query','taskDefinitionArns[0]','--output','text','--profile',PROFILE,'--region',REGION],{encoding:'utf8'}).stdout.trim().split(String.fromCharCode(10))[0].trim()}`)).join('\n')+'\n');
rb('stacks.json',['app','model','issuer','foundation','privateEdge'].map(k=>{const s=aws(['cloudformation','describe-stacks','--stack-name',K.stacks[k]]).Stacks[0];return {stack:s.StackName,status:s.StackStatus,updated:s.LastUpdatedTime};}));
rb('foundation-outputs.live.json',aws(['cloudformation','describe-stacks','--stack-name',K.stacks.foundation,'--query','Stacks[0].Outputs']));
rb('private-edge-outputs.live.json',aws(['cloudformation','describe-stacks','--stack-name',K.stacks.privateEdge,'--query','Stacks[0].Outputs']));
rb('app.live.template.json',aws(['cloudformation','get-template','--stack-name',K.stacks.app,'--template-stage','Original','--query','TemplateBody']));
const deployment=JSON.parse(baseline),labels={};
for(const key of K.materialSecretKeys){const v=aws(['secretsmanager','list-secret-version-ids','--secret-id',deployment.secrets[key],'--include-deprecated','--max-results','100']).Versions;
 labels[key]={versions:v.length,labels:[...new Set(v.flatMap(x=>x.VersionStages??[]))].sort()};}
rb('secret-labels.json',labels);
const day=new Date().toISOString().slice(0,10).replaceAll('-',''),used=new Set(Object.values(labels).flatMap(l=>l.labels));
const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ',last=Math.max(-1,...[...used].map(l=>new RegExp(`^FIRST_CHAT_${day}([A-Z])$`,'u').exec(l)?.[1]).filter(Boolean).map(l=>letters.indexOf(l)));
if(last>=25)fail('no label letter left for today');K.label=`FIRST_CHAT_${day}${letters[last+1]}`;
const maxLabels=Math.max(...Object.values(labels).map(l=>l.labels.length));if(maxLabels>=20)fail('a material secret is at the 20-label quota');

// 7. kit.json, kit.mjs, numbered scripts, SHIP-STEPS.md.
writeFileSync(`${O}/kit.json`,JSON.stringify(K,null,2)+'\n');copyFileSync(`${HERE}/kit.mjs`,`${O}/kit.mjs`);
const STEPS=[
 ['01-source-put','MUTATING','S3: two create-only KMS objects (sealed source zip + manifest)','HEAD matches length, SHA256 and KMS for both'],
 ['02-build-request','local','request.json, verifier, recipe, size check, start request (no AWS write)','image-build-source.py verify exit 0; buildspec within 25 600 B'],
 ['03-image-build','MUTATING','CodeBuild: ONE product image build (30/5/0)','build id recorded; no other build active; tag new'],
 ['04-image-readback','read-only','wait for the build; authenticate receipt, ECR digest/tag, scan; write candidate deployment inputs','SUCCEEDED; scan COMPLETE with 0 HIGH / 0 CRITICAL; runnerSha256 joins'],
 ['05-measurement-prepare','local','prepare the launch-measurement payload','OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN'],
 ['06-measurement-payload-put','MUTATING','S3: one create-only KMS payload object','payload-pin.json written from authenticated HEAD'],
 ['07-measurement-finalize','local','finalize the measurement start request','OFFLINE_MEASUREMENT_REQUEST_FINALIZED'],
 ['08-measurement-build','MUTATING','CodeBuild: ONE measurement build (10/5/0), no model request','build id recorded'],
 ['09-measurement-readback','read-only','wait; download six results; verify joins; assemble runtime values','MEASUREMENT_VERIFIED_AND_ASSEMBLED'],
 ['10-stage3-input','read-only','latest revisions and predicted task definitions','stage3.json written'],
 ['11-private-core','PRIVATE','bearer read, Core membership POST, core.json (operator only)','membership HTTP 200; summary exit 0; core-values written'],
 ['12-private-render','PRIVATE','certificate check, revisions unchanged, render five roles (operator only)','MERI_FIRST_CHAT_MATERIAL_RENDERED; verify-rendered exit 0'],
 ['13-secret-upload','MUTATING','Secrets Manager: five new versions under a new label only','new versions carry only the label; all earlier labels unchanged'],
 ['14-bindings','read-only','live outputs and app template; bindings; pre-deploy ship packet','STAGE3_BINDINGS_WRITTEN; SHIP_PACKET_WRITTEN'],
 ['15-changesets','MUTATING','CloudFormation: create (not execute) model, issuer and app change sets','only TaskDefinition/Service changes'],
 ['16-execute-model','MUTATING','stop owner+proxy, execute model, start both; owner/proxy gate','1/1/0 on rendered revisions, 120 s, one Cloud Map instance each, PAIR_READY (75 s quiet)'],
 ['17-execute-issuer','MUTATING','execute issuer; issuer gate; then run 18 immediately','1/1/0, runtime.listening'],
 ['18-execute-app','MUTATING','execute app; control/worker gate','1/1/0, runtime.listening, both target groups healthy'],
 ['19-verify','read-only','verify-outputs and public health','STAGE3_TASK_DEFINITIONS_MATCH_RENDER; HTTP 200']];
for(const [step,kind,what,gate] of STEPS)writeFileSync(`${O}/${step}.sh`,`#!/usr/bin/env bash
# ${step} [${kind}] ${what}
# Commit ${X}, kit ${O}. Expected outcome / gate: ${gate}.
# Refuses (exit 2) on wrong preconditions or existing outputs; exit 3 = uncertain, read back before rerunning.
set -euo pipefail
cd '${O}'
exec node kit.mjs ${step}
`);
writeFileSync(`${O}/SHIP-STEPS.md`,`# Meri first-chat ship kit for ${X}

Made ${new Date().toISOString()} by make-ship-kit.mjs. Kit directory \`${O}\`, clean source worktree \`${SRC}\`.
Image build attempt \`${K.attempt}\`, measurement attempt \`${K.measurementAttempt}\`, secret label \`${K.label}\`,
private working directory \`${K.privateWorkDir}\` (created by step 11; never inside a repository).

Already done here (no AWS mutation): seal (archive \`${K.archiveSha256}\`, manifest \`${K.manifestSha256}\`, ${sealed.fileCount} files);
runnerSha256 \`${runnerSha256}\` (git blob); measurement packet copied from \`${HANDOFF}\` with its two source pins set to this commit
(verifier pin unchanged and still valid); C baseline and release E deployment inputs; dry request through the real verifier, recipe and
size check (\`dry/\`); read-only readbacks in \`readback/\` (services, latest revisions, stacks, outputs, live app template, secret label metadata).

Run each script from Git Bash in order. MUTATING and PRIVATE steps are the operator's. Every step prints its plan first,
refuses on wrong state, and writes its evidence into this directory (private outputs go only to the private working directory).

| # | Script | Kind | Does | Gate |
| --- | --- | --- | --- | --- |
${STEPS.map(([s,k,w,g],i)=>`| ${i+1} | \`${s}.sh\` | ${k} | ${w} | ${g} |`).join('\n')}

Notes
- Builds: an uncertain StartBuild is read back (\`aws codebuild list-builds-for-project\`), never resubmitted. A failed build stops the kit.
- 11 needs \`--client-id <uuid>\` only when the membership lists several clients: run \`node kit.mjs 11-private-core --client-id <uuid>\` from this directory.
- 12 must follow 11 within 15 minutes and refuses if any task-definition revision changed since 10.
- 13 refuses if \`${K.label}\` already exists on any material secret, or a secret is at 100 versions or 20 labels; retries reuse the plan's fixed tokens.
- 15 creates all three change sets first so 17 -> 18 runs back to back (the issuer refuses unpinned control/worker revisions until the app lands).
- A failed or rolled-back stack update burns the rendered revisions: stop, then re-render under a new label (rerun from 10 with a new kit only after review).
- Rollback = forward redeploy of release E (\`release-E.deployment-inputs.json\`) through the same steps with a new label; not UpdateService.
- Do not deploy the foundation stack in this cycle.
`);
say(JSON.stringify({status:'SHIP_KIT_READY',commit:X,kit:O,source:SRC,label:K.label,attempt:K.attempt,measurementAttempt:K.measurementAttempt,privateWorkDir:K.privateWorkDir}));

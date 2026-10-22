#!/usr/bin/env node
/** Writes the portfolio-preview frontend ship kit for one capiro-frontend commit, then runs its non-mutating steps (00-02).
 * Usage: node make-fe-ship-kit.mjs <commit> [--worktree <clean worktree at the commit>] [--label <change-set label>]
 *          [--tests tests/a.test.ts,…] [--browser-specs a.spec.ts,…]
 * The kit (C:/dev/fable/ship-fe-<sha8>) repeats the serving rev-18 release (CodeBuild 8b5264dc, change set meri-fe18-67fdf56b):
 * one CodeBuild job with a one-shot buildspec, the ECR scan gate, a change set on the live template that changes only
 * ImageUri, rollout with a health gate, and rollback to the live baseline revision. Reads AWS, never mutates it. */
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url)).replaceAll('\\','/');
const REPO='C:/dev/fable/capiro-frontend',PROFILE='capiro-dev',REGION='us-east-1';
const die=m=>{process.stderr.write(`make-fe-ship-kit: ${m}\n`);process.exit(2);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:fallback;};
const list=name=>(arg(name,'')??'').split(',').map(s=>s.trim()).filter(Boolean);
function sh(cmd,args,{allowFail=false}={}){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:256*1024*1024,env:{...process.env,AWS_PAGER:'',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}});
 if(r.status!==0){if(allowFail)return undefined;die(`${cmd} ${args.slice(0,3).join(' ')} exited ${r.status}: ${(r.stderr??'').trim().slice(0,300)}`);}return r.stdout;}
const git=(...args)=>sh('git',['-C',REPO,...args]).trim();
const aws=(...args)=>JSON.parse(sh('aws',[...args,'--profile',PROFILE,'--region',REGION,'--output','json']));

// ---------- the commit ----------
const commit=git('rev-parse','--verify',`${process.argv[2]??die('usage: make-fe-ship-kit.mjs <commit>')}^{commit}`);
const tree=git('rev-parse',`${commit}^{tree}`),subject=git('log','-1','--format=%s',commit),sha8=commit.slice(0,8);
const worktree=(arg('--worktree','C:/dev/fable/wt-fe-release')).replaceAll('\\','/');
if(sh('git',['-C',worktree,'rev-parse','HEAD']).trim()!==commit)die(`${worktree} is not at ${commit}`);
if(sh('git',['-C',worktree,'status','--porcelain=v1','--untracked-files=no']).trim())die(`${worktree} has local changes`);
const branch=sh('git',['-C',worktree,'rev-parse','--abbrev-ref','HEAD']).trim();

// ---------- the live baseline (read only) ----------
const STACK='Capiro-Portfolio-Preview-Service',CLUSTER='capiro-portfolio-preview',SERVICE='capiro-portfolio-preview',REPOSITORY='capiro/portfolio-preview';
const service=aws('ecs','describe-services','--cluster',CLUSTER,'--services',SERVICE).services[0];
if(!(service.deployments.length===1&&service.deployments[0].rolloutState==='COMPLETED'&&service.runningCount===1))die('the live service is mid-deployment: make the kit when it is steady');
const td=aws('ecs','describe-task-definition','--task-definition',service.taskDefinition).taskDefinition,imageUri=td.containerDefinitions[0].image;
const digest=imageUri.split('@')[1]??die(`the serving image ${imageUri} is not pinned by digest`);
const servingTag=(aws('ecr','describe-images','--repository-name',REPOSITORY,'--image-ids',`imageDigest=${digest}`).imageDetails[0].imageTags??[]).find(t=>/^[0-9a-f]{40}$/u.test(t))??die('the serving image has no commit tag');
const template=aws('cloudformation','get-template','--stack-name',STACK,'--template-stage','Original').TemplateBody;
const targetGroupArn=service.loadBalancers[0].targetGroupArn,container=td.containerDefinitions[0];
if(spawnSync('git',['-C',REPO,'merge-base','--is-ancestor',servingTag,commit]).status!==0)die(`${sha8} does not contain the serving ${servingTag.slice(0,8)}: shipping it would drop serving changes`);

// ---------- the build recipe ----------
// Unit suites of the serving rev-18 recipe, then every changed test and every test that imports a changed apps/web module.
const BASE_TESTS=['preview-read-receiving','first-chat-intent','first-chat-bootstrap','meri-first-chat-core','meri-first-chat-preview-policy','meri-first-chat-route',
 'meri-first-chat-host','meri-client-selector','meri-conversation-host','meri-conversation-route','meri-conversation-proxy','meri-history-proxy','meri-preview-route-activation',
 'meri-document-proxy','preview-backend-containment'].map(n=>`tests/${n}.test.ts`);
// Deleted paths can't be tested or imported at the commit, so the diff lists only paths that still exist there.
const changed=git('diff','--name-only','--diff-filter=d',servingTag,commit).split('\n').filter(Boolean);
const changedTests=changed.filter(f=>/^apps\/web\/tests\/[^/]+\.test\.tsx?$/u.test(f)).map(f=>f.slice('apps/web/'.length));
const modules=changed.filter(f=>/^apps\/web\/src\/.+\.tsx?$/u.test(f)&&!/\.test\.tsx?$/u.test(f)).map(f=>f.slice('apps/web/src/'.length).replace(/\.tsx?$/u,''));
const importing=modules.flatMap(m=>(sh('git',['-C',REPO,'grep','-l','-F',m,commit,'--','apps/web/tests/*.test.ts','apps/web/tests/*.test.tsx'],{allowFail:true})??'')
 .split('\n').filter(Boolean).map(l=>l.slice(commit.length+1+'apps/web/'.length)));
const vitest=[...new Set([...BASE_TESTS,...changedTests,...importing,...list('--tests')])];
const BROWSER_MODULES_GREP='unknown Meri input|a finished run accepts|Stop requests|a foreign native actor|an uncertain reserved-turn|navigation keeps the uncertain|selected conversation reload|synthetic lost reservation|synthetic desktop held admission|synthetic desktop interrupted initial|synthetic desktop hard reload';
const BROWSER_PORTFOLIO=['tests/browser/facility-action-lifetime.spec.ts','tests/browser/profile-current-state.spec.ts','tests/browser/work-boundary.spec.ts','tests/browser/work-documents.spec.ts'];
const browserModules=['meri-new-conversation.spec.ts',...list('--browser-specs')];
const dockerfile=Buffer.from(sh('git',['-C',REPO,'show',`${commit}:apps/web/Dockerfile`]));
const patchedDockerfile=dockerfile.toString('utf8').replace(/\n$/u,'').split('\n').flatMap(l=>l==='RUN npm run build'?['ARG CAPIRO_BUILD_NODE_OPTIONS','ARG CAPIRO_BUILD_CIRCLE_NODE_TOTAL','RUN NODE_OPTIONS="$CAPIRO_BUILD_NODE_OPTIONS" CIRCLE_NODE_TOTAL="$CAPIRO_BUILD_CIRCLE_NODE_TOTAL" npm run build']:[l]).join('\n')+'\n';
if(dockerfile.toString('utf8').split('\n').filter(l=>l==='RUN npm run build').length!==1)die('apps/web/Dockerfile must contain exactly one "RUN npm run build" line for the build-heap patch');
const ecrUri=`${td.taskDefinitionArn.split(':')[4]}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY}`;
const extraModules=browserModules.slice(1);
const buildspec=`# One-shot inline buildspecOverride for capiro-frontend ${commit}
# (${subject.replaceAll('#','')}), = serving ${servingTag.slice(0,8)} + ${git('rev-list','--count',`${servingTag}..${commit}`)} commit(s).
# Written by C:/dev/fable/ship-fe-kit/make-fe-ship-kit.mjs. Repeats the serving rev-18 recipe (CodeBuild 8b5264dc for 67fdf56b) with the
# later e6180219 run's (78d8240f) source checks before npm ci, ABORT on failure and one worker per suite, plus the suites this change
# touches. The ECR scan is gated by the operator after the build (the build role lacks ecr:DescribeImageScanFindings).
version: 0.2
env:
  shell: bash
phases:
  install:
    on-failure: ABORT
    runtime-versions:
      nodejs: 24
    commands:
      - set -euo pipefail
      - test "$EXPECTED_SHA" = "${commit}"
      - printf '%s\\n' "$EXPECTED_SHA" | cmp -s - source-commit.txt
      - test -n "\${EXPECTED_S3_VERSION:-}"
      - test "$CODEBUILD_SOURCE_VERSION" = "$EXPECTED_S3_VERSION"
      - node --version
      - node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) process.exit(1)'
      - npm --version
      - npm ci --ignore-scripts --no-audit --no-fund
      - npm exec --workspace @capiro/web -- playwright install --with-deps chromium
  build:
    on-failure: ABORT
    commands:
      - set -euo pipefail
      - node --test scripts/preview-config.test.mjs
      - npm exec --workspace @capiro/web -- vitest run ${vitest.join(' ')} --maxWorkers=1 --no-file-parallelism
      - NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck --workspace @capiro/web
      - npm run lint --workspace @capiro/web
      - npm run architecture
      - node apps/web/deployment/portfolio/qualify-elements.mjs "$(mktemp -d)/elements"
      - npm exec --workspace @capiro/web -- playwright test meri-new-conversation.spec.ts --config test/browser/playwright.config.ts --workers=1
      - npm run test:browser:modules --workspace @capiro/web -- --grep '${BROWSER_MODULES_GREP}' --workers=1
${extraModules.length?`      - npm exec --workspace @capiro/web -- playwright test ${extraModules.join(' ')} --config test/browser/playwright.config.ts --workers=1\n`:''}      - npm run test:browser -- --workers=1 ${BROWSER_PORTFOLIO.join(' ')}
      - NODE_OPTIONS= node -p 'JSON.stringify({node:process.version,heapLimitMiB:Math.round(require("node:v8").getHeapStatistics().heap_size_limit/1048576),constrainedMemory:process.constrainedMemory()})'
      - CIRCLE_NODE_TOTAL=2 NODE_OPTIONS=--max-old-space-size=4096 npm run build
      - npm run test:production
      - test "$REPOSITORY_URI" = "${ecrUri}"
      - test "$AWS_DEFAULT_REGION" = "${REGION}"
      - test "$(sha256sum apps/web/Dockerfile | cut -d' ' -f1)" = "${sha(dockerfile)}"
      - test "$(grep -c '^RUN npm run build$' apps/web/Dockerfile)" -eq 1
      - awk '/^RUN npm run build$/ { print "ARG CAPIRO_BUILD_NODE_OPTIONS"; print "ARG CAPIRO_BUILD_CIRCLE_NODE_TOTAL"; print "RUN NODE_OPTIONS=\\"$CAPIRO_BUILD_NODE_OPTIONS\\" CIRCLE_NODE_TOTAL=\\"$CAPIRO_BUILD_CIRCLE_NODE_TOTAL\\" npm run build"; next } { print }' apps/web/Dockerfile > /tmp/Dockerfile.nodeheap
      - test "$(sha256sum /tmp/Dockerfile.nodeheap | cut -d' ' -f1)" = "${sha(patchedDockerfile)}"
      - test "$(grep -c '^ARG CAPIRO_BUILD_NODE_OPTIONS$' /tmp/Dockerfile.nodeheap)" -eq 1
      - test "$(grep -c '^ARG CAPIRO_BUILD_CIRCLE_NODE_TOTAL$' /tmp/Dockerfile.nodeheap)" -eq 1
      - test "$(grep -c '^RUN NODE_OPTIONS=' /tmp/Dockerfile.nodeheap)" -eq 1
      - docker build --pull --platform linux/amd64 --build-arg CAPIRO_BUILD_NODE_OPTIONS=--max-old-space-size=4096 --build-arg CAPIRO_BUILD_CIRCLE_NODE_TOTAL=2 -f /tmp/Dockerfile.nodeheap -t "$REPOSITORY_URI:$EXPECTED_SHA" .
      - bash apps/web/deployment/portfolio/smoke.sh "$REPOSITORY_URI:$EXPECTED_SHA"
      - aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | docker login --username AWS --password-stdin "\${REPOSITORY_URI%%/*}"
      - docker push "$REPOSITORY_URI:$EXPECTED_SHA"
      - aws ecr describe-images --repository-name ${REPOSITORY} --image-ids "imageTag=$EXPECTED_SHA" --query 'imageDetails[0].{imageDigest:imageDigest,imageTags:imageTags,imageScanStatus:imageScanStatus}' --output json --no-cli-pager
`;

// ---------- the kit ----------
const OUT=`C:/dev/fable/ship-fe-${sha8}`;if(existsSync(OUT))die(`${OUT} exists: remove it to make a fresh kit`);
mkdirSync(OUT,{recursive:true});
const baseRev=Number(td.taskDefinitionArn.split(':').pop()),label=arg('--label','release');
// The py-launcher CPython, not whichever python.exe is first on PATH (a tool venv on this machine).
const PYTHON='C:/Users/neoma/AppData/Local/Python/pythoncore-3.14-64/python.exe';
const kit={schema:'capiro.fe-ship-kit.v1',madeAt:new Date().toISOString(),commit,tree,subject,branch,servingCommit:servingTag,repo:REPO,worktree,python:existsSync(PYTHON)?PYTHON:'python',
 account:td.taskDefinitionArn.split(':')[4],profile:PROFILE,region:REGION,
 bucket:`capiro-portfolio-preview-source-${td.taskDefinitionArn.split(':')[4]}-${REGION}`,sourceKey:'inputs/portfolio-source.zip',
 project:'capiro-portfolio-preview-build',build:{timeoutMinutes:60,queuedTimeoutMinutes:10,attempt:'a1'},
 ecrRepositoryName:REPOSITORY,ecrRepositoryUri:ecrUri,stack:STACK,cluster:CLUSTER,service:SERVICE,family:td.family,containerName:container.name,
 targetGroupArn,publicHealthUrl:'https://portfolio-preview.app.capiro.ai/healthz',appLogGroup:container.logConfiguration.options['awslogs-group'],
 appLogStreamPrefix:container.logConfiguration.options['awslogs-stream-prefix'],
 templateSha256:sha(template),reviewedTemplate:'C:/dev/fable/frontend-meri-wire/REVIEWED_PREVIEW_TEMPLATE.yml',
 baseline:{taskDefinitionArn:td.taskDefinitionArn,imageUri,imageTag:servingTag},
 changeSetName:`fable-fe-${label}-${sha8}`,rollbackChangeSetName:`fable-fe-rollback-r${baseRev}-${sha8}`,
 buildspecSha256:sha(buildspec),dockerfile:{sha256:sha(dockerfile),patchedSha256:sha(patchedDockerfile)},
 wsl:{distro:'Ubuntu-24.04',nodeBin:'/opt/adj-b-transport/node/bin',workDir:`/opt/fe-ship-${sha8}`},
 tests:{vitest,browserModules,browserModulesGrep:BROWSER_MODULES_GREP,browserPortfolio:BROWSER_PORTFOLIO},
 files:{required:['scripts/preview-config.test.mjs','scripts/verify-preview-archive.py','apps/web/deployment/portfolio/qualify-elements.mjs','apps/web/deployment/portfolio/smoke.sh',
  'apps/web/test/browser/playwright.config.ts','apps/web/playwright.config.ts','apps/web/Dockerfile'],
  // As the buildspec calls them: root scripts directly, the rest with --workspace @capiro/web (root test:browser delegates there).
  npmScripts:{'package.json':['architecture','build','test:production','test:browser'],'apps/web/package.json':['typecheck','lint','test:browser','test:browser:modules']}}};
writeFileSync(`${OUT}/kit.json`,JSON.stringify(kit,null,2)+'\n');writeFileSync(`${OUT}/buildspec.yml`,buildspec);copyFileSync(`${HERE}/fe-kit.mjs`,`${OUT}/kit.mjs`);
const STEPS=[
 ['00-preflight','read only','me now; operator again right before 03','Live stack, template, parameters, service 1/1/0 on the baseline, one healthy target, rollback image + scan, no change set, no active build, tag absent'],
 ['01-source-archive','local','me now','`git archive` ZIP + the commit\'s `scripts/verify-preview-archive.py` (every member equals its Git blob, `source-commit.txt` appended)'],
 ['02-dry','local + read only','me now','Buildspec pins vs the commit (tests, scripts, Dockerfile and patch digests), parameter diff ImageUri-only, template unchanged, expected task definition, `validate-template`'],
 ['02b-rehearse','local (WSL2 + Docker, ~25 min)','optional; me before handing over','The buildspec itself, every install/build command in order on the extracted archive, ECR login/push/describe skipped: catches a failing suite, a stale pin or an unresolvable `apk` pin before a CodeBuild job is spent'],
 ['03-source-put','**MUTATING** (S3 new version)','operator','Full-object SHA-256 + SSE-S3 confirmed by an exact-version HEAD; writes the start-build request pinned to that version'],
 ['04-image-build','**MUTATING** (one CodeBuild job)','operator','No active build; ECR tag absent (tags are immutable); 60 min, queue 10, no retry'],
 ['05-image-readback','read only (waits)','operator','SUCCEEDED; "Container smoke passed" in the log; ECR digest; **scan COMPLETE with 0 findings**; writes the candidate parameters'],
 ['06-changeset','**MUTATING** (create only)','operator','Live state still the baseline; exactly Modify PreviewTaskDefinition (ImageUri only) + Modify PreviewService (TaskDefinition only)'],
 ['07-rollout','**MUTATING** (execute)','operator','UPDATE_COMPLETE; service 1/1/0 on the new revision with the candidate image; its task >= 120 s and the only healthy target; "Ready in" logged; public /healthz 200 (if reachable)'],
 ['08-verify','read only','operator','New revision = baseline revision except the image; parameters = candidate file; outputs unchanged'],
 [`R1-rollback-to-${baseRev}`,'**MUTATING** (only when needed)','operator',`In progress: cancel-update-stack. Rolled back already: verify. Completed: a change set with the recorded rev-${baseRev} parameters (registers rev-${baseRev} content again; ${td.family}:${baseRev} itself is deregistered by CloudFormation once the release completes)`]];
// kit.mjs runs a mutating step only with --execute, which only these wrappers pass.
for(const [step,kind] of STEPS)writeFileSync(`${OUT}/${step}.sh`,`#!/usr/bin/env bash\n# ${step}: ${kind.replaceAll('*','')}\ncd '${OUT}' && exec node kit.mjs ${step}${kind.includes('MUTATING')?' --execute':''}\n`);
writeFileSync(`${OUT}/SHIP-STEPS.md`,[`# Frontend ship kit for ${sha8}`,'',
 `- **Commit:** capiro-frontend \`${commit}\` (${subject}), branch \`${branch}\`, tree \`${tree}\`.`,
 `- **Baseline:** serving \`${servingTag}\` on \`${td.family}:${baseRev}\`, image \`${imageUri}\`.`,
 `- **Stack:** \`${STACK}\`. The change set is \`${kit.changeSetName}\` and the rollback change set is \`${kit.rollbackChangeSetName}\`.`,'',
 'Each step is one command: `bash <step>.sh`, which runs `node kit.mjs <step>`. It prints a PLAN line, then refuses with exit 2 on any wrong state or existing output.',
 'A mutating step runs only through its `.sh`, which adds `--execute`; `node kit.mjs <mutating step>` alone does nothing and exits 2.',
 'Exit 3 means the outcome is uncertain: read back before rerunning. Outputs go to `out/`, the baseline to `readback/`, and the dry run to `dry/`.','',
 '| Step | Kind | Who | Gate |','| --- | --- | --- | --- |',...STEPS.map(([s,k,w,g])=>`| \`${s}\` | ${k} | ${w} | ${g} |`),'',
 `Unit suites in the buildspec (${vitest.length}): ${vitest.map(t=>`\`${t.replace('tests/','').replace('.test.ts','')}\``).join(', ')}.`,
 `Browser: \`${browserModules.join('`, `')}\` (modules config), the rev-18 grep of 11 cases, and ${BROWSER_PORTFOLIO.length} portfolio specs.`,''].join('\n'));
process.stdout.write(`kit ${OUT}: buildspec ${Buffer.byteLength(buildspec)} B, ${vitest.length} unit suites (${[...changedTests,...importing].length} from the diff), baseline ${td.family}:${baseRev} ${servingTag.slice(0,8)}\n`);
for(const step of ['00-preflight','01-source-archive','02-dry']){
 const r=spawnSync(process.execPath,[`${OUT}/kit.mjs`,step],{stdio:'inherit'});if(r.status!==0)die(`${step} exited ${r.status}`);
}

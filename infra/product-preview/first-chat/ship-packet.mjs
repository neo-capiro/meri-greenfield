#!/usr/bin/env node
/** Meri first-chat release: the reviewable ship packet for one new Node runtime image on the live preview stacks. It joins the
 * reviewed NON-SECRET inputs of docs/shipping/20261017/STAGE3-DEPLOY-RUNBOOK.md (deployment inputs, measured runtime values, the
 * standard image-build result, scan pins, stage3.json, the upload plan, the previous release) into one ordered packet: pins, evidence,
 * migration delta, cost limits, the exact commands with their gates, smoke checks, rollback, cleanup and known risks.
 *
 * It runs no AWS command, reads no secret and no material bundle, and writes only a new directory outside the repository:
 * ship-packet.json (canonical, hash-pinned) and SHIP-PACKET.md (the same packet for review). Run it once after render and
 * upload-plan (phase pre-upload) and again with --bindings after `stage3-deploy bindings` (phase pre-deploy) to pin the templates.
 * Exit 0 written; 2 refused (one SHIP_PACKET_* line on stderr). Importing this module performs no IO. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {deploymentRoles,SOURCE_ROOT,parseDeploymentInputs,parseRuntimeValues} from './render-material.mjs';
import {ALL_STAGE3_FAMILIES,STAGE3_STACKS,STAGE3_DEPLOY_ORDER,MATERIAL_SECRET_KEYS} from './stage3-bindings.mjs';

export const SCHEMA='meri.first-chat-ship-packet/3';
const STAGE3='infra/product-preview/first-chat/stage3-deploy.mjs';
const MIGRATE='infra/product-preview/first-chat-migrate.mjs';
const commit=/^[a-f0-9]{40}$/u;
const hex64=/^[a-f0-9]{64}$/u;
export const refuse=detail=>{throw Object.assign(Error(`SHIP_PACKET_REFUSED: ${detail}`),{code:'SHIP_PACKET_REFUSED'});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digestOf=uri=>/@sha256:([a-f0-9]{64})$/u.exec(String(uri))?.[1]??refuse(`image ${String(uri).slice(0,120)} is not pinned by digest`);
const cluster=deployment=>/cluster\/([A-Za-z0-9_-]+)$/u.exec(deployment.clusterArn)?.[1]??refuse('deployment.clusterArn');

// Record the complete configuration delta for review. This offline packet is not
// deployment authorization; actual infrastructure changes still require review.
function configurationChange(deployment,previousDeployment){
 if(!previousDeployment||typeof previousDeployment!=='object'||Array.isArray(previousDeployment)||
  previousDeployment.schemaVersion!==1||!previousDeployment.images||!commit.test(previousDeployment.images.nodeRuntimeSourceCommit??''))
  refuse('previous deployment inputs must identify the prior release');
 digestOf(previousDeployment.images.nodeRuntime);
 const {images:now,...current}=deployment,{images:before,...previous}=previousDeployment??{};
 const removed=[],added=[],changed=[],object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const walk=(a,b,path='')=>{
  for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
   const next=path?`${path}.${key}`:key;
   if(!Object.hasOwn(a,key))removed.push(next);
   else if(!Object.hasOwn(b,key))added.push(next);
   else if(object(a[key])&&object(b[key]))walk(a[key],b[key],next);
   else if(canonicalSha256(a[key])!==canonicalSha256(b[key]))changed.push(next);
  }
 };
 walk(current,previous);
 const differs=removed.length+added.length+changed.length>0;
 if(!differs&&canonicalSha256(now)===canonicalSha256(before))refuse('the inputs equal the previous release: nothing to ship');
 return {kind:differs?'configuration-and-images':'image-only',previousSha256:canonicalSha256(previous),currentSha256:canonicalSha256(current),removed,added,changed};
}

/** The CLI records its own clean operator checkout, independently of the image source. */
export function readOperatorSource(sourceRoot=SOURCE_ROOT){
 try{
  const git=args=>execFileSync('git',['-C',sourceRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const [head,tree]=git(['rev-parse','HEAD','HEAD^{tree}']).split(/\r?\n/u);
  if(!commit.test(head??'')||!commit.test(tree??'')||git(['status','--porcelain','--untracked-files=all']))refuse('operator checkout must be clean');
  return {commit:head,tree};
 }catch(error){if(error?.code==='SHIP_PACKET_REFUSED')throw error;refuse('a clean operator Git checkout is required');}
}

/** Every planned entry of a first-chat-migrate.mjs source text (the PLAN array is declared data): kind, source, sha256, stage. */
export function planEntries(text){
 const block=/export const PLAN=Object\.freeze\(\[([\s\S]*?)\n\]\.map\(/u.exec(text)?.[1];
 if(!block)refuse('first-chat-migrate.mjs has no PLAN');
 return [...block.matchAll(/\[\s*'([a-z_:]+)'\s*,\s*([^\n]*?),\s*'([a-f0-9]{64})'(?:\s*,\s*'([a-z]+)')?\s*\]/gu)].map(([,kind,source,digest,stage])=>
  ({kind,source:source.trim(),sha256:digest,stage:stage??(kind==='phase:temporal_grants'?'temporal':'meri')}));
}
/** All stages share one ordinal-exact ledger. Earlier entries may not be removed, edited, moved or reassigned to a stage.
 * This is a source delta, not proof of database state: the actual ledger still determines every pending stage. */
export function migrationDelta(previous,current){
 const identity=e=>[e.kind,e.source,e.sha256,e.stage];
 if(current.length<previous.length)refuse('migration plan drops ledgered entries');
 if(previous.some((e,i)=>canonicalSha256(identity(e))!==canonicalSha256(identity(current[i]))))refuse('migration plan edits or reorders ledgered entries');
 const added=current.slice(previous.length),stages=added.map(e=>e.stage).filter((stage,i,a)=>i===0||stage!==a[i-1]);
 return {previousEntries:previous.length,currentEntries:current.length,added,required:added.length>0,stages,
  integrationChanged:added.some(e=>e.stage==='integration')};
}

/** Cross-checks the reviewed inputs; any disagreement refuses before a packet exists. */
export function checkInputs({deployment,previousDeployment,runtime,receipt,receiptSha256,imageScans,stage3,upload}){
 const images=deployment?.images;
 if(deployment?.schemaVersion!==1||!images)refuse('deployment inputs');
 try{parseDeploymentInputs(deployment);parseRuntimeValues(runtime);}catch{refuse('current deployment or runtime inputs do not match the renderer');}
 const ac=deployment.agentcore;
 if(!ac||Object.keys(ac).sort().join(',')!=='qualifier,runtimeArn,runtimeVersion'||
  !/^arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime\/[A-Za-z][A-Za-z0-9_]*-[A-Za-z0-9]{10}$/u.test(ac.runtimeArn??'')||
  !/^[1-9][0-9]{0,4}$/u.test(ac.runtimeVersion??'')||ac.qualifier!=='preview')refuse('deployment.agentcore selection');
 // Root authenticates S3/CodeBuild provenance and fresh digest-bound scans before release.
 // This offline packet binds the reviewed result bytes; local JSON is not an AWS attestation.
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||typeof receipt.sourceCommit!=='string'||!commit.test(receipt.sourceCommit)||
  typeof receipt.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(receipt.imageDigest))refuse('image build result source/digest');
 if(typeof receipt.sourceVersion!=='string'||receipt.sourceVersion.length>1024||receipt.sourceVersion==='null'||
  !/^[A-Za-z0-9._~+/=-]+$/u.test(receipt.sourceVersion))refuse('image build result sourceVersion');
 if(receipt.platform!=='linux/arm64')refuse('image build result platform');
 if(`sha256:${digestOf(images.nodeRuntime)}`!==receipt.imageDigest||images.nodeRuntimeSourceCommit!==receipt.sourceCommit)refuse('deployment images.nodeRuntime is not the image the build result describes');
 if(receipt.scanStatus!=='COMPLETE')refuse('image scan is not COMPLETE');
 const counts=receipt.findingSeverityCounts;
 if(!counts||typeof counts!=='object'||Array.isArray(counts)||!Object.values(counts).every(n=>Number.isSafeInteger(n)&&n>=0))refuse('image scan findingSeverityCounts');
 for(const severity of ['CRITICAL','HIGH'])if((counts[severity]??0)!==0)refuse(`image scan has ${severity} findings`);
 if(typeof receiptSha256!=='string'||!hex64.test(receiptSha256)||imageScans?.nodeRuntime!==receiptSha256)refuse('image-scans.nodeRuntime must be the sha256 of the image build result file');
 if(stage3?.schemaVersion!==1)refuse('stage3.json');
 const roles=deploymentRoles(deployment);
 if(JSON.stringify(Object.keys(stage3.taskDefinitions??{}).sort())!==JSON.stringify([...roles].sort()))refuse('stage3 task definition roles');
 for(const role of roles)if(!new RegExp(`task-definition/${ALL_STAGE3_FAMILIES[role]}:[1-9][0-9]*$`,'u').test(stage3.taskDefinitions?.[role]??''))refuse(`stage3 task definition for ${role}`);
 if(JSON.stringify(upload?.roles?.map(r=>r.role))!==JSON.stringify(roles))refuse('upload plan roles');
 for(const r of upload.roles)if(r.secretArn!==deployment.secrets[MATERIAL_SECRET_KEYS[r.role]])refuse(`upload plan secret for ${r.role}`);
 for(const r of upload.roles)if(!Array.isArray(r.labelsBefore)||r.labelsBefore.includes(upload.label))refuse(`upload plan for ${r.role} lacks a before-upload label readback without ${upload.label}`);
 return configurationChange(deployment,previousDeployment);
}

const command=(argv,{stdout,note}={})=>({argv,...(stdout?{stdout}:{}),...(note?{note}:{})});
const logs=(group,pattern)=>command(['aws','logs','filter-log-events','--region','us-east-1','--log-group-name',group,'--start-time','<deploy start ms>','--filter-pattern',pattern,'--query','events[].message','--output','text'],{note:'set MSYS_NO_PATHCONV=1 in Git Bash'});

/** The ordered release steps for the inputs above. `work` is the operator's private working directory (a path, never content). */
export function releaseSteps({deployment,stage3,upload,migrations,work,bindingsPlan}){
 const roles=deploymentRoles(deployment),schedule=roles.includes('schedule-worker'),c=cluster(deployment),f=deployment.foundation,fam=roles.map(role=>ALL_STAGE3_FAMILIES[role]),W=name=>join(work,name),S=ALL_STAGE3_FAMILIES;
 const wait=(...roles)=>command(['aws','ecs','wait','services-stable','--region','us-east-1','--cluster',c,'--services',...roles.map(r=>S[r])]);
 const steps=[{id:'readback',title:'Revisions unchanged since stage3.json (any registration in between forces a new render)',
  commands:fam.flatMap(family=>['ACTIVE','INACTIVE'].map(status=>command(['aws','ecs','list-task-definitions','--region','us-east-1','--family-prefix',family,'--status',status,'--sort','DESC','--max-items','1','--query','taskDefinitionArns[0]','--output','text']))),
  gate:'the highest ACTIVE/INACTIVE revision of every family is one below stage3.json taskDefinitions'}];
 const ac=deployment.agentcore,id=ac.runtimeArn.split('/').at(-1);
 steps.push({id:'agentcore',title:'Verify the qualified AgentCore version and preview endpoint before control cutover',
  commands:[command(['aws','bedrock-agentcore-control','get-agent-runtime','--region','us-east-1','--agent-runtime-id',id,'--agent-runtime-version',ac.runtimeVersion],{stdout:W('agentcore-runtime.json')}),
   command(['aws','bedrock-agentcore-control','get-agent-runtime-endpoint','--region','us-east-1','--agent-runtime-id',id,'--endpoint-name',ac.qualifier],{stdout:W('agentcore-endpoint.json')})],
  gate:`both readbacks READY for ${ac.runtimeArn}; runtime version and endpoint liveVersion/targetVersion equal ${ac.runtimeVersion}; exact reviewed image digest, V1 platform, MMDSv2, IAM, network and lifecycle settings; native SDK/private-control invocation and restoration gates passed`});
 steps.push({id:'migrate',title:'Verify the full migration ledger and apply any pending stages before uploads or stack updates',
  commands:[command(['node',MIGRATE,'plan'],{note:'offline: confirms all planned files and hashes; the source delta does not establish applied database state'}),
   ...migrations.stages.map(stage=>command(['node',MIGRATE,stage],{note:'run through the existing d2-migrate owner only after snapshot, isolated rehearsal and actual ledger verification; if earlier stages are pending, complete those first in plan order'}))],
  gate:`inspect the one persistent preview clone ledger; before any forward SQL, verify a fresh snapshot and isolated rehearsal of its pending prefix and grants. The existing d2-migrate owner must report all ${migrations.currentEntries} entries applied with exact ordinals, names and hashes, including integration. Never infer completion from an unchanged source plan or re-clone the database`});
 steps.push({id:'upload',title:`Stage the ${roles.length} rendered bundles under ${upload.label} (AWSCURRENT does not move)`,
  commands:upload.roles.flatMap(r=>[command(r.command,{note:`append "${r.role}<TAB>VersionId" to ${W('secret-versions.tsv')}; on an uncertain outcome resend this exact command`}),command(r.readback)]),
  gate:`${roles.length} new versions carry only ${upload.label}; each secret's other labels equal its labelsBefore in the upload plan (AWSCURRENT unmoved)`});
 steps.push({id:'bindings',title:'Live readbacks, then bindings and the update templates',
  commands:[command(['aws','cloudformation','get-template','--region','us-east-1','--stack-name',STAGE3_STACKS.app,'--template-stage','Original','--query','TemplateBody','--output','json'],{stdout:W('app.live.template.json')}),
   command(['aws','cloudformation','describe-stacks','--region','us-east-1','--stack-name','<foundation stack>','--query','Stacks[0].Outputs'],{stdout:W('foundation-live.json')}),
   command(['aws','cloudformation','describe-stacks','--region','us-east-1','--stack-name','<private-edge stack>','--query','Stacks[0].Outputs'],{stdout:W('private-edge-outputs.json')}),
   command(['node',STAGE3,'bindings','--deployment-inputs','<deployment-inputs.json>','--foundation-outputs',W('foundation-live.json'),'--private-edge-outputs',W('private-edge-outputs.json'),
    '--rendered',W('rendered'),'--secret-versions',W('secret-versions.tsv'),'--image-scans','<image-scans.json>','--live-app-template',W('app.live.template.json'),'--out',W('bindings')])],
  gate:'STAGE3_BINDINGS_WRITTEN; rerun this packet with --bindings to pin the template hashes'});
 const gates={app:{wait:wait(...roles),checks:[logs(f.ControlLogGroupName,'"runtime.listening"'),logs(f.WorkerLogGroupName,'"runtime.listening"'),...(schedule?[logs(f.ScheduleLogGroupName,'"runtime.listening"')]:[]),
   command(['aws','elbv2','describe-target-health','--region','us-east-1','--target-group-arn',deployment.privateEdge.controlPrivateTargetGroupArn]),
   command(['aws','elbv2','describe-target-health','--region','us-east-1','--target-group-arn',f.ControlTargetGroupArn])],
   gate:`exactly one control task, worker 1/1/0${schedule?', schedule-worker 1/1/0':''}, all runtime.listening, both target groups healthy; no RUNTIME_UNAVAILABLE, RUNTIME_CONFIGURATION, STATIC_INIT_* or *_REFUSED; tasks alive after 200 s${schedule?'; verify an actual authorized scheduled occurrence and revocation/retirement through the canonical owners before accepting routines':''}`}};
 for(const key of STAGE3_DEPLOY_ORDER){
  const planned=bindingsPlan?.stacks?.[key],stack=STAGE3_STACKS[key];
  steps.push({id:`deploy-${key}`,title:`${stack}: change set, review, execute, wait`,
   commands:[command(planned?.command??['node',STAGE3,'(deploy-plan.json not yet written)']),
    command(['aws','cloudformation','describe-change-set','--region','us-east-1','--change-set-name','<change set ARN printed above>']),
    command(['aws','cloudformation','execute-change-set','--region','us-east-1','--change-set-name','<change set ARN printed above>']),
    command(planned?.wait??['aws','cloudformation','wait','stack-update-complete','--region','us-east-1','--stack-name',stack]),gates[key].wait,...gates[key].checks],
   gate:gates[key].gate});
 }
 steps.push({id:'verify',title:'Every deployed task definition is the rendered revision',
  commands:[...STAGE3_DEPLOY_ORDER.map(key=>command(['aws','cloudformation','describe-stacks','--region','us-east-1','--stack-name',STAGE3_STACKS[key],'--query','Stacks[0].Outputs'],{stdout:W(`${key}.outputs.json`)})),
   command(['node',STAGE3,'verify-outputs','--bindings',W('bindings'),'--app',W('app.outputs.json')])],
  gate:`STAGE3_TASK_DEFINITIONS_MATCH_RENDER for all ${roles.length} task definitions; a mismatch means re-render, never patch`});
 return steps;
}

/** The packet object. Pure: callers supply file bytes, git readings and the clock-free inputs. */
export function buildShipPacket(i){
 const configuration=checkInputs(i);
 const {deployment,previousDeployment,runtime,receipt,stage3,upload,bindings,migrations,ceilingUsd,work,hashes}=i;
 if(!i.operatorSource||!commit.test(i.operatorSource.commit??'')||!commit.test(i.operatorSource.tree??''))refuse('operator source commit/tree');
 if(!Number.isFinite(ceilingUsd)||ceilingUsd<=0)refuse('--ceiling-usd must be the positive authorized allocation for this cycle');
 if(!isAbsolute(work))refuse('--work must be an absolute path');
 if(bindings){
  if(JSON.stringify(bindings.plan.order)!==JSON.stringify(STAGE3_DEPLOY_ORDER))refuse('deploy plan order');
  for(const [role,arn] of Object.entries(stage3.taskDefinitions))if(bindings.plan.expectedTaskDefinitions?.[role]!==arn)refuse(`bindings were rendered for another ${role} revision`);
 }
 const packet={schema:SCHEMA,phase:bindings?'pre-deploy':'pre-upload',
  pins:{sourceCommit:deployment.images.nodeRuntimeSourceCommit,previousSourceCommit:previousDeployment.images.nodeRuntimeSourceCommit,
   operatorSource:{commit:i.operatorSource.commit,tree:i.operatorSource.tree},images:structuredClone(deployment.images),
   agentcore:structuredClone(deployment.agentcore),versions:structuredClone(runtime.versions),
   label:upload.label,taskDefinitions:structuredClone(stage3.taskDefinitions),inputs:structuredClone(hashes),
   ...(bindings?{templates:bindings.templates}:{})},
  evidence:{sourceCommit:receipt.sourceCommit,sourceVersion:receipt.sourceVersion,imageDigest:receipt.imageDigest,platform:receipt.platform,
   scanStatus:receipt.scanStatus,findingSeverityCounts:structuredClone(receipt.findingSeverityCounts),
   required:['exact-source ARM64 image build, native SDK/Temporal/SWC imports and artifact execution under the service identity',
    'digest-bound image scans with zero HIGH/CRITICAL and reviewed dispositions for other findings',
    'independent exact-head review, native PostgreSQL migration/run accounting and Linux material gates']},
  configuration,
  prerequisites:[
   'root authenticates the frozen previous inputs against actual release evidence; if the original archive is unavailable, label them reconstructed previous state and retain reviewed live readbacks, hashes and field lineage separately; never rewrite historical inputs to pass this comparison',
   'review every recorded configuration change against the actual live templates; qualify the pinned AgentCore runtime and preview endpoint before control cutover; retain the exact previous topology only for the bounded rollback window',
   'Temporal is a separate prerequisite: qualify its native ARM image and source-based binding, preserve pinned native mTLS CAs and the default authorizer with the verified certificate role mapper, and review its actual live service counts; the stopped DesiredCount0 template is not a live update',
   deploymentRoles(deployment).includes('schedule-worker')?
    'schedule-worker activation requires the canonical routine task manifest, reviewed distinct database-role grants, current Core unattended authority and AgentCore occurrence/retirement owners; native TLS/service health does not qualify scheduled outcomes':
    'schedule-worker is not enabled in these two app services; configure an approved routines workflow and its complete schedule bindings before claiming scheduled/background outcomes',
   'complete required review and gates, verify the clone snapshot and full ledger, then hold the preview deploy lock through the coordinated update; root performs live browser acceptance before retiring old resources'
  ],
  migrations,
  costLimits:{cycleCeilingUsd:ceilingUsd,policySource:'canonical tenant settings at run admission; SDK per-run limits and one terminal usage record',
   rule:'the release does not initialize or override tenant caps; observe uncertain submissions before any retry'},
  steps:releaseSteps({deployment,stage3,upload,migrations,work,bindingsPlan:bindings?.plan}),
  smoke:[command(['curl','--fail','--max-time','10','https://meri-preview.capiro.ai/health/live']),
   {note:'after deployment health, root runs the required preview acceptance within the authorized Wave2 scope and records exact source/image pins'}],
  rollback:{rule:'forward redeploy: the rendered material pins exact task-definition revisions and a failed or rolled-back update burns them, so UpdateService to an old revision cannot roll back',
   images:structuredClone(previousDeployment.images),
   steps:configuration.kind!=='image-only'?
    ['old images alone cannot roll back this topology transition; preserve reviewed previous configuration, compatible historical renderer and model resources until acceptance',
     'review a separate rollback against actual live topology and applied migrations, using fresh revisions and material; previous images require their compatible renderer and runtime configuration',
     'after previous hosting resources retire, use only a separately proven AgentCore-compatible forward recovery']:
    ['readback revisions','verify rollback source compatibility with applied migrations and the current service topology','render current roles with compatible rollback images and runtime values','upload under a NEW label','bindings','app with the gates above','verify-outputs']},
  cleanup:['after replacement acceptance, retire the old hosting and Temporal issuer resources and verify no active caller remains; account explicitly for retained KMS signing keys, log groups and historical secret versions','retain scrubbed command/upload receipts; remove scratch private PKI, secret-value files and rendered bundles on success or failure','prune obsolete version labels under the existing secret retention policy',
   'CloudFormation deregisters the replaced task-definition revisions'],
  risks:['static material expiry and certificate validity must cover startup; render immediately before deployment',
   'compatible image replacement: admitted conversations can continue from the latest published checkpoint when SDK, CLI, contracts and checkpoint format are unchanged; fresh authentication and owner, client and policy checks still apply',
   'incompatible SDK or format: changed SDK/CLI refuses checkpoint continuation with NEXT_TURN_SDK_CHANGED; changed contracts/checkpoint format refuses with NEXT_TURN_FORMAT_CHANGED; this packet neither migrates nor seeds an incompatible session',
   'unfinished or in-flight work: a started run is never rebound; a successor waits for a durable terminal outcome and uses the latest published native session and workspace files, never partial capture',
   'continuity statements describe source behavior, not live qualification: restart, reconnect and continuation evidence for these exact source/image/environment pins remains required',
   'worker AZ rebalancing stays ENABLED (only control changes); a first worker task can be refused while the old one overlaps',
   'service health alone does not establish chat or Core data access; complete the live acceptance before announcing readiness']};
 return {...packet,packetSha256:canonicalSha256(packet)};
}

const shellWord=w=>/^[A-Za-z0-9_@%+=:,./<>-]+$/u.test(w)?w:`'${String(w).replaceAll("'","'\\''")}'`;
const line=c=>c.argv?`${c.argv.map(shellWord).join(' ')}${c.stdout?` > ${shellWord(c.stdout)}`:''}${c.note?`   # ${c.note}`:''}`:`# ${c.note}`;
export function renderMarkdown(p){
 const out=[`# Meri first-chat ship packet (${p.phase})`,'',`Packet sha256 \`${p.packetSha256}\`. Source \`${p.pins.sourceCommit}\` replaces \`${p.pins.previousSourceCommit}\`. Label \`${p.pins.label}\`.`,
  '','## Pins','','```json',JSON.stringify(p.pins,null,1),'```','','## Evidence','','```json',JSON.stringify(p.evidence,null,1),'```','',
  '## Migrations','',p.migrations.required?`${p.migrations.added.length} new source-plan entries require ledger verification and application if pending:\n\n${p.migrations.added.map(e=>`- ${e.stage}: ${e.source} \`${e.sha256}\``).join('\n')}`:'No new source-plan entries. This does not prove database completion; verify the actual full ledger and apply any pending stages before release.',
  '','## Configuration change','','```json',JSON.stringify(p.configuration,null,1),'```',
  '','## Prerequisites','',...p.prerequisites.map(s=>`- ${s}`),
  '','## Cost limits','','```json',JSON.stringify(p.costLimits,null,1),'```','','## Steps',''];
 for(const [n,s] of p.steps.entries())out.push(`### ${n+1}. ${s.title}`,'','```bash',...s.commands.map(line),'```','',`Gate: ${s.gate}`,'');
 out.push('## Smoke','','```bash',...p.smoke.map(line),'```','','## Rollback','',p.rollback.rule,'',...p.rollback.steps.map(s=>`- ${s}`),'','## Cleanup','',...p.cleanup.map(s=>`- ${s}`),'','## Risks','',...p.risks.map(s=>`- ${s}`),'');
 return out.join('\n');
}

const USAGE=`Usage: node infra/product-preview/first-chat/ship-packet.mjs --deployment-inputs F --previous-deployment-inputs F --runtime runtime-values.json
  --node-receipt image-evidence/result.json --image-scans F --stage3 stage3.json --upload-plan upload-plan.json --work <private working dir>
  --ceiling-usd N --out NEW_DIR [--bindings DIR]
Run from a clean operator checkout; its commit/tree are recorded separately from the image source.
Root must authenticate the source/S3/CodeBuild result and obtain fresh digest-bound scans before release; this offline packet checks local pins only.`;
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const gitShow=(sourceRoot,rev,path)=>execFileSync('git',['-C',sourceRoot,'show',`${rev}:${path}`],{encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore']});

export async function main(argv=process.argv.slice(2),{out=t=>process.stdout.write(t),err=t=>process.stderr.write(t),sourceRoot=SOURCE_ROOT}={}){
 if(!argv.length||argv[0]==='--help'){out(USAGE+'\n');return argv.length?0:2;}
 const a={};
 for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||argv[i+1]===undefined){err(USAGE+'\n');return 2;}a[argv[i].slice(2)]=argv[i+1];}
 try{
  for(const key of ['deployment-inputs','previous-deployment-inputs','runtime','node-receipt','image-scans','stage3','upload-plan','work','ceiling-usd','out'])if(!a[key])refuse(`--${key} is required`);
  const operatorSource=readOperatorSource(sourceRoot);
  const files=Object.fromEntries(await Promise.all(['deployment-inputs','previous-deployment-inputs','runtime','node-receipt','image-scans','stage3','upload-plan'].map(async key=>[key,await readFile(a[key])])));
  const parse=key=>JSON.parse(files[key].toString('utf8'));
  const deployment=parse('deployment-inputs'),previousDeployment=parse('previous-deployment-inputs');
  for(const c of [deployment.images?.nodeRuntimeSourceCommit,previousDeployment.images?.nodeRuntimeSourceCommit])if(!commit.test(c??''))refuse('images.nodeRuntimeSourceCommit');
  let previousPlan,currentPlan;
  try{previousPlan=planEntries(gitShow(sourceRoot,previousDeployment.images.nodeRuntimeSourceCommit,MIGRATE));currentPlan=planEntries(gitShow(sourceRoot,deployment.images.nodeRuntimeSourceCommit,MIGRATE));}
  catch(error){if(error?.code==='SHIP_PACKET_REFUSED')throw error;refuse('both release commits must be available locally: fetch them');}
  let bindings;
  if(a.bindings){
   const dir=resolve(a.bindings),plan=await json(join(dir,'deploy-plan.json')),templates={};
   for(const key of STAGE3_DEPLOY_ORDER){const body=await readFile(join(dir,`${key}.template.json`));templates[key]={sha256:sha(body),bytes:body.length};}
   bindings={plan,templates};
  }
  const packet=buildShipPacket({deployment,previousDeployment,operatorSource,runtime:parse('runtime'),receipt:parse('node-receipt'),receiptSha256:sha(files['node-receipt']),
   imageScans:parse('image-scans'),stage3:parse('stage3'),upload:parse('upload-plan'),bindings,
   migrations:migrationDelta(previousPlan,currentPlan),
   ceilingUsd:Number(a['ceiling-usd']),work:a.work,hashes:Object.fromEntries(Object.entries(files).map(([key,bytes])=>[key,sha(bytes)]))});
  const dir=resolve(a.out),rel=relative(sourceRoot,dir);
  if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))refuse('--out must be outside the repository');
  await mkdir(dir,{recursive:false,mode:0o700});
  await writeFile(join(dir,'ship-packet.json'),JSON.stringify(packet,null,1)+'\n',{flag:'wx'});
  await writeFile(join(dir,'SHIP-PACKET.md'),renderMarkdown(packet),{flag:'wx'});
  out(JSON.stringify({status:'SHIP_PACKET_WRITTEN',out:dir,phase:packet.phase,packetSha256:packet.packetSha256,migrationsRequired:packet.migrations.required})+'\n');return 0;
 }catch(error){
  err((error?.code==='SHIP_PACKET_REFUSED'?error.message:typeof error?.code==='string'&&/^E[A-Z]+$/u.test(error.code)?`SHIP_PACKET_INPUT_UNREADABLE ${error.code}`:
   error instanceof SyntaxError?'SHIP_PACKET_REFUSED: an input file is not JSON':'SHIP_PACKET_REFUSED')+'\n');return 2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();

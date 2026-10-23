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
import {ROLES,SOURCE_ROOT,runnerSha256AtCommit} from './render-material.mjs';
import {STAGE3_FAMILIES,STAGE3_SERVICES,STAGE3_STACKS,STAGE3_DEPLOY_ORDER,MATERIAL_SECRET_KEYS} from './stage3-bindings.mjs';

export const SCHEMA='meri.first-chat-ship-packet/2';
const STAGE3='infra/product-preview/first-chat/stage3-deploy.mjs';
const MIGRATE='infra/product-preview/first-chat-migrate.mjs';
const commit=/^[a-f0-9]{40}$/u;
const hex64=/^[a-f0-9]{64}$/u;
export const refuse=detail=>{throw Object.assign(Error(`SHIP_PACKET_REFUSED: ${detail}`),{code:'SHIP_PACKET_REFUSED'});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digestOf=uri=>/@sha256:([a-f0-9]{64})$/u.exec(String(uri))?.[1]??refuse(`image ${String(uri).slice(0,120)} is not pinned by digest`);
const cluster=deployment=>/cluster\/([A-Za-z0-9_-]+)$/u.exec(deployment.clusterArn)?.[1]??refuse('deployment.clusterArn');

/** Every planned entry of a first-chat-migrate.mjs source text (the PLAN array is declared data): kind, source, sha256, stage. */
export function planEntries(text){
 const block=/export const PLAN=Object\.freeze\(\[([\s\S]*?)\n\]\.map\(/u.exec(text)?.[1];
 if(!block)refuse('first-chat-migrate.mjs has no PLAN');
 return [...block.matchAll(/\[\s*'([a-z_:]+)'\s*,\s*([^\n]*?),\s*'([a-f0-9]{64})'(?:\s*,\s*'([a-z]+)')?\s*\]/gu)].map(([,kind,source,digest,stage])=>
  ({kind,source:source.trim(),sha256:digest,stage:stage??(kind==='phase:temporal_grants'?'temporal':'meri')}));
}
/** The release's migration delta. The 'meri' and 'temporal' stages are ledgered, and the ledger accepts only an exact prefix, so
 * their entries may be appended, never removed, edited or reordered. 'integration' entries are applied only by an explicit
 * integration run (approved, not applied), so they are reported separately and never make the release's migrate run required. */
export function migrationDelta(previous,current){
 const ledgered=entries=>entries.filter(e=>e.stage!=='integration'),integration=entries=>entries.filter(e=>e.stage==='integration');
 const before=ledgered(previous),now=ledgered(current),kept=new Set(now.map(e=>e.sha256));
 const removed=before.filter(e=>!kept.has(e.sha256));
 if(removed.length)refuse(`migration plan drops or edits ledgered entries: ${removed.map(e=>e.source).join(', ')}`);
 if(now.slice(0,before.length).some((e,i)=>e.sha256!==before[i].sha256))refuse('migration plan reorders ledgered entries');
 const added=now.slice(before.length);
 return {previousEntries:before.length,currentEntries:now.length,added,required:added.length>0,
  integrationChanged:canonicalSha256(integration(previous).map(e=>e.sha256))!==canonicalSha256(integration(current).map(e=>e.sha256))};
}

/** Cross-checks the reviewed inputs; any disagreement refuses before a packet exists. */
export function checkInputs({deployment,previousDeployment,runtime,receipt,receiptSha256,imageScans,stage3,upload,measuredRunnerSha256}){
 const images=deployment?.images,previous=previousDeployment?.images;
 if(deployment?.schemaVersion!==1||!images)refuse('deployment inputs');
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
 const runner=runtime?.preparationIntent?.runnerSha256;
 if(typeof measuredRunnerSha256!=='string'||!hex64.test(measuredRunnerSha256))refuse('the node runtime source commit is not available locally: fetch it');
 if(runner!==measuredRunnerSha256)refuse('runnerSha256 differs between runtime values and conversation-runner.mjs at the image source commit');
 if(stage3?.schemaVersion!==1)refuse('stage3.json');
 for(const [role,family] of Object.entries(STAGE3_FAMILIES))if(!new RegExp(`task-definition/${family}:[1-9][0-9]*$`,'u').test(stage3.taskDefinitions?.[role]??''))refuse(`stage3 task definition for ${role}`);
 if(JSON.stringify(upload?.roles?.map(r=>r.role))!==JSON.stringify(ROLES))refuse('upload plan roles');
 for(const r of upload.roles)if(r.secretArn!==deployment.secrets[MATERIAL_SECRET_KEYS[r.role]])refuse(`upload plan secret for ${r.role}`);
 for(const r of upload.roles)if(!Array.isArray(r.labelsBefore)||r.labelsBefore.includes(upload.label))refuse(`upload plan for ${r.role} lacks a before-upload label readback without ${upload.label}`);
 const {images:a,...restNow}=deployment,{images:b,...restBefore}=previousDeployment??{};
 if(!previous||canonicalSha256(restNow)!==canonicalSha256(restBefore))refuse('previous deployment inputs must differ from these only in images');
 if(canonicalSha256(a)===canonicalSha256(b))refuse('the images equal the previous release: nothing to ship');
}

const command=(argv,{stdout,note}={})=>({argv,...(stdout?{stdout}:{}),...(note?{note}:{})});
const logs=(group,pattern)=>command(['aws','logs','filter-log-events','--region','us-east-1','--log-group-name',group,'--start-time','<deploy start ms>','--filter-pattern',pattern,'--query','events[].message','--output','text'],{note:'set MSYS_NO_PATHCONV=1 in Git Bash'});

/** The ordered release steps for the inputs above. `work` is the operator's private working directory (a path, never content). */
export function releaseSteps({deployment,stage3,upload,migrations,work,bindingsPlan}){
 const c=cluster(deployment),f=deployment.foundation,fam=Object.values(STAGE3_FAMILIES),W=name=>join(work,name),S=STAGE3_SERVICES;
 const wait=(...roles)=>command(['aws','ecs','wait','services-stable','--region','us-east-1','--cluster',c,'--services',...roles.map(r=>S[r])]);
 const steps=[{id:'readback',title:'Revisions unchanged since stage3.json (any registration in between forces a new render)',
  commands:fam.flatMap(family=>['ACTIVE','INACTIVE'].map(status=>command(['aws','ecs','list-task-definitions','--region','us-east-1','--family-prefix',family,'--status',status,'--sort','DESC','--max-items','1','--query','taskDefinitionArns[0]','--output','text']))),
  gate:'the highest ACTIVE/INACTIVE revision of every family is one below stage3.json taskDefinitions (an unchanged runner keeps its revision)'}];
 if(migrations.required)steps.push({id:'migrate',title:`Apply ${migrations.added.length} new migration(s) (stage meri) before any stack update`,
  commands:[command(['node',MIGRATE,'plan'],{note:'offline: confirms the planned files and hashes'})],
  gate:'the d2-migrate one-shot task (docs/shipping/20261017/D2-DATABASE.md; its task definition is not in this repository) reports the ledger as the exact plan prefix'});
 steps.push({id:'upload',title:`Stage the ${ROLES.length} rendered bundles under ${upload.label} (AWSCURRENT does not move)`,
  commands:upload.roles.flatMap(r=>[command(r.command,{note:`append "${r.role}<TAB>VersionId" to ${W('secret-versions.tsv')}; on an uncertain outcome resend this exact command`}),command(r.readback)]),
  gate:`${ROLES.length} new versions carry only ${upload.label}; each secret's other labels equal its labelsBefore in the upload plan (AWSCURRENT unmoved)`});
 steps.push({id:'bindings',title:'Live readbacks, then bindings and the update templates',
  commands:[command(['aws','cloudformation','get-template','--region','us-east-1','--stack-name',STAGE3_STACKS.app,'--template-stage','Original','--query','TemplateBody','--output','json'],{stdout:W('app.live.template.json')}),
   command(['aws','cloudformation','describe-stacks','--region','us-east-1','--stack-name','<foundation stack>','--query','Stacks[0].Outputs'],{stdout:W('foundation-live.json')}),
   command(['aws','cloudformation','describe-stacks','--region','us-east-1','--stack-name','<private-edge stack>','--query','Stacks[0].Outputs'],{stdout:W('private-edge-outputs.json')}),
   command(['node',STAGE3,'bindings','--deployment-inputs','<deployment-inputs.json>','--foundation-outputs',W('foundation-live.json'),'--private-edge-outputs',W('private-edge-outputs.json'),
    '--rendered',W('rendered'),'--secret-versions',W('secret-versions.tsv'),'--image-scans','<image-scans.json>','--live-app-template',W('app.live.template.json'),'--out',W('bindings')])],
  gate:'STAGE3_BINDINGS_WRITTEN; rerun this packet with --bindings to pin the template hashes'});
 const gates={issuer:{wait:wait('temporal-issuer'),checks:[logs(f.IssuerLogGroupName,'"runtime.listening"')],
   gate:'issuer runtime.listening on the new revision; from here the running control and worker are refused until the app update lands: continue immediately'},
  app:{wait:wait('control','temporal-worker'),checks:[logs(f.ControlLogGroupName,'"runtime.listening"'),logs(f.WorkerLogGroupName,'"runtime.listening"'),
   command(['aws','elbv2','describe-target-health','--region','us-east-1','--target-group-arn',deployment.privateEdge.controlPrivateTargetGroupArn]),
   command(['aws','elbv2','describe-target-health','--region','us-east-1','--target-group-arn',f.ControlTargetGroupArn])],
   gate:'exactly one control task, worker 1/1/0, both runtime.listening, both target groups healthy; no RUNTIME_UNAVAILABLE, RUNTIME_CONFIGURATION, STATIC_INIT_* or *_REFUSED; tasks alive after 200 s'}};
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
   command(['node',STAGE3,'verify-outputs','--bindings',W('bindings'),'--app',W('app.outputs.json'),'--issuer',W('issuer.outputs.json')])],
  gate:'STAGE3_TASK_DEFINITIONS_MATCH_RENDER for all four task definitions; a mismatch means re-render, never patch'});
 return steps;
}

/** The packet object. Pure: callers supply file bytes, git readings and the clock-free inputs. */
export function buildShipPacket(i){
 checkInputs(i);
 const {deployment,previousDeployment,runtime,receipt,stage3,upload,bindings,migrations,ceilingUsd,work,hashes}=i;
 if(!Number.isFinite(ceilingUsd)||ceilingUsd<=0)refuse('--ceiling-usd must be the positive authorized allocation for this cycle');
 if(!isAbsolute(work))refuse('--work must be an absolute path');
 if(bindings){
  if(JSON.stringify(bindings.plan.order)!==JSON.stringify(STAGE3_DEPLOY_ORDER))refuse('deploy plan order');
  for(const [role,arn] of Object.entries(stage3.taskDefinitions))if(bindings.plan.expectedTaskDefinitions?.[role]!==arn)refuse(`bindings were rendered for another ${role} revision`);
 }
 const packet={schema:SCHEMA,phase:bindings?'pre-deploy':'pre-upload',
  pins:{sourceCommit:deployment.images.nodeRuntimeSourceCommit,previousSourceCommit:previousDeployment.images.nodeRuntimeSourceCommit,images:structuredClone(deployment.images),
   runnerSha256:runtime.preparationIntent.runnerSha256,versions:structuredClone(runtime.versions),
   label:upload.label,taskDefinitions:structuredClone(stage3.taskDefinitions),inputs:structuredClone(hashes),
   ...(bindings?{templates:bindings.templates}:{})},
  evidence:{sourceCommit:receipt.sourceCommit,sourceVersion:receipt.sourceVersion,imageDigest:receipt.imageDigest,platform:receipt.platform,
   scanStatus:receipt.scanStatus,findingSeverityCounts:structuredClone(receipt.findingSeverityCounts),
   required:['exact-source ARM64 image build, native SDK/Temporal/SWC imports and artifact execution under the service identity',
    'digest-bound image scans with zero HIGH/CRITICAL and reviewed dispositions for other findings',
    'independent exact-head review, native PostgreSQL migration/run accounting and Linux material gates']},
  migrations,
  costLimits:{cycleCeilingUsd:ceilingUsd,policySource:'canonical tenant settings at run admission; SDK per-run limits and one terminal usage record',
   rule:'the release does not initialize or override tenant caps; observe uncertain submissions before any retry'},
  steps:releaseSteps({deployment,stage3,upload,migrations,work,bindingsPlan:bindings?.plan}),
  smoke:[command(['curl','--fail','--max-time','10','https://meri-preview.capiro.ai/health/live']),
   {note:'after deployment health, root runs the required preview acceptance within the authorized Wave2 scope and records exact source/image pins'}],
  rollback:{rule:'forward redeploy: the rendered material pins exact task-definition revisions and a failed or rolled-back update burns them, so UpdateService to an old revision cannot roll back',
   images:structuredClone(previousDeployment.images),
   steps:['readback revisions','verify rollback source compatibility with applied migrations and the current service topology','render current roles with compatible rollback images and runtime values','upload under a NEW label','bindings','issuer, app with the gates above','verify-outputs']},
  cleanup:['deregister any probe task definition used for diagnosis','retain scrubbed command/upload receipts; remove scratch private PKI, secret-value files and rendered bundles on success or failure','prune obsolete version labels under the existing secret retention policy',
   'CloudFormation deregisters the replaced task-definition revisions'],
  risks:['the static candidate grant and deadline expire 15 minutes after render (real chats use dynamic runs)',
   'static material expiry and certificate validity must cover startup; render immediately before deployment',
   'compatible image replacement: admitted conversations can continue from the latest published checkpoint when SDK, CLI, contracts and checkpoint format are unchanged; fresh authentication and owner, client and policy checks still apply',
   'incompatible SDK or format: changed SDK/CLI refuses checkpoint continuation with NEXT_TURN_SDK_CHANGED; changed contracts/checkpoint format refuses with NEXT_TURN_FORMAT_CHANGED; this packet neither migrates nor seeds an incompatible session',
   'unfinished or in-flight work: fresh issuance can re-prepare an unstarted original, but a started run is never rebound; a successor waits for terminal state and proven retirement/revocation (or proved no-authority), using the latest published checkpoint or a fresh SDK session if none exists, never partial work',
   'continuity statements describe source behavior, not live qualification: restart, reconnect and continuation evidence for these exact source/image/environment pins remains required',
   'between the issuer and app updates control and the worker are refused (RUNTIME_UNAVAILABLE): run the app update immediately',
   'worker AZ rebalancing stays ENABLED (only control changes); a first worker task can be refused while the old one overlaps',
   'service health alone does not establish chat or Core data access; complete the live acceptance before announcing readiness']};
 return {...packet,packetSha256:canonicalSha256(packet)};
}

const shellWord=w=>/^[A-Za-z0-9_@%+=:,./<>-]+$/u.test(w)?w:`'${String(w).replaceAll("'","'\\''")}'`;
const line=c=>c.argv?`${c.argv.map(shellWord).join(' ')}${c.stdout?` > ${shellWord(c.stdout)}`:''}${c.note?`   # ${c.note}`:''}`:`# ${c.note}`;
export function renderMarkdown(p){
 const out=[`# Meri first-chat ship packet (${p.phase})`,'',`Packet sha256 \`${p.packetSha256}\`. Source \`${p.pins.sourceCommit}\` replaces \`${p.pins.previousSourceCommit}\`. Label \`${p.pins.label}\`.`,
  '','## Pins','','```json',JSON.stringify(p.pins,null,1),'```','','## Evidence','','```json',JSON.stringify(p.evidence,null,1),'```','',
  '## Migrations','',p.migrations.required?`${p.migrations.added.length} new entries must be applied first:\n\n${p.migrations.added.map(e=>`- ${e.source} \`${e.sha256}\``).join('\n')}`:'None: the migration plan is unchanged since the previous release.',
  '','## Cost limits','','```json',JSON.stringify(p.costLimits,null,1),'```','','## Steps',''];
 for(const [n,s] of p.steps.entries())out.push(`### ${n+1}. ${s.title}`,'','```bash',...s.commands.map(line),'```','',`Gate: ${s.gate}`,'');
 out.push('## Smoke','','```bash',...p.smoke.map(line),'```','','## Rollback','',p.rollback.rule,'',...p.rollback.steps.map(s=>`- ${s}`),'','## Cleanup','',...p.cleanup.map(s=>`- ${s}`),'','## Risks','',...p.risks.map(s=>`- ${s}`),'');
 return out.join('\n');
}

const USAGE=`Usage: node infra/product-preview/first-chat/ship-packet.mjs --deployment-inputs F --previous-deployment-inputs F --runtime runtime-values.json
  --node-receipt image-evidence/result.json --image-scans F --stage3 stage3.json --upload-plan upload-plan.json --work <private working dir>
  --ceiling-usd N --out NEW_DIR [--bindings DIR]
Root must authenticate the source/S3/CodeBuild result and obtain fresh digest-bound scans before release; this offline packet checks local pins only.`;
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const gitShow=(rev,path)=>execFileSync('git',['-C',SOURCE_ROOT,'show',`${rev}:${path}`],{encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','ignore']});

export async function main(argv=process.argv.slice(2),{out=t=>process.stdout.write(t),err=t=>process.stderr.write(t)}={}){
 if(!argv.length||argv[0]==='--help'){out(USAGE+'\n');return argv.length?0:2;}
 const a={};
 for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||argv[i+1]===undefined){err(USAGE+'\n');return 2;}a[argv[i].slice(2)]=argv[i+1];}
 try{
  for(const key of ['deployment-inputs','previous-deployment-inputs','runtime','node-receipt','image-scans','stage3','upload-plan','work','ceiling-usd','out'])if(!a[key])refuse(`--${key} is required`);
  const files=Object.fromEntries(await Promise.all(['deployment-inputs','previous-deployment-inputs','runtime','node-receipt','image-scans','stage3','upload-plan'].map(async key=>[key,await readFile(a[key])])));
  const parse=key=>JSON.parse(files[key].toString('utf8'));
  const deployment=parse('deployment-inputs'),previousDeployment=parse('previous-deployment-inputs');
  for(const c of [deployment.images?.nodeRuntimeSourceCommit,previousDeployment.images?.nodeRuntimeSourceCommit])if(!commit.test(c??''))refuse('images.nodeRuntimeSourceCommit');
  let previousPlan,currentPlan;
  try{previousPlan=planEntries(gitShow(previousDeployment.images.nodeRuntimeSourceCommit,MIGRATE));currentPlan=planEntries(gitShow(deployment.images.nodeRuntimeSourceCommit,MIGRATE));}
  catch(error){if(error?.code==='SHIP_PACKET_REFUSED')throw error;refuse('both release commits must be available locally: fetch them');}
  let bindings;
  if(a.bindings){
   const dir=resolve(a.bindings),plan=await json(join(dir,'deploy-plan.json')),templates={};
   for(const key of STAGE3_DEPLOY_ORDER){const body=await readFile(join(dir,`${key}.template.json`));templates[key]={sha256:sha(body),bytes:body.length};}
   bindings={plan,templates};
  }
  const packet=buildShipPacket({deployment,previousDeployment,runtime:parse('runtime'),receipt:parse('node-receipt'),receiptSha256:sha(files['node-receipt']),
   imageScans:parse('image-scans'),stage3:parse('stage3'),upload:parse('upload-plan'),bindings,
   measuredRunnerSha256:runnerSha256AtCommit(deployment.images.nodeRuntimeSourceCommit),migrations:migrationDelta(previousPlan,currentPlan),
   ceilingUsd:Number(a['ceiling-usd']),work:a.work,hashes:Object.fromEntries(Object.entries(files).map(([key,bytes])=>[key,sha(bytes)]))});
  const dir=resolve(a.out),rel=relative(SOURCE_ROOT,dir);
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

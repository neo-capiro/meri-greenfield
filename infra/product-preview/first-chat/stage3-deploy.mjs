#!/usr/bin/env node
/** Meri first-chat Stage 3: the data-plumbing steps of docs/shipping/20261017/STAGE3-DEPLOY-RUNBOOK.md. Every AWS mutation stays an
 * explicit command the operator runs; this tool only reads local files, validates and writes local files. It never prints a
 * secret: nothing here reads a user credential or material bundle.
 *
 *   stage3-input      latest task-definition ARNs (TSV) -> stage3.json for render-material.mjs --stage3
 *   core-values       Core and frontend origins -> core.json for render-material.mjs --core
 *   upload-plan       rendered directory + a new version label + the secrets' label readback -> the exact PutSecretValue
 *                     commands (fixed idempotency tokens); refuses a label in use or a secret at its version/label capacity
 *   bindings          rendered directory + secret VersionIds + live app template -> the application binding, templates and deploy plan
 *   verify-outputs    deployed stack outputs -> refuses unless every task definition ARN equals the rendered one
 *
 * Exit 0 done; 2 refused (one STAGE3_* line on stderr). Importing this module performs no IO. */
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve,join,isAbsolute,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROLES,ALL_ROLES,deploymentRoles,parseCoreValues,SOURCE_ROOT} from './render-material.mjs';
import {ALL_STAGE3_FAMILIES,STAGE3_STACKS,STAGE3_DEPLOY_ORDER,MATERIAL_SECRET_KEYS,TEMPLATE_BUCKET,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3,fail} from './stage3-bindings.mjs';

export const CORE_ORIGIN='https://first-chat-preview.app-dev.capiro.ai';
/** `family<TAB>arn|None` lines (one per family and status) -> {role: [arn...]}. */
export function parseLatestTsv(text,{roles=ROLES}={}){
 const byFamily=Object.fromEntries(roles.map(role=>[ALL_STAGE3_FAMILIES[role],role])),latest={};
 for(const line of text.split(/\r?\n/u).map(l=>l.trim()).filter(Boolean)){
  const [family,arn,...rest]=line.split(/\s+/u);
  if(rest.length||!arn||!Object.hasOwn(byFamily,family))fail(`latest line "${line.slice(0,200)}"`);
  (latest[byFamily[family]]??=[]).push(arn);
 }
 for(const role of roles)if(!latest[role]||latest[role].length<2)fail(`latest needs the ACTIVE and INACTIVE listing of ${ALL_STAGE3_FAMILIES[role]}`);
 return latest;
}

/** Deployment origins only. User identity and client/General scope are admitted on each request by Core. */
export function coreValues({frontendOrigin,coreOrigin=CORE_ORIGIN,...extra}){
 if(Object.keys(extra).length)fail('core values accept origins only');return parseCoreValues({coreOrigin,frontendOrigin});
}

const RESERVED_STAGES=new Set(['AWSCURRENT','AWSPREVIOUS','AWSPENDING']);
/** Secrets Manager limits: at most 20 staging labels across all versions of a secret, and versions beyond 100 that carry no label are
 * removed. Every release keeps its label, so both bound how many releases a secret can hold. */
export const SECRET_LIMITS=Object.freeze({stagingLabels:20,versions:100});
function labelsFromVersions(versions){
 if(!Array.isArray(versions))fail('secret label readback must contain version records');
 const ids=new Set(),labels=new Set();
 for(const version of versions){
  if(!version||typeof version!=='object'||Array.isArray(version)||typeof version.VersionId!=='string'||!version.VersionId||ids.has(version.VersionId))
   fail('secret label readback contains an invalid or duplicate version');
  ids.add(version.VersionId);
  // An unlabelled, deprecated version legitimately omits VersionStages, but still counts toward capacity.
  const stages=version.VersionStages===undefined?[]:version.VersionStages;
  if(!Array.isArray(stages)||stages.some(stage=>typeof stage!=='string'||!stage||stage.length>256))
   fail('secret label readback contains invalid version stages');
  for(const stage of stages){if(labels.has(stage))fail('secret label readback repeats a staging label');labels.add(stage);}
 }
 return [...labels].sort();
}
/** `list-secret-version-ids --include-deprecated` outputs, one per secret -> {ARN: Versions}. */
export function secretLabelReadback(outputs){
 if(!Array.isArray(outputs))fail('each secret label readback is one list-secret-version-ids output per secret');
 const byArn={};
 for(const output of outputs){
  if(typeof output?.ARN!=='string'||!output.ARN.startsWith('arn:')||!Array.isArray(output.Versions)||Object.hasOwn(byArn,output.ARN))fail('each secret label readback is one list-secret-version-ids output per secret');
  // A partial page can conceal a reused label or a full secret. Only the complete CLI readback is admissible.
  if(output.NextToken!==undefined)fail('secret label readback is incomplete: collect every page');
  labelsFromVersions(output.Versions);
  byArn[output.ARN]=output.Versions;
 }
 return byArn;
}
/** One new secret version per role, staged under a fresh label only: AWSCURRENT and every earlier label stay where they are (task
 * definitions reference exact VersionIds). Each role gets a fixed idempotency token, so a retry after an uncertain outcome sends the
 * same token with the same bytes and can never create a second version. Bundles are referenced by path; nothing here reads them.
 * The before-upload label readback must show the label unused (PutSecretValue would otherwise silently move it off an older version)
 * and room for one more version and one more label. */
export function uploadPlan({deployment,renderedDirectory,label,secretLabels,newToken=randomUUID}){
 if(typeof label!=='string'||!/^[A-Za-z0-9_]{1,64}$/u.test(label)||RESERVED_STAGES.has(label))fail('--label must be a new custom staging label');
 return deploymentRoles(deployment).map(role=>{
  const secretArn=deployment?.secrets?.[MATERIAL_SECRET_KEYS[role]];
  if(typeof secretArn!=='string'||!/^arn:aws:secretsmanager:us-east-1:967807252336:secret:meri\/preview\/[a-z]+\/material-[A-Za-z0-9]{6}$/u.test(secretArn))fail(`deployment.secrets.${MATERIAL_SECRET_KEYS[role]}`);
  const versions=secretLabels?.[secretArn];
  if(!Array.isArray(versions))fail(`no label readback for ${role} (${secretArn})`);
  const labelsBefore=labelsFromVersions(versions);
  if(labelsBefore.includes(label))fail(`label ${label} is already on a version of ${role}: choose a new label`);
  if(versions.length>=SECRET_LIMITS.versions)fail(`${role} already holds ${versions.length} versions`);
  if(labelsBefore.length>=SECRET_LIMITS.stagingLabels)fail(`${role} is at the ${SECRET_LIMITS.stagingLabels} staging-label quota: retire an unpinned label first`);
  const bundleFile=join(renderedDirectory,role,'bundle.json'),clientRequestToken=newToken();
  return {role,secretArn,bundleFile,clientRequestToken,labelsBefore,
   command:['aws','secretsmanager','put-secret-value','--region','us-east-1','--secret-id',secretArn,'--client-request-token',clientRequestToken,
    '--version-stages',label,'--secret-string',`file://${bundleFile}`,'--query','VersionId','--output','text'],
   readback:['aws','secretsmanager','list-secret-version-ids','--region','us-east-1','--secret-id',secretArn,'--include-deprecated','--max-results','100']};
 });
}

/** `role<TAB>VersionId` lines from the PutSecretValue loop -> {role: VersionId}. */
export function parseVersionsTsv(text){
 const out={};
 for(const line of text.split(/\r?\n/u).map(l=>l.trim()).filter(Boolean)){
  const [role,version,...rest]=line.split(/\s+/u);
  if(rest.length||!ALL_ROLES.includes(role)||Object.hasOwn(out,role))fail(`secret version line for ${String(role).slice(0,40)}`);
  out[role]=version;
 }
 return out;
}
/** `aws cloudformation describe-stacks --query Stacks[0].Outputs` (array) or a plain {key: value} object. */
export function outputsObject(value){
 if(Array.isArray(value))return Object.fromEntries(value.map(o=>{if(typeof o?.OutputKey!=='string')fail('stack outputs');return [o.OutputKey,o.OutputValue];}));
 if(value&&typeof value==='object')return value;
 fail('stack outputs');
}

/** One change set per stack, in STAGE3_DEPLOY_ORDER: create it, review it, execute the ARN it printed, wait, then gate. */
export function deployPlan(sizes,directory){
 return Object.fromEntries(STAGE3_DEPLOY_ORDER.map(key=>{
  const stack=STAGE3_STACKS[key],file=join(directory,`${key}.template.json`),viaS3=sizes[key].viaS3;
  return [key,{stack,templateFile:file,bytes:sizes[key].bytes,viaS3,
   command:['aws','cloudformation','deploy','--region','us-east-1','--stack-name',stack,'--template-file',file,
    ...(viaS3?['--s3-bucket',TEMPLATE_BUCKET.bucket,'--s3-prefix',TEMPLATE_BUCKET.prefix]:[]),
    '--no-execute-changeset','--no-fail-on-empty-changeset'],
   wait:['aws','cloudformation','wait','stack-update-complete','--region','us-east-1','--stack-name',stack]}];
 }));
}

/** Refuses unless each stack's task definitions are exactly the revisions the material was rendered for. */
export function verifyOutputs({expectedTaskDefinitions,app}){
 const keys={control:'ControlTaskDefinitionArn','temporal-worker':'TemporalWorkerTaskDefinitionArn','schedule-worker':'ScheduleWorkerTaskDefinitionArn'};
 if(Object.keys(expectedTaskDefinitions).some(role=>!ALL_ROLES.includes(role))||ROLES.some(role=>!expectedTaskDefinitions[role]))fail('expected task definition roles');
 const pairs=Object.keys(expectedTaskDefinitions).map(role=>[role,app[keys[role]]]);
 const mismatched=pairs.filter(([role,actual])=>actual!==expectedTaskDefinitions[role]).map(([role,actual])=>`${role}: rendered ${expectedTaskDefinitions[role]} deployed ${actual}`);
 if(mismatched.length)fail(`task definitions differ from the render (re-render with the deployed revisions): ${mismatched.join('; ')}`);
 return pairs.map(([role,arn])=>({role,arn}));
}

async function writeNew(path,text,mode=0o600){await writeFile(path,text,{mode,flag:'wx'});return path;}
async function outsideRepository(path){
 const target=resolve(path),rel=relative(SOURCE_ROOT,target);
 if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))fail('outputs must be outside the repository');
 return target;
}
const json=async path=>JSON.parse(await readFile(path,'utf8'));

const USAGE=`Usage: node infra/product-preview/first-chat/stage3-deploy.mjs <command> [--flag value]...
  stage3-input   --deployment-inputs F --foundation-outputs F --latest latest.tsv --out stage3.json
  core-values    --frontend-origin URL [--core-origin URL] --out core.json
  upload-plan    --deployment-inputs F --rendered DIR --label NEW_LABEL --secret-labels DIR --out upload-plan.json
                 (DIR: one list-secret-version-ids --include-deprecated JSON output per material secret, read just before)
  bindings       --deployment-inputs F --foundation-outputs F --private-edge-outputs F --rendered DIR --secret-versions versions.tsv
                 --image-scans scans.json --live-app-template app.live.template.json [--web-search-outputs gw.outputs.json] --out NEW_DIR
  verify-outputs --bindings DIR --app F`;

export async function main(argv=process.argv.slice(2),{out=t=>process.stdout.write(t),err=t=>process.stderr.write(t)}={}){
 const [command,...rest]=argv;
 if(!command||command==='--help'){out(USAGE+'\n');return command?0:2;}
 const a={};
 for(let i=0;i<rest.length;i+=2){if(!rest[i].startsWith('--')||rest[i+1]===undefined){err(USAGE+'\n');return 2;}a[rest[i].slice(2)]=rest[i+1];}
 const need=(...keys)=>{for(const key of keys)if(!a[key])fail(`--${key} is required`);};
 try{
  if(command==='stage3-input'){
   need('deployment-inputs','foundation-outputs','latest','out');
   const deployment=await json(a['deployment-inputs']),roles=deploymentRoles(deployment),revisions=nextRevisions(parseLatestTsv(await readFile(a.latest,'utf8'),{roles}),{roles});
   const stage3=stage3RenderInput({deployment,foundationOutputs:outputsObject(await json(a['foundation-outputs'])),revisions});
   await writeNew(await outsideRepository(a.out),JSON.stringify(stage3,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_INPUT_WRITTEN',out:resolve(a.out),taskDefinitions:stage3.taskDefinitions})+'\n');return 0;
  }
  if(command==='core-values'){
   need('frontend-origin','out');
   for(const key of Object.keys(a))if(!['frontend-origin','core-origin','out'].includes(key))fail('core-values accepts origins only');
   const core=coreValues({frontendOrigin:a['frontend-origin'],...(a['core-origin']?{coreOrigin:a['core-origin']}:{})});
   await writeNew(await outsideRepository(a.out),JSON.stringify(core,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_CORE_VALUES_WRITTEN',out:resolve(a.out)})+'\n');return 0;
  }
  if(command==='upload-plan'){
   need('deployment-inputs','rendered','label','secret-labels','out');
   const rendered=resolve(a.rendered),labels=resolve(a['secret-labels']);
   const deployment=await json(a['deployment-inputs']);
   for(const role of deploymentRoles(deployment))await lstat(join(rendered,role,'bundle.json'));
   const readbacks=await Promise.all((await readdir(labels)).filter(name=>name.endsWith('.json')).sort().map(name=>json(join(labels,name))));
   const plan=uploadPlan({deployment,renderedDirectory:rendered,label:a.label,secretLabels:secretLabelReadback(readbacks)});
   await writeNew(await outsideRepository(a.out),JSON.stringify({schemaVersion:1,label:a.label,roles:plan},null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_UPLOAD_PLAN_WRITTEN',out:resolve(a.out),label:a.label,roles:plan.map(p=>p.role)})+'\n');return 0;
  }
  if(command==='bindings'){
   need('deployment-inputs','foundation-outputs','private-edge-outputs','rendered','secret-versions','image-scans','live-app-template','out');
   const rendered=resolve(a.rendered),renderedExpected={},deployment=await json(a['deployment-inputs']);
   for(const role of deploymentRoles(deployment))renderedExpected[role]=await json(join(rendered,role,'expected.json'));
   // Optional: the gateway stack's own outputs bind public search into control's environment.
   const webSearchOutputs=a['web-search-outputs']===undefined?undefined:outputsObject(await json(a['web-search-outputs']));
   const bindings=buildStage3Bindings({deployment,foundationOutputs:outputsObject(await json(a['foundation-outputs'])),
    privateEdgeOutputs:outputsObject(await json(a['private-edge-outputs'])),renderSummary:await json(join(rendered,'summary.json')),renderedExpected,
    secretVersions:parseVersionsTsv(await readFile(a['secret-versions'],'utf8')),imageScans:await json(a['image-scans']),liveAppTemplate:await json(a['live-app-template']),
    ...(webSearchOutputs===undefined?{}:{webSearchOutputs})});
   const {bodies,sizes}=synthesizeStage3(bindings),dir=await outsideRepository(a.out);
   await mkdir(dir,{recursive:false,mode:0o700});
   for(const key of STAGE3_DEPLOY_ORDER){await writeNew(join(dir,`${key}.binding.json`),JSON.stringify(bindings[key],null,1)+'\n');await writeNew(join(dir,`${key}.template.json`),bodies[key]);}
   const plan={order:[...STAGE3_DEPLOY_ORDER],stacks:deployPlan(sizes,dir),expectedTaskDefinitions:bindings.expectedTaskDefinitions,services:bindings.services};
   await writeNew(join(dir,'deploy-plan.json'),JSON.stringify(plan,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_BINDINGS_WRITTEN',out:dir,...plan})+'\n');return 0;
  }
  if(command==='verify-outputs'){
   need('bindings','app');
   for(const key of Object.keys(a))if(!['bindings','app'].includes(key))fail('verify-outputs accepts the application stack only');
   const plan=await json(join(resolve(a.bindings),'deploy-plan.json'));
   const verified=verifyOutputs({expectedTaskDefinitions:plan.expectedTaskDefinitions,app:outputsObject(await json(a.app))});
   out(JSON.stringify({status:'STAGE3_TASK_DEFINITIONS_MATCH_RENDER',verified})+'\n');return 0;
  }
  fail(`unknown command ${String(command).slice(0,40)}`);
 }catch(error){
  const message=typeof error?.code==='string'&&/^(STAGE3_|RENDER_)/u.test(error.code)?error.message:
   /^PRODUCT_PREVIEW_BINDING_REFUSED$/u.test(error?.message??'')?`STAGE3_TEMPLATE_REFUSED: ${error.message}`:
   typeof error?.code==='string'&&/^E[A-Z]+$/u.test(error.code)?`STAGE3_INPUT_UNREADABLE ${error.code} ${error.path??''}`:
   error instanceof SyntaxError?'STAGE3_INPUT_REFUSED: an input file is not JSON':'STAGE3_REFUSED';
  err(message+'\n');return 2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();

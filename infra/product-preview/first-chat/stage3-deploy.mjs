#!/usr/bin/env node
/** Meri first-chat Stage 3: the data-plumbing steps of docs/shipping/20261017/STAGE3-DEPLOY-RUNBOOK.md. Every AWS mutation stays an
 * explicit command the operator runs; this tool only reads local files, validates and writes local files. It never prints a
 * secret: the identity bearer is referenced by path only, and nothing here reads a material bundle.
 *
 *   stage3-input      latest task-definition ARNs (TSV) -> stage3.json for render-material.mjs --stage3
 *   core-values       Core membership response + bearer path -> core.json for render-material.mjs --core
 *   tenant-budget     core.json -> ECS RunTask overrides that insert the tenant_budgets row as meri_product_migrator
 *   bindings          rendered directory + secret VersionIds -> the three bindings, the three templates and the deploy plan
 *   verify-outputs    deployed stack outputs -> refuses unless every task definition ARN equals the rendered one
 *
 * Exit 0 done; 2 refused (one STAGE3_* line on stderr). Importing this module performs no IO. */
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,join,isAbsolute,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROLES,parseCoreValues,SOURCE_ROOT} from './render-material.mjs';
import {STAGE3_FAMILIES,STAGE3_STACKS,TEMPLATE_BUCKET,nextRevisions,stage3RenderInput,buildStage3Bindings,synthesizeStage3,fail} from './stage3-bindings.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ADMITTED_ROLES=new Set(['standard_user','user_admin','capiro_admin']);
export const CORE_ORIGIN='https://first-chat-preview.app-dev.capiro.ai';
/** apps/gateway/budget/migrations/0002_tenant_budgets.sql row for the first-chat tenant (change set D1: $25, two concurrent runs). */
export const TENANT_BUDGET=Object.freeze({monthlyCapMicroUsd:25000000,maxConcurrentRuns:2});

/** `family<TAB>arn|None` lines (one per family and status) -> {role: [arn...]}. */
export function parseLatestTsv(text){
 const byFamily=Object.fromEntries(Object.entries(STAGE3_FAMILIES).map(([role,family])=>[family,role])),latest={};
 for(const line of text.split(/\r?\n/u).map(l=>l.trim()).filter(Boolean)){
  const [family,arn,...rest]=line.split(/\s+/u);
  if(rest.length||!arn||!Object.hasOwn(byFamily,family))fail(`latest line "${line.slice(0,200)}"`);
  (latest[byFamily[family]]??=[]).push(arn);
 }
 for(const role of Object.keys(STAGE3_FAMILIES))if(!latest[role]||latest[role].length<2)fail(`latest needs the ACTIVE and INACTIVE listing of ${STAGE3_FAMILIES[role]}`);
 return latest;
}

/** Core's membership receipt (apps/control/product-access/membership.mjs shape) -> render core values. Never sees the bearer bytes. */
export function coreValuesFromMembership(membership,{identityCredentialPath,frontendOrigin,clientId,coreOrigin=CORE_ORIGIN,nowMs=Date.now()}){
 const keys=['tenantId','actorId','status','role','permissions','clientIds','membershipRevision','checkedAtMs','expiresAtMs'];
 if(membership===null||typeof membership!=='object'||Array.isArray(membership)||Object.keys(membership).sort().join()!==[...keys].sort().join())fail('membership response shape');
 const m=membership;
 if(m.status!=='active'||!ADMITTED_ROLES.has(m.role))fail('membership is not an active admitted member');
 if(!Array.isArray(m.clientIds)||m.clientIds.some(id=>!UUID.test(id)))fail('membership clientIds');
 if(!Number.isSafeInteger(m.expiresAtMs)||m.expiresAtMs<=Number(m.checkedAtMs)||Number(m.checkedAtMs)>nowMs+300000)fail('membership times');
 const selected=clientId??(m.clientIds.length===1?m.clientIds[0]:null);
 if(!selected)fail(`membership lists ${m.clientIds.length} clients: pass --client-id`);
 if(!m.clientIds.includes(selected))fail('--client-id is not one of the membership clientIds');
 return parseCoreValues({coreOrigin,frontendOrigin,tenantId:m.tenantId,actorId:m.actorId,clientId:selected,identityCredentialPath});
}

/** One-shot program for the Stage 1 migrate task (image /opt/meri, pg under apps/runtime, RDS bundle in the image). It takes the
 * migrator role exactly as first-chat-migrate.mjs's bootstrap does, inserts one row, verifies it and always revokes the SET. */
export const TENANT_BUDGET_PROGRAM=`const {createRequire}=require('node:module');const fs=require('node:fs');
const pg=createRequire('/opt/meri/apps/runtime/package.json')('pg');
const tenant=process.env.MERI_TENANT_ID,cap='${TENANT_BUDGET.monthlyCapMicroUsd}',runs=${TENANT_BUDGET.maxConcurrentRuns};
const log=x=>process.stdout.write(JSON.stringify(x)+'\\n');
(async()=>{
 if(typeof tenant!=='string'||tenant.length<1||tenant.length>128)throw Error('MERI_TENANT_ID');
 if(process.env.PGDATABASE!=='capiro'||!process.env.PGHOST||!process.env.PGUSER||!process.env.PGPASSWORD)throw Error('PG_ENV');
 const c=new pg.Client({host:process.env.PGHOST,port:Number(process.env.PGPORT||'5432'),database:'capiro',user:process.env.PGUSER,password:process.env.PGPASSWORD,
  application_name:'meri-stage3-tenant-budget',connectionTimeoutMillis:10000,ssl:{ca:fs.readFileSync('/opt/meri/certs/rds-global-bundle.pem','utf8'),rejectUnauthorized:true,servername:process.env.PGHOST}});
 await c.connect();let granted=false;
 try{
  await c.query('GRANT meri_product_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE');granted=true;
  await c.query('BEGIN');await c.query('SET LOCAL ROLE meri_product_migrator');
  const ins=await c.query('INSERT INTO meri_product_budget.tenant_budgets (tenant_id, monthly_cap_micro_usd, max_concurrent_runs) VALUES ($1, $2::bigint, $3) ON CONFLICT (tenant_id) DO NOTHING',[tenant,cap,runs]);
  const r=await c.query('SELECT monthly_cap_micro_usd::text AS cap, max_concurrent_runs AS runs FROM meri_product_budget.tenant_budgets WHERE tenant_id = $1',[tenant]);
  if(r.rows.length!==1||r.rows[0].cap!==cap||r.rows[0].runs!==runs)throw Error('MERI_TENANT_BUDGET_CONFLICT');
  await c.query('COMMIT');log({event:'tenant_budget',inserted:ins.rowCount,cap,runs});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}
 finally{if(granted)await c.query('REVOKE meri_product_migrator FROM CURRENT_USER').catch(()=>log({event:'revoke_failed'}));await c.end().catch(()=>{});}
})().catch(e=>{process.stderr.write(JSON.stringify({event:'failed',message:String(e&&e.message).slice(0,200)})+'\\n');process.exit(1);});`;

/** Private readiness probe from the runner's network position (runner SG: 443 to the internal control ALB, 8443 to the proxy, nothing
 * to the owner). It carries no credential: only the public Meri server CA that signs control-private and the proxy server. */
export const PROBE_FAMILY='meri-product-preview-stage3-probe';
export const PROBE_PROGRAM=`const https=require('node:https'),net=require('node:net');
const ca=Buffer.from(process.env.MERI_PROBE_CA_BASE64||'','base64').toString('utf8');
const log=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const get=(host,port,path)=>new Promise(done=>{const r=https.request({host,port,path,method:'GET',servername:host,ca,timeout:8000,headers:{accept:'application/json'}},s=>{let b='';s.setEncoding('utf8');s.on('data',d=>{if(b.length<4096)b+=d;});s.on('end',()=>done({status:s.statusCode,body:b.slice(0,4096)}));});r.on('timeout',()=>r.destroy(Error('TIMEOUT')));r.on('error',e=>done({error:e.code||e.message}));r.end();});
const tcp=(host,port)=>new Promise(done=>{const s=net.connect({host,port,timeout:5000});s.on('connect',()=>{s.destroy();done('connected');});s.on('timeout',()=>{s.destroy();done('timeout');});s.on('error',e=>done(e.code||'error'));});
(async()=>{
 const ready=await get('control.meri-preview.internal',443,'/health/ready');log({check:'control-private-ready',...ready});
 const proxy=await get('proxy.meri.internal',8443,'/health/live');log({check:'proxy-pinned-tls',...proxy});
 log({check:'owner-unreachable-from-runner-sg',result:await tcp('owner.meri.internal',8444)});
 process.exitCode=ready.status===200&&proxy.error===undefined?0:1;
})();`;
export function probeTaskDefinition({deployment,foundationOutputs,renderSummary}){
 const ca=renderSummary?.runnerPoststart?.MERI_POSTSTART_CA_BASE64;
 if(typeof ca!=='string'||!ca)fail('render summary runner poststart CA');
 return {family:PROBE_FAMILY,requiresCompatibilities:['FARGATE'],networkMode:'awsvpc',cpu:'256',memory:'512',
  runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},executionRoleArn:foundationOutputs.RunnerExecutionRoleArn,
  containerDefinitions:[{name:'probe',image:deployment.images.nodeRuntime,essential:true,user:'1000:1000',readonlyRootFilesystem:true,privileged:false,
   linuxParameters:{capabilities:{drop:['ALL']}},entryPoint:['node','-e'],command:[PROBE_PROGRAM],environment:[{name:'MERI_PROBE_CA_BASE64',value:ca}],
   logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':foundationOutputs.RunnerLogGroupName,'awslogs-region':'us-east-1','awslogs-stream-prefix':'stage3-probe','mode':'blocking'}}}]};
}

/** RunTask --overrides for the existing Stage 1 migrate task definition, whose entryPoint is ["/bin/bash","-c"]. */
export function tenantBudgetOverrides(core,{containerName}){
 if(typeof containerName!=='string'||!/^[A-Za-z0-9_-]{1,255}$/u.test(containerName))fail('--container');
 if(typeof core?.tenantId!=='string'||core.tenantId.length<1||core.tenantId.length>128)fail('core.tenantId');
 return {containerOverrides:[{name:containerName,command:[`set -euo pipefail; exec node -e "$MERI_STAGE3_PROGRAM"`],
  environment:[{name:'MERI_TENANT_ID',value:core.tenantId},{name:'MERI_STAGE3_PROGRAM',value:TENANT_BUDGET_PROGRAM}]}]};
}

/** `role<TAB>VersionId` lines from the PutSecretValue loop -> {role: VersionId}. */
export function parseVersionsTsv(text){
 const out={};
 for(const line of text.split(/\r?\n/u).map(l=>l.trim()).filter(Boolean)){
  const [role,version,...rest]=line.split(/\s+/u);
  if(rest.length||!ROLES.includes(role)||Object.hasOwn(out,role))fail(`secret version line for ${String(role).slice(0,40)}`);
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

export function deployPlan(sizes,directory){
 return Object.fromEntries(Object.entries(STAGE3_STACKS).map(([key,stack])=>{
  const file=join(directory,`${key}.template.json`),viaS3=sizes[key].viaS3;
  return [key,{stack,templateFile:file,bytes:sizes[key].bytes,viaS3,
   command:['aws','cloudformation','deploy','--region','us-east-1','--stack-name',stack,'--template-file',file,
    ...(key==='model'?['--capabilities','CAPABILITY_IAM']:[]),...(viaS3?['--s3-bucket',TEMPLATE_BUCKET.bucket,'--s3-prefix',TEMPLATE_BUCKET.prefix]:[]),
    '--no-execute-changeset','--no-fail-on-empty-changeset']}];
 }));
}

/** Refuses unless each stack's task definitions are exactly the revisions the material was rendered for. */
export function verifyOutputs({expectedTaskDefinitions,app,model,issuer}){
 const pairs=[['control',app.ControlTaskDefinitionArn],['temporal-worker',app.TemporalWorkerTaskDefinitionArn],['runner',app.RunnerTaskDefinitionArn],
  ['model-owner',model.ModelOwnerTaskDefinitionArn],['model-proxy',model.ModelProxyTaskDefinitionArn],['temporal-issuer',issuer.TemporalIssuerTaskDefinitionArn]];
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
  core-values    --membership membership.json --identity <bearer file> --frontend-origin URL [--client-id UUID] --out core.json
  tenant-budget  --core core.json --container <migrate container name> --out overrides.json
  bindings       --deployment-inputs F --foundation-outputs F --private-edge-outputs F --rendered DIR --secret-versions versions.tsv
                 --image-scans scans.json --out NEW_DIR
  verify-outputs --bindings DIR --app F --model F --issuer F
  probe-task     --deployment-inputs F --foundation-outputs F --rendered DIR --out probe-task-definition.json`;

export async function main(argv=process.argv.slice(2),{out=t=>process.stdout.write(t),err=t=>process.stderr.write(t)}={}){
 const [command,...rest]=argv;
 if(!command||command==='--help'){out(USAGE+'\n');return command?0:2;}
 const a={};
 for(let i=0;i<rest.length;i+=2){if(!rest[i].startsWith('--')||rest[i+1]===undefined){err(USAGE+'\n');return 2;}a[rest[i].slice(2)]=rest[i+1];}
 const need=(...keys)=>{for(const key of keys)if(!a[key])fail(`--${key} is required`);};
 try{
  if(command==='stage3-input'){
   need('deployment-inputs','foundation-outputs','latest','out');
   const revisions=nextRevisions(parseLatestTsv(await readFile(a.latest,'utf8')));
   const stage3=stage3RenderInput({deployment:await json(a['deployment-inputs']),foundationOutputs:outputsObject(await json(a['foundation-outputs'])),revisions});
   await writeNew(await outsideRepository(a.out),JSON.stringify(stage3,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_INPUT_WRITTEN',out:resolve(a.out),taskDefinitions:stage3.taskDefinitions})+'\n');return 0;
  }
  if(command==='core-values'){
   need('membership','identity','frontend-origin','out');
   const identity=resolve(a.identity);await lstat(identity);
   const core=coreValuesFromMembership(await json(a.membership),{identityCredentialPath:identity,frontendOrigin:a['frontend-origin'],clientId:a['client-id']});
   await writeNew(await outsideRepository(a.out),JSON.stringify(core,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_CORE_VALUES_WRITTEN',out:resolve(a.out),tenantId:core.tenantId,actorId:core.actorId,clientId:core.clientId})+'\n');return 0;
  }
  if(command==='tenant-budget'){
   need('core','container','out');
   const overrides=tenantBudgetOverrides(await json(a.core),{containerName:a.container});
   await writeNew(await outsideRepository(a.out),JSON.stringify(overrides)+'\n');
   out(JSON.stringify({status:'STAGE3_TENANT_BUDGET_OVERRIDES_WRITTEN',out:resolve(a.out),...TENANT_BUDGET})+'\n');return 0;
  }
  if(command==='bindings'){
   need('deployment-inputs','foundation-outputs','private-edge-outputs','rendered','secret-versions','image-scans','out');
   const rendered=resolve(a.rendered),renderedExpected={};
   for(const role of ROLES)renderedExpected[role]=await json(join(rendered,role,'expected.json'));
   const bindings=buildStage3Bindings({deployment:await json(a['deployment-inputs']),foundationOutputs:outputsObject(await json(a['foundation-outputs'])),
    privateEdgeOutputs:outputsObject(await json(a['private-edge-outputs'])),renderSummary:await json(join(rendered,'summary.json')),renderedExpected,
    secretVersions:parseVersionsTsv(await readFile(a['secret-versions'],'utf8')),imageScans:await json(a['image-scans'])});
   const {bodies,sizes}=synthesizeStage3(bindings),dir=await outsideRepository(a.out);
   await mkdir(dir,{recursive:false,mode:0o700});
   for(const key of ['app','model','issuer']){await writeNew(join(dir,`${key}.binding.json`),JSON.stringify(bindings[key],null,1)+'\n');await writeNew(join(dir,`${key}.template.json`),bodies[key]);}
   const plan={stacks:deployPlan(sizes,dir),expectedTaskDefinitions:bindings.expectedTaskDefinitions,services:bindings.services};
   await writeNew(join(dir,'deploy-plan.json'),JSON.stringify(plan,null,1)+'\n');
   out(JSON.stringify({status:'STAGE3_BINDINGS_WRITTEN',out:dir,...plan})+'\n');return 0;
  }
  if(command==='probe-task'){
   need('deployment-inputs','foundation-outputs','rendered','out');
   const definition=probeTaskDefinition({deployment:await json(a['deployment-inputs']),foundationOutputs:outputsObject(await json(a['foundation-outputs'])),renderSummary:await json(join(resolve(a.rendered),'summary.json'))});
   await writeNew(await outsideRepository(a.out),JSON.stringify(definition)+'\n');
   out(JSON.stringify({status:'STAGE3_PROBE_TASK_DEFINITION_WRITTEN',out:resolve(a.out),family:PROBE_FAMILY})+'\n');return 0;
  }
  if(command==='verify-outputs'){
   need('bindings','app','model','issuer');
   const plan=await json(join(resolve(a.bindings),'deploy-plan.json'));
   const verified=verifyOutputs({expectedTaskDefinitions:plan.expectedTaskDefinitions,app:outputsObject(await json(a.app)),model:outputsObject(await json(a.model)),issuer:outputsObject(await json(a.issuer))});
   out(JSON.stringify({status:'STAGE3_TASK_DEFINITIONS_MATCH_RENDER',verified})+'\n');return 0;
  }
  fail(`unknown command ${String(command).slice(0,40)}`);
 }catch(error){
  const message=typeof error?.code==='string'&&/^(STAGE3_|RENDER_)/u.test(error.code)?error.message:
   /^(PRODUCT_PREVIEW|PRODUCT_MODEL_PROXY|FIRST_CHAT_ISSUER)_BINDING_REFUSED$/u.test(error?.message??'')?`STAGE3_TEMPLATE_REFUSED: ${error.message}`:
   typeof error?.code==='string'&&/^E[A-Z]+$/u.test(error.code)?`STAGE3_INPUT_UNREADABLE ${error.code} ${error.path??''}`:
   error instanceof SyntaxError?'STAGE3_INPUT_REFUSED: an input file is not JSON':'STAGE3_REFUSED';
  err(message+'\n');return 2;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();

/** Ship packet on NON-SECRET fixtures: standard synthetic build result and historical runtime values,
 * a synthetic next-foundation runner task role, a deterministic upload
 * plan and a synthetic previous release. No PKI, render, bundle, AWS or network. Both release commits must be in the local clone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAN} from '../first-chat-migrate.mjs';
import {STAGE3_FAMILIES,STAGE3_DEPLOY_ORDER,MATERIAL_SECRET_KEYS,nextRevisions,stage3RenderInput} from './stage3-bindings.mjs';
import {parseLatestTsv,uploadPlan} from './stage3-deploy.mjs';
import {runnerSha256AtCommit} from './render-material.mjs';
import {SCHEMA,planEntries,migrationDelta,buildShipPacket,renderMarkdown,main} from './ship-packet.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const bytes=name=>readFile(join(here,name));
const json=async name=>JSON.parse((await bytes(name)).toString('utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Reviewed sources present in history; all image receipts in this test are synthetic. */
const PREVIOUS_COMMIT='05d588c7c5d6da8b8e8a12ea4d47e16526af1aaf';
const CURRENT_COMMIT='e0b2243e35e5b08bb263868cd03523230363db89';
const LATEST=Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tarn:aws:ecs:us-east-1:967807252336:task-definition/${f}:7`,`${f}\tNone`]).join('\n')+'\n';

async function inputs(){
 const deployment=await json('deployment-inputs.json'),foundationOutputs=await json('foundation-outputs.json');
 // The archived deployment predates PREVIOUS_COMMIT and drops integration entries.
 // Build a forward fixture without rewriting the historical checked-in inputs.
 deployment.images.nodeRuntimeSourceCommit=CURRENT_COMMIT;
 // Canonical image-build.sh result shape. Immutable historical receipts remain historical.
 const receipt={sourceCommit:deployment.images.nodeRuntimeSourceCommit,sourceVersion:'reviewed-source-version',
  imageDigest:deployment.images.nodeRuntime.slice(deployment.images.nodeRuntime.indexOf('@')+1),platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{}};
 const receiptSha256=sha(Buffer.from(JSON.stringify(receipt)));
 // Planned fixture only: the historical live readback is deliberately unchanged.
 foundationOutputs.RunnerTaskRoleArn='arn:aws:iam::967807252336:role/MeriPreview-runner-task';
 const previousDeployment=structuredClone(deployment);
 previousDeployment.images.nodeRuntime=deployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,`@sha256:${'1'.repeat(64)}`);
 previousDeployment.images.nodeRuntimeSourceCommit=PREVIOUS_COMMIT;
 let n=0;
 const plan=entries=>entries.map(e=>({kind:e.kind,source:e.path,sha256:e.pinned,stage:e.stage}));
 const runtime=await json('runtime-values.json');runtime.preparationIntent.runnerSha256=runnerSha256AtCommit(CURRENT_COMMIT);
 return {deployment,previousDeployment,runtime,receipt,receiptSha256,
  imageScans:{nodeRuntime:receiptSha256},stage3:stage3RenderInput({deployment,foundationOutputs,revisions:nextRevisions(parseLatestTsv(LATEST))}),
  upload:{label:'FIRST_CHAT_20261021A',roles:uploadPlan({deployment,renderedDirectory:'/w/rendered',label:'FIRST_CHAT_20261021A',
   secretLabels:Object.fromEntries(Object.values(MATERIAL_SECRET_KEYS).map(key=>[deployment.secrets[key],[{VersionId:'v-current',VersionStages:['AWSCURRENT']}]])),newToken:()=>`token-${++n}`})},
  measuredRunnerSha256:runnerSha256AtCommit(deployment.images.nodeRuntimeSourceCommit),migrations:migrationDelta(plan(PLAN),plan(PLAN)),
  ceilingUsd:5,work:'/w',hashes:{'deployment-inputs':'e'.repeat(64)}};
}

test('the migration plan parses exactly as first-chat-migrate.mjs declares it; the delta allows only appended entries',async()=>{
 const parsed=planEntries((await readFile(join(here,'..','first-chat-migrate.mjs'),'utf8')));
 assert.deepEqual(parsed.map(e=>[e.sha256,e.stage]),PLAN.map(e=>[e.pinned,e.stage]));
 const meri=parsed.filter(e=>e.stage==='meri');
 assert.deepEqual(migrationDelta(parsed,parsed),{previousEntries:parsed.length,currentEntries:parsed.length,added:[],required:false,stages:[],integrationChanged:false});
 assert.equal(migrationDelta(meri.slice(0,-1),meri).required,true,'a new meri-stage entry must be applied before the stacks update');
 const extended=migrationDelta(parsed.slice(0,-1),parsed);
 assert.equal(extended.required,true,'SDK usage requires its integration migration before release');assert.equal(extended.integrationChanged,true);
 assert.deepEqual(extended.stages,['integration']);assert.equal(extended.previousEntries,43);assert.equal(extended.currentEntries,44);
 assert.equal(extended.added[0].sha256,'bc03d9ed37371b0841993f05d86c521c803cb58205f668913a5f0d7eabfde4fe');
 const beforeSdk=migrationDelta(parsed.slice(0,-2),parsed);
 assert.equal(beforeSdk.previousEntries,42);assert.equal(beforeSdk.currentEntries,44);
 assert.deepEqual(beforeSdk.stages,['integration']);
 assert.deepEqual(beforeSdk.added.map(e=>e.sha256),['234433e94a6fbc68ef76b74929f7e3e54fcba1db5d15a396dcaa0f817214933c','bc03d9ed37371b0841993f05d86c521c803cb58205f668913a5f0d7eabfde4fe']);
 assert.deepEqual(migrationDelta([],parsed).stages,['meri','temporal','meri','integration'],'stage order follows contiguous ledger entries, including the second meri stage');
 for(const key of ['sha256','kind','source','stage']){
  const changed=structuredClone(parsed);changed.at(-1)[key]=key==='sha256'?'9'.repeat(64):'changed';
  assert.throws(()=>migrationDelta(parsed,changed),/edits or reorders/u,`integration ${key} is immutable`);
 }
 assert.throws(()=>migrationDelta(parsed,parsed.slice(0,-1)),/drops/u);
 assert.throws(()=>migrationDelta(meri,meri.slice(1)),/drops/u);
 assert.throws(()=>migrationDelta(meri,[meri[1],meri[0],...meri.slice(2)]),/reorders/u);
});

test('packet: pins, evidence, cost limits, ordered steps with gates, rollback and risks from consistent reviewed inputs',async()=>{
 const i=await inputs(),p=buildShipPacket(i);
 assert.equal(p.schema,SCHEMA);assert.equal(p.phase,'pre-upload');assert.match(p.packetSha256,/^[a-f0-9]{64}$/u);
 assert.equal(p.pins.sourceCommit,i.deployment.images.nodeRuntimeSourceCommit);assert.equal(p.pins.previousSourceCommit,PREVIOUS_COMMIT);
 assert.equal(i.receipt.runnerSha256,undefined);assert.equal(p.pins.runnerSha256,i.measuredRunnerSha256);assert.equal(p.pins.label,'FIRST_CHAT_20261021A');
 assert.deepEqual(p.pins.taskDefinitions,i.stage3.taskDefinitions);
 assert.equal(p.evidence.scanStatus,'COMPLETE');assert.equal(p.costLimits.cycleCeilingUsd,5);
 for(const key of ['sourceCommit','sourceVersion','imageDigest','platform'])assert.equal(p.evidence[key],i.receipt[key]);
 for(const key of ['producerBuild','glibcVersion','nodeVersion','archiveSha256','sourceManifestSha256'])assert.equal(Object.hasOwn(p.evidence,key),false,key);
 assert.match(p.costLimits.policySource,/canonical tenant settings/u);assert.equal(p.costLimits.tenantMonthlyCapUsd,undefined);
 assert.deepEqual(p.steps.map(s=>s.id),['readback','migrate','upload','bindings',...STAGE3_DEPLOY_ORDER.map(k=>`deploy-${k}`),'verify']);
 const migration=p.steps.find(s=>s.id==='migrate');
 assert.deepEqual(migration.commands.map(c=>c.argv.at(-1)),['plan'],'an unchanged source still requires full actual-ledger verification');
 assert.match(migration.gate,/all 44 entries applied/u);assert.match(migration.gate,/snapshot and isolated rehearsal/u);
 const upload=p.steps.find(s=>s.id==='upload').commands.filter(c=>c.argv.includes('put-secret-value'));
 assert.equal(upload.length,3);for(const c of upload)assert.equal(c.argv[c.argv.indexOf('--version-stages')+1],'FIRST_CHAT_20261021A');
 const bindings=p.steps.find(s=>s.id==='bindings').commands.at(-1).argv;assert.ok(bindings.includes('--live-app-template'));
 const issuer=p.steps.find(s=>s.id==='deploy-issuer');assert.match(issuer.gate,/continue immediately/u);
 assert.ok(p.steps.find(s=>s.id==='deploy-app').commands.some(c=>c.argv?.includes(i.deployment.privateEdge.controlPrivateTargetGroupArn)));
 assert.deepEqual(p.rollback.images,i.previousDeployment.images);assert.match(p.rollback.rule,/forward redeploy/u);
 assert.ok(p.risks.some(r=>/15 minutes/u.test(r))&&p.risks.some(r=>/certificate validity/u.test(r)));
 // Deterministic: the same inputs give the same packet hash; nothing secret-shaped appears.
 assert.equal(buildShipPacket(await inputs()).packetSha256,p.packetSha256);
 const md=renderMarkdown(p);assert.match(md,/^# Meri first-chat ship packet \(pre-upload\)/u);
 for(const forbidden of ['PRIVATE KEY','"password"','synthetic-'])assert.equal((md+JSON.stringify(p)).includes(forbidden),false,forbidden);
 assert.ok(md.includes("--version-stages FIRST_CHAT_20261021A"));
 assert.match(md,/No new source-plan entries\. This does not prove database completion/u);
});

test('an integration-only source delta reaches the operator packet before uploads',async()=>{
 const i=await inputs(),parsed=planEntries(await readFile(join(here,'..','first-chat-migrate.mjs'),'utf8'));
 i.migrations=migrationDelta(parsed.slice(0,-2),parsed);
 const p=buildShipPacket(i),step=p.steps.find(s=>s.id==='migrate'),md=renderMarkdown(p);
 assert.deepEqual(step.commands.map(c=>c.argv.at(-1)),['plan','integration']);
 assert.match(step.commands[1].note,/earlier stages are pending/u);
 assert.ok(p.steps.indexOf(step)<p.steps.findIndex(s=>s.id==='upload'));
 assert.match(md,/integration: conversation\('0021_sdk_run_usage.sql'\)/u);
 assert.match(md,/integration: conversation\('0022_sdk_run_usage_grants.sql'\)/u);
 assert.match(md,/node infra\/product-preview\/first-chat-migrate.mjs integration/u);
 assert.doesNotMatch(md,/None: the migration plan|stage meri\) before/u);
});

test('packet risks distinguish compatible images, incompatible sessions and unfinished work without claiming live qualification',async()=>{
 const p=buildShipPacket(await inputs()),md=renderMarkdown(p);
 // The release packet must preserve the distinctions enforced by session-continuity.mjs, prepared-candidate.mjs and next-run.mjs.
 const expected=[
  'compatible image replacement: admitted conversations can continue from the latest published checkpoint when SDK, CLI, contracts and checkpoint format are unchanged; fresh authentication and owner, client and policy checks still apply',
  'incompatible SDK or format: changed SDK/CLI refuses checkpoint continuation with NEXT_TURN_SDK_CHANGED; changed contracts/checkpoint format refuses with NEXT_TURN_FORMAT_CHANGED; this packet neither migrates nor seeds an incompatible session',
  'unfinished or in-flight work: fresh issuance can re-prepare an unstarted original, but a started run is never rebound; a successor waits for terminal state and proven retirement/revocation (or proved no-authority), using the latest published checkpoint or a fresh SDK session if none exists, never partial work',
  'continuity statements describe source behavior, not live qualification: restart, reconnect and continuation evidence for these exact source/image/environment pins remains required'
 ];
 assert.deepEqual(p.risks.slice(2,6),expected);
 for(const risk of expected)assert.ok(md.includes(`- ${risk}\n`),'each scenario and qualification caveat reaches the operator packet');
 assert.doesNotMatch(JSON.stringify(p.risks),/every render re-mints grants|conversations admitted under the previous render refuse/u);
 assert.doesNotMatch(md,/every render re-mints grants|conversations admitted under the previous render refuse/u);
});

test('fail closed: image, scan, runner, upload, previous release, ceiling and bindings disagreements refuse',async()=>{
 const refused=async(mutate,pattern)=>{const i=await inputs();mutate(i);assert.throws(()=>buildShipPacket(i),pattern);};
 await refused(i=>{i.receipt.imageDigest=`sha256:${'2'.repeat(64)}`;},/build result/u);
 await refused(i=>{i.receipt.sourceCommit='2'.repeat(40);},/build result/u);
 await refused(i=>{i.receipt.findingSeverityCounts={HIGH:1};},/HIGH findings/u);
 await refused(i=>{i.receipt.scanStatus='IN_PROGRESS';},/not COMPLETE/u);
 await refused(i=>{i.receiptSha256='3'.repeat(64);},/sha256 of the image build result/u);
 await refused(i=>{i.runtime.preparationIntent.runnerSha256='4'.repeat(64);},/runnerSha256/u);
 await refused(i=>{i.measuredRunnerSha256=null;},/fetch it/u);
 await refused(i=>{i.upload.roles[1].secretArn=i.upload.roles[0].secretArn;},/upload plan secret/u);
 await refused(i=>{delete i.upload.roles[2].labelsBefore;},/before-upload label readback/u);
 await refused(i=>{i.upload.roles[2].labelsBefore.push(i.upload.label);},/before-upload label readback/u);
 await refused(i=>{i.previousDeployment.clusterArn='arn:aws:ecs:us-east-1:967807252336:cluster/other';},/only in images/u);
 await refused(i=>{i.previousDeployment.images=structuredClone(i.deployment.images);},/nothing to ship/u);
 await refused(i=>{i.ceilingUsd=0;},/ceiling/u);
 await refused(i=>{i.bindings={plan:{order:['app','model','issuer'],expectedTaskDefinitions:i.stage3.taskDefinitions},templates:{}};},/order/u);
 await refused(i=>{i.bindings={plan:{order:[...STAGE3_DEPLOY_ORDER],expectedTaskDefinitions:{...i.stage3.taskDefinitions,runner:'x'}},templates:{}};},/another runner revision/u);
});

test('standard build result requires all fields, safe immutable source version and numeric scan counts',async()=>{
 const base=await inputs();
 const refused=mutate=>{const i=structuredClone(base);mutate(i);assert.throws(()=>buildShipPacket(i),{code:'SHIP_PACKET_REFUSED'});};
 for(const key of Object.keys(base.receipt))refused(i=>{delete i.receipt[key];});
 for(const receipt of [null,[],false,'result'])refused(i=>{i.receipt=receipt;});
 for(const sourceCommit of ['',12,'A'.repeat(40),'1'.repeat(39)])refused(i=>{i.receipt.sourceCommit=sourceCommit;});
 for(const sourceVersion of ['',null,12,'null','bad version','version\n','version;command','a'.repeat(1025)])refused(i=>{i.receipt.sourceVersion=sourceVersion;});
 for(const imageDigest of ['',null,'sha256:'+'A'.repeat(64),'2'.repeat(64)])refused(i=>{i.receipt.imageDigest=imageDigest;});
 for(const platform of ['',null,'linux/amd64'])refused(i=>{i.receipt.platform=platform;});
 for(const counts of [null,[],false,'0',{HIGH:'0'},{HIGH:null},{HIGH:false},{MEDIUM:-1},{LOW:0.5},{LOW:Number.MAX_SAFE_INTEGER+1}])
  refused(i=>{i.receipt.findingSeverityCounts=counts;});
 for(const severity of ['HIGH','CRITICAL'])refused(i=>{i.receipt.findingSeverityCounts={[severity]:1};});
 for(const receiptSha256 of [undefined,null,'',12,'A'.repeat(64)])refused(i=>{i.receiptSha256=receiptSha256;i.imageScans.nodeRuntime=receiptSha256;});
 const i=structuredClone(base);i.receipt.sourceVersion='Ab_c.~+/=-9';i.receipt.findingSeverityCounts={HIGH:0,CRITICAL:0,MEDIUM:2};
 assert.deepEqual(buildShipPacket(i).evidence.findingSeverityCounts,i.receipt.findingSeverityCounts);
});

test('CLI writes ship-packet.json and SHIP-PACKET.md outside the repository; pre-deploy phase pins the templates',async()=>{
 const i=await inputs(),work=await mkdtemp(join(tmpdir(),'meri-ship-packet-'));
 try{
  const quiet=async argv=>{const lines=[];const code=await main(argv,{out:t=>lines.push(t),err:t=>lines.push(t)});return {code,text:lines.join('')};};
  const write=async(name,value)=>{await writeFile(join(work,name),typeof value==='string'?value:JSON.stringify(value));return join(work,name);};
  const args=['--deployment-inputs',await write('deployment.json',i.deployment),'--previous-deployment-inputs',await write('previous.json',i.previousDeployment),
   '--runtime',await write('runtime.json',i.runtime),'--node-receipt',await write('result.json',i.receipt),'--image-scans',await write('image-scans.json',i.imageScans),
   '--stage3',await write('stage3.json',i.stage3),'--upload-plan',await write('upload-plan.json',i.upload),'--work',work,'--ceiling-usd','5'];
  let r=await quiet([...args,'--out',join(work,'packet')]);
  assert.equal(r.code,0,r.text);assert.match(r.text,/SHIP_PACKET_WRITTEN/u);
  const packet=JSON.parse(await readFile(join(work,'packet','ship-packet.json'),'utf8'));
  assert.equal(packet.phase,'pre-upload');assert.equal(typeof packet.migrations.required,'boolean');
  assert.match(await readFile(join(work,'packet','SHIP-PACKET.md'),'utf8'),new RegExp(packet.packetSha256,'u'));
  // A historical source that drops integration entries is not a compatible rollback.
  const backward=[...args];backward[1]=join(here,'deployment-inputs.json');
  r=await quiet([...backward,'--out',join(work,'backward')]);assert.equal(r.code,2);assert.match(r.text,/drops ledgered entries/u);
  await assert.rejects(readFile(join(work,'backward','ship-packet.json')),{code:'ENOENT'});
  // The CLI hashes actual result bytes, so a changed source version cannot reuse the old scan pin.
  await write('result.json',{...i.receipt,sourceVersion:'another-source-version'});
  r=await quiet([...args,'--out',join(work,'changed-result')]);assert.equal(r.code,2);assert.match(r.text,/sha256 of the image build result/u);
  await assert.rejects(readFile(join(work,'changed-result','ship-packet.json')),{code:'ENOENT'});
  await write('result.json',i.receipt);
  // Pre-deploy: a bindings directory with the deploy plan and two templates.
  await mkdir(join(work,'b'));
  await writeFile(join(work,'b','deploy-plan.json'),JSON.stringify({order:[...STAGE3_DEPLOY_ORDER],expectedTaskDefinitions:i.stage3.taskDefinitions,stacks:{}}));
  for(const key of STAGE3_DEPLOY_ORDER)await writeFile(join(work,'b',`${key}.template.json`),`{"${key}":1}`);
  r=await quiet([...args,'--bindings',join(work,'b'),'--out',join(work,'packet2')]);
  assert.equal(r.code,0,r.text);
  const deploy=JSON.parse(await readFile(join(work,'packet2','ship-packet.json'),'utf8'));
  assert.equal(deploy.phase,'pre-deploy');assert.equal(deploy.pins.templates.app.sha256,sha(Buffer.from('{"app":1}')));
  // Refusals: inside the repository, an existing output, a missing input.
  r=await quiet([...args,'--out',join(here,'packet-should-not-exist')]);assert.equal(r.code,2);assert.match(r.text,/outside the repository/u);
  r=await quiet([...args,'--out',join(work,'packet')]);assert.equal(r.code,2);
  r=await quiet(args.slice(2));assert.equal(r.code,2);assert.match(r.text,/--deployment-inputs is required/u);
  r=await quiet(['--help']);assert.equal(r.code,0);assert.match(r.text,/fresh digest-bound scans before release/u);
 }finally{await rm(work,{recursive:true,force:true});}
});

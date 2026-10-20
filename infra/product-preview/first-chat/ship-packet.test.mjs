/** Ship packet on reviewed NON-SECRET repository inputs only: the committed deployment inputs, N21 producer receipt, scan pins and
 * measured runtime values (a consistent set), a stage3.json built from the committed foundation outputs, a deterministic upload
 * plan and a synthetic previous release. No PKI, render, bundle, AWS or network. Both release commits must be in the local clone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAN} from '../first-chat-migrate.mjs';
import {STAGE3_FAMILIES,STAGE3_DEPLOY_ORDER,nextRevisions,stage3RenderInput} from './stage3-bindings.mjs';
import {parseLatestTsv,uploadPlan} from './stage3-deploy.mjs';
import {runnerSha256AtCommit} from './render-material.mjs';
import {SCHEMA,planEntries,migrationDelta,buildShipPacket,renderMarkdown,main} from './ship-packet.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const bytes=name=>readFile(join(here,name));
const json=async name=>JSON.parse((await bytes(name)).toString('utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
/** A reviewed earlier source commit present in history; its image digest here is synthetic. */
const PREVIOUS_COMMIT='a1876afaeaa59d9da47729487d490cba8cfc9d9c';
const LATEST=Object.values(STAGE3_FAMILIES).flatMap(f=>[`${f}\tarn:aws:ecs:us-east-1:967807252336:task-definition/${f}:7`,`${f}\tNone`]).join('\n')+'\n';

async function inputs(){
 const deployment=await json('deployment-inputs.json'),receiptBytes=await bytes('n21-build-receipt.json'),foundationOutputs=await json('foundation-outputs.json');
 const previousDeployment=structuredClone(deployment);
 previousDeployment.images.nodeRuntime=deployment.images.nodeRuntime.replace(/@sha256:[a-f0-9]{64}$/u,`@sha256:${'1'.repeat(64)}`);
 previousDeployment.images.nodeRuntimeSourceCommit=PREVIOUS_COMMIT;
 let n=0;
 const plan=entries=>entries.map(e=>({kind:e.kind,source:e.path,sha256:e.pinned,stage:e.stage}));
 return {deployment,previousDeployment,runtime:await json('runtime-values.json'),receipt:JSON.parse(receiptBytes.toString('utf8')),receiptSha256:sha(receiptBytes),
  imageScans:await json('image-scans.json'),stage3:stage3RenderInput({deployment,foundationOutputs,revisions:nextRevisions(parseLatestTsv(LATEST))}),
  upload:{label:'FIRST_CHAT_20261021A',roles:uploadPlan({deployment,renderedDirectory:'/w/rendered',label:'FIRST_CHAT_20261021A',newToken:()=>`token-${++n}`})},
  measuredRunnerSha256:runnerSha256AtCommit(deployment.images.nodeRuntimeSourceCommit),migrations:migrationDelta(plan(PLAN),plan(PLAN)),
  ceilingUsd:5,work:'/w',hashes:{'deployment-inputs':'e'.repeat(64)}};
}

test('the migration plan parses exactly as first-chat-migrate.mjs declares it; the delta allows only appended entries',async()=>{
 const parsed=planEntries((await readFile(join(here,'..','first-chat-migrate.mjs'),'utf8')));
 assert.deepEqual(parsed.map(e=>[e.sha256,e.stage]),PLAN.map(e=>[e.pinned,e.stage]));
 const meri=parsed.filter(e=>e.stage==='meri'),integration=parsed.find(e=>e.stage==='integration');
 const ledgered=parsed.filter(e=>e.stage!=='integration').length;
 assert.deepEqual(migrationDelta(parsed,parsed),{previousEntries:ledgered,currentEntries:ledgered,added:[],required:false,integrationChanged:false});
 assert.equal(migrationDelta(meri.slice(0,-1),meri).required,true,'a new meri-stage entry must be applied before the stacks update');
 const extended=migrationDelta(parsed.slice(0,-1),parsed);
 assert.equal(extended.required,false,'integration-stage entries wait for an explicit integration run');assert.equal(extended.integrationChanged,true);
 // An unapplied integration entry may still be revised; a ledgered one may not.
 assert.equal(migrationDelta([...meri,integration],[...meri,{...integration,sha256:'9'.repeat(64)}]).integrationChanged,true);
 assert.throws(()=>migrationDelta(meri,meri.slice(1)),/drops or edits/u);
 assert.throws(()=>migrationDelta(meri,[meri[1],meri[0],...meri.slice(2)]),/reorders/u);
});

test('packet: pins, evidence, cost limits, ordered steps with gates, rollback and risks from consistent reviewed inputs',async()=>{
 const i=await inputs(),p=buildShipPacket(i);
 assert.equal(p.schema,SCHEMA);assert.equal(p.phase,'pre-upload');assert.match(p.packetSha256,/^[a-f0-9]{64}$/u);
 assert.equal(p.pins.sourceCommit,i.deployment.images.nodeRuntimeSourceCommit);assert.equal(p.pins.previousSourceCommit,PREVIOUS_COMMIT);
 assert.equal(p.pins.runnerSha256,i.receipt.runnerSha256);assert.equal(p.pins.label,'FIRST_CHAT_20261021A');
 assert.deepEqual(p.pins.taskDefinitions,i.stage3.taskDefinitions);
 assert.equal(p.evidence.scanStatus,'COMPLETE');assert.equal(p.costLimits.perRunMaxUsd,2);assert.equal(p.costLimits.cycleCeilingUsd,5);
 assert.deepEqual(p.steps.map(s=>s.id),['readback','upload','bindings',...STAGE3_DEPLOY_ORDER.map(k=>`deploy-${k}`),'verify']);
 const upload=p.steps.find(s=>s.id==='upload').commands.filter(c=>c.argv.includes('put-secret-value'));
 assert.equal(upload.length,5);for(const c of upload)assert.equal(c.argv[c.argv.indexOf('--version-stages')+1],'FIRST_CHAT_20261021A');
 const bindings=p.steps.find(s=>s.id==='bindings').commands.at(-1).argv;assert.ok(bindings.includes('--live-app-template'));
 const issuer=p.steps.find(s=>s.id==='deploy-issuer');assert.match(issuer.gate,/continue immediately/u);
 assert.ok(p.steps.find(s=>s.id==='deploy-app').commands.some(c=>c.argv?.includes(i.deployment.privateEdge.controlPrivateTargetGroupArn)));
 assert.deepEqual(p.rollback.images,i.previousDeployment.images);assert.match(p.rollback.rule,/forward redeploy/u);
 assert.ok(p.risks.some(r=>/15 minutes/u.test(r))&&p.risks.some(r=>/7 days/u.test(r)));
 // Deterministic: the same inputs give the same packet hash; nothing secret-shaped appears.
 assert.equal(buildShipPacket(await inputs()).packetSha256,p.packetSha256);
 const md=renderMarkdown(p);assert.match(md,/^# Meri first-chat ship packet \(pre-upload\)/u);
 for(const forbidden of ['PRIVATE KEY','"password"','synthetic-'])assert.equal((md+JSON.stringify(p)).includes(forbidden),false,forbidden);
 assert.ok(md.includes("--version-stages FIRST_CHAT_20261021A"));
});

test('fail closed: image, scan, runner, upload, previous release, ceiling and bindings disagreements refuse',async()=>{
 const refused=async(mutate,pattern)=>{const i=await inputs();mutate(i);assert.throws(()=>buildShipPacket(i),pattern);};
 await refused(i=>{i.receipt.imageDigest=`sha256:${'2'.repeat(64)}`;},/producer receipt/u);
 await refused(i=>{i.receipt.findingSeverityCounts={HIGH:1};},/HIGH findings/u);
 await refused(i=>{i.receipt.scanStatus='IN_PROGRESS';},/not COMPLETE/u);
 await refused(i=>{i.receiptSha256='3'.repeat(64);},/sha256 of the producer receipt/u);
 await refused(i=>{i.runtime.preparationIntent.runnerSha256='4'.repeat(64);},/runnerSha256/u);
 await refused(i=>{i.measuredRunnerSha256=null;},/fetch it/u);
 await refused(i=>{i.upload.roles[1].secretArn=i.upload.roles[0].secretArn;},/upload plan secret/u);
 await refused(i=>{i.previousDeployment.clusterArn='arn:aws:ecs:us-east-1:967807252336:cluster/other';},/only in images/u);
 await refused(i=>{i.previousDeployment.images=structuredClone(i.deployment.images);},/nothing to ship/u);
 await refused(i=>{i.ceilingUsd=0;},/ceiling/u);
 await refused(i=>{i.bindings={plan:{order:['app','model','issuer'],expectedTaskDefinitions:i.stage3.taskDefinitions},templates:{}};},/order/u);
 await refused(i=>{i.bindings={plan:{order:[...STAGE3_DEPLOY_ORDER],expectedTaskDefinitions:{...i.stage3.taskDefinitions,runner:'x'}},templates:{}};},/another runner revision/u);
});

test('CLI writes ship-packet.json and SHIP-PACKET.md outside the repository; pre-deploy phase pins the templates',async()=>{
 const i=await inputs(),work=await mkdtemp(join(tmpdir(),'meri-ship-packet-'));
 try{
  const quiet=async argv=>{const lines=[];const code=await main(argv,{out:t=>lines.push(t),err:t=>lines.push(t)});return {code,text:lines.join('')};};
  const write=async(name,value)=>{await writeFile(join(work,name),typeof value==='string'?value:JSON.stringify(value));return join(work,name);};
  const args=['--deployment-inputs',join(here,'deployment-inputs.json'),'--previous-deployment-inputs',await write('previous.json',i.previousDeployment),
   '--runtime',join(here,'runtime-values.json'),'--node-receipt',join(here,'n21-build-receipt.json'),'--image-scans',join(here,'image-scans.json'),
   '--stage3',await write('stage3.json',i.stage3),'--upload-plan',await write('upload-plan.json',i.upload),'--work',work,'--ceiling-usd','5'];
  let r=await quiet([...args,'--out',join(work,'packet')]);
  assert.equal(r.code,0,r.text);assert.match(r.text,/SHIP_PACKET_WRITTEN/u);
  const packet=JSON.parse(await readFile(join(work,'packet','ship-packet.json'),'utf8'));
  assert.equal(packet.phase,'pre-upload');assert.equal(typeof packet.migrations.required,'boolean');
  assert.match(await readFile(join(work,'packet','SHIP-PACKET.md'),'utf8'),new RegExp(packet.packetSha256,'u'));
  // Pre-deploy: a bindings directory with the deploy plan and three templates.
  await mkdir(join(work,'b'));
  await writeFile(join(work,'b','deploy-plan.json'),JSON.stringify({order:[...STAGE3_DEPLOY_ORDER],expectedTaskDefinitions:i.stage3.taskDefinitions,stacks:{}}));
  for(const key of STAGE3_DEPLOY_ORDER)await writeFile(join(work,'b',`${key}.template.json`),`{"${key}":1}`);
  r=await quiet([...args,'--bindings',join(work,'b'),'--out',join(work,'packet2')]);
  assert.equal(r.code,0,r.text);
  const deploy=JSON.parse(await readFile(join(work,'packet2','ship-packet.json'),'utf8'));
  assert.equal(deploy.phase,'pre-deploy');assert.equal(deploy.pins.templates.model.sha256,sha(Buffer.from('{"model":1}')));
  // Refusals: inside the repository, an existing output, a missing input.
  r=await quiet([...args,'--out',join(here,'packet-should-not-exist')]);assert.equal(r.code,2);assert.match(r.text,/outside the repository/u);
  r=await quiet([...args,'--out',join(work,'packet')]);assert.equal(r.code,2);
  r=await quiet(args.slice(2));assert.equal(r.code,2);assert.match(r.text,/--deployment-inputs is required/u);
 }finally{await rm(work,{recursive:true,force:true});}
});

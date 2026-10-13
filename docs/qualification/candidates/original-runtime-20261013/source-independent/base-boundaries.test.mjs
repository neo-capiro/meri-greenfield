/** Independent base characterization; these refusals are not runtime qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT??resolve(import.meta.dirname,'../../../../..');
const moduleAt=path=>import(pathToFileURL(resolve(root,path)).href);
const catalog=JSON.parse(await readFile(resolve(root,'packages/contracts/retrieval-0.2/catalog.json'),'utf8'));
const {canonicalSha256}=await moduleAt('packages/contracts/validate.mjs');
const contracts=await moduleAt('packages/contracts/retrieval-0.2/validate.mjs');
const {listSkills,selectSkill}=await moduleAt('packages/skills/index.mjs');
const {createRuntimeCatalog}=await moduleAt('apps/gateway/catalog/runtime-catalog.mjs');
const {allocation}=await moduleAt('apps/gateway/budget/tool-budget-binding.mjs');
const {deliveryRecord}=await moduleAt('apps/gateway/budget/tool-invocation-record.mjs');
const catalogSha='27db172a756ba1f5b58eb90a843779b5022e581203b0deca728ca278e8dfe968';
const skill=id=>selectSkill(`quick_skill.${id}`,'1.0.0');
const descriptor=id=>catalog.operations.find(d=>d.operation.id===id);

test('all14 immutable asset pins remain correlated to the exact preservation catalog',()=>{
 assert.equal(canonicalSha256(catalog),catalogSha);assert.equal(listSkills().length,14);
 for(const entry of listSkills()){
  const a=selectSkill(entry.skillId,entry.skillVersion);
  assert.equal(a.pin.catalogSha256,catalogSha);assert.equal(canonicalSha256(a.manifest),a.pin.manifestSha256);
 }
});

for(const id of ['commitments_audit','relationship_brief'])test(`${id}: original selected skill still refuses unavailable sources and has no artifact operation`,()=>{
 const a=skill(id);assert.throws(()=>contracts.assertSkillManifest(a.manifest,catalog),/unavailable operation/u);
 assert(a.manifest.allowedOperations.some(o=>o.id==='query_tasks'&&o.version==='0.2.0'));
 assert(a.manifest.allowedOperations.some(o=>o.id==='query_action_items'&&o.version==='0.2.0'));
 assert(!a.manifest.allowedOperations.some(o=>o.id==='create_word'));
 assert.equal(a.manifest.budgets.maxToolCalls,24);assert.equal(a.manifest.budgets.maxRuntimeSeconds,60);
});

test('canonical runtime exposes no executable base operation even with a handler table',()=>{
 let calls=0;const handlers=new Map(catalog.operations.map(d=>[`${d.operation.id}@${d.operation.version}`,{sourceSha256:'a'.repeat(64),execute:()=>{calls++;}}]));
 const runtime=createRuntimeCatalog({catalogJson:JSON.stringify(catalog),contracts,handlers});
 assert.deepEqual(runtime.discoverable(),[]);assert.equal(runtime.entry({id:'query_tasks',version:'0.2.0'}),null);assert.equal(calls,0);
});

const installation=()=>{
 const c=structuredClone(catalog),d=c.operations.find(d=>d.operation.id==='query_tasks');
 d.availability='enabled';d.qualification='qualified';d.handler={module:'apps/gateway/sources/original-tracking/index.mjs',export:'read_tasks',sourceSha256:'a'.repeat(64)};return c;
};
test('merely stamping preservation metadata qualified is refused by the canonical catalog owner',()=>{
 const c=installation();assert.throws(()=>contracts.assertCatalog(c),/Pending catalog cannot expose an executable handler/u);
 assert.throws(()=>createRuntimeCatalog({catalogJson:JSON.stringify(c),contracts}),/GATEWAY_CONFIGURATION/u);
 assert.equal(canonicalSha256(catalog),catalogSha);
});

test('renaming catalog identity cannot bypass exact canonical resolver descriptor binding',()=>{
 const c=installation();c.catalogId='review.synthetic';contracts.assertCatalog(c);
 const runtime=createRuntimeCatalog({catalogJson:JSON.stringify(c),contracts,handlers:new Map([['query_tasks@0.2.0',{sourceSha256:'a'.repeat(64),execute(){throw Error('must not execute');}}]])});
 assert.throws(()=>runtime.entry({id:'query_tasks',version:'0.2.0'}),/GATEWAY_CONFIGURATION/u);
 assert.equal(descriptor('query_tasks').handler,null);
});

test('original action enumeration identity and authority are distinct from successor projection',()=>{
 const original=descriptor('query_action_items'),successor=descriptor('actions.query');
 assert.deepEqual(original.sourceRequirements,[{sourceId:'action_recommendation',authority:'authoritative',purpose:'enumeration'}]);
 assert.equal(original.aliases.length,0);assert.notDeepEqual(original.sourceRequirements,successor.sourceRequirements);
 assert.notEqual(original.outputSchema.id,successor.outputSchema.id);
});

function allocationValue(){const a=skill('commitments_audit');return {run:{tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002',conversationId:'00000000-0000-4000-8000-000000000003',runId:'00000000-0000-4000-8000-000000000004'},manifest:a.manifest,manifestSha256:a.pin.manifestSha256,catalogSha256:a.pin.catalogSha256,budgets:a.manifest.budgets,schedule:{revision:'a'.repeat(64),expiresAt:'2026-10-13T18:00:00.000Z',operations:a.manifest.allowedOperations.map(operation=>({operation,chargeMicrousd:1}))}};}
test('original budget allocation cannot silently include create_word as a scheduled effect',()=>{
 const a=allocationValue();assert.deepEqual(allocation(JSON.stringify(a)).manifest.allowedOperations,a.manifest.allowedOperations);
 a.schedule.operations.push({operation:{id:'create_word',version:'0.2.0'},chargeMicrousd:1});
 assert.throws(()=>allocation(JSON.stringify(a)),/MANIFEST_OPERATION_MISMATCH/u);
});

test('trusted delivery key is stable but request digest detects altered arguments',()=>{
 const a=allocation(JSON.stringify(allocationValue())),binding={...a.run,attemptId:'00000000-0000-4000-8000-000000000005',workerId:'00000000-0000-4000-8000-000000000006',writerFence:1};
 const context={grantId:'00000000-0000-4000-8000-000000000007',binding,qualificationBinding:{runId:binding.runId,attempt:1,workerArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/00000000000000000000000000000001',fence:1,policyRevision:'b'.repeat(64)},capabilitySha256:'c'.repeat(64),allocationSha256:canonicalSha256(a)};
 const delivery={context,producer:{namespace:'sdk.original.reads',executionId:binding.runId},deliveryId:'00000000-0000-4000-8000-000000000008'},request={operation:{id:'query_tasks',version:'0.2.0'},arguments:{limit:2}};
 const first=deliveryRecord(JSON.stringify(delivery),JSON.stringify(request),a),same=deliveryRecord(JSON.stringify(delivery),JSON.stringify(request),a);
 assert.equal(first.key,same.key);assert.equal(first.rawRequestSha256,same.rawRequestSha256);
 request.arguments.limit=3;const changed=deliveryRecord(JSON.stringify(delivery),JSON.stringify(request),a);
 assert.equal(first.key,changed.key);assert.notEqual(first.rawRequestSha256,changed.rawRequestSha256);
});

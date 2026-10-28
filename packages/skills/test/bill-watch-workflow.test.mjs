/** Local source/SDK discovery only; no model, source, provider or target calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../contracts/validate.mjs';
import {resolveOperationContract,validateShape} from '../../contracts/retrieval-0.2/validate.mjs';
import {inspectStateBillSelector} from '../../contracts/retrieval-0.2/state-bill-identity.mjs';
import catalog from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {selectSkill,listSkills} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';
import {createProfileMounts} from '../../../apps/worker/conversation/capabilities/mounts.mjs';
import {sdkSkillPluginDirectory,prepareRunSkillPlugin,verifySkillPluginTree} from '../../../apps/worker/conversation/capabilities/skill-plugin.mjs';
import {assertCapabilityPolicy} from '../../../apps/worker/conversation/capabilities/policy.mjs';
import {binding,scopes} from '../../../apps/control/conversations/test/store-fixture.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';

const folder=new URL('../originals/bill_watch/1.1.0/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
const prose=await readFile(new URL('SKILL.md',folder),'utf8');
const refs=[{id:'get_client_context',version:'0.3.0'},...['search_tracked_bills','search_congress_bills','get_bill_status','read_bill_text','search_state_bills','get_state_bill_status'].map(id=>({id,version:'0.2.0'}))];
const sha=raw=>createHash('sha256').update(raw).digest('hex');

test('candidate Bill Watch requires current client, federal and state evidence without granting mutations',()=>{
 validateShape('SkillManifest',manifest);
 assert.deepEqual(manifest.allowedOperations,refs);
 assert.deepEqual(manifest.subjectKinds,['client']);
 assert.equal(manifest.prose.sha256,sha(prose));
 assert.equal(manifest.skillVersion,'1.1.0');
 const sources=new Map();
 for(const ref of refs){const descriptor=resolveOperationContract(ref).descriptor;assert.equal(descriptor.sideEffect,'none');assert.equal(descriptor.approvalBoundary,'none');for(const source of descriptor.sourceRequirements)sources.set(source.sourceId,source);}
 assert.deepEqual(manifest.requiredSources,[...sources.values()]);
 assert.deepEqual(manifest.requiredSources.map(source=>source.sourceId),['client_knowledge_profile','tracked_bills','bill_text','federal_legislation','state_legislation','state_status_votes']);
 assert.equal(manifest.completion.negativeClaims,'complete-covered-only');
 assert.equal(manifest.completion.allowDisclosedPartial,true);
 assert.deepEqual(manifest.approval,{mutations:'separate-immutable-proposal',autoCreateTasks:false});
 assert.match(prose,/immutable version `1\.1\.0`/u);
 assert.match(prose,/does not provide immutable state bill text/u);
 assert.match(prose,/inferred facility location or unverified address is not a confirmed state footprint/u);
 assert.match(prose,/not an automatically installed watch/u);
});

test('candidate profile arguments retain selected client/full facility coverage and reject substitution',()=>{
 const ref=refs[0],contract=resolveOperationContract(ref),clientId='71000000-0000-4000-8000-000000000005';
 const request={clientId,section:'facilities',representation:'full',limit:50};
 const context={asOf:'2026-10-27T00:00:00.000Z',clientResolution:{selector:clientId,clientId}};
 const normalized=contract.normalizeInput(request,context);
 assert.deepEqual(normalized.input,{clientId,section:'facilities',afterId:null,limit:50,representation:'full'});
 assert.throws(()=>contract.normalizeInput(request,{...context,clientResolution:{selector:clientId,clientId:'71000000-0000-4000-8000-000000000099'}}));
 assert.throws(()=>contract.normalizeInput({...request,tenantId:'forged'},context));
 const cursor=Buffer.from(JSON.stringify({clientId:'71000000-0000-4000-8000-000000000099',section:'facilities',afterId:'71000000-0000-4000-8000-000000000006'})).toString('base64url');
 assert.throws(()=>contract.normalizeInput({...request,cursor},context));
});

test('candidate state read uses a retained canonical key and preserves designation as a distinct fallback',()=>{
 const contract=resolveOperationContract(refs.at(-1));
 const normalized=contract.normalizeInput({billId:'tx-2025-hb1234'},{});
 assert.deepEqual(normalized.metadata.selector,{kind:'canonical',key:'tx-2025-hb1234'});
 assert.equal(inspectStateBillSelector('TX HB 1234').kind,'designation');
 assert.match(prose,/only with a canonical key returned by that search or a retained authorized source/u);
 assert.match(prose,/never invent a key, substitute an unqualified designation or invoke a designation fallback/u);
 assert.throws(()=>contract.normalizeInput({billId:'tx-2025-hb1234',tenantId:'forged'},{}));
});

test('candidate actual SDK read discovery is narrowed to seven existing operations without compiler or saved-record widening',async()=>{
 const extra=catalog.operations.find(row=>row.operation.id==='read_saved_record').operation;
 const mounts=await createProfileMounts({binding,scopes,policy:assertCapabilityPolicy({generalReads:true,activeReadOperations:[...refs,extra]}),now:Date.now,deadlineMs:Date.now()+10000,skill:manifest});
 const client=new Client({name:'bill-watch-local-proof',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{await mounts.reads.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
  const names=(await client.listTools()).tools.map(tool=>tool.name).sort();
  assert.deepEqual(names,refs.map(ref=>ref.id).sort());
  assert.equal(names.includes('create_word'),false);assert.equal(names.includes('read_saved_record'),false);
 }finally{await client.close();await mounts.reads.close();}
});

test('Bill Watch prior sourced-document pins remain unchanged and explicitly addressable',()=>{
 const pins=[['1.0.0','15eb005afa184bc3773b76d97acdc4605da126a1fc73fd7f7609683a7be48065','ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55'],['1.0.1','3aa78e8d41f7a83bb0499fd96660f875cfde3c29956a7c7bfbf2e34bb9d4d67d','b73c8406c7525a437292ac6055bc60d5f9c1fa6b457158cf45eb125bac18f58c']];
 for(const [version,manifestSha256,proseSha256]of pins){const old=selectSkill('quick_skill.bill_watch',version);assert.equal(canonicalSha256(old.manifest),manifestSha256);assert.equal(sha(old.prose),proseSha256);}
 const old=selectSkill('quick_skill.bill_watch','1.0.1');
 assert.equal(describeSkillPlugin({selection:old.pin}).skills.find(skill=>skill.skillId===old.pin.skillId).skillVersion,'1.0.1');
 assert.throws(()=>describeSkillPlugin({selection:selectSkill('quick_skill.bill_watch','1.0.0').pin}),/SKILL_PLUGIN_SELECTION_REFUSED/u);
});

test('registered successor changes only the explicit default while keeping fourteen original identities',()=>{
 const selected=selectSkill('quick_skill.bill_watch','1.1.0');
 assert.equal(canonicalSha256(selected.manifest),canonicalSha256(manifest));assert.equal(selected.prose,prose);
 assert.equal(new Set(listSkills().map(row=>row.skillId)).size,14);
 const plugin=describeSkillPlugin();assert.equal(plugin.skills.length,14);
 assert.equal(plugin.skills.find(skill=>skill.skillId===selected.pin.skillId).skillVersion,'1.1.0');
 assert.equal(plugin.skills.find(skill=>skill.skillId==='quick_skill.pe_deep_dive').skillVersion,'1.1.0');
 assert.throws(()=>selectSkill('quick_skill.bill_watch','latest'),/SKILL_VERSION_UNAVAILABLE/u);
 assert.throws(()=>describeSkillPlugin({selection:{...selected.pin,proseSha256:'0'.repeat(64)}}),/SKILL_PLUGIN_SELECTION_PIN/u);
});

test('Bill Watch old and new explicit selections materialize distinct exact SDK trees without replacing an existing pin',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-bill-watch-'));
 const unseal=async dir=>{await chmod(dir,0o700);for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await unseal(path);else await chmod(path,0o600);}};
 t.after(async()=>{await unseal(root);await rm(root,{recursive:true,force:true});});
 const old=selectSkill('quick_skill.bill_watch','1.0.1'),current=selectSkill('quick_skill.bill_watch','1.1.0');
 const oldPath=sdkSkillPluginDirectory(root,old.pin),currentPath=sdkSkillPluginDirectory(root,current.pin);
 assert.notEqual(oldPath,currentPath);
 for(const [selection,directory]of [[old,oldPath],[current,currentPath]]){
  const prepared=await prepareRunSkillPlugin(directory,{selection:selection.pin});
  assert.equal(await readFile(join(directory,'skills','meri-bill-watch','SKILL.md'),'utf8'),selection.prose);
  assert.deepEqual(await prepareRunSkillPlugin(directory,{selection:selection.pin}),prepared);
 }
 await assert.rejects(verifySkillPluginTree(oldPath,{selection:current.pin}),/SKILL_PLUGIN_TREE_REFUSED/u);
 assert.equal(await readFile(join(oldPath,'skills','meri-bill-watch','SKILL.md'),'utf8'),old.prose);
 for(const selection of [undefined,selectSkill('quick_skill.mail_history','1.0.0').pin]){
  const directory=sdkSkillPluginDirectory(root,selection);await prepareRunSkillPlugin(directory,{selection});
  await assert.rejects(readFile(join(directory,'skills','meri-bill-watch','SKILL.md'),'utf8'),{code:'ENOENT'});
  await verifySkillPluginTree(directory,{selection});
  assert.equal(describeSkillPlugin({selection,execution:true}).skills.length,13);
 }
 assert.equal(describeSkillPlugin().skills.length,14,'launcher inventory is not unselected execution availability');
 assert.equal(describeSkillPlugin({selection:current.pin,execution:true}).skills.length,14);
 for(const selection of [{skillId:current.pin.skillId,skillVersion:'1.1.0'},{...current.pin,proseSha256:'0'.repeat(64)}])
  assert.throws(()=>sdkSkillPluginDirectory(root,selection),/SKILL_PLUGIN_SELECTION_PIN/u);
});

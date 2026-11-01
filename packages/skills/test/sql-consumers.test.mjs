/** Developer checks for the versioned SQL recipe and real mounted read narrowing; no source/provider calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,chmod,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {selectSkill,listSkills} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';
import catalog from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {sdkSkillPluginDirectory,prepareRunSkillPlugin,verifySkillPluginTree} from '../../../apps/worker/conversation/capabilities/skill-plugin.mjs';
import {createProfileMounts} from '../../../apps/worker/conversation/capabilities/mounts.mjs';
import {assertCapabilityPolicy} from '../../../apps/worker/conversation/capabilities/policy.mjs';
import {binding,scopes} from '../../../apps/control/conversations/test/store-fixture.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {readPromptSentence} from '../../../apps/worker/conversation/reads/options.mjs';
const old=selectSkill('quick_skill.pe_deep_dive','1.0.0'),current=selectSkill('quick_skill.pe_deep_dive','1.1.0');
const unseal=async dir=>{await chmod(dir,0o700);for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await unseal(p);else await chmod(p,0o600);}};

test('Q04: fifteen identities, explicit new default, frozen old PE pin and no implicit version fallback',()=>{
 assert.equal(new Set(listSkills().map(s=>s.skillId)).size,15);
 assert.equal(describeSkillPlugin().skills.length,15);
 assert.deepEqual(describeSkillPlugin().skills.map(s=>s.skillId.replace('quick_skill.','')),['client_changes','commitments_audit','funding_opportunity_match','hearing_watch','mail_history','meeting_prep','pe_deep_dive','portfolio_changes','portfolio_overlap','regulatory_docket_brief','relationship_brief','representation_lookup','research_company','bill_watch','cited_report']);
 assert.equal(describeSkillPlugin().skills.find(s=>s.skillId===old.pin.skillId).skillVersion,'1.1.1');
 assert.equal(describeSkillPlugin({selection:current.pin}).skills.find(s=>s.skillId===old.pin.skillId).skillVersion,'1.1.0');
 assert.equal(describeSkillPlugin({selection:old.pin}).skills.find(s=>s.skillId===old.pin.skillId).skillVersion,'1.0.0');
 assert.equal(old.pin.manifestSha256,'6c39f93daeb9c824cbbd37d0ced433dfa0a14d0454e41bd2ba4d3b0e5f4379d9');
 assert.equal(old.pin.proseSha256,'8032b4dcdf812f0b8ba60de5c5f1c9cc2a633aff6f19b71dcf5feadba83b4d8e');
 assert.equal(old.pin.catalogSha256,'41aed2fc63dc40cafe987ee3059a13b605b7d3796c31f60ed6ca26939954bfcc');
 assert.equal(current.pin.catalogSha256,'56bd5d1eef3de6a36cdd2d73fa39d993f4e17eaad95d4a46024f17035d9d15cf');
 assert.throws(()=>selectSkill(old.pin.skillId,'latest'),/SKILL_VERSION_UNAVAILABLE/);
 assert.throws(()=>describeSkillPlugin({selection:{...old.pin,proseSha256:current.pin.proseSha256}}),/SKILL_PLUGIN_SELECTION_PIN/);
 assert.deepEqual(current.manifest.allowedOperations.slice(2),old.manifest.allowedOperations);
 assert.ok(catalog.operations.some(d=>d.operation.id==='query_global_data'));
 assert.ok(catalog.operations.some(d=>d.operation.id==='list_global_datasets'));
});

test('Q04: old and new selected versions materialize distinct sealed trees and reuse only exact bytes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-q04-'));t.after(async()=>{await unseal(root);await rm(root,{recursive:true,force:true});});
 const oldPath=sdkSkillPluginDirectory(root,old.pin),newPath=sdkSkillPluginDirectory(root,current.pin);assert.notEqual(oldPath,newPath);
 for(const [selection,directory]of [[old,oldPath],[current,newPath]]){
  const prepared=await prepareRunSkillPlugin(directory,{selection:selection.pin});
  assert.equal(await readFile(join(directory,'skills','meri-pe-deep-dive','SKILL.md'),'utf8'),selection.prose);
  assert.deepEqual(await prepareRunSkillPlugin(directory,{selection:selection.pin}),prepared);
 }
 await assert.rejects(verifySkillPluginTree(oldPath,{selection:current.pin}),/SKILL_PLUGIN_TREE_REFUSED/);
 assert.equal(await readFile(join(oldPath,'skills','meri-pe-deep-dive','SKILL.md'),'utf8'),old.prose);
});

for(const selected of [old,current])test(`Q04: ${selected.pin.skillVersion} narrows actual MCP discovery to its own read manifest`,async()=>{
 const activeReadOperations=catalog.operations.filter(d=>['describe_capiro_data','query_capiro_data','read_bill_text','get_pe_budget_timeline','read_saved_record'].includes(d.operation.id)).map(d=>d.operation);
 const mounts=await createProfileMounts({binding,scopes,policy:assertCapabilityPolicy({generalReads:true,activeReadOperations}),now:Date.now,deadlineMs:Date.now()+5000,skill:selected.manifest});
 const client=new Client({name:'q04-developer',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{await mounts.reads.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
  const names=(await client.listTools()).tools.map(t=>t.name).sort();
  assert.deepEqual(names,['get_pe_budget_timeline','read_bill_text',...(selected===current?['describe_capiro_data','query_capiro_data']:[])].sort());
  const prompt=readPromptSentence(true,mounts.reads.sdkOptions.allowedTools);assert.equal(prompt.includes('describe_capiro_data'),selected===current);
  assert.equal(prompt.includes('Use read_saved_record'),false);
 }finally{await client.close();await mounts.reads.close();}
});

test('Q04: ordinary guidance uses only mounted tools, preserves partial coverage and client boundaries',()=>{
 const prefix='mcp__meri_reads__',tools=['describe_capiro_data','query_capiro_data','read_saved_record','read_saved_strategy_records'].map(n=>prefix+n);
 const prompt=readPromptSentence(true,tools);for(const word of ['describe_capiro_data once per conversation and then query_capiro_data','client_records','never switch to another source','say which path you used','General-only','exact client and parent'])assert.ok(prompt.includes(word),word);
 assert.equal(readPromptSentence(false,tools),`Capiro's data is not connected in this conversation: tell the user so in their own terms and answer from general knowledge with that caveat. Never quote internal words such as bounded, read-disabled, UNAVAILABLE, tool or activity to the user, and never recommend a third-party API or scraping as a workaround.`);
 assert.doesNotMatch(readPromptSentence(true,[prefix+'query_capiro_data']),/Structured questions about Capiro data/);
});

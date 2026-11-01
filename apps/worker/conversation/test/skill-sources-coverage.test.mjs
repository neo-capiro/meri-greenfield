/** Admission gates a selected skill's sources against the general-read families only for the plugin-path skills, which read through
 * the general `meri_reads` server. Every such installed manifest must declare only required sources some general-read family can
 * cover; a recipe with its own document compiler reads through the selected skill server and is outside this gate (Cited Report
 * covers `artifact_versions` only through `create_word`, which no general-read family offers). */
import test from 'node:test';import assert from 'node:assert/strict';
import {unavailableSkillSources} from '../../../../packages/contracts/selected-skills/sources.mjs';
import {selectSkill,listSkills,documentCompiler} from '../../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {familyReads} from '../reads/availability.mjs';
const generalReads=familyReads().map(row=>row.operation);
/** Admission admits a selection only when the SDK plugin describes it (admission.mjs selectionReceipt); the pre-compiler Bill Watch 1.0.x pins have no SDK frontmatter and are not admissible at all. */
const admissible=pin=>{try{return describeSkillPlugin({selection:selectSkill(pin.skillId,pin.skillVersion).pin}).skills.some(s=>s.skillId===pin.skillId&&s.skillVersion===pin.skillVersion);}catch{return false;}};
const general=manifest=>manifest.allowedOperations.filter(op=>generalReads.some(row=>row.id===op.id&&row.version===op.version));
test('every admissible plugin-path manifest is admitted when its general reads are available, and only Bill Watch 1.0.1 keeps a source outside the gate',()=>{
 const plugin=listSkills().filter(pin=>documentCompiler(pin)===null),described=plugin.filter(admissible);assert.ok(described.length>0);
 assert.deepEqual(plugin.filter(pin=>!admissible(pin)).map(pin=>`${pin.skillId}@${pin.skillVersion}`),['quick_skill.bill_watch@1.0.0'],'the pre-compiler pin without SDK frontmatter is not admissible at all');
 const outside=[];
 for(const pin of described){const {manifest}=selectSkill(pin.skillId,pin.skillVersion),reads=general(manifest);
  assert.deepEqual(unavailableSkillSources(manifest,reads,reads),[],`${pin.skillId}@${pin.skillVersion} with every general read available`);
  const gated=new Set(unavailableSkillSources(manifest,[],reads));for(const {sourceId} of manifest.requiredSources)if(!gated.has(sourceId))outside.push(`${pin.skillId}@${pin.skillVersion}:${sourceId}`);}
 assert.deepEqual(outside,['quick_skill.bill_watch@1.0.1:artifact_versions'],'a required source read only by a non-general operation (create_word) is outside the general-read gate');
});
test('the compiler-path recipes are exactly the four with a document compiler, and Cited Report would be refused by the general-read rule alone',()=>{
 const compiled=[...new Set(listSkills().filter(pin=>documentCompiler(pin)!==null).map(pin=>pin.skillId))].sort();
 assert.deepEqual(compiled,['quick_skill.bill_watch','quick_skill.cited_report','quick_skill.commitments_audit','quick_skill.relationship_brief']);
 const cited=selectSkill('quick_skill.cited_report','1.0.1').manifest;
 assert.deepEqual(unavailableSkillSources(cited,cited.allowedOperations.filter(op=>generalReads.some(row=>row.id===op.id&&row.version===op.version))),['artifact_versions']);
});

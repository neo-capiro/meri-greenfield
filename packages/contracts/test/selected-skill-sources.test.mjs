/** The one rule control admission and the worker share: a required source is unavailable when none of the manifest's allowed
 * operations that read it is available. Pure over the installed manifests and the catalog; no gateway, policy or run. */
import test from 'node:test';import assert from 'node:assert/strict';
import {unavailableSkillSources} from '../selected-skills/sources.mjs';
import {selectSkill,listSkills} from '../../skills/index.mjs';
const mail=selectSkill('quick_skill.mail_history','1.0.1').manifest;
test('Mail History: every required source is covered by its allowed operations; losing all mail reads names only mail',()=>{
 assert.deepEqual(mail.requiredSources.map(s=>s.sourceId),['entity_candidates','tenant_contacts','mail']);
 assert.deepEqual(unavailableSkillSources(mail,mail.allowedOperations),[]);
 assert.deepEqual(unavailableSkillSources(mail,mail.allowedOperations.filter(o=>!o.id.startsWith('mail.'))),['mail']);
 assert.deepEqual(unavailableSkillSources(mail,mail.allowedOperations.filter(o=>o.id!=='mail.list_messages')),[],'one remaining mail read still covers the mail source');
 assert.deepEqual(unavailableSkillSources(mail,[]),['entity_candidates','tenant_contacts','mail']);
 assert.ok(Object.isFrozen(unavailableSkillSources(mail,[])));
});
test('an operation the manifest does not allow never covers a source, and a version mismatch is a different operation',()=>{
 assert.deepEqual(unavailableSkillSources(mail,[{id:'mail.search_messages',version:'9.9.9'},{id:'search_public_web',version:'0.2.0'}]),['entity_candidates','tenant_contacts','mail']);
});
test('the considered operations bound the question: a source read only outside them is not this gate\u2019s to refuse',()=>{
 const billWatch=selectSkill('quick_skill.bill_watch','1.0.1').manifest,reads=billWatch.allowedOperations.filter(op=>op.id!=='create_word');
 assert.deepEqual(unavailableSkillSources(billWatch,[]),billWatch.requiredSources.map(s=>s.sourceId),'over every allowed operation, nothing available leaves every source uncovered');
 assert.deepEqual(unavailableSkillSources(billWatch,reads,reads),[],'artifact_versions is read only by create_word, outside the considered reads');
 assert.deepEqual(unavailableSkillSources(billWatch,[],reads),billWatch.requiredSources.map(s=>s.sourceId).filter(id=>id!=='artifact_versions'),'nothing available leaves every considered source uncovered');
 assert.deepEqual(unavailableSkillSources(mail,[],[{id:'search_public_web',version:'0.2.0'}]),[],'a considered operation the manifest does not allow decides nothing');
});
test('a compiler-path recipe covers a required source only through a non-general operation: the rule alone would refuse it',()=>{
 const cited=selectSkill('quick_skill.cited_report','1.0.1').manifest;
 assert.deepEqual(unavailableSkillSources(cited,cited.allowedOperations.filter(op=>op.id!=='create_word')),['artifact_versions'],'artifact_versions is read only by create_word, which no general-read family offers');
 assert.ok(listSkills().length>0);
});

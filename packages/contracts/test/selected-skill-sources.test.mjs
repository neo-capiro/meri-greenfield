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
test('every installed manifest declares only required sources its allowed operations can cover',()=>{
 for(const {skillId,skillVersion} of listSkills()){const {manifest}=selectSkill(skillId,skillVersion);
  assert.deepEqual(unavailableSkillSources(manifest,manifest.allowedOperations),[],`${skillId}@${skillVersion}`);}
});

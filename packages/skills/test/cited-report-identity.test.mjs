/** Focused identity tests for the additive 0.3.0 receiver. They prove three things and nothing more:
 * the new identity is installed and selectable; the closed 0.2.0 foundation and every original byte it
 * already published are unchanged, so an old archive/consumer still refuses an identity it does not know;
 * and the original fourteen launcher identities keep their own pins and their own SDK admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {selectSkill,listSkills} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';
import {validateShape} from '../../contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../contracts/validate.mjs';
import {addedSkillIdentity,assertAddedSkillManifest,skillIdentityExtension} from '../../contracts/retrieval-0.3/validate.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Pins published at HEAD before this identity was added: they must not move. */
const FROZEN={installationCatalogSha256:'1f901f26ec134e1585ff12541c3344fda77da1fb07f599f8d59e9338ecaa6eb6',
 'quick_skill.bill_watch@1.0.0':['15eb005afa184bc3773b76d97acdc4605da126a1fc73fd7f7609683a7be48065','ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55'],
 'quick_skill.bill_watch@1.0.1':['3aa78e8d41f7a83bb0499fd96660f875cfde3c29956a7c7bfbf2e34bb9d4d67d','b73c8406c7525a437292ac6055bc60d5f9c1fa6b457158cf45eb125bac18f58c'],
 'quick_skill.bill_watch@1.1.0':['d8c3f776a56f7a67ff2d0fb2fae4a2704e5bd45173ee2c2200232a41085b875e','e24b8793dc674f76eff3eb55b61cd76198a4ddde146ff723af4a0787da0f7e1a'],
 'quick_skill.bill_watch@2.0.0':['7e00e11aa4606a5f5277dfd58913c11fe87ef6f069d5d1ad22911de69c83593b','8767442316ed7c1a318ba091026eff84ad0ad0a575beab22c1800bac5fa24d3a'],
 'quick_skill.research_company@1.0.1':['89d0dd5bf0e773e27b4f3e006b14d7cd4223cb981f9ee68ffffaadbef4cb41a9','9139d0bed0bb1919386dd26c0407ad2e8e10303865a0c52a418cc6beb3c42929'],
 'quick_skill.regulatory_docket_brief@1.0.1':['8c68e30969cdee09f8fac0b6b7c6a85167704d4538ad612392edec4e6933027a','413fe92d76e3e68282906fc93412e3f06afec07e2cb1e321e8df038e36d86c4e']};
const CLOSED='quick_skill.research_company,quick_skill.relationship_brief,quick_skill.client_changes,quick_skill.portfolio_changes,quick_skill.portfolio_overlap,quick_skill.mail_history,quick_skill.meeting_prep,quick_skill.commitments_audit,quick_skill.funding_opportunity_match,quick_skill.pe_deep_dive,quick_skill.bill_watch,quick_skill.hearing_watch,quick_skill.representation_lookup,quick_skill.regulatory_docket_brief'.split(',');

test('the closed 0.2.0 foundation is unchanged and still refuses the new identity',()=>{
 const closed=read('../../contracts/retrieval-0.2/skill.schema.json');
 assert.equal(closed.$id,'urn:meri:retrieval:skill:0.2.0');
 assert.deepEqual([...closed.$defs.SkillManifest.properties.skillId.enum],CLOSED,'the 0.2.0 foundation still enumerates exactly the original fourteen');
 for(const name of ['SkillInvocation','SkillManifest','PinnedSkill'])assert.deepEqual([...closed.$defs[name].properties.skillId.enum],CLOSED,`${name} ids are unchanged`);
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.throws(()=>validateShape('SkillManifest',installed.manifest),/must be equal to one of the allowed values/u,'an old 0.2.0 consumer still refuses the added identity');
 assert.equal(installed.pin.catalogSha256,FROZEN.installationCatalogSha256,'the closed 0.2.0 catalog pin is unchanged');
 assert.equal(listSkills().length,19);
});

test('the 0.3.0 receiver adds exactly one identity and nothing else',()=>{
 const leaf=read('../../contracts/retrieval-0.3/skill-identity.schema.json');
 assert.equal(leaf.$id,'urn:meri:retrieval:skill-identity:0.3.0');
 assert.deepEqual([...leaf.$defs.AddedSkillId.enum],['quick_skill.cited_report']);
 assert.deepEqual([...leaf.$defs.SkillId.enum],CLOSED.concat('quick_skill.cited_report'),'the receiver is the closed set plus exactly one id');
 assert.equal(leaf.$defs.SkillId.enum.length,CLOSED.length+1);
 assert.deepEqual(skillIdentityExtension.added,['quick_skill.cited_report']);
 assert.equal(skillIdentityExtension.ids.length,15);
 assert.ok(addedSkillIdentity('quick_skill.cited_report'));
 for(const id of CLOSED)assert.ok(!addedSkillIdentity(id),`${id} keeps the frozen path, not the additive receiver`);
 assert.throws(()=>assertAddedSkillManifest({skillId:'quick_skill.other',skillVersion:'1.0.0'}),/not an added 0.3.0 identity/u);
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.equal(assertAddedSkillManifest(installed.manifest),installed.manifest);
 assert.throws(()=>assertAddedSkillManifest({...installed.manifest,contractVersion:'9.9.9'}),/SkillManifest/u,'the receiver keeps the 0.2.0 contract version');
 assert.throws(()=>assertAddedSkillManifest({...installed.manifest,skillId:'quick_skill.unknown_report'}),/not an added 0.3.0 identity/u);
 assert.throws(()=>selectSkill('quick_skill.cited_report','2.0.0'),/SKILL_VERSION_UNAVAILABLE/u,'no latest-version fallback');
});

test('the installed identity is selectable, launchable and pinned to its own prose',()=>{
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.equal(installed.pin.skillId,'quick_skill.cited_report');assert.equal(installed.pin.skillVersion,'1.0.0');
 assert.equal(installed.pin.catalogSha256,FROZEN.installationCatalogSha256);
 assert.equal(installed.pin.manifestSha256,canonicalSha256(read('../../../apps/control/document-application/cited-report/manifest.json')));
 assert.equal(installed.pin.proseSha256,digest(readFileSync(new URL('../../../apps/control/document-application/cited-report/SKILL.md',import.meta.url))));
 assert.deepEqual([...installed.manifest.subjectKinds],['client','portfolio','personal']);
 assert.equal(installed.manifest.prose.id,'urn:meri:original:general-cited-report:1.0.0');
 const plugin=describeSkillPlugin(),cited=plugin.skills.filter(skill=>skill.skillId==='quick_skill.cited_report');
 assert.equal(plugin.skills.length,15);assert.deepEqual(cited,[{skillId:'quick_skill.cited_report',skillVersion:'1.0.0',name:'meri-cited-report',proseSha256:installed.pin.proseSha256}]);
 assert.equal(new Set(plugin.skills.map(skill=>skill.name)).size,15,'no launcher name collision');
 assert.deepEqual(plugin.skills.filter(skill=>skill.skillId==='quick_skill.bill_watch'),[{skillId:'quick_skill.bill_watch',skillVersion:'1.1.0',name:'meri-bill-watch',proseSha256:FROZEN['quick_skill.bill_watch@1.1.0'][1]}],'Bill1.1 keeps its own version, name and prose');
 assert.deepEqual(plugin.excluded,[
  {skillId:'quick_skill.bill_watch',skillVersion:'1.0.0',reason:'NO_SDK_FRONTMATTER'},
  {skillId:'quick_skill.pe_deep_dive',skillVersion:'1.0.0',reason:'NOT_SELECTED_SDK_VERSION'},
  {skillId:'quick_skill.bill_watch',skillVersion:'1.0.1',reason:'NOT_SELECTED_SDK_VERSION'},
  {skillId:'quick_skill.bill_watch',skillVersion:'2.0.0',reason:'NOT_SELECTED_SDK_VERSION'}],'the original exclusions are unchanged');
 const selected=describeSkillPlugin({selection:installed.pin});
 assert.equal(selected.skills.filter(skill=>skill.skillId==='quick_skill.cited_report').length,1);
 assert.equal(selected.skills.length,15);
 assert.deepEqual(selected.skills.filter(skill=>skill.skillId==='quick_skill.bill_watch'),[{skillId:'quick_skill.bill_watch',skillVersion:'1.1.0',name:'meri-bill-watch',proseSha256:FROZEN['quick_skill.bill_watch@1.1.0'][1]}]);
});

test('every published original pin is byte-unchanged',()=>{
 const rows=new Map(listSkills().map(row=>[`${row.skillId}@${row.skillVersion}`,row]));
 for(const [identity,[manifestSha256,proseSha256]]of Object.entries(FROZEN)){
  if(identity==='installationCatalogSha256')continue;
  const row=rows.get(identity);
  assert.ok(row,`${identity} is still published`);
  assert.equal(row.manifestSha256,manifestSha256,`${identity} manifest bytes unchanged`);
  assert.equal(row.proseSha256,proseSha256,`${identity} prose bytes unchanged`);
 }
 assert.equal(rows.size,19);
 assert.equal(new Set([...rows.keys()].map(key=>key.split('@')[0])).size,15,'the fourteen original ids plus exactly one added id');
 for(const id of CLOSED)assert.ok([...rows.keys()].some(key=>key.startsWith(id+'@')),`${id} is still published`);
});

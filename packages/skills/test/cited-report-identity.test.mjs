/** Focused identity/version tests for the versioned 0.3.0 admission. They prove four things and nothing more:
 * the new identity is installed and selectable at its own manifest contract version; admission is dispatched on
 * the contract version a manifest actually declares, so a new identity can never be smuggled into the closed
 * 0.2.0 family and an unknown version or identity is refused; the closed 0.2.0 foundation bytes and every
 * original published pin are unchanged; and the original fourteen launcher identities keep their own names. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {selectSkill,listSkills} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';
import {validateShape,assertCatalog} from '../../contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../contracts/validate.mjs';
import {assertInstalledSkillManifest,assertVersionedSkillManifest,assertInstalledSkillCatalog,installedSkillContractVersion,
 addedSkillIdentity,FROZEN_SKILL_CONTRACT_VERSION,ADDED_SKILL_CONTRACT_VERSION,installedSkillReceiver} from '../../contracts/retrieval-0.3/installed-skill.mjs';
import catalog from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const bytes=path=>readFileSync(new URL(path,import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
const CLOSED='quick_skill.research_company,quick_skill.relationship_brief,quick_skill.client_changes,quick_skill.portfolio_changes,quick_skill.portfolio_overlap,quick_skill.mail_history,quick_skill.meeting_prep,quick_skill.commitments_audit,quick_skill.funding_opportunity_match,quick_skill.pe_deep_dive,quick_skill.bill_watch,quick_skill.hearing_watch,quick_skill.representation_lookup,quick_skill.regulatory_docket_brief'.split(',');
/** Pins and bytes published at HEAD before this identity was added: they must not move. */
const FROZEN={installationCatalogSha256:'1f901f26ec134e1585ff12541c3344fda77da1fb07f599f8d59e9338ecaa6eb6',
 'skill.schema.json':'146a78397cf72fbb899769fe23a83ab609fd8d67803f543ab5a76dba7a37ee7e',
 'quick_skill.bill_watch@1.0.0':['15eb005afa184bc3773b76d97acdc4605da126a1fc73fd7f7609683a7be48065','ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55'],
 'quick_skill.bill_watch@1.0.1':['3aa78e8d41f7a83bb0499fd96660f875cfde3c29956a7c7bfbf2e34bb9d4d67d','b73c8406c7525a437292ac6055bc60d5f9c1fa6b457158cf45eb125bac18f58c'],
 'quick_skill.bill_watch@1.1.0':['d8c3f776a56f7a67ff2d0fb2fae4a2704e5bd45173ee2c2200232a41085b875e','e24b8793dc674f76eff3eb55b61cd76198a4ddde146ff723af4a0787da0f7e1a'],
 'quick_skill.bill_watch@2.0.0':['7e00e11aa4606a5f5277dfd58913c11fe87ef6f069d5d1ad22911de69c83593b','8767442316ed7c1a318ba091026eff84ad0ad0a575beab22c1800bac5fa24d3a'],
 'quick_skill.research_company@1.0.1':['89d0dd5bf0e773e27b4f3e006b14d7cd4223cb981f9ee68ffffaadbef4cb41a9','9139d0bed0bb1919386dd26c0407ad2e8e10303865a0c52a418cc6beb3c42929'],
 'quick_skill.regulatory_docket_brief@1.0.1':['8c68e30969cdee09f8fac0b6b7c6a85167704d4538ad612392edec4e6933027a','413fe92d76e3e68282906fc93412e3f06afec07e2cb1e321e8df038e36d86c4e']};
const citedReportManifest=()=>read('../../../apps/control/document-application/cited-report/manifest.json');

test('the closed 0.2.0 foundation is byte-unchanged and still refuses the new identity',()=>{
 const closed=read('../../contracts/retrieval-0.2/skill.schema.json');
 assert.equal(closed.$id,'urn:meri:retrieval:skill:0.2.0');
 assert.equal(digest(bytes('../../contracts/retrieval-0.2/skill.schema.json')),FROZEN['skill.schema.json'],'the frozen foundation bytes are untouched');
 assert.deepEqual([...closed.$defs.SkillManifest.properties.skillId.enum],CLOSED,'the 0.2.0 foundation still enumerates exactly the original fourteen');
 for(const name of ['SkillInvocation','SkillManifest','PinnedSkill'])assert.deepEqual([...closed.$defs[name].properties.skillId.enum],CLOSED,`${name} ids are unchanged`);
 assert.equal(closed.$defs.SkillManifest.properties.contractVersion.const,'0.2.0');
 assertCatalog(catalog);
 assert.equal(canonicalSha256(catalog),FROZEN.installationCatalogSha256,'the closed 0.2.0 catalog pin is unchanged');
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.throws(()=>validateShape('SkillManifest',installed.manifest),/must be equal to one of the allowed values/u,'an old 0.2.0 consumer still refuses the added identity');
 assert.equal(listSkills().length,19);
});

test('the 0.3.0 receiver is versioned, minimal and composes the frozen shape instead of copying it',()=>{
 const receiver=read('../../contracts/retrieval-0.3/skill-manifest.schema.json');
 assert.equal(receiver.$id,'urn:meri:retrieval:skill-manifest:0.3.0');
 assert.equal(receiver['x-contractVersion'],'0.3.0');
 assert.equal(receiver['x-composes'],'urn:meri:retrieval:skill:0.2.0#/$defs/SkillManifest');
 assert.deepEqual([...receiver.$defs.AddedSkillId.enum],['quick_skill.cited_report'],'this version adds exactly one identity');
 assert.deepEqual(installedSkillReceiver,{id:'urn:meri:retrieval:skill-manifest:0.3.0',composes:'urn:meri:retrieval:skill:0.2.0#/$defs/SkillManifest',version:'0.3.0',added:['quick_skill.cited_report']});
 assert.equal(FROZEN_SKILL_CONTRACT_VERSION,'0.2.0');assert.equal(ADDED_SKILL_CONTRACT_VERSION,'0.3.0');
 assert.equal(installedSkillContractVersion(citedReportManifest()),'0.3.0');
 assert.equal(installedSkillContractVersion(selectSkill('quick_skill.bill_watch','2.0.0').manifest),'0.2.0');
 assert.ok(addedSkillIdentity('quick_skill.cited_report'));
 for(const id of CLOSED)assert.ok(!addedSkillIdentity(id),`${id} keeps the frozen path, not the additive receiver`);
 assert.equal(installedSkillContractVersion(null),undefined);assert.equal(installedSkillContractVersion([]),undefined);
});

test('admission follows the declared contract version, never the identity alone',()=>{
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.equal(assertInstalledSkillManifest(installed.manifest,catalog),installed.manifest);
 assert.equal(assertVersionedSkillManifest(installed.manifest),installed.manifest);
 // 0.2.0 keeps its own shape: a new identity smuggled into it is refused, not accepted by version semantics.
 assert.throws(()=>assertInstalledSkillManifest({...installed.manifest,contractVersion:'0.2.0'},catalog),/SkillManifest/u);
 // 0.3.0 enumerates only the identities it adds, so an original id at 0.3.0 is refused.
 assert.throws(()=>assertInstalledSkillManifest({...installed.manifest,skillId:'quick_skill.bill_watch'},catalog),/not an installed 0.3.0 identity/u);
 assert.throws(()=>assertVersionedSkillManifest({...installed.manifest,skillId:'quick_skill.unknown_report'}),/not an installed 0.3.0 identity/u);
 // An unknown or missing contract version is refused rather than coerced into either family.
 for(const contractVersion of ['0.4.0','0.1.0','',null,undefined]){
  assert.throws(()=>assertInstalledSkillManifest({...installed.manifest,contractVersion},catalog),/SKILL_MANIFEST_CONTRACT_VERSION/u);
  assert.throws(()=>assertInstalledSkillManifest({contractVersion},catalog),/SKILL_MANIFEST_CONTRACT_VERSION/u);
 }
 // The versioned receiver is still the full manifest shape, not a looser one.
 assert.throws(()=>assertVersionedSkillManifest({contractVersion:'0.3.0',skillId:'quick_skill.cited_report'}),/required property/u);
 assert.throws(()=>assertInstalledSkillManifest(undefined,catalog),/SKILL_MANIFEST_CONTRACT_VERSION/u);
});

test('the shared catalog consistency rules refuse an unknown operation, a wrong version and an unbacked source',()=>{
 const installed=citedReportManifest();
 const clone=()=>structuredClone(installed);
 const wrongVersion=clone();wrongVersion.allowedOperations[0]={id:'mail.read_thread',version:'9.9.9'};
 assert.throws(()=>assertInstalledSkillManifest(wrongVersion,catalog),/SKILL_OPERATION_PIN/u);
 const unknownOperation=clone();unknownOperation.allowedOperations[0]={id:'mail.read_everything',version:'0.2.0'};
 assert.throws(()=>assertInstalledSkillManifest(unknownOperation,catalog),/SKILL_OPERATION_PIN/u);
 const duplicatedOperation=clone();duplicatedOperation.allowedOperations[1]=duplicatedOperation.allowedOperations[0];
 assert.throws(()=>assertInstalledSkillManifest(duplicatedOperation,catalog),/SKILL_OPERATION_PIN|must NOT have duplicate items/u);
 const unbackedSource=clone();unbackedSource.requiredSources[0]={sourceId:'client_knowledge_search',authority:'derived',purpose:'evidence'};
 assert.throws(()=>assertInstalledSkillManifest(unbackedSource,catalog),/SKILL_SOURCE_PIN/u,'a source no allowed operation declares is refused');
 const duplicatedSource=clone();duplicatedSource.requiredSources[1]=duplicatedSource.requiredSources[0];
 assert.throws(()=>assertInstalledSkillManifest(duplicatedSource,catalog),/SKILL_SOURCE_PIN|must NOT have duplicate items/u);
 const widenedPurpose=clone();widenedPurpose.requiredSources[0]={sourceId:'mail',authority:'authoritative',purpose:'mutation'};
 assert.throws(()=>assertInstalledSkillManifest(widenedPurpose,catalog),/SKILL_SOURCE_PIN|must be equal to one of the allowed values/u,'a purpose no operation declares is refused');
 assert.throws(()=>assertInstalledSkillCatalog(installed,undefined),/SKILL_CATALOG_UNAVAILABLE/u);
 assert.equal(assertInstalledSkillCatalog(installed,catalog),installed);
});

test('the installed identity is selectable, launchable and pinned to its own prose at its own version',()=>{
 const installed=selectSkill('quick_skill.cited_report','1.0.0');
 assert.equal(installed.pin.skillId,'quick_skill.cited_report');assert.equal(installed.pin.skillVersion,'1.0.0');
 assert.equal(installed.pin.catalogSha256,FROZEN.installationCatalogSha256);
 assert.equal(installed.manifest.contractVersion,'0.3.0');
 assert.equal(installed.pin.manifestSha256,canonicalSha256(citedReportManifest()));
 assert.equal(installed.pin.proseSha256,digest(bytes('../../../apps/control/document-application/cited-report/SKILL.md')));
 assert.deepEqual([...installed.manifest.subjectKinds],['client']);
 assert.equal(installed.manifest.prose.id,'urn:meri:original:general-cited-report:1.0.0');
 assert.throws(()=>selectSkill('quick_skill.cited_report','2.0.0'),/SKILL_VERSION_UNAVAILABLE/u,'no latest-version fallback');
 const plugin=describeSkillPlugin(),cited=plugin.skills.filter(skill=>skill.skillId==='quick_skill.cited_report');
 assert.equal(plugin.skills.length,15);assert.deepEqual(cited,[{skillId:'quick_skill.cited_report',skillVersion:'1.0.0',name:'meri-cited-report',proseSha256:installed.pin.proseSha256}]);
 assert.equal(new Set(plugin.skills.map(skill=>skill.name)).size,15,'no launcher name collision');
 assert.deepEqual(plugin.skills.filter(skill=>skill.skillId==='quick_skill.bill_watch'),[{skillId:'quick_skill.bill_watch',skillVersion:'1.1.0',name:'meri-bill-watch',proseSha256:FROZEN['quick_skill.bill_watch@1.1.0'][1]}],'Bill1.1 keeps its own version, name and prose');
 assert.deepEqual(plugin.excluded,[
  {skillId:'quick_skill.bill_watch',skillVersion:'1.0.0',reason:'NO_SDK_FRONTMATTER'},
  {skillId:'quick_skill.pe_deep_dive',skillVersion:'1.0.0',reason:'NOT_SELECTED_SDK_VERSION'},
  {skillId:'quick_skill.bill_watch',skillVersion:'1.0.1',reason:'NOT_SELECTED_SDK_VERSION'},
  {skillId:'quick_skill.bill_watch',skillVersion:'2.0.0',reason:'NOT_SELECTED_SDK_VERSION'}],'the original exclusions are unchanged');
});

test('every published original pin is byte-unchanged',()=>{
 const rows=new Map(listSkills().map(row=>[`${row.skillId}@${row.skillVersion}`,row]));
 for(const [identity,[manifestSha256,proseSha256]]of Object.entries(FROZEN)){
  if(!identity.includes('@'))continue;
  const row=rows.get(identity);
  assert.ok(row,`${identity} is still published`);
  assert.equal(row.manifestSha256,manifestSha256,`${identity} manifest bytes unchanged`);
  assert.equal(row.proseSha256,proseSha256,`${identity} prose bytes unchanged`);
 }
 assert.equal(rows.size,19);
 assert.equal(new Set([...rows.keys()].map(key=>key.split('@')[0])).size,15,'the fourteen original ids plus exactly one added id');
 for(const id of CLOSED)assert.ok([...rows.keys()].some(key=>key.startsWith(id+'@')),`${id} is still published`);
});

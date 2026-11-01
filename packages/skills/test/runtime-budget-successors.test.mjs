/** Runtime-budget successors: every user-selectable original has a successor whose only change is the whole-run
 * budget (60 s -> 600 s). Predecessors stay installed and resolvable; new selections are offered the successor;
 * the document-compiler registry and the revision contract agree on which versions have a compiler. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../contracts/validate.mjs';
import {supportsSelectedDocumentRevision} from '../../contracts/document-revision.mjs';
import {listSkills,selectSkill,documentCompiler,selectCompilerSkill} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';
import assets from '../assets.json' with {type:'json'};
const sha=text=>createHash('sha256').update(Buffer.from(text)).digest('hex');

/** [identity, predecessor, successor, predecessor manifest/prose pins frozen at the time the successor was issued]. */
const SUCCESSORS=[
 ['quick_skill.client_changes','1.0.1','1.0.2','186eb257d00c081781916595ae5d0331091afddfcf76eb96a9d1b3a8bb909621','a301ff3409d72d822d90a366693ec918288c3c0cf3870cf430759e8905623333'],
 ['quick_skill.funding_opportunity_match','1.0.1','1.0.2','cda8b0782966822ca2ebfca7dbdde5bbe41a349b1c8dcf5332038e43b54e6e14','7fcb2c315a84d5b5bb5438b0739672858083c210a15b33490c8ac8a52a262c7e'],
 ['quick_skill.hearing_watch','1.0.1','1.0.2','4dd221658c8475c3c81653b0f3dbfaddfdf5621e725f92b037724dc1152b4938','8113ddb40117410862987ca0d1eded9f911518d2511d14d6b5d28f83332f3999'],
 ['quick_skill.meeting_prep','1.0.1','1.0.2','8d89bfc58af319ac9467fa9eabafb615201663b2e74e49b171bc132a0ff546ba','f229e324b2465501c5eb53d6dc0b1084e56c99002a9495bbf1376dbf89eb78ef'],
 ['quick_skill.portfolio_changes','1.0.1','1.0.2','1ef88b41f4246a06cd6444716ac703e226e70af6ffa8e4cf4bfb7bd8253b9709','c6632efe7264570dad0ae7380bb33bd34c187c79631e77d315d22e526725ae3d'],
 ['quick_skill.portfolio_overlap','1.0.1','1.0.2','5ed004bb0fc21b7348aba360a83cf8be1e5c748e45c0a565ad04ecc3b8a72d2b','2c3a84fa2a4cd334202a005b6bf2b0253aaf85404d441be0ba2ace44eb009f11'],
 ['quick_skill.regulatory_docket_brief','1.0.1','1.0.2','8c68e30969cdee09f8fac0b6b7c6a85167704d4538ad612392edec4e6933027a','413fe92d76e3e68282906fc93412e3f06afec07e2cb1e321e8df038e36d86c4e'],
 ['quick_skill.representation_lookup','1.0.1','1.0.2','0d9f59f1cd1feb8684c0c8abb0f95b0cb5464d8799ad0c6be2da68efe217d1a9','d49f44ac5afa0e04f27f516613cda54a1e8813de75090d7f650fc63a2c22e6bf'],
 ['quick_skill.research_company','1.0.1','1.0.2','89d0dd5bf0e773e27b4f3e006b14d7cd4223cb981f9ee68ffffaadbef4cb41a9','9139d0bed0bb1919386dd26c0407ad2e8e10303865a0c52a418cc6beb3c42929'],
 ['quick_skill.commitments_audit','1.0.0','1.0.1','30a5b805056de2961a00da0de65152e4d7e918993f05adfbc7bbe456731bef2d','892dc0dbd9105e88e0cb78097514437f9cb29c0323b9bad168c1999d02a4e3db'],
 ['quick_skill.relationship_brief','1.0.0','1.0.1','dc7f9358bd9d646d6d6ca88c9528ad16edbc7552d6765b0d97d945c31d1bc7ed','3b6a422d87c0a61562fbe2f2ba96b164b282f62d38058e7db0e15a97672d99ee'],
 ['quick_skill.mail_history','1.0.0','1.0.1','b8ac89b3cf04716a62f8a41f70382987b8a76426c4825a2dd7aeb6fb690903d1','a6f2508d93e0c1b5f3c723b10038db37adc31f9a08b49a36944c8dcf55308ea4'],
 ['quick_skill.pe_deep_dive','1.1.0','1.1.1','27391e1eb9db904dc48587a5aa6013daafce423329f53c7360964ce0f079372d','a4a9461db01d8737da84f5ee01783ee1d736cf7a9a2090f63b2705da1cb65065'],
 ['quick_skill.bill_watch','1.1.0','1.1.1','d8c3f776a56f7a67ff2d0fb2fae4a2704e5bd45173ee2c2200232a41085b875e','e24b8793dc674f76eff3eb55b61cd76198a4ddde146ff723af4a0787da0f7e1a'],
 ['quick_skill.bill_watch','2.0.0','2.0.1','7e00e11aa4606a5f5277dfd58913c11fe87ef6f069d5d1ad22911de69c83593b','8767442316ed7c1a318ba091026eff84ad0ad0a575beab22c1800bac5fa24d3a'],
 ['quick_skill.cited_report','1.0.0','1.0.1','ed25117407946264ef62a916377ffeec0ceca30ca54a97ab0983c797fb6a685a','6637bc1bd277ad758a2f3c301480b5756a931e09ec2fab7408092ebf475771cd'],
];
const versionStatements=[from=>`immutable version \`${from}\``,from=>`version ${from}.`,from=>`at exactly version ${from}`];

for(const [skillId,from,to,manifestSha256,proseSha256] of SUCCESSORS)test(`${skillId}: ${from} stays frozen and ${to} changes only the whole-run budget and its version statement`,()=>{
 const old=selectSkill(skillId,from),next=selectSkill(skillId,to);
 assert.equal(old.pin.manifestSha256,manifestSha256);assert.equal(old.pin.proseSha256,proseSha256);
 assert.equal(old.manifest.budgets.maxRuntimeSeconds,60);assert.equal(next.manifest.budgets.maxRuntimeSeconds,600);
 assert.equal(next.manifest.budgets.maxToolCalls,24);
 const restored=structuredClone(next.manifest);restored.skillVersion=from;restored.prose=old.manifest.prose;restored.budgets.maxRuntimeSeconds=60;
 assert.deepEqual(restored,old.manifest,'operations, sources, subject kinds, window bases, completion, approval and the other budgets are unchanged');
 assert.equal(next.manifest.prose.id,old.manifest.prose.id.replace(/:[0-9]+\.[0-9]+\.[0-9]+$/u,':'+to));
 const statements=versionStatements.map(f=>f(from)).filter(statement=>old.prose.includes(statement));
 assert.equal(statements.length,1,'exactly one version statement identifies the prose');
 assert.equal(next.prose,old.prose.replace(statements[0],statements[0].replace(from,to)),'every other prose byte is preserved');
 assert.equal(next.manifest.prose.sha256,sha(next.prose));assert.equal(next.pin.proseSha256,sha(next.prose));assert.equal(next.pin.manifestSha256,canonicalSha256(next.manifest));
 assert.equal(next.pin.catalogSha256,old.pin.catalogSha256,'the successor inherits its predecessor catalog provenance');
 assert.notEqual(next.pin.manifestSha256,old.pin.manifestSha256);
});

test('new selections are offered every successor; persisted predecessor pins still resolve and launch as themselves',()=>{
 const offered=describeSkillPlugin().skills;
 for(const [skillId,from,to] of SUCCESSORS){
  if(skillId==='quick_skill.bill_watch'&&to==='2.0.1')continue; // The sourced cited report is reached by explicit selection, never offered as the Bill Watch default.
  assert.equal(offered.find(row=>row.skillId===skillId).skillVersion,to,`${skillId} offers ${to}`);
  assert.equal(assets.sdkDefaults[skillId],to);
  const previous=selectSkill(skillId,from).pin;
  assert.equal(describeSkillPlugin({selection:previous}).skills.find(row=>row.skillId===skillId).skillVersion,from,`${skillId}@${from} launches as itself when persisted`);
 }
 assert.equal(offered.length,15);assert.equal(listSkills().length,35);
 assert.throws(()=>selectSkill('quick_skill.mail_history','latest'),/SKILL_VERSION_UNAVAILABLE/u);
 assert.throws(()=>selectSkill('quick_skill.mail_history','1.0.2'),/SKILL_VERSION_UNAVAILABLE/u,'no version beyond the issued successor exists');
});

test('the document-compiler registry is explicit per version and agrees with the revision contract',()=>{
 assert.deepEqual(assets.documentCompilers,{'quick_skill.commitments_audit':['1.0.0','1.0.1'],'quick_skill.relationship_brief':['1.0.0','1.0.1'],'quick_skill.bill_watch':['2.0.0','2.0.1'],'quick_skill.cited_report':['1.0.0','1.0.1']});
 for(const [skillId,versions] of Object.entries(assets.documentCompilers))for(const skillVersion of versions){
  const pin=selectSkill(skillId,skillVersion).pin;
  assert.equal(documentCompiler(pin),skillId);
  assert.equal(selectCompilerSkill(pin,skillId).pin,pin);
  assert.throws(()=>selectCompilerSkill(pin,'quick_skill.mail_history'),/SKILL_COMPILER_PIN/u,'a pin is admitted only to its own compiler');
  assert.throws(()=>selectCompilerSkill({...pin,proseSha256:'0'.repeat(64)},skillId),/SKILL_COMPILER_PIN/u,'an altered pin is refused');
  assert.throws(()=>selectCompilerSkill({skillId,skillVersion},skillId),/SKILL_COMPILER_PIN/u,'a bare identity without its digests is refused');
  if(['quick_skill.bill_watch','quick_skill.cited_report'].includes(skillId))assert.ok(supportsSelectedDocumentRevision(pin),`${skillId}@${skillVersion} supports document revision`);
 }
 for(const row of listSkills())if(documentCompiler(row)===null){
  assert.throws(()=>selectCompilerSkill(selectSkill(row.skillId,row.skillVersion).pin,row.skillId),/SKILL_COMPILER_PIN/u);
  assert.equal(supportsSelectedDocumentRevision(row),false,`${row.skillId}@${row.skillVersion} has no compiler and no revision support`);
 }
 assert.equal(documentCompiler({skillId:'quick_skill.bill_watch',skillVersion:'1.1.1'}),null,'the native Bill Watch workflow has no document compiler');
 assert.equal(documentCompiler({skillId:'quick_skill.bill_watch',skillVersion:'9.9.9'}),null);
 assert.equal(documentCompiler({}),null);
});

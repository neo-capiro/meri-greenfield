import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,cp,mkdir,mkdtemp,symlink,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {selectSkill,listSkills} from '../index.mjs';
import {validateShape,assertSkillManifest} from '../../contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../contracts/validate.mjs';
import catalog from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import inventory from '../../../docs/coordination/r2/skills.json' with {type:'json'};
const sha=value=>createHash('sha256').update(value).digest('hex');

const evidence={
 research_company:['public_web','program_elements','federal_market','funding_opportunities','certification_status'],
 relationship_brief:['mail','meetings','tenant_contacts','client_documents','client_knowledge_memory','tasks','action_recommendation','client_knowledge_monday'],
 client_changes:['mail','meetings','client_documents','tasks','action_recommendation','client_knowledge_monday','tracked_bills','district_nexus','business_development'],
 portfolio_changes:['clients','mail','meetings','tasks','client_knowledge_monday','tracked_bills'],
 portfolio_overlap:['clients','public_web','program_elements','federal_market','tenant_contacts','district_nexus'],
 mail_history:['mail','tenant_contacts','entity_candidates'],
 meeting_prep:['mail','meetings','client_documents','client_knowledge_memory','tasks','client_knowledge_monday','tracked_bills','public_domain_hearings'],
 commitments_audit:['mail','meetings','client_documents','tasks','action_recommendation','client_knowledge_monday'],
 funding_opportunity_match:['client_knowledge_profile','funding_opportunities','stored_public_data','sam_opportunities'],
 pe_deep_dive:['program_elements','pe_references','bill_text','federal_legislation','stored_public_reports'],
 hearing_watch:['client_knowledge_profile','public_domain_hearings','legislative_directory','tracked_bills'],
 representation_lookup:['facility_representation','state_legislation','legislative_directory','district_nexus','tenant_contacts'],
 regulatory_docket_brief:['regulatory_dockets','rule_status','research_legal_legislation','public_web']
};

test('all 14 original identities have an explicit immutable asset (bill_watch at 1.0.0 and the plugin-admissible 1.0.1); 13 absent recipes are implemented',()=>{
 assert.deepEqual([...new Set(listSkills().map(s=>s.skillId))].sort(),inventory.records.map(row=>row.fields.ID).sort());
 assert.deepEqual(listSkills().filter(s=>s.skillId==='quick_skill.bill_watch').map(s=>s.skillVersion).sort(),['1.0.0','1.0.1']);
 assert.equal(listSkills().length,15);
 assert.equal(Object.keys(evidence).length,13);
 for(const entry of listSkills()){
  const asset=selectSkill(entry.skillId,entry.skillVersion);validateShape('SkillManifest',asset.manifest);
  assert.equal(asset.pin.manifestSha256,canonicalSha256(asset.manifest));
  assert.equal(asset.pin.proseSha256,sha(Buffer.from(asset.prose)));assert.equal(asset.pin.catalogSha256,canonicalSha256(catalog));
  assert.equal(asset.manifest.approval.autoCreateTasks,false);assert.equal(asset.manifest.completion.negativeClaims,'complete-covered-only');
  assert.throws(()=>assertSkillManifest(asset.manifest,catalog),/unavailable operation/u);
 }
});
for(const [id,required]of Object.entries(evidence))test(`${id}: workflow-specific evidence and original explicit-selection prose`,()=>{
 const selected=listSkills().find(row=>row.skillId===`quick_skill.${id}`);
 const {manifest,prose}=selectSkill(selected.skillId,selected.skillVersion);
 for(const sourceId of required)assert(manifest.requiredSources.some(row=>row.sourceId===sourceId),sourceId);
 assert.match(prose,/^---\nname: meri-[a-z-]+\ndescription: .+\ndisable-model-invocation: true\n---\n/u);
 assert(prose.includes(`quick_skill.${id}`));assert.match(prose,/decisive|exact opportunity|exact schedule/u);
 assert(manifest.completion.rubric.filter(row=>!['coverage','decisive-evidence'].includes(row.id)).length>=2);
 assert.match(prose,/Partial results|coverage/u);assert.match(prose,/separate immutable approval proposal/u);
});

test('existing bounded Bill Watch bytes, manifest and accepted pins stay exact',async()=>{
 const asset=selectSkill('quick_skill.bill_watch','1.0.0');
 const bytes=await readFile(new URL('../../../apps/control/document-application/research-brief/SKILL.md',import.meta.url));
 assert.equal(asset.prose,bytes.toString());assert.equal(sha(bytes),'ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55');
 assert.deepEqual(asset.manifest,JSON.parse(await readFile(new URL('../../../apps/control/document-application/research-brief/manifest.json',import.meta.url))));
 assert.match(asset.prose,/does not replace the full bill-watch workflow/u);
});

test('asset selection has no implicit latest, fuzzy identity, mutable pin or shared returned state',()=>{
 for(const args of [['quick_skill.mail_history'],['mail_history','1.0.0'],['quick_skill.mail_history','latest'],['quick_skill.mail_history','1.0.1'],[{},'1.0.0']])assert.throws(()=>selectSkill(...args),/SKILL_/u);
 const asset=selectSkill('quick_skill.mail_history','1.0.0');
 assert.throws(()=>asset.manifest.requiredSources.push({sourceId:'foreign'}),TypeError);
 assert.throws(()=>asset.pin.proseSha256='a'.repeat(64),TypeError);
 assert.throws(()=>listSkills().pop(),TypeError);assert.equal(selectSkill('quick_skill.mail_history','1.0.0'),asset);
});

test('a fresh loader refuses jointly changed prose and self-declared hash against immutable index',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'meri-skill-pin-'));
 try{
  await mkdir(join(dir,'packages'),{recursive:true});await cp(new URL('../',import.meta.url),join(dir,'packages','skills'),{recursive:true});
  await symlink(fileURLToPath(new URL('../../contracts',import.meta.url)),join(dir,'packages','contracts'));
  const folder=join(dir,'packages','skills','originals','mail_history','1.0.0'),path=join(folder,'SKILL.md'),prose=await readFile(path,'utf8');
  await writeFile(path,prose+'\nTampered semantic instruction.\n');
  const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));manifest.prose.sha256=sha(Buffer.from(prose+'\nTampered semantic instruction.\n'));
  await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest));
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {selectSkill} from ${JSON.stringify(new URL('file://'+join(dir,'packages','skills','index.mjs')).href)};selectSkill('quick_skill.mail_history','1.0.0');`],{encoding:'utf8'});
  assert.equal(child.status,1);assert.match(child.stderr,/SKILL_ASSET_PIN/u);
 }finally{await rm(dir,{recursive:true,force:true});}
});

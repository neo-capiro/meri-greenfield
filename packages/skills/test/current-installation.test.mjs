/** Immutable skill selections are compatible with one exact current installation, not arbitrary catalogs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {selectSkill,listSkills} from '../index.mjs';
import assets from '../assets.json' with {type:'json'};
import historical from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import current from '../../contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../contracts/validate.mjs';
import {assertSkillInstallation} from '../../contracts/selected-skills/validate.mjs';
const currentHash='2b8f757a4d4485906e00bdf62d02cc27d8f7bd0e1590e454d44029d431392f4d';

test('all thirty-five original asset identities survive the exact additive installation without added grants',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../assets.json',import.meta.url))).digest('hex'),'6a2349e3b6828fa49bdf672633db7ba4db85b1b9fb904557ee55a7f11fa4eab8');
 assert.equal(hash(historical),assets.installationCatalogSha256);assert.equal(hash(current),currentHash);
 assert.equal(current.sourceRegistryCommit,historical.sourceRegistryCommit);
 assert.equal(historical.operations.length,142);assert.equal(current.operations.length,161);
 const oldRows=new Map(historical.operations.map(row=>[hash(row.operation),row])),newRows=new Map(current.operations.map(row=>[hash(row.operation),row]));
 for(const [key,row]of oldRows)assert.deepEqual(newRows.get(key),row);
 assert.equal(listSkills().length,35);
 for(const row of assets.assets){
  const selected=selectSkill(row.skillId,row.skillVersion);
  assert.deepEqual(selected.pin,{skillId:row.skillId,skillVersion:row.skillVersion,manifestSha256:row.manifestSha256,proseSha256:row.proseSha256,catalogSha256:row.catalogSha256??assets.catalogSha256});
  assert.equal(selected.installationCatalogSha256,currentHash);
  assert.equal(hash(selected.manifest),row.manifestSha256);
  assert.equal(createHash('sha256').update(selected.prose).digest('hex'),row.proseSha256);
  for(const operation of selected.manifest.allowedOperations)assert(oldRows.has(hash(operation)),'additive operation is not a skill grant');
 }
});

test('all four selected compilers, at every registered version, require current installation and refuse historical, altered, foreign and changed receipts',()=>{
 for(const [skillId,skillVersion]of [['quick_skill.commitments_audit','1.0.0'],['quick_skill.commitments_audit','1.0.1'],['quick_skill.relationship_brief','1.0.0'],['quick_skill.relationship_brief','1.0.1'],['quick_skill.bill_watch','2.0.0'],['quick_skill.bill_watch','2.0.1'],['quick_skill.cited_report','1.0.0'],['quick_skill.cited_report','1.0.1']]){
  const selected=selectSkill(skillId,skillVersion),input={binding:{tenantId:'synthetic',actorId:'owner'},skill:selected.pin,requestSha256:'a'.repeat(64),selectionSha256:'b'.repeat(64)};
  const receipt={...input,baseCatalogSha256:currentHash,installationId:'71000000-0000-4000-8000-000000000091',executionCatalogSha256:'c'.repeat(64),operations:selected.manifest.allowedOperations,checkedAtMs:100,expiresAtMs:200};
  const options={input,selected,started:100,now:()=>100,life:{limitDeadline(){}}};
  assert.deepEqual(assertSkillInstallation(receipt,options),receipt);
  for(const wrong of [hash(historical),selected.pin.catalogSha256,'d'.repeat(64)])assert.throws(()=>assertSkillInstallation({...receipt,baseCatalogSha256:wrong},options),{code:'SKILL_CURRENT_RECEIPT_REFUSED'});
  for(const change of [{binding:{...input.binding,actorId:'foreign'}},{skill:{...selected.pin,catalogSha256:currentHash}},{requestSha256:'e'.repeat(64)},{checkedAtMs:99},{expiresAtMs:100},{operations:[...receipt.operations,{id:'prepare_federal_draft',version:'0.2.0'}]}])assert.throws(()=>assertSkillInstallation({...receipt,...change},options),{code:'SKILL_CURRENT_RECEIPT_REFUSED'});
  assert.deepEqual(assertSkillInstallation({...receipt,checkedAtMs:101},{...options,now:()=>101,previous:receipt}),{...receipt,checkedAtMs:101});
  for(const change of [{installationId:'71000000-0000-4000-8000-000000000092'},{executionCatalogSha256:'f'.repeat(64)},{operations:receipt.operations.slice(1)}])assert.throws(()=>assertSkillInstallation({...receipt,...change},{...options,previous:receipt}),{code:'SKILL_CURRENT_RECEIPT_REFUSED'});
 }
});

test('loader refuses a changed current catalog even when all historical operation rows remain intact',()=>{
 const original=current.originals[0].boundary;
 try{current.originals[0].boundary=original+' Altered routing claim.';assert.throws(()=>listSkills(),/SKILL_INSTALLATION_CATALOG_PIN/u);}
 finally{current.originals[0].boundary=original;}
 assert.equal(listSkills().length,35);
});

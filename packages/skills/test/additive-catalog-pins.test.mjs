/** Persisted selection identity is distinct from the current process's installation receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSkill,listSkills} from '../index.mjs';
import assets from '../assets.json' with {type:'json'};
import catalog from '../../contracts/retrieval-0.2/catalog.json' with {type:'json'};
import installationCatalog from '../../contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../contracts/validate.mjs';
import {assertSkillInstallation} from '../../contracts/selected-skills/validate.mjs';
import {briefSkillPin} from '../../../apps/control/document-application/research-brief/skill.mjs';
import {continuationFixture} from '../../../apps/worker/conversation/continuation/test/fixtures.mjs';
import {buildContinuationOptions} from '../../../apps/worker/conversation/continuation/options.mjs';
const oldCatalog='41aed2fc63dc40cafe987ee3059a13b605b7d3796c31f60ed6ca26939954bfcc';

test('every immutable identity keeps its explicit pin under the additive catalog',()=>{
  const rows=listSkills().filter(row=>!(['quick_skill.pe_deep_dive','quick_skill.bill_watch'].includes(row.skillId)&&['1.1.0','2.0.0'].includes(row.skillVersion)));assert.equal(rows.length,16);assert.equal(new Set(rows.map(row=>row.skillId)).size,15);
  for(const row of rows){
    const selected=selectSkill(row.skillId,row.skillVersion),asset=assets.assets.find(item=>item.skillId===row.skillId&&item.skillVersion===row.skillVersion);
    // Every persisted pin remains the asset's exact historical selection identity.
    assert.deepEqual(selected.pin,{...row,catalogSha256:asset.catalogSha256??assets.catalogSha256});
    assert.equal(selected.installationCatalogSha256,hash(installationCatalog));
    assert.equal(hash(JSON.parse(readFileSync(new URL('../'+asset.manifestPath,import.meta.url)))),selected.pin.manifestSha256);
  }
  assert.deepEqual(briefSkillPin(),selectSkill('quick_skill.bill_watch','1.0.0').pin);
});
test('persisted old skill pin resumes exactly and an attempted catalog-pin upgrade is refused',()=>{
  const {continuation,target}=continuationFixture();assert.equal(target.sourceRequest.skill.catalogSha256,oldCatalog);
  const persisted=JSON.stringify(target.sourceRequest);assert.doesNotThrow(()=>buildContinuationOptions(continuation,target));
  assert.equal(JSON.stringify(target.sourceRequest),persisted);
  const altered=structuredClone(target);altered.request.skill.catalogSha256=hash(catalog);
  assert.throws(()=>buildContinuationOptions(continuation,altered));
});
test('new runtime requires a fresh current installation; old receipt and mid-lifetime changes stay refused',()=>{
  const selected=selectSkill('quick_skill.mail_history','1.0.0'),binding={synthetic:true};
  const input={binding,skill:selected.pin,requestSha256:'a'.repeat(64),selectionSha256:'b'.repeat(64)};
  const receipt={...input,baseCatalogSha256:hash(installationCatalog),installationId:'71000000-0000-4000-8000-000000000091',executionCatalogSha256:'c'.repeat(64),operations:selected.manifest.allowedOperations,checkedAtMs:100,expiresAtMs:200};
  const options={input,selected,started:100,now:()=>100,life:{limitDeadline(){}}};
  assert.deepEqual(assertSkillInstallation(receipt,options),receipt);
  assert.throws(()=>assertSkillInstallation({...receipt,baseCatalogSha256:oldCatalog},options));
  assert.throws(()=>assertSkillInstallation({...receipt,baseCatalogSha256:hash(catalog)},options));
  assert.throws(()=>assertSkillInstallation({...receipt,baseCatalogSha256:'d'.repeat(64)},options));
  assert.throws(()=>assertSkillInstallation({...receipt,installationId:'71000000-0000-4000-8000-000000000092'},{...options,previous:receipt}));
  assert.equal(input.skill.catalogSha256,oldCatalog);
});

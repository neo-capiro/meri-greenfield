/** Every canonical identity/version has an explicit held availability; no synthetic admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {skillCatalog} from '@capiro/meri-contracts/skill-catalog';
import {listSkills,selectSkill} from '../../skills/index.mjs';
import {originalRuntimeSupports} from '../../skills/runtime-support.mjs';
test('all 14 canonical skills and 15 exact immutable assets are represented once',()=>{
 assert.equal(skillCatalog.skills.length,15);assert.equal(new Set(skillCatalog.skills.map(x=>x.skillId)).size,14);
 assert.deepEqual(skillCatalog.skills.map(({skillId,skillVersion,manifestSha256,proseSha256})=>({skillId,skillVersion,manifestSha256,proseSha256})),listSkills());
 for(const row of skillCatalog.skills){const {pin,manifest}=selectSkill(row.skillId,row.skillVersion);
  for(const [key,value]of Object.entries(pin))assert.equal(row[key],value);
  assert.deepEqual(row.operations,manifest.allowedOperations);assert.deepEqual(row.requiredSources,manifest.requiredSources);
  assert.equal(row.available,false);assert.equal(row.runtimeSupported,originalRuntimeSupports(row));
  assert.equal(row.unavailableReason,row.runtimeSupported?'CURRENT_INSTALLATION_REQUIRED':'RUNTIME_NOT_QUALIFIED');
  assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.operations));
 }
});

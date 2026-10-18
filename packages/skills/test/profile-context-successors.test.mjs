import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../contracts/validate.mjs';
import {listSkills,selectSkill} from '../index.mjs';
import {describeSkillPlugin} from '../plugin.mjs';

// Frozen accepted 1.0.0 pins, independent of the active index's successor rows.
const originals={
 client_changes:['9980a0e23a484e02438d636dc017ff9cd43098b41c9628bd3eb57c84114ba53f','e81c3692348c9bfc7f9655d703823e785c1b7eb0b77fb394cbecb4a062cd0ee8'],
 funding_opportunity_match:['6de1b91a9481951d5ff016c5640b7c617f78de29705292a946698eacd846dcfd','e7211a21a883ec59e43f5d719fbf7e313630e57674667f99f4e875a14b8ce26d'],
 hearing_watch:['d1bc18bcd07991c9e9a8ce06d9c7f75495d92f4b44c0dad09078abf1a71151ba','d070a99280c30a38d29fa9f2fdc425faa735d30b43cd6ac80fc95cbb69626314'],
 meeting_prep:['ba783cb9e955a2e797f6c103b95984ca2d09e3e68f14d640f100fe049150455d','fe6f7c54e017e9f187344dd6968af7cb36c01a88c622cde868080ab118df3d7f'],
 portfolio_changes:['ccee9962b1ce75e1ab64b8c356d36164305f947f9d9c9a6ff2a9b446ef8a0915','3e76da17d5dc490944b7f5464065cee69742ac554ebe7ceb12f4e3e327ce67b5'],
 portfolio_overlap:['7f859973a4371e37c4010cd2f27bab4f534020660ae06dbd34c60411861a92aa','3abdb87f27d60fd7f8dd85083d8aad8b0413884f297e9ed7e5a143aa50e20e8b'],
 regulatory_docket_brief:['638b10d2a7c04389836a286a7cb61fd6f0eed31f39e601f49ab78de7d75c9151','698a96dd6c6de443456a477a04d11e393487a38f8c82d34b68d97b01a7849da2'],
 representation_lookup:['56c59dc649c5160d55dff2094bb1f07cff90c918fdee8bdf54c95f8ce446894e','232dec9783f0cec8001043fae72e3e6d38a5b2799c98302571d54bde0d4f6a76'],
 research_company:['93344aee6750efe2a9d99d9571bee8e6dfaaa500d4d13285501d67e36b988602','cbee7506868d65de5ef247add8390850de151398b074add2ce69d2aefd63b7ab']
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

for(const [id,[manifestSha256,proseSha256]]of Object.entries(originals))test(`${id}: immutable original and bounded profile receiving successor`,async()=>{
 const folder=new URL(`../originals/${id}/1.0.0/`,import.meta.url);
 const original=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const originalProse=await readFile(new URL('SKILL.md',folder),'utf8');
 assert.equal(canonicalSha256(original),manifestSha256);
 assert.equal(sha(originalProse),proseSha256);
 assert.deepEqual(listSkills().filter(row=>row.skillId===original.skillId).map(row=>row.skillVersion),['1.0.1']);
 assert.throws(()=>selectSkill(original.skillId,'1.0.0'),/SKILL_VERSION_UNAVAILABLE/u);
 const {manifest,prose,pin}=selectSkill(original.skillId,'1.0.1');
 assert.equal(manifest.contractVersion,original.contractVersion);
 assert.equal(manifest.skillVersion,'1.0.1');
 assert.equal(manifest.prose.id,original.prose.id.replace(/:1\.0\.0$/u,':1.0.1'));
 assert.equal(prose,originalProse.replace('immutable version `1.0.0`','immutable version `1.0.1`'));
 assert.equal(manifest.prose.sha256,sha(prose));
 assert.equal(pin.proseSha256,sha(prose));
 assert.equal(pin.manifestSha256,canonicalSha256(manifest));
 assert.deepEqual(manifest.allowedOperations.filter(row=>row.id==='get_client_context'),[{id:'get_client_context',version:'0.3.0'}]);
 const restored=structuredClone(manifest);
 restored.skillVersion=original.skillVersion;
 restored.prose=original.prose;
 restored.allowedOperations.find(row=>row.id==='get_client_context').version='0.2.0';
 assert.deepEqual(restored,original,'source requirements, other operations, completion, approval and budgets retain their original values');
});

test('the native plugin selects all nine successors once with unique names',()=>{
 const plugin=describeSkillPlugin();
 assert.equal(new Set(plugin.skills.map(row=>row.name)).size,plugin.skills.length);
 for(const id of Object.keys(originals))assert.deepEqual(plugin.skills.filter(row=>row.skillId===`quick_skill.${id}`).map(row=>row.skillVersion),['1.0.1']);
});

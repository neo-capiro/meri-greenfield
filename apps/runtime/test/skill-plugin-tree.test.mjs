/** Native skill asset integrity, independent of deleted SDK launch measurements. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,realpathSync,readFileSync,writeFileSync,chmodSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {prepareRunSkillPlugin,verifySkillPluginTree,SKILL_PLUGIN_TREE_SCHEMA,sdkSkillPluginDirectory} from '../../worker/conversation/capabilities/skill-plugin.mjs';
import {describeSkillPlugin,materializeSkillPlugin} from '../../../packages/skills/plugin.mjs';
const POSIX=process.platform!=='win32';
const unseal=dir=>{try{chmodSync(dir,0o700);}catch{}for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())unseal(p);else try{chmodSync(p,0o600);}catch{}}};
const scratch=()=>{const dir=realpathSync(mkdtempSync(join(tmpdir(),'meri-g3-')));return {dir,cleanup:()=>{unseal(dir);rmSync(dir,{recursive:true,force:true});}};};

test('the run skill plugin copy is materialized read-only with the exact pinned digest, verified when reused, refused when altered',async t=>{
 const s=scratch();t.after(s.cleanup);
 const directory=sdkSkillPluginDirectory(join(s.dir,'run')),reference=join(s.dir,'reference');mkdirSync(join(s.dir,'run'));
 const prepared=await prepareRunSkillPlugin(directory);assert.equal(prepared.directory,directory);
 // The exact digest: the manifest the skills package writes plus one SKILL.md per described skill at its catalog prose pin, nothing else.
 await materializeSkillPlugin({directory:reference});const plugin=describeSkillPlugin();
 const files=[{path:'.claude-plugin/plugin.json',sha256:createHash('sha256').update(readFileSync(join(reference,'.claude-plugin','plugin.json'))).digest('hex')},...plugin.skills.map(skill=>({path:`skills/${skill.name}/SKILL.md`,sha256:skill.proseSha256}))]
  .sort((x,y)=>x.path<y.path?-1:1);
 assert.equal(prepared.digest,canonicalSha256({schema:SKILL_PLUGIN_TREE_SCHEMA,files}));assert.equal(plugin.skills.length,14);
 const file=join(directory,'skills',plugin.skills[0].name,'SKILL.md');
 if(POSIX){assert.equal(lstatSync(file).mode&0o777,0o400);assert.equal(lstatSync(directory).mode&0o777,0o500);assert.equal(lstatSync(join(directory,'skills')).mode&0o777,0o500);}
 else assert.equal(lstatSync(file).mode&0o222,0,'read-only');
 assert.throws(()=>writeFileSync(file,'changed'),{code:POSIX?'EACCES':'EPERM'});
 assert.deepEqual(await prepareRunSkillPlugin(directory),prepared,'a reused copy verifies to the same digest and is never rewritten');
 if(POSIX)await assert.rejects(verifySkillPluginTree(directory,{uid:process.getuid()+1}),{code:'SKILL_PLUGIN_TREE_REFUSED'});
 chmodSync(file,0o600);writeFileSync(file,'altered');chmodSync(file,0o400);
 await assert.rejects(prepareRunSkillPlugin(directory),{code:'SKILL_PLUGIN_TREE_REFUSED'});
 for(const bad of ['relative',`${directory}/`,undefined])await assert.rejects(prepareRunSkillPlugin(bad),{code:'SKILL_PLUGIN_DIRECTORY_REFUSED'});
});

test('an extra entry in the plugin copy refuses',async t=>{
 const s=scratch();t.after(s.cleanup);const directory=join(s.dir,'meri-skill-plugin');await prepareRunSkillPlugin(directory);
 chmodSync(join(directory,'skills'),0o700);writeFileSync(join(directory,'skills','extra.md'),'x');chmodSync(join(directory,'skills','extra.md'),0o400);chmodSync(join(directory,'skills'),0o500);
 await assert.rejects(prepareRunSkillPlugin(directory),{code:'SKILL_PLUGIN_TREE_REFUSED'});
});

/** The native SDK plugin is a byte-exact projection of the immutable originals, written into a fresh owner-only directory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describeSkillPlugin,materializeSkillPlugin,PLUGIN_NAME} from '../plugin.mjs';
import {listSkills,selectSkill} from '../index.mjs';

test('the plugin description derives every name from the immutable index and excludes assets without SDK frontmatter',()=>{
 const d=describeSkillPlugin(),ids=listSkills().map(s=>s.skillId);
 assert.equal(d.name,PLUGIN_NAME);assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.skills[0]));
 assert.deepEqual([...d.skills.map(s=>s.skillId),...d.excluded.map(s=>s.skillId)].sort(),[...ids].sort());
 for(const s of d.skills){assert.match(s.name,/^meri-[a-z0-9-]+$/u);assert.equal(s.proseSha256,selectSkill(s.skillId,s.skillVersion).pin.proseSha256);}
});

test('materialization writes the manifest and byte-exact SKILL.md files, refuses an existing target and stays owner-only',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-skill-plugin-')),directory=join(root,'plugin');t.after(()=>rm(root,{recursive:true,force:true}));
 const result=await materializeSkillPlugin({directory}),d=describeSkillPlugin();
 assert.deepEqual(result.skills,d.skills);assert.equal(result.directory,directory);
 const manifest=JSON.parse(await readFile(join(directory,'.claude-plugin','plugin.json'),'utf8'));assert.deepEqual(Object.keys(manifest),['name','version','description']);assert.equal(manifest.name,PLUGIN_NAME);
 assert.deepEqual((await readdir(join(directory,'skills'))).sort(),d.skills.map(s=>s.name).sort());
 for(const s of d.skills){const file=join(directory,'skills',s.name,'SKILL.md');assert.equal(await readFile(file,'utf8'),selectSkill(s.skillId,s.skillVersion).prose);assert.equal((await stat(file)).mode&0o777,0o600);}
 assert.equal((await stat(directory)).mode&0o777,0o700);
 await assert.rejects(materializeSkillPlugin({directory}),/SKILL_PLUGIN_DIRECTORY_REFUSED/);assert.equal(JSON.parse(await readFile(join(directory,'.claude-plugin','plugin.json'),'utf8')).name,PLUGIN_NAME,'an existing target is never overwritten or removed');
 for(const bad of ['relative',`${directory}/`,`${root}/../x`,`${root}/a\0b`,undefined])await assert.rejects(materializeSkillPlugin({directory:bad}),/SKILL_PLUGIN_DIRECTORY_REFUSED/);
});

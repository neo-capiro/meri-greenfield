/** Canonical skill asset digest for runtime material. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const SKILLS_DIGEST_SCHEMA='meri.skills-digest.v1';
const load=(root,path)=>import(pathToFileURL(join(root,...path.split('/'))).href);
export async function skillsDigest({root}){
 const skills=await load(root,'packages/skills/index.mjs'),{canonicalSha256}=await load(root,'packages/contracts/validate.mjs');
 const assets=JSON.parse(readFileSync(join(root,'packages','skills','assets.json'),'utf8')),listed=skills.listSkills();
 for(const {skillId,skillVersion} of listed)skills.selectSkill(skillId,skillVersion);
 return {digest:canonicalSha256({schema:SKILLS_DIGEST_SCHEMA,catalogSha256:assets.catalogSha256,skills:listed}),catalogSha256:assets.catalogSha256,count:listed.length};
}

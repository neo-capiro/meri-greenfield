/** Additive identity admission for the general long-form cited report.
 * The closed 0.2.0 foundation is read from disk and never written: this module rebuilds the same Ajv
 * registry with the same options and replaces ONLY the SkillId enum with the 0.3.0 receiver id set, so
 * every consumer of the frozen 0.2.0 file keeps refusing an identity it does not know. It grants no
 * operation, no source and no runtime availability. */
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import identity from './skill-identity.schema.json' with {type:'json'};
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const added=Object.freeze([...identity.$defs.AddedSkillId.enum]),ids=Object.freeze([...identity.$defs.SkillId.enum]);
const extensionId=identity.$id.replace(':skill-identity:',':skill:');
const extended=read('../retrieval-0.2/skill.schema.json');
if(extended.$id!=='urn:meri:retrieval:skill:0.2.0')throw Error('SKILL_IDENTITY_FOUNDATION');
extended.$id=extensionId;
extended.title='Meri R2 skill contract identity extension 0.3.0';
for(const name of ['SkillInvocation','SkillManifest','PinnedSkill'])extended.$defs[name].properties.skillId={type:'string',enum:[...ids]};
const ajv=new Ajv({strict:true,allErrors:true});
addFormats(ajv);
ajv.addSchema(read('../meri.schema.json'));
ajv.addSchema(read('../retrieval-0.2/common.schema.json'));
ajv.addSchema(extended);
let check;
/** True only for the identities this versioned leaf adds; the closed 0.2.0 ids are not this receiver's. */
export const addedSkillIdentity=skillId=>typeof skillId==='string'&&added.includes(skillId);
/** The closed 0.2.0 manifest shape with the 0.3.0 id set; refuses everything the 0.2.0 shape refuses. */
export function assertAddedSkillManifest(manifest){
 if(!manifest||typeof manifest!=='object'||!addedSkillIdentity(manifest.skillId))throw Error('SkillManifest: skillId is not an added 0.3.0 identity');
 check??=ajv.compile({$ref:extensionId+'#/$defs/SkillManifest'});
 if(!check(manifest))throw Error(`SkillManifest: ${ajv.errorsText(check.errors)}`);
 return manifest;
}
export const skillIdentityExtension=Object.freeze({id:identity.$id,extensionId,added,ids});

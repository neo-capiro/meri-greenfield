/** Existing skill/read installation projections retained until Step3 owns removal.
 * These are asset metadata, never a model-launch or SDK-options receipt. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const SKILLS_DIGEST_SCHEMA='meri.skills-digest.v1';
const load=(root,path)=>import(pathToFileURL(join(root,...path.split('/'))).href);
const refuse=detail=>{throw Object.assign(Error('READ_ASSETS_REFUSED: '+detail),{code:'READ_ASSETS_REFUSED'});};
export async function skillsDigest({root}){
 const skills=await load(root,'packages/skills/index.mjs'),{canonicalSha256}=await load(root,'packages/contracts/validate.mjs');
 const assets=JSON.parse(readFileSync(join(root,'packages','skills','assets.json'),'utf8')),listed=skills.listSkills();
 for(const {skillId,skillVersion} of listed)skills.selectSkill(skillId,skillVersion);
 return {digest:canonicalSha256({schema:SKILLS_DIGEST_SCHEMA,catalogSha256:assets.catalogSha256,skills:listed}),catalogSha256:assets.catalogSha256,count:listed.length};
}
/** The full inventory remains the canonical desired scope. An explicit active set selects only exact canonical refs for P2; it never
 * accepts a caller-supplied family, descriptor hash, or source hash. An omitted set preserves the historical full measurement. */
export async function generalReadInstallation({root,activeReadOperations}){
 const [issuer,runtime,validation]=await Promise.all([load(root,'apps/gateway/general-reads/installation-issuer.mjs'),load(root,'apps/runtime/native-authority/general-read-installation/runtime.mjs'),load(root,'packages/contracts/validate.mjs')]);
 const rows=runtime.installationReadOperations(),inventory=await issuer.measureGeneralReadInstallation({catalogJson:readFileSync(join(root,'packages','contracts','retrieval-0.2','catalog.json'),'utf8'),operations:rows});
 if(activeReadOperations===undefined)return inventory;
 if(!Array.isArray(activeReadOperations)||activeReadOperations.length<1||activeReadOperations.length>rows.length)refuse('active read operations must be a nonempty subset of the installable inventory');
 const canonical=new Set(rows.map(row=>`${row.operation.id}@${row.operation.version}`)),selected=new Set();
 for(const op of activeReadOperations){
  if(op===null||typeof op!=='object'||Array.isArray(op)||Object.getPrototypeOf(op)!==Object.prototype||
   Object.keys(op).sort().join(',')!=='id,version'||typeof op.id!=='string'||typeof op.version!=='string')refuse('active read operation is not an exact OperationRef');
  const key=`${op.id}@${op.version}`;if(!canonical.has(key)||selected.has(key))refuse('active read operation is unknown or duplicated');selected.add(key);
 }
 const measurement={...inventory.measurement,operations:inventory.measurement.operations.filter(row=>selected.has(`${row.operation.id}@${row.operation.version}`))};
 if(measurement.operations.length!==selected.size)refuse('active read installation omits a selected operation');
 return {measurement,measurementSha256:validation.canonicalSha256(measurement)};
}

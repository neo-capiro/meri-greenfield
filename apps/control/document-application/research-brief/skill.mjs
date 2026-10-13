/** Original immutable recipe/prose identity; no runtime activation or SDK loop. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import manifest from './manifest.json' with {type:'json'};
import {artifactValidators as v,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const prose=readFileSync(new URL('./SKILL.md',import.meta.url));
validateShape('SkillManifest',manifest); // Shape only; catalog operations remain unavailable.
if(manifest.prose.sha256!==digest(prose))throw Error('BRIEF_PROSE_PIN');
const entries=manifest.allowedOperations.map(ref=>catalog.operations.find(x=>v.hash(x.operation)===v.hash(ref)));
if(entries.some(x=>!x)||v.hash(entries.flatMap(x=>x.sourceRequirements))!==v.hash(manifest.requiredSources))throw Error('BRIEF_MANIFEST_SOURCE_PIN');
export const briefManifest=()=>v.snapshot(manifest);
export const briefSkillPin=()=>({skillId:manifest.skillId,skillVersion:manifest.skillVersion,
  manifestSha256:v.hash(manifest),proseSha256:manifest.prose.sha256,catalogSha256:v.hash(catalog)});
export const briefSourceIds=Object.freeze(manifest.requiredSources.filter(x=>x.sourceId!=='artifact_versions').map(x=>x.sourceId));
export const briefReadOperation=sourceId=>v.snapshot(entries.find(x=>x.sourceRequirements.some(s=>s.sourceId===sourceId))?.operation);

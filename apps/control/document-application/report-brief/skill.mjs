/** Original immutable recipe/prose identity of the sourced cited report; no runtime activation, no SDK loop.
 * The recipe is installed as its own version quick_skill.bill_watch 2.0.0 in packages/skills/assets.json, so its
 * newly authored prose is bound as itself (urn:meri:original:sourced-cited-report) and is never presented as the
 * sourced brief prose of the installed quick_skill.bill_watch 1.0.0 pin. */
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import manifest from './manifest.json' with {type:'json'};
import {artifactValidators as v,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const prose=readFileSync(new URL('./SKILL.md',import.meta.url));
validateShape('SkillManifest',manifest); // Shape only; catalog operations remain unavailable.
if(manifest.prose.sha256!==digest(prose))throw Error('REPORT_PROSE_PIN');
const entries=manifest.allowedOperations.map(ref=>catalog.operations.find(x=>v.hash(x.operation)===v.hash(ref)));
if(entries.some(x=>!x)||v.hash(entries.flatMap(x=>x.sourceRequirements))!==v.hash(manifest.requiredSources))throw Error('REPORT_MANIFEST_SOURCE_PIN');
export const reportManifest=()=>v.snapshot(manifest);
export const reportSkillPin=()=>selectSkill(manifest.skillId,manifest.skillVersion).pin;
export const reportSourceIds=Object.freeze(manifest.requiredSources.filter(x=>x.sourceId!=='artifact_versions').map(x=>x.sourceId));
export const reportReadOperation=sourceId=>v.snapshot(entries.find(x=>x.sourceRequirements.some(s=>s.sourceId===sourceId))?.operation);

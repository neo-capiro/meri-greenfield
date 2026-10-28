/** Original immutable recipe/prose identity of the general long-form cited report. It is installed as its
 * own identity quick_skill.cited_report 1.0.0 in packages/skills/assets.json, admitted through the additive
 * retrieval-0.3 identity receiver, so nothing here is presented as any other recipe's prose or pin and the
 * closed retrieval-0.2 foundation keeps refusing an identity it does not know. */
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import manifest from './manifest.json' with {type:'json'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const prose=readFileSync(new URL('./SKILL.md',import.meta.url));
if(manifest.prose.sha256!==digest(prose))throw Error('CITED_REPORT_PROSE_PIN');
const entries=manifest.allowedOperations.map(ref=>catalog.operations.find(x=>v.hash(x.operation)===v.hash(ref)));
if(entries.some(x=>!x)||v.hash(entries.flatMap(x=>x.sourceRequirements))!==v.hash(manifest.requiredSources))throw Error('CITED_REPORT_MANIFEST_SOURCE_PIN');
export const citedReportManifest=()=>v.snapshot(manifest);
export const citedReportSkillPin=()=>selectSkill(manifest.skillId,manifest.skillVersion).pin;
export const citedReportSourceIds=Object.freeze(manifest.requiredSources.filter(x=>x.sourceId!=='artifact_versions').map(x=>x.sourceId));
export const citedReportReadOperation=sourceId=>v.snapshot(entries.find(x=>x.sourceRequirements.some(s=>s.sourceId===sourceId))?.operation);
export const citedReportCatalogPin=()=>v.hash(catalog);

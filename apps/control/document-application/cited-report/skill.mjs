/** Original immutable recipe/prose identity of the general long-form cited report. It is installed as its own
 * identity quick_skill.cited_report 1.0.0 in packages/skills/assets.json and admitted through the versioned
 * retrieval-0.3 manifest receiver, so the closed retrieval-0.2 foundation keeps refusing an identity it does
 * not enumerate and no other recipe's prose or pin is presented as this one's. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import manifest from './manifest.json' with {type:'json'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const prose=readFileSync(new URL('./SKILL.md',import.meta.url));
if(manifest.prose.sha256!==digest(prose))throw Error('CITED_REPORT_PROSE_PIN');
export const citedReportManifest=()=>v.snapshot(manifest);
/** The real operation of each declared evidence source, taken from this recipe's own manifest. */
export const citedReportOperation=operationId=>{
 const reference=manifest.allowedOperations.find(row=>row.id===operationId);
 if(!reference)throw Error('CITED_REPORT_OPERATION');
 return v.snapshot(reference);
};

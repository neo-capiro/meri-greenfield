/** Which required sources of an installed manifest no available allowed operation can read. Pure: the catalog's own
 * `sourceRequirements` say which source each operation reads, so the answer is the manifest's `requiredSources` ids that
 * every one of their allowed operations leaves unavailable. Control admission (before a run exists) and the worker
 * (over its mounted reads) ask the same question; availability itself is decided by the gateway and never here. */
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';
const key=operation=>canonicalSha256({id:operation.id,version:operation.version});
export function unavailableSkillSources(manifest,availableOperations){
 const available=new Set(availableOperations.map(key)),covered=new Set();
 for(const operation of manifest.allowedOperations)if(available.has(key(operation)))for(const source of resolveOperationContract(operation).descriptor.sourceRequirements)covered.add(source.sourceId);
 return Object.freeze([...new Set(manifest.requiredSources.map(source=>source.sourceId))].filter(sourceId=>!covered.has(sourceId)));
}

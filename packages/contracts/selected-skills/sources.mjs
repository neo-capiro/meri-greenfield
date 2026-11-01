/** Which required sources of an installed manifest no available allowed operation can read. Pure: the catalog's own
 * `sourceRequirements` say which source each operation reads, so the answer is the manifest's `requiredSources` ids that
 * every one of their considered operations leaves unavailable. `consideredOperations` (default: every allowed operation)
 * bounds the question to the operations the asking gate decides: a source read only by operations outside that set (an
 * artifact write, a compiler-path read) is not this gate's to refuse. Control admission (before a run exists) and the worker
 * (over its mounted general reads) ask the same question; availability itself is decided by the gateway and never here. */
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';
const key=operation=>canonicalSha256({id:operation.id,version:operation.version});
export function unavailableSkillSources(manifest,availableOperations,consideredOperations=manifest.allowedOperations){
 const allowed=new Set(manifest.allowedOperations.map(key)),available=new Set(availableOperations.map(key)),considered=new Set(),covered=new Set();
 for(const operation of consideredOperations){if(!allowed.has(key(operation)))continue;
  for(const source of resolveOperationContract(operation).descriptor.sourceRequirements){considered.add(source.sourceId);if(available.has(key(operation)))covered.add(source.sourceId);}}
 return Object.freeze([...new Set(manifest.requiredSources.map(source=>source.sourceId))].filter(sourceId=>considered.has(sourceId)&&!covered.has(sourceId)));
}

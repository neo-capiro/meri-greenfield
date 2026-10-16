/** Private version/commitment checks only. Core still owns basis history; these data confer no authority. */
import {own,data} from '../contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../contracts/validate.mjs';
import {coreApplicationSha256} from './core-application-digest.mjs';
export const REGENERATION_REQUEST_VERSION='capiro.objective-strategy.regeneration-request/20261016.1';
export const REGENERATION_RESULT_VERSION='capiro.objective-strategy.regeneration-result/20261016.1';
export const CORE_STRATEGY_BASIS_NAMESPACE='capiro.objective-strategy.basis:v1';
const initial=Object.freeze({kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',versionKey:'candidateVersion',version:'strategy-candidate/20261015.2'});
const regeneration=Object.freeze({kind:'objective.strategy.regeneration',path:'meri-objective-strategy-regeneration.result.json',versionKey:'resultVersion',version:REGENERATION_RESULT_VERSION});
export {initial as OBJECTIVE_DRAFT_PROTOCOL,regeneration as OBJECTIVE_REGENERATION_PROTOCOL};
const refuse=()=>{throw Error('OBJECTIVE_TYPED_RESULT_REFUSED');},uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v),same=(a,b)=>hash(a)===hash(b);
export const canonicalPlanKeys=Object.freeze(['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','bindingVersion','epoch','requestedIntentId','requestedObjectiveRevisionId','requestedObjectiveVersion','snapshotHash']);
export const regenerationRequestKeys=Object.freeze(['requestVersion','operation','requestId','jobId','principal','source','context','applicationTarget','basis','basisSha256','delegation','requestedAtMs','originalExpiresAtMs','inputSha256','input']);
export const regenerationBasisKeys=Object.freeze(['schemaVersion','namespace','canonical','sourceAdmissionSha256','strategyId','expectedStrategyVersionId','snapshot','snapshotSha256','archiveIndex','archiveIndexSha256','sourceIndex','sourceIndexSha256','lastMachineStrategy','provenance']);
export function objectiveDescriptorProtocol(value){for(const p of [initial,regeneration])if(value.kind===p.kind&&value.path===p.path)return p;refuse();}
export function objectiveRequestProtocol(value,association){
 if(value.operation!=='strategy.draft')refuse();
 if(value.candidateVersion===initial.version&&value.requestVersion===undefined&&value.basis===null)return initial;
 if(value.requestVersion===REGENERATION_REQUEST_VERSION&&value.candidateVersion===undefined){assertRegenerationCommitments(value,association);return regeneration;}
 refuse();
}
/** Opaque basis content is validated/reconstructed by Core, never guessed or interpreted as a model grant here. */
export function assertRegenerationCommitments(value,{sourceAdmission,sourceAdmissionSha256}={}){
 const r=data(own(value,regenerationRequestKeys)),t=own(r.applicationTarget,['mode','canonical','expectedStrategyVersionId']),b=own(r.basis,regenerationBasisKeys),c=own(t.canonical,canonicalPlanKeys);
 for(const key of ['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','requestedIntentId','requestedObjectiveRevisionId'])if(!uuid(c[key]))refuse();
 for(const n of [c.bindingVersion,c.requestedObjectiveVersion])if(!Number.isInteger(n)||n<1||n>2147483647)refuse();if(c.epoch!==1||!digest(c.snapshotHash)||!digest(b.sourceAdmissionSha256))refuse();
 if(r.requestVersion!==REGENERATION_REQUEST_VERSION||r.operation!=='strategy.draft'||t.mode!=='regenerate'||!uuid(t.expectedStrategyVersionId)||b.schemaVersion!==1||b.namespace!==CORE_STRATEGY_BASIS_NAMESPACE||!same(b.canonical,c)||b.strategyId!==c.canonicalStrategyId||b.expectedStrategyVersionId!==t.expectedStrategyVersionId||r.basisSha256!==coreApplicationSha256(b)||b.snapshotSha256!==coreApplicationSha256(b.snapshot)||b.archiveIndexSha256!==coreApplicationSha256(b.archiveIndex)||b.sourceIndexSha256!==coreApplicationSha256(b.sourceIndex))refuse();
 if(r.principal.tenantId!==c.tenantId||r.principal.clientId!==c.clientId||r.source.kind!=='objective'||r.source.objectiveId!==c.objectiveId||r.source.objectiveRevisionId!==c.requestedObjectiveRevisionId||r.source.objectiveVersion!==c.requestedObjectiveVersion||r.source.snapshotSha256!==c.snapshotHash||r.inputSha256!==hash(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='inputSha256'))))refuse();
 if(sourceAdmission!==undefined&&(sourceAdmission.expectedStrategyVersionId!==t.expectedStrategyVersionId||!same(sourceAdmission.canonical,c)))refuse();
 if(sourceAdmission!==undefined&&sourceAdmissionSha256!==undefined&&coreApplicationSha256(sourceAdmission)!==sourceAdmissionSha256)refuse();
 if(sourceAdmissionSha256!==undefined&&b.sourceAdmissionSha256!==sourceAdmissionSha256)refuse();return r;
}

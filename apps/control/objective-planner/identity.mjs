/** Private continuation identities. Canonical IDs reserve an association; only Core receipts prove application. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {refuse} from '../product-access/errors.mjs';
export {own,data,hash};
export const fail=(code,outcome)=>refuse('OBJECTIVE_PLANNER_'+code,outcome);
export const same=(a,b)=>hash(a)===hash(b);
export function uuid(v){if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v))fail('INVALID_SELECTION');return v;}
export function digest(v){if(typeof v!=='string'||!/^[a-f0-9]{64}$/u.test(v))fail('INVALID_RECEIPT');return v;}
export function integer(v){if(!Number.isInteger(v)||v<1||v>2147483647)fail('INVALID_RECEIPT');return v;}
export function instant(v){if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('INVALID_RECEIPT');return v;}
export function text(v){if(typeof v!=='string'||!v.length)fail('INVALID_RECEIPT');return v;}
export function actor(v){if(typeof v!=='string'||!v.length||v.length>256||/\s/u.test(v))fail('INVALID_SELECTION');return v;}
export function canonical(value){
 const c=data(own(value,['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','bindingVersion','epoch','requestedIntentId','requestedObjectiveRevisionId','requestedObjectiveVersion','snapshotHash']));
 for(const key of ['bindingVersion','epoch','requestedObjectiveVersion'])integer(c[key]);
 for(const key of ['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','requestedIntentId','requestedObjectiveRevisionId'])uuid(c[key]);
 digest(c.snapshotHash);if(c.epoch!==1)fail('INVALID_SELECTION');return c;
}
export function selection(value){const s=data(own(value,['canonicalPlanId','requestedIntentId','generationJobId']));Object.values(s).forEach(uuid);return s;}
// Stable for the original canonical intent and actor. A different job/version under that intent must conflict, never remint an effect ID.
export function requestId(value){const v=own(value,['canonical','actorId']);canonical(v.canonical);actor(v.actorId);const h=hash({purpose:'objective_strategy_planner_materialization',...v});return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
export function work(value){
 const w=data(own(value,['canonical','actorId','generationJobId','generationRequestId','strategyId','strategyVersionId','strategyReceiptSha256','snapshotDigest','plannerRequestId']));canonical(w.canonical);
 actor(w.actorId);for(const key of ['generationJobId','generationRequestId','strategyId','strategyVersionId','plannerRequestId'])uuid(w[key]);digest(w.strategyReceiptSha256);digest(w.snapshotDigest);
 if(w.strategyId!==w.canonical.canonicalStrategyId||w.plannerRequestId!==requestId({canonical:w.canonical,actorId:w.actorId}))fail('ASSOCIATION_UNAVAILABLE');return w;
}
export const workflowId=value=>{const w=work(value);return 'meri:objective-planner:'+hash({canonical:w.canonical,actorId:w.actorId});};
export function expectedSource(value){const w=work(value),c=w.canonical;return data({generationJobId:w.generationJobId,generationRequestId:w.generationRequestId,clientId:c.clientId,objectiveId:c.objectiveId,objectiveVersion:c.requestedObjectiveVersion,objectiveRevisionId:c.requestedObjectiveRevisionId,strategyId:w.strategyId,strategyVersionId:w.strategyVersionId,snapshotDigest:w.snapshotDigest});}
export function materializationInput(value){const w=work(value);return data({requestId:w.plannerRequestId,generationJobId:w.generationJobId,expected:{strategyId:w.strategyId,strategyVersionId:w.strategyVersionId,objectiveRevisionId:w.canonical.requestedObjectiveRevisionId}});}

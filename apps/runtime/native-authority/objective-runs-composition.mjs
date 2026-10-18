/** One-call control composition of the Objective `runs` native operations, so startControl needs a single splice.
 * Disabled unless the control configuration declares `objectiveGeneration.runs.enabled`. Declared, it always mounts the
 * private application; the owner inside answers `not-started` (nothing written) until every trusted owner exists:
 *   - `authority`: Core's current-claim authority for an Objective-origin admission (no Meri substitute; absent today),
 *   - `template`: the prepared candidate's dynamic-initial-run facts (versions, policy revision, bindings configuration digest,
 *     run window); Objective runs are prepared only by that path, so without it nothing can be admitted. The candidate must
 *     expose it ONLY when the prepared-run splice (run-start-facts.mjs decorator and pair reconstruction) is composed: a run-start
 *     writer without that reader would let an Objective run be prepared as ordinary chat,
 *   - the control pool, conversation store and Temporal client (always present in control).
 * Nothing here reads configuration files, credentials or request data. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createTemporalConversationDispatcher} from '../../control/conversations/temporal-dispatch.mjs';
import {compileObjectiveGenerationConfiguration} from '../objective-generation/configuration.mjs';
import {createObjectiveRunOwner} from '../objective-generation/run-owner.mjs';
import {createPostgresObjectiveRunStartStore} from '../objective-source/postgres-run-starts.mjs';
import {createObjectiveNativeAdmission} from './objective-admission.mjs';
import {createObjectiveRunsApplication} from './objective-runs-http.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_RUNS_CONFIGURATION'),{code:'OBJECTIVE_RUNS_CONFIGURATION'});

export function composeObjectiveRuns(options){
 let o;try{o=own(options,['configuration','controlCapabilitySha256'],['pool','store','client','tenantId','template','authority','now']);}catch{throw fault();}
 const declared=compileObjectiveGenerationConfiguration(o.configuration,'control').runs;
 if(!declared)return Object.freeze({application:createObjectiveRunsApplication({controlCapabilitySha256:o.controlCapabilitySha256}),state:'disabled',tables:Object.freeze([])});
 const now=o.now??Date.now,limits=o.configuration.limits,ready=o.authority!==undefined&&o.template!==undefined&&typeof o.tenantId==='string';
 let owner;
 if(ready){
  const runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool:o.pool,tenantId:o.tenantId,now});
  if(!runStarts.available())throw fault();
  const admission=createObjectiveNativeAdmission({pool:o.pool,store:o.store,authority:o.authority,template:o.template,now,maxRequestMs:limits.requestMs});
  const dispatcher=createTemporalConversationDispatcher({client:o.client,taskQueue:o.configuration.temporal.taskQueue,lifecycle:true,now,maxRequestMs:limits.requestMs});
  owner=createObjectiveRunOwner({enabled:true,runStarts,admission,dispatcher,store:o.store,now});
 }else owner=createObjectiveRunOwner({});
 return Object.freeze({application:createObjectiveRunsApplication({controlCapabilitySha256:o.controlCapabilitySha256,owner,enabled:true,now}),
  state:ready?'composed':'owners-unavailable',
  // Readiness must see the run-start table once the owner can write it (migration 0002 applied).
  tables:Object.freeze(ready?['meri_objective_source.run_starts']:[])});
}

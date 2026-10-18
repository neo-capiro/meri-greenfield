/** Write-intent execution composition, Meri side (dot PR #121 6246551969, items 1-7 assigned to R0). One trusted in-process
 * owner per control process; construction is inert (no SQL, native call, secret read, timer or fetch).
 *
 * `createIntentExecutionOwner(configuration)` -> `{state, missing, bindApprovals, contextFor, commandOptionsFor, issueExecution,
 * intentMountFor}`. `state()` is `disabled` unless `enabled === true`; `unavailable` while any owner below is absent or the shared
 * decision ports are unbound; `composed` only with all of them. Until `composed` every port refuses with the typed
 * `EXECUTION_OWNER_UNAVAILABLE` (NOT_DISPATCHED) or, for the runner mount, `UNAVAILABLE`, before any effect.
 *
 * Owners (all trusted, never request data):
 *  - `trust`               pinned Core issuer + Ed25519 JWKs (`compileExecutionTrust` input)
 *  - `core`                `{origin, getCredentials}`: Core's issuance route and the attended approver's native bearer + service secret
 *  - `allocations`         the conversation store's `allocations` slot (`read({binding, allocationKey}, check)`), whose ADMITTED
 *                          record carries the run's admitted grant set (`resource.grantFactsJsons`)
 *  - `pool`                the borrowed control pool (intent journal, approval metadata, command journal, product budget)
 *  - `selectionFor`        `({binding, signal}) -> {reference, clientId} | null`: the run's trusted client resolution, the SAME
 *                          one the run's preparer used (TaskCreateContext)
 *  - `preparePolicy`       Core's approval-metadata policy owner (`createTaskCreateApprovalMetadataOwner`)
 *  - `authorizeBusiness`, `authorizeSources`   Core's canonical current membership/client/policy and source owners, in the
 *                          exact `current-tool-authority.mjs` port shapes. No Meri owner stands in for them.
 *  - `currentRights`       Core's current rights for the per-run result release (`result-release-authority.mjs`)
 *  - `source`              `{origin, getServiceSecret}` for Core's `create_task` tool route
 *  - `sourceEnabled`       G1; must be true
 *  - `bindApprovals({approvalStore, readDecision})`   late-bound once by the intents family (`product-ports/intents.mjs`) to
 *                          the shared native decision adapter, so every executor rechecks the decision the decide route recorded.
 *
 * Suppliers (dot item 6): `currentRun`/`currentAllocation` always come from `createPostgresAdmittedRunOwner` over the run's
 * admitted grant set and installed allocation; `issueExecution` is `execution-issuance.mjs`, whose successful issuance installs
 * the token's grant on the run's existing allocation (`../../gateway/budget/execution-grant-admission.mjs`, lane X) before any
 * receipt; the executor's trusted grant is `execution-grant.mjs` over the existing `bindTrustedGrant` (that ACTIVE row). The
 * run-terminal cleanup revokes the execution grants with the admitted set. The approval-wait/continuation guard (dot
 * item 4): nothing here is reachable from the lifecycle. `issueExecution` is called only by the decide route after Core recorded
 * an approved decision; its <=120 s token is handed to exactly one executor for exactly one proposal and is never retained,
 * returned to the runner or accepted by any other port. */
import {types} from 'node:util';
import {canonicalSha256 as hash,validateShape,assertProposalIntegrity} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {taskUpdateValidators} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandIntentValidator} from '../../../packages/contracts/commands-0.2/execution-intent.mjs';
import {createCurrentToolAuthority} from '../../gateway/authorization/current-tool-authority.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {PostgresBudgetStore} from '../../gateway/budget/postgres-budget-store.mjs';
import {createExecutionGrantAdmission} from '../../gateway/budget/execution-grant-admission.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../../control/commands/approval-metadata/index.mjs';
import {createPostgresCommandJournal} from '../../control/commands/postgres-command-journal.mjs';
import {createPostgresCommandExecutor} from '../../control/commands/durable-executor.mjs';
import {createCommandHttpSource} from '../../control/commands/source-http.mjs';
import {createCommandIntentPreparer} from '../../control/intents/command-preparer.mjs';
import {createIntentMount} from '../../control/intents/mount.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {createIntentResultReleaseAuthority} from '../../control/intents/result-release-authority.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {compileExecutionTrust,verifyExecutionCapability,assertExecutionCorrelation,executionFault} from './execution-capability.mjs';
import {createCoreExecutionIssuance} from './execution-issuance.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
import {compileIntentsConfiguration,createIntentsFamilyWith} from '../product-ports/intents.mjs';
import {executionGrantFacts,bindExecutionGrant} from './execution-grant.mjs';
const entry=resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor;
const DESCRIPTOR=Object.freeze({action:'task.create',operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements});
export const EXECUTION_PRODUCER_NAMESPACE='meri.intents.execution';
const OWNERS=['trust','core','allocations','pool','selectionFor','preparePolicy','authorizeBusiness','authorizeSources','currentRights','source'];
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const same=(a,b)=>hash(a)===hash(b);
const unavailable=()=>new ProductError('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
const configurationFault=()=>executionFault('EXECUTION_CONFIGURATION');
/** The run's admitted grant set and installed allocation, and the existing admitted-run owner over them. Read-only. */
export function createAdmittedRunSource({pool,allocations,now,limits}){
 const read=allocations?.read;if(!ordinary(read)||typeof pool?.connect!=='function'||!ordinary(now))throw configurationFault();
 const store=new PostgresBudgetStore(pool,{namespace:'product'});
 return Object.freeze({async admittedFor({binding,signal}){
  nativeSignal(signal);validateShape('RunBinding',binding);const check=()=>{if(signal?.aborted)throw executionFault('CANCELLED');};
  const saved=data(await read.call(allocations,{binding,allocationKey:hash(binding)},check)),r=saved?.record;check();
  if(!r||r.state!=='ADMITTED'||!same(r.binding,binding)||!Array.isArray(r.resource?.grantFactsJsons))throw unavailable();
  const rows=await store.transact(async client=>(await client.query(`SELECT allocation,allocation_sha256 FROM ${store.tables.tool_run_allocations} WHERE run_id=$1`,[binding.runId])).rows,check,undefined,true);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].allocation_sha256!==r.allocationSha256||hash(rows[0].allocation)!==r.allocationSha256)throw unavailable();
  const allocationJson=JSON.stringify(rows[0].allocation),grantFactsJsons=[...r.resource.grantFactsJsons];
  let set;try{set=parseAdmittedGrantSet({allocationJson,grantFactsJsons});}catch{throw unavailable();}
  if(!same(set.facts[0].binding,binding))throw unavailable();
  const owner=createPostgresAdmittedRunOwner({pool,allocationJson,grantFactsJsons,namespace:'product',now,limits});
  const q=set.facts[0].qualificationBinding,qualification=data({runId:q.runId,attempt:q.attempt,workerArn:q.workerArn,fence:q.fence,policyRevision:q.policyRevision});
  return Object.freeze({binding:data(binding),allocationJson,grantFactsJsons:Object.freeze(grantFactsJsons),qualification,owner});
 }});
}
export function createIntentExecutionOwner(configuration){
 const c=own(configuration??{},['enabled'],[...OWNERS,'sourceEnabled','fetchImpl','now','newId','limits']);
 if(typeof c.enabled!=='boolean'||c.sourceEnabled!==undefined&&typeof c.sourceEnabled!=='boolean')throw configurationFault();
 const now=c.now??Date.now,newId=c.newId??(()=>globalThis.crypto.randomUUID()),fetchImpl=c.fetchImpl??globalThis.fetch;
 const limits=c.limits===undefined?{maxRequestMs:10000,maxFactBytes:131072,maxResponseBytes:262144,maxCleanupMs:3000}:data(own(c.limits,['maxRequestMs','maxFactBytes','maxResponseBytes','maxCleanupMs']));
 if(!ordinary(now)||!ordinary(newId)||!ordinary(fetchImpl)||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||
  !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072||!Number.isSafeInteger(limits.maxResponseBytes)||limits.maxResponseBytes<1||limits.maxResponseBytes>1048576||
  !Number.isSafeInteger(limits.maxCleanupMs)||limits.maxCleanupMs<1||limits.maxCleanupMs>60000)throw configurationFault();
 // Shapes are checked now (inert), so a misconfigured owner fails startup rather than a request.
 const trust=c.trust===undefined?undefined:compileExecutionTrust(c.trust);
 const core=c.core===undefined?undefined:own(c.core,['origin','getCredentials']);
 const source=c.source===undefined?undefined:own(c.source,['origin','getServiceSecret']);
 for(const fn of [c.selectionFor,c.preparePolicy,c.authorizeBusiness,c.authorizeSources,c.currentRights,core?.getCredentials,source?.getServiceSecret])if(fn!==undefined&&!ordinary(fn))throw configurationFault();
 if(c.pool!==undefined&&(c.pool===null||typeof c.pool!=='object'||types.isProxy(c.pool)||typeof c.pool.connect!=='function'))throw configurationFault();
 const admitted=c.pool===undefined||c.allocations===undefined?undefined:createAdmittedRunSource({pool:c.pool,allocations:c.allocations,now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes}});
 let approvals=null;
 const missing=()=>Object.freeze([...OWNERS.filter(k=>c[k]===undefined),...(c.sourceEnabled===true?[]:['sourceEnabled']),...(approvals?[]:['approvals'])]);
 const state=()=>c.enabled!==true?'disabled':missing().length?'unavailable':'composed';
 const issuance=c.enabled===true&&trust&&core&&admitted?createCoreExecutionIssuance({origin:core.origin,trust,getCredentials:core.getCredentials,fetchImpl,now,
  executorFor:async({proposal,signal})=>{const run=await admitted.admittedFor({binding:proposal.command.binding,signal});return {binding:run.binding,currentAllocationJson:await run.owner.currentAllocation(run.binding,{signal}),qualification:run.qualification};},
  // Dot item 5: the verified token's grant, installed on the run's existing allocation by the gateway budget owner (lane X).
  installGrant:async({verified,executorBinding,signal})=>{
   const run=await admitted.admittedFor({binding:executorBinding,signal});
   const facts=executionGrantFacts({verified,admitted:{allocationJson:run.allocationJson,grantFactsJsons:run.grantFactsJsons}});
   const installer=createExecutionGrantAdmission({pool:c.pool,allocationJson:run.allocationJson,grantFactsJsons:run.grantFactsJsons,namespace:'product',now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes}});
   return installer.install({facts,expiresAtMs:verified.expiresAtMs,signal});},
  readDecision:value=>approvals.readDecision(value),limits:{maxRequestMs:limits.maxRequestMs,maxResponseBytes:Math.min(limits.maxResponseBytes,65536),maxSkewMs:1000}}):undefined;
 const composed=()=>{if(state()!=='composed')throw unavailable();};
 async function contextFor(proposal){
  composed();const p=data(proposal);assertProposalIntegrity(p);
  const clientResolution=data(await c.selectionFor({binding:p.command.binding}));
  return data({binding:p.command.binding,clientResolution});
 }
 function taskCreateOptions(context,executor){
  const approvalMetadataOwner=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:c.pool}),commandContext:context,preparePolicy:c.preparePolicy,now,newId,maxRequestMs:limits.maxRequestMs});
  return Object.freeze({operation:entry.operation,action:'task.create',outputShape:entry.outputSchema.id.split('#/$defs/')[1],commandContext:context,validators:commandToolValidators,
   assertProposal:assertProposalIntegrity,approvalMetadataOwner,executor,now,limits:data({maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes})});
 }
 /** The executor for one proposal's run. It is built per capability: the grant facts include the exact token digest. */
 function deferredExecutor(context){
  return Object.freeze({async execute(payload,credential,signal){
   composed();nativeSignal(signal);
   const v=data(own(payload,['proposal','execution']));
   // Before any SQL: the token verifies, is exactly this request, and matches this proposal and executor binding.
   const verified=verifyExecutionCapability(credential,trust,{nowMs:now()});
   if(!same(verified.request,v.execution)||!same(context.binding,v.proposal.command.binding))throw executionFault('EXECUTION_CAPABILITY_MISMATCH');
   const body=assertExecutionCorrelation({verified,proposal:v.proposal,executorBinding:v.execution.executorBinding,requestId:v.execution.requestId});
   const run=await admitted.admittedFor({binding:v.execution.executorBinding,signal});
   const facts=executionGrantFacts({verified,admitted:{allocationJson:run.allocationJson,grantFactsJsons:run.grantFactsJsons}});
   const authority=createCurrentToolAuthority({now,maxFactBytes:limits.maxFactBytes,capabilityAction:'command.execute',ports:{
    // Every authority check re-verifies the same token and its comparison to the actual request (dot receiver requirement 1).
    async verifyCapability(presented){
     const again=verifyExecutionCapability(presented,trust,{nowMs:now()});
     if(again.credentialSha256!==verified.credentialSha256)throw executionFault('EXECUTION_CAPABILITY_MISMATCH');
     assertExecutionCorrelation({verified:again,proposal:v.proposal,executorBinding:v.execution.executorBinding,requestId:v.execution.requestId});
     return again.claimsJson;},
    currentRun:(binding,options)=>run.owner.currentRun(binding,options),
    authorizeBusiness:value=>c.authorizeBusiness(value),authorizeSources:value=>c.authorizeSources(value)}});
   // The Core tool body is the deterministic projection bound above (null clientId/dueDate omitted); anything else never leaves.
   const boundFetch=(url,init)=>{let sent;try{sent=hash(JSON.parse(init?.body));}catch{sent=null;}
    if(new URL(url).pathname!=='/api/clio/tools/'+body.sourceTool||init?.method!=='POST'||sent!==body.sourceBodySha256)throw executionFault('EXECUTION_SOURCE_BODY_MISMATCH');
    return fetchImpl(url,init);};
   const commandSource=createCommandHttpSource({origin:source.origin,now,maxResponseBytes:limits.maxResponseBytes,fetchImpl:boundFetch,
    getCredentials:async({binding,signal:s})=>({binding,bearerToken:credential,serviceSecret:await source.getServiceSecret({binding,purpose:'command.execute',signal:s}),expiresAtMs:verified.expiresAtMs})});
   const durable=createPostgresCommandExecutor({pool:c.pool,allocationJson:run.allocationJson,
    producerContext:{context:facts,producer:{namespace:EXECUTION_PRODUCER_NAMESPACE,executionId:verified.claims.capabilityId}},
    journal:createPostgresCommandJournal({pool:c.pool}),authority,approvalStore:approvals.approvalStore,source:commandSource,
    contracts:createCommandIntentValidator({taskUpdate:taskUpdateValidators}),descriptor:DESCRIPTOR,context,now,newId,
    limits:{maxRequestMs:limits.maxRequestMs,maxResponseBytes:limits.maxResponseBytes,maxCleanupMs:limits.maxCleanupMs},sourceEnabled:c.sourceEnabled===true});
   // The existing grant owner on the same allocation must already hold the ACTIVE row; this never creates or activates it.
   await bindExecutionGrant({bindTrustedGrant:durable.bindTrustedGrant,facts,check:()=>{if(signal?.aborted)throw executionFault('CANCELLED');}});
   return durable.execute({proposal:v.proposal,execution:v.execution},credential,signal);
  }});
 }
 async function commandOptionsFor(value){
  composed();const v=own(value,['proposal'],['signal']);nativeSignal(v.signal);
  const context=await contextFor(v.proposal);return taskCreateOptions(context,deferredExecutor(context));
 }
 async function issueExecution(value){composed();return issuance.issueExecution(value);}
 /** P-INT-9 per-run intent mount for `createPreparedRunRegistry({intentMountFor})`. Prepare-only; never executes. */
 async function intentMountFor(value){
  const v=own(value,['binding','original'],['signal']);nativeSignal(v.signal);
  if(state()!=='composed')throw intentFault('UNAVAILABLE');
  const binding=data(v.binding);validateShape('RunBinding',binding);if(!same(v.original?.binding,binding))throw intentFault('UNAVAILABLE');
  let run,clientResolution;
  try{run=await admitted.admittedFor({binding,signal:v.signal});clientResolution=data(await c.selectionFor({binding,signal:v.signal}));}catch{throw intentFault('UNAVAILABLE');}
  const refuseExecution={async execute(){throw intentFault('REFUSED');}};
  const preparer=createCommandIntentPreparer({commandOptions:taskCreateOptions(data({binding,clientResolution}),refuseExecution)});
  return createIntentMount({binding,preparers:[preparer],journalStore:createPostgresIntentJournalStore({pool:c.pool}),now,limits:{maxRequestMs:limits.maxRequestMs},enabled:true,
   resultRelease:createIntentResultReleaseAuthority({binding,currentRun:(b,o)=>run.owner.currentRun(b,o),currentRights:value=>c.currentRights(value),now,maxFactBytes:limits.maxFactBytes})});
 }
 return Object.freeze({state,missing,
  bindApprovals(value){
   const v=own(value,['approvalStore','readDecision']);if(approvals!==null||!ordinary(v.readDecision)||!ordinary(v.approvalStore?.getCurrent))throw configurationFault();
   approvals=Object.freeze({approvalStore:Object.freeze({getCurrent:x=>v.approvalStore.getCurrent(x)}),readDecision:x=>v.readDecision(x)});
  },
  contextFor,commandOptionsFor,issueExecution,intentMountFor});
}
/** Control-startup helper for the composer (cli/control/prepared-candidate). `family` replaces the `intents` entry of
 * `PRODUCT_FAMILIES`; on the first trusted context it builds ONE owner over that context's pool and configuration and binds it
 * into the shared intents composition. `intentMountFor` is the registry's P-INT-9 seam, late-bound to that owner (UNAVAILABLE
 * until built). With `intents.enabled` but no `intents.execution` block the owner is `disabled`; with the block it stays
 * `unavailable` until Core's issuance credentials, approval-metadata policy, business/source authority and result-release rights
 * owners are supplied (`owners`), which no production code does today. */
export function createControlIntentExecution({readSecret,owners={}}={}){
 if(!ordinary(readSecret))throw configurationFault();
 const extra=own(owners,[],['core','preparePolicy','authorizeBusiness','authorizeSources','currentRights']);
 let built=null;
 function build(context){
  const configuration=context.configuration,intents=compileIntentsConfiguration(configuration),e=intents.execution;
  const clientResolution=configuration.nativeCandidate===undefined?null:compilePreparedCandidateConfiguration(configuration.nativeCandidate,configuration.versions).identity.commandContext.clientResolution;
  return createIntentExecutionOwner({enabled:intents.enabled===true&&e!==undefined,now:context.now,sourceEnabled:configuration.sourceEnabled===true,
   ...(intents.enabled===true&&e!==undefined?{trust:{issuer:e.issuer,keys:e.keys},pool:context.pool,allocations:createPostgresConversationStore({pool:context.pool}).allocations,
    selectionFor:async()=>clientResolution,source:{origin:e.coreOrigin,getServiceSecret:async()=>(await readSecret(e.serviceSecretFile)).toString('utf8').trim()},...extra}:{})});
 }
 return Object.freeze({
  family(context){if(built===null)built={context,owner:build(context)};else if(built.context!==context)throw configurationFault();return createIntentsFamilyWith({execution:built.owner})(context);},
  async intentMountFor(value){if(built===null)throw intentFault('UNAVAILABLE');return built.owner.intentMountFor(value);},
  state:()=>built===null?'unbuilt':built.owner.state(),missing:()=>built===null?[]:built.owner.missing()});
}

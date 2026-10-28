/** Content-free current-tenant accounting. No principal selectors, credits or execution authority. */
export const USAGE_OVERVIEW_SCHEMA='meri.usage-overview/1',USAGE_OVERVIEW_PATH='/api/conversations/usage-overview';
export const overviewStates=Object.freeze(['queued','starting','running','waiting-for-approval','paused','completed','failed','cancelled']);
export const usageOverviewErrors=Object.freeze({INVALID_REQUEST:[400],UNAUTHENTICATED:[401],ACCESS_DENIED:[403],MEMBERSHIP_REVOKED:[403],NOT_FOUND:[404],METHOD_NOT_ALLOWED:[405],DEADLINE:[408],MEMBERSHIP_CHANGED:[409],REQUEST_TOO_LARGE:[413],UNSUPPORTED_MEDIA_TYPE:[415],CANCELLED:[499],PRODUCT_UNAVAILABLE:[502],USAGE_OVERVIEW_REQUEST_INVALID:[400],USAGE_OVERVIEW_CORRUPT:[500],USAGE_OVERVIEW_UNAVAILABLE:[503]});
export const usageOverviewMetadata=Object.freeze({schemaId:'urn:meri:usage-overview:1.0.0',version:'1.0.0',path:USAGE_OVERVIEW_PATH,method:'POST',requestBytes:1024,responseBytes:16384,
 authentication:'current native tenant membership, rechecked before release',scope:'tenant aggregate numbers only; no conversation, client or other member identifiers',
 currency:'USD',money:'integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost',
 periods:'UTC day, ISO Monday week and calendar month; attempt cohorts use run.createdAt, admission cap uses sdk_usage_recorded_at',
 limits:'current canonical SDK limits and tenant admission cap; no reservations or budget editing',
 capacity:'recorded durable states only; no physical worker concurrency or available capacity observation',
 economics:'attempts are not complete jobs; provider billing and complete-job economics unavailable'});
export function usageOverviewPeriods(at){
 const date=new Date(at);if(!Number.isSafeInteger(at)||!Number.isFinite(date.getTime()))throw Error('USAGE_OVERVIEW_CLOCK');
 const day=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()),week=day-((date.getUTCDay()+6)%7)*86400000;
 const month=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1),nextMonth=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
 return [['day',day,day+86400000],['week',week,week+7*86400000],['month',month,nextMonth]].map(([kind,start,end])=>({kind,startInclusive:new Date(start).toISOString(),endExclusive:new Date(end).toISOString()}));
}

/** Explicit successor source version on the same closed route. The wire version changes because the
 * response meaning changed: run-level attempts and conversation threads, measured counters, an
 * estimated list-price charge and honest unknowns replace labels that could read as job economics. */
export const USAGE_OVERVIEW_SCHEMA_V2='meri.usage-overview/2';
export const usageOverviewLineageClasses=Object.freeze(['root','fork','resume','unknown-lineage']);
export const usageOverviewLineageBasis='sdk_usage.parentRunId plus the run binding writerFence: absent parent = root thread start; writerFence 1 = fork into a separate logical thread; writerFence 2 or more = resume continuation of the same thread';
export const usageOverviewCounterNames=Object.freeze(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests','toolInvocations','toolFailures']);
export const usageOverviewBases=Object.freeze(['measured','estimated','inside-another-counter','unresolved','unavailable']);
/** The measurement basis of every cost category, declared once so a category with no counter anywhere
 * stays unresolved instead of becoming an invented zero. `cost` is the SDK list-price estimate the
 * native cap already owns: an estimate, never an invoice. Sources: apps/control/conversations/usage.mjs
 * (SDK_USAGE_BASIS, accountSdkUsage: "modelUsage includes subagents/compaction and is cumulative across
 * resume/fork", "Thinking is already in outputTokens") and packages/contracts/runtime-0.2/usage.mjs.
 * Verification is NOT named on that source line, so it stays unresolved rather than inferred from a name. */
export const usageOverviewCostCategories=Object.freeze({inputTokens:'measured',outputTokens:'measured',reasoningTokens:'inside-another-counter',
 cacheReadInputTokens:'measured',cacheCreationInputTokens:'measured',webSearchRequests:'measured',toolInvocations:'measured',toolOutcomes:'measured',
 cost:'estimated',providerBilledMicroUsd:'unresolved',subagentCost:'inside-another-counter',compactionCost:'inside-another-counter',
 verificationCost:'unresolved',infrastructureCost:'unresolved',retryCost:'unresolved',fallbackCost:'unresolved',extractionCost:'unresolved',activityCapacity:'unresolved'});
export const usageOverviewDenominators=Object.freeze({
 attempts:'run rows in the ledger; one run is one attempt or turn, never a job',
 conversationThreads:'distinct conversation_id with at least one run created in the period; a thread may host several attempts',
 sustainedJobs:'canonical ROOT Work/Delegate objectives: the run whose stored request carries request.work with entry start-work|delegate, together with every run that continues it through the persisted continuation custody. A child assignment, conversation thread, SDK attempt or one completed run is never a job'});
/** Whole-job vocabulary. `cancelled` is broken out of `failed` rather than hidden inside it, and an
 * objective that is not settled by the existing completion owner is `unclosed`, never `successful`. */
export const usageOverviewJobStates=Object.freeze(['successful','partial','failed','cancelled','unclosed']);
export const usageOverviewJobWindow='root revision created within the admitted month window';
export const usageOverviewJobWindowEdge='a revision created after the window is not read, so a job whose continuation falls outside the window is reported from the revisions inside it only, and a continuation whose root revision is outside the window is excluded and counted';
export const usageOverviewJobDefinition='one whole job is the canonical ROOT Work/Delegate objective across its continuations and current goal revision; it is never a child assignment, conversation thread, SDK attempt or one completed run';
export const usageOverviewJobLineage='a run continues another objective only when the canonical continuation owner verifies that run stored continuation envelope in the same transaction and that envelope is a resume naming that source run stored request, so its source request digest equals the source run request_sha256; a fork and a run without that verified custody each start a new objective, because the canonical prompt identity owner makes a fork and a next prompt new logical prompts';
export const usageOverviewJobClosure='the existing completion producer decides. successful = every current revision is completed and carries a PUBLISHED native-session completion capture whose identity pins that revision, with no unresolved successor and no unsettled child receipt; failed = every current revision reached failed; cancelled = every current revision reached cancelled; partial = a current revision is still in flight, or terminal revisions carry mixed outcomes; unclosed = a current revision is terminal without that closure proof, or a continuation control is unresolved (not APPLIED, or its successor revision is outside this read window), or a child receipt is unresolved';
/** The exact durable whole-job read this projection consumes: the existing completion producer's own
 * native-session capture joined over the persisted run and control lineage. No second store is created. */
export const usageOverviewJobInterface=Object.freeze({
 owner:'the existing lifecycle completion producer (meri_conversations.completion_checkpoints) read over the existing run and control lineage; no second store, ledger, scheduler or table is created',
 read:'per objective: the root revision digest, every continuation revision, each revision recorded run state, its canonical continuation custody verdict, its published native-session completion capture, its last APPLIED steer control and its child assignment/result settlement counts',
 identity:'the root revision digest (request_sha256 of the job-start run) plus the current goal revision (tail run request_sha256 and the last APPLIED steer control controlId, inputSha256 and controlSequence, exactly as the child-assignment revision owner reports them: assertRevision in lifecycle/child-assignments.mjs)',
 closure:'a revision is settled when the completion producer published its native-session capture for that revision; the objective closes only when every current revision is settled with no unresolved successor and no unsettled child, where a continuation control is unresolved unless it is APPLIED and its successor revision is a work revision inside this read window',
 absent:'a run without request.work is not a job; an objective whose current revisions are not settled stays unclosed and is never counted successful'});
export const usageOverviewMetadataV2=Object.freeze({...usageOverviewMetadata,schemaId:'urn:meri:usage-overview:2.0.0',version:'2.0.0',responseBytes:32768,
 periods:'UTC day, ISO Monday week and calendar month; attempt cohorts and conversation threads use run.createdAt, whole jobs use the root revision createdAt, admission cap uses sdk_usage_recorded_at',
 economics:'attempts, conversation threads and canonical root Work/Delegate objectives with successful/partial/failed/cancelled/unclosed separated; the charge is an SDK list-price estimate; provider billing and physical capacity are unavailable'});

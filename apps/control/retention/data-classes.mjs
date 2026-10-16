/** The complete retained data-class inventory: the one registry the retention policy, reference enumeration, purge planning and the
 * row owners derive their class vocabularies from. Each class names its canonical owner, the subject kind that owns it, where it is
 * stored, how it leaves (deletion path), which retention rule governs it, and how serving is suppressed before any read.
 *
 * Deletion paths:
 * - `row-target`: exact database rows deleted by the row owner inside the purge transaction (the row port must support the class,
 *   otherwise its preflight refuses the whole plan with zero effects);
 * - `object-version`: exact storage object versions referenced by the class's rows (bytes leave through the version storage port);
 * - `external-request`: the data is owned outside Meri and leaves only through that owner; while no deletion port exists, a plan
 *   carrying it is BLOCKED (`EXTERNAL_DELETION_UNAVAILABLE`), so a purge never reports EXECUTED while leaving it behind;
 * - `retain`: identifier-only evidence kept under its own rule (financial liability, operational logs); never deleted by a subject
 *   purge and never blocking it; the policy must mark it not purgeable.
 * Serving: `retention-read-gate` names the serving owner that consults the canonical read gate before every read; `admission-gate`
 * means the data is only ever served to a run that the gated conversation owner admitted (suppression cancels in-flight runs);
 * `not-served` means no product read path returns it; `external` means its owner serves it outside Meri.
 * A `planned` class has no data yet: it is listed so its owner, rule and deletion path are fixed before it exists, it is absent from
 * the policy, and an inventory that carries it is refused. Pure data; importing this module has no effect. */
const entry=value=>Object.freeze({...value,subjectKinds:Object.freeze(value.subjectKinds),tables:Object.freeze(value.tables??[]),serving:Object.freeze(value.serving)});
export const dataClasses=Object.freeze([
 entry({id:'conversation',label:'conversations and runs',status:'active',subjectKinds:['conversation'],storage:'rows+objects',tables:['meri_conversations.conversations','meri_conversations.runs','meri_conversations.controls'],owner:'apps/control/conversations/postgres-store.mjs',deletion:'row-target',rule:'policy',serving:{gate:'retention-read-gate',owner:'apps/control/conversations/service.mjs'}}),
 entry({id:'events',label:'run events',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_conversations.events'],owner:'apps/control/conversations/postgres-store.mjs',deletion:'row-target',rule:'policy',serving:{gate:'retention-read-gate',owner:'apps/control/conversations/service.mjs'}}),
 entry({id:'lifecycle',label:'lifecycle checkpoints',status:'active',subjectKinds:['conversation'],storage:'rows+objects',tables:['meri_conversations.checkpoints'],owner:'apps/control/conversations/lifecycle/journal.mjs',deletion:'row-target',rule:'policy',serving:{gate:'admission-gate',owner:'apps/control/conversations/lifecycle/service.mjs'}}),
 entry({id:'completionCheckpoints',label:'completion checkpoints',status:'active',subjectKinds:['conversation'],storage:'rows+objects',tables:['meri_conversations.completion_checkpoints'],owner:'apps/control/conversations/completion-journal.mjs',deletion:'row-target',rule:'policy',serving:{gate:'admission-gate',owner:'apps/control/conversations/lifecycle/service.mjs'}}),
 entry({id:'nextRuns',label:'next-run successors',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_conversations.next_runs'],owner:'apps/control/conversations/next-run-journal.mjs',deletion:'row-target',rule:'policy',serving:{gate:'admission-gate',owner:'apps/control/conversations/lifecycle/service.mjs'}}),
 entry({id:'sdkSession',label:'SDK session mirror',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_conversations.sdk_session_entries'],owner:'apps/runtime/native-authority/session-owner.mjs',deletion:'row-target',rule:'policy',serving:{gate:'admission-gate',owner:'apps/control/conversations/lifecycle/service.mjs'}}),
 entry({id:'selectedOutputs',label:'selected outputs and reads',status:'active',subjectKinds:['conversation'],storage:'rows+objects',tables:['meri_conversations.selected_outputs','meri_conversations.selected_reads'],owner:'apps/runtime/selected/ledger.mjs',deletion:'row-target',rule:'policy',serving:{gate:'retention-read-gate',owner:'apps/control/conversations/service.mjs'}}),
 entry({id:'nativeJournals',label:'native execution, allocation and restoration journals',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_conversations.native_executions','meri_conversations.native_allocations','meri_conversations.native_restorations'],owner:'apps/control/conversations/execution-journal.mjs',deletion:'row-target',rule:'policy',serving:{gate:'not-served',owner:'apps/control/conversations/execution-journal.mjs'}}),
 entry({id:'artifactVersions',label:'artifacts and their immutable versions',status:'active',subjectKinds:['artifact'],storage:'rows+objects',tables:['meri_artifacts.versions','meri_artifacts.heads'],owner:'apps/artifacts/storage/postgres-versions.mjs',deletion:'row-target',rule:'policy',serving:{gate:'retention-read-gate',owner:'apps/artifacts/service.mjs'}}),
 entry({id:'uploads',label:'stored uploaded objects',status:'active',subjectKinds:['conversation'],storage:'objects',owner:null,pendingOwner:'chat attachments (save_chat_attachments and read_chat_attachments are selected but not yet implemented)',deletion:'object-version',rule:'policy',serving:{gate:'not-served',owner:null}}),
 entry({id:'schedules',label:'schedules and schedule intents',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_schedules.projections','meri_schedules.intents'],owner:'apps/control/schedules/postgres-schedule-owner.mjs',deletion:'row-target',rule:'policy',serving:{gate:'admission-gate',owner:'apps/control/conversations/lifecycle/service.mjs'}}),
 entry({id:'receipts',label:'command, approval, issuance and task-lookup receipts',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_command_journal','meri_approval_metadata','meri_conversations.run_issuances','meri_task_lookup.lookups','meri_task_lookup.events'],owner:'apps/control/commands/postgres-command-journal.mjs',deletion:'row-target',rule:'policy',serving:{gate:'not-served',owner:'apps/control/commands/postgres-command-journal.mjs'}}),
 entry({id:'memoryProposals',label:'memory proposals',status:'active',subjectKinds:['conversation'],storage:'external',owner:'apps/gateway/sources/memory-proposals/http-adapter.mjs',deletion:'external-request',rule:'policy',serving:{gate:'external',owner:'apps/gateway/sources/memory-proposals/http-adapter.mjs'}}),
 entry({id:'budgets',label:'budget reservations and settlements',status:'active',subjectKinds:['conversation'],storage:'rows',tables:['meri_product_budget.runs','meri_product_budget.requests','meri_product_budget.tenant_run_reservations'],owner:'apps/gateway/budget/postgres-budget-store.mjs',deletion:'retain',rule:'policy-retained',serving:{gate:'not-served',owner:'apps/gateway/budget/postgres-budget-store.mjs'}}),
 entry({id:'logs',label:'operational logs',status:'active',subjectKinds:['conversation','artifact'],storage:'external',owner:'apps/runtime/cli.mjs',deletion:'retain',rule:'policy-retained',serving:{gate:'not-served',owner:'apps/runtime/cli.mjs'}}),
 entry({id:'telemetry',label:'redacted telemetry exports',status:'active',subjectKinds:['conversation','artifact'],storage:'external',owner:'apps/runtime/telemetry/redaction.mjs',deletion:'retain',rule:'policy-retained',serving:{gate:'not-served',owner:'apps/runtime/telemetry/redaction.mjs'}}),
 entry({id:'editorDrafts',label:'Office editor drafts (owner decision Q-O9: private, 7 days after last activity, destroyed on suppression or loss of access)',status:'planned',subjectKinds:['artifact'],storage:'rows+objects',owner:null,pendingOwner:'Office editor session owner (after the initial live version)',deletion:'row-target',rule:'policy',serving:{gate:'retention-read-gate',owner:null}}),
]);
const active=dataClasses.filter(c=>c.status==='active');
/** Every active class, in registry order: the exact class set a retention policy configures. */
export const policyClasses=Object.freeze(active.map(c=>c.id));
/** Classes a subject purge never deletes and that never block it (identifier-only evidence); the policy marks them not purgeable. */
export const retainedClasses=Object.freeze(active.filter(c=>c.deletion==='retain').map(c=>c.id));
/** Classes owned outside Meri whose deletion needs that owner; without a deletion port they block the plan. */
export const externalRequestClasses=Object.freeze(active.filter(c=>c.deletion==='external-request').map(c=>c.id));
/** Classes deleted as exact database rows, and the one subject kind whose purge may delete each. */
export const rowTargetClasses=Object.freeze(active.filter(c=>c.deletion==='row-target').map(c=>c.id));
export const rowTargetSubjectKind=Object.freeze(Object.fromEntries(active.filter(c=>c.deletion==='row-target').map(c=>[c.id,c.subjectKinds[0]])));
export const plannedClasses=Object.freeze(dataClasses.filter(c=>c.status==='planned').map(c=>c.id));
export const dataClass=id=>dataClasses.find(c=>c.id===id)??null;

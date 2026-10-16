// @ts-check
/** The one registry of governed conversational write requests (`meri_intents`, proposal P10, approved by the owner on
 * 15 Oct 2026). It covers exactly the 11 selected non-read capabilities the scope ledger routes through INTENT-ROUTE.
 * Each row names the intent tool, the canonical owner kind that PREPARES it, and, where no canonical owner can prepare
 * it yet, the explicit reason it stays unavailable. Display text and schema identities come only from the canonical
 * catalog descriptor. Data only, safe to import.
 *
 * Owner kinds (all existing control owners; this module invents none):
 * - `command`: `apps/control/commands/tool-interface.mjs` `prepare` with its approval-metadata owner.
 * - `schedule`: `apps/control/schedules/tool-interface.mjs` with a trusted context whose `approval` is null.
 * - `document`: the artifact write owner behind `apps/control/document-application` (immutable draft version).
 * - `artifact`: the artifact analysis owner (no governed route yet). */
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
export const INTENT_SERVER_NAME='meri_intents';
export const INTENT_TOOL_PREFIX=`mcp__${INTENT_SERVER_NAME}__`;
/** @typedef {{id:string,version:string}} OperationRef */
/** @typedef {'command'|'schedule'|'document'|'artifact'} OwnerKind */
/** @typedef {{operation:OperationRef,tool:string,owner:OwnerKind,unavailable:string|null}} IntentRow */
const op=(/** @type {string} */id)=>Object.freeze({id,version:'0.2.0'});
const row=(/** @type {string} */id,/** @type {string} */tool,/** @type {OwnerKind} */owner,/** @type {string|null} */unavailable=null)=>Object.freeze({operation:op(id),tool,owner,unavailable});
/** @type {readonly IntentRow[]} */
export const INTENT_ROWS=Object.freeze([
 row('create_word','request_document','document'),
 row('create_excel','request_document','document'),
 row('create_powerpoint','request_document','document','ROUTE_GAP: the document application admits only create_word and create_excel; the PowerPoint layout defect (DA-3) and ARTIFACT-ADMISSION are open.'),
 row('run_analysis','request_analysis','artifact','ROUTE_GAP: no governed analysis route exists; general analysis also needs an admitted sandbox (ANALYSIS-SANDBOX).'),
 row('schedule_task','propose_schedule','schedule'),
 row('update_scheduled_task','propose_schedule_change','schedule'),
 row('cancel_scheduled_task','propose_schedule_change','schedule'),
 row('create_task','propose_task','command'),
 row('update_task','propose_task_update','command'),
 row('save_memory','propose_memory','command','OWNER_MISSING: the approval-metadata owner admits task commands only; memory.propose has no proposal metadata codec yet.'),
 row('save_chat_attachments','propose_attachment_filing','command','OWNER_MISSING: the approval-metadata owner admits task commands only; artifact.file has no proposal metadata codec yet.'),
]);
/** Selected capabilities the ledger also routes to `meri_intents` but which are reads, so never a prepare-only intent. */
export const NOT_INTENTS=Object.freeze({list_scheduled_tasks:'READ: listing schedules has no effect to approve; it belongs on a read route (proposal P-INT-5).'});
/** @param {string} tool */
export const intentToolName=tool=>`${INTENT_TOOL_PREFIX}${tool}`;
const key=(/** @type {OperationRef} */o)=>`${o.id}@${o.version}`;
const byOperation=new Map(INTENT_ROWS.map(r=>[key(r.operation),r]));
/** @param {OperationRef} operation @returns {IntentRow|undefined} */
export const intentRow=operation=>byOperation.get(key(operation));
/** Canonical catalog descriptor of an intent operation. @param {OperationRef} operation */
export function intentDescriptor(operation){
 const d=catalog.operations.find(e=>e.operation.id===operation.id&&e.operation.version===operation.version);
 if(!d)throw Object.assign(Error('INTENT_CATALOG'),{code:'INTENT_CATALOG'});
 return d;
}
/** Every row is a catalog non-read behind an approval or draft boundary; never a read, never a deferred original.
 * Throws INTENT_CATALOG on any drift. */
export function assertIntentCatalog(){
 const deferred=new Set(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
 const fail=()=>{throw Object.assign(Error('INTENT_CATALOG'),{code:'INTENT_CATALOG'});};
 if(byOperation.size!==INTENT_ROWS.length)fail();
 for(const r of INTENT_ROWS){const d=intentDescriptor(r.operation);
  if(d.sideEffect==='none'||d.approvalBoundary==='none'||deferred.has(r.operation.id)||deferred.has(r.tool)||!/^[a-z][a-z_]{0,62}$/u.test(r.tool))fail();}
}

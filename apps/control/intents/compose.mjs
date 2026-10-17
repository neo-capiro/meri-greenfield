/** Production composition of the conversation write-intent approval surface, for the control startup (lane 1 owns the
 * call site in `apps/runtime`). Construction is inert: no pool connection, native call, listener or timer.
 *
 *  const intents = composeIntentApprovals({
 *    pool,                        // borrowed control PostgreSQL pool (meri_intents.preparations; migration not yet applied)
 *    native,                      // the control's fixed native provider client: native.call(operation,input,{signal})
 *    commandJournal, contextFor,  // the executor's createPostgresCommandJournal and its exact per-run executor context
 *    commandOptionsFor,           // ({proposal,signal}) → createCommandToolInterface options for the proposal's run, whose
 *                                 //   executor's approvalStore MUST be intents.approvalStore (the same Core decisions)
 *    issueExecution,              // ({proposal,principal,signal,deadlineMs}) → fresh CommandExecutionRequest + credential
 *    gate,                        // the membership gate (product-access/membership.mjs)
 *    now, limits:{maxRequestMs,maxRequestBytes,maxResponseBytes,maxFactBytes}, enabled:false });
 *  // intents.app.handle(Request) on the application origin; intents.app.paths lists the two routes.
 *
 * Nothing here is live: Core does not yet implement `approval/record` or `approval/decision`, the three write-path
 * migrations are unapplied, and no execution broker for conversation intents exists. `enabled` stays false until then. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresIntentJournalStore} from './postgres-journal.mjs';
import {createIntentApprovalOwner} from './approval.mjs';
import {createIntentApplication} from './http.mjs';
import {createNativeIntentApprovals,createCommandJournalOutcomes} from './native-approvals.mjs';
export function composeIntentApprovals(configuration){
 const c=own(configuration,['pool','native','commandJournal','contextFor','commandOptionsFor','issueExecution','gate','now','limits'],['enabled']);
 const limits=own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes','maxFactBytes']);
 if(typeof c.native?.call!=='function')throw Error('INTENT_APPROVAL_CONFIGURATION');
 const decisions=createNativeIntentApprovals({call:(operation,input,options)=>c.native.call(operation,input,options),now:c.now,maxFactBytes:limits.maxFactBytes});
 const owner=createIntentApprovalOwner({journal:createPostgresIntentJournalStore({pool:c.pool}),decisions,issueExecution:c.issueExecution,commandOptionsFor:c.commandOptionsFor,
  outcomes:createCommandJournalOutcomes({journal:c.commandJournal,contextFor:c.contextFor}),now:c.now,limits:{maxRequestMs:limits.maxRequestMs},enabled:c.enabled??false});
 const app=createIntentApplication({owner,gate:c.gate,now:c.now,limits:{maxRequestMs:limits.maxRequestMs,maxRequestBytes:limits.maxRequestBytes,maxResponseBytes:limits.maxResponseBytes}});
 return Object.freeze({app,owner,
  /** The executor's approval guard input: the CURRENT Core decision, never a decision cached by this surface. */
  approvalStore:Object.freeze({getCurrent:value=>decisions.getCurrent(value)}),
  /** For the lifecycle's approval-wait (`approvals.readDecision`). */
  readDecision:value=>decisions.readDecision(value)});
}

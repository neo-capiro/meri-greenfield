/** Inert composition of native task/document decisions and durable intent history. Core owns task effects. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresIntentJournalStore} from './postgres-journal.mjs';
import {createIntentApprovalOwner} from './approval.mjs';
import {createIntentApplication} from './http.mjs';
import {createNativeIntentApprovals} from './native-approvals.mjs';
export function composeIntentApprovals(configuration){
 const c=own(configuration,['pool','native','gate','now','limits'],['enabled','decisions','documents','tasks','filing','mail','retention','sharing','legiwatch','clientRecord','bizdev','legislativeDocument','watch']);
 const limits=own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes','maxFactBytes']);
 if(typeof c.native?.call!=='function')throw Error('INTENT_APPROVAL_CONFIGURATION');
 // `decisions` lets the trusted composer share ONE native decision adapter (over this same `native`) with the per-run
 // executors' approval guard and the lifecycle approval-wait; absent, this composition builds its own.
 if(c.decisions!==undefined&&['record','readDecision','getCurrent'].some(k=>typeof c.decisions?.[k]!=='function'))throw Error('INTENT_APPROVAL_CONFIGURATION');
 const decisions=c.decisions??createNativeIntentApprovals({call:(operation,input,options)=>c.native.call(operation,input,options),now:c.now,maxFactBytes:limits.maxFactBytes});
 const owner=createIntentApprovalOwner({journal:createPostgresIntentJournalStore({pool:c.pool}),decisions,
  ...(c.documents?{documents:c.documents}:{}),...(c.tasks?{tasks:c.tasks}:{}),...(c.mail?{mail:c.mail}:{}),...(c.filing?{filing:c.filing}:{}),...(c.sharing?{sharing:c.sharing}:{}),...(c.clientRecord?{clientRecord:c.clientRecord}:{}),...(c.legiwatch?{legiwatch:c.legiwatch}:{}),...(c.bizdev?{bizdev:c.bizdev}:{}),...(c.watch?{watch:c.watch}:{}),...(c.legislativeDocument?{legislativeDocument:c.legislativeDocument}:{}),now:c.now,limits:{maxRequestMs:limits.maxRequestMs},enabled:c.enabled??false});
 const app=createIntentApplication({owner,gate:c.gate,now:c.now,...(c.retention===undefined?{}:{retention:c.retention}),limits:{maxRequestMs:limits.maxRequestMs,maxRequestBytes:limits.maxRequestBytes,maxResponseBytes:limits.maxResponseBytes}});
 return Object.freeze({app,owner,
  /** The executor's approval guard input: the CURRENT Core decision, never a decision cached by this surface. */
  approvalStore:Object.freeze({getCurrent:value=>decisions.getCurrent(value)}),
  /** For the lifecycle's approval-wait (`approvals.readDecision`). */
  readDecision:value=>decisions.readDecision(value)});
}

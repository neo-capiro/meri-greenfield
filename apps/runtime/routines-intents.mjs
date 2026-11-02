/** SDK schedule preparation borrows the same attended session and canonical routines service as the public surface.
 * The operation version it declares is the exact schedule contract family pin of that composition (`operationVersion`,
 * canonical pins only, the legacy pin when none is declared); an unsupported pin fails before any session is borrowed
 * and before the service is reached, so the runtime preparer, the recorded delivery and the custody read correlate. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {LEGACY_SCHEDULE_OPERATION_VERSION,scheduleOperationFamily} from '../../packages/contracts/schedule-operation-family.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../control/action-host/session/owner.mjs';
import {SCHEDULE_INTENT_OPERATIONS} from '../control/intents/schedule-preparer.mjs';
import {intentFault,intentFaultDetail,intentFaultReason,INTENT_FAILURE_CODES} from '../control/intents/faults.mjs';
const owners=new WeakMap();
const CLOSED=new Set(INTENT_FAILURE_CODES),ownValue=(error,name)=>error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,name)?.value:undefined;
/** The closed intent failure for one failed schedule preparation. The service's own closed answer passes through with its detail
 * and reason; an UNKNOWN keeps its unknown effect (the routines journal may hold a preparation); a session or context refusal
 * maps by its own constant (`SESSION_UNAVAILABLE`, `ROUTINES_INVALID_REQUEST`, `ROUTINES_ACCESS_DENIED`, ...) to the closed code
 * it names, with plain words as the detail and the constant as the reason for control's log line. Every mapped failure was
 * raised before the schedule tool dispatched anything; this changes which closed code is reported, not what may run. */
const WORDS=Object.freeze({UNAVAILABLE:'no live session or schedule service answered for this run',INVALID_ARGUMENTS:'the schedule request is not a canonical request',ACCESS_DENIED:'current access does not allow this schedule request',REFUSED:'the schedule service refused the request as it stands'});
export function routineIntentFailure(error){
 const code=ownValue(error,'code'),named=typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,62}$/u.test(code)?code:undefined;
 if(code==='UNKNOWN')return intentFault('UNKNOWN','unknown',undefined,intentFaultReason(error));
 if(typeof code==='string'&&CLOSED.has(code))return intentFault(code,'none',intentFaultDetail(error),intentFaultReason(error));
 const closed=named===undefined?'REFUSED':/(?:^|_)UNKNOWN$/u.test(named)?'UNKNOWN':/(?:^|_)(?:INVALID_REQUEST|REQUEST)$/u.test(named)?'INVALID_ARGUMENTS':/(?:^|_)UNAVAILABLE$/u.test(named)?'UNAVAILABLE':/(?:^|_)ACCESS_DENIED$/u.test(named)?'ACCESS_DENIED':'REFUSED';
 // An error with no owned constant says nothing: a plain REFUSED with neither words nor reason.
 return closed==='UNKNOWN'?intentFault('UNKNOWN','unknown',undefined,named):intentFault(closed,'none',named===undefined?undefined:WORDS[closed],named);
}
export function registerRoutineIntentOwner(context,factory){if(owners.has(context)||typeof factory!=='function')throw intentFault('INTENT_CONFIGURATION');owners.set(context,factory);}
export function routineIntentPreparersFor(context,value){return owners.get(context)?.(value)??[];}
export function createRoutineIntentPreparers({sessions,service,binding,selectedClientId,now,maxRequestMs,operationVersion=LEGACY_SCHEDULE_OPERATION_VERSION}){
 if(!scheduleOperationFamily(operationVersion))throw intentFault('INTENT_CONFIGURATION');
 const borrow=borrowedRunSession(sessions);if(!borrow||typeof service?.prepareIntent!=='function')return [];
 return SCHEDULE_INTENT_OPERATIONS.map(id=>Object.freeze({operation:{id,version:operationVersion},owner:'schedule',binding,
  async prepare(raw){
   const {arguments:request,signal}=own(raw,['arguments','deliveryId'],['signal']);
   try{
    const session=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());
    const result=await service.prepareIntent({binding,credential:session.credential,request:{operation:id,request},signal,deadlineMs:Math.min(session.expiresAtMs,now()+maxRequestMs)});
    // Borrowing again catches replacement/revocation after the owner's awaited current checks.
    const current=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());
    if(current.credential!==session.credential||hash(current.context)!==hash(session.context))throw intentFault('ACCESS_DENIED','none');
    return data(result);
   }catch(error){throw routineIntentFailure(error);}
  }}));
}

/** SDK schedule preparation borrows the same attended session and canonical routines service as the public surface.
 * The operation version it declares is the exact schedule contract family pin of that composition (`operationVersion`,
 * canonical pins only, the legacy pin when none is declared); an unsupported pin fails before any session is borrowed
 * and before the service is reached, so the runtime preparer, the recorded delivery and the custody read correlate. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {LEGACY_SCHEDULE_OPERATION_VERSION,scheduleOperationFamily} from '../../packages/contracts/schedule-operation-family.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../control/action-host/session/owner.mjs';
import {SCHEDULE_INTENT_OPERATIONS} from '../control/intents/schedule-preparer.mjs';
import {intentFault} from '../control/intents/faults.mjs';
const owners=new WeakMap();
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
   }catch(error){throw intentFault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED','none');}
  }}));
}

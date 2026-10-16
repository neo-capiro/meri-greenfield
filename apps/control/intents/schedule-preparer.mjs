/** Prepares a schedule intent through the existing schedule tool interface (`schedules/tool-interface.mjs`). With a
 * trusted context whose `approval` is null, that interface checks current authority and returns its immutable
 * `approval_required` proposal without any lifecycle mutation. This preparer refuses any context that carries an
 * approval, so the intent path can never apply a schedule; applying stays with the existing approved execution.
 *
 * `resolveContext({operation,request,deliveryId,signal})` is the trusted schedule-context owner: it resolves the
 * caller identity, current projection, task/destination/limit resolutions and allocates the intent ID from trusted
 * state, never from the model. No such owner exists in this repository yet (proposal P-INT-6), so no composition
 * can make schedule intents available until it does. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {intentFault} from './faults.mjs';
export const SCHEDULE_INTENT_OPERATIONS=Object.freeze(['schedule_task','update_scheduled_task','cancel_scheduled_task']);
/** @param {{operation:string,tool:{execute:Function},resolveContext:Function,binding:object}} configuration */
export function createScheduleIntentPreparer(configuration){
 const c=own(configuration,['operation','tool','resolveContext','binding']);
 if(!SCHEDULE_INTENT_OPERATIONS.includes(c.operation)||typeof c.tool?.execute!=='function'||typeof c.resolveContext!=='function')throw intentFault('INTENT_CONFIGURATION');
 const binding=data(c.binding);
 return Object.freeze({operation:Object.freeze({id:c.operation,version:'0.2.0'}),owner:'schedule',binding,
  async prepare({arguments:request,deliveryId,signal}){
   let context;
   try{context=data(await c.resolveContext({operation:c.operation,request:data(request),deliveryId,signal}));own(context,['scheduleContext']);}
   catch(error){throw intentFault(error?.code==='DEADLINE'||error?.code==='CANCELLED'?error.code:'REFUSED','none');}
   const s=context.scheduleContext;
   // Prepare-only: an approval in the context would make the interface apply the schedule.
   if(s?.approval!==null||s.callerIdentity?.tenantId!==binding.tenantId||s.callerIdentity?.actorId!==binding.actorId)throw intentFault('REFUSED','none');
   let out;
   try{out=data(await c.tool.execute({operation:c.operation,request,context,signal}));}
   catch(error){
    // With no approval nothing is dispatched; any other disposition is not evidence of no effect.
    if(error?.outcome==='NOT_DISPATCHED')throw intentFault(error.code==='DEADLINE'||error.code==='CANCELLED'?error.code:'REFUSED','none');
    throw intentFault('UNKNOWN','unknown');
   }
   if(out?.status!=='approval_required'||out.operation!==c.operation)throw intentFault('INVALID_RESULT','unknown');
   return {status:'approval_required',proposal:out};
  }});
}

import {types} from 'node:util';
import {denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';

export function sdkMethod(object,name) {
  if(!object||types.isProxy(object))denySchedule('SCHEDULE_SDK_PORT');
  let owner=object;
  while(owner) {
    const d=Object.getOwnPropertyDescriptor(owner,name);
    if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function')denySchedule('SCHEDULE_SDK_PORT');return d.value.bind(object);}
    owner=Object.getPrototypeOf(owner);
  }
  denySchedule('SCHEDULE_SDK_PORT');
}
export function exactHandle(client,id,lifetime) {
  lifetime.check();const h=sdkMethod(client,'getHandle')(id);lifetime.check();
  if(!h||types.isProxy(h))denySchedule('SCHEDULE_HANDLE');
  const d=Object.getOwnPropertyDescriptor(h,'scheduleId');
  if(!d||!Object.hasOwn(d,'value')||d.value!==id)denySchedule('SCHEDULE_HANDLE');
  return h;
}
export function scheduleSdkOptions(intent) {
  const c=intent.configuration,p=intent.projection,s=c.spec;
  return {scheduleId:p.temporalScheduleId,spec:{calendars:s.calendars,intervals:s.intervals,cronExpressions:s.cronExpressions,skip:s.skip,timezone:s.timezone,jitter:s.jitterMs,
    ...(s.startAt===null?{}:{startAt:new Date(s.startAt)}),...(s.endAt===null?{}:{endAt:new Date(s.endAt)})},
    action:{type:'startWorkflow',...c.workflow,args:[{projection:p,generation:intent.generation,task:c.task}],workflowRunTimeout:p.maxRuntimeSeconds*1000,retry:{maximumAttempts:p.retryLimit+1}},
    policies:{overlap:c.overlap,catchupWindow:c.catchupWindowMs,pauseOnFailure:c.pauseOnFailure},
    state:{paused:c.paused,note:c.note,...(c.remainingActions===null?{}:{remainingActions:c.remainingActions}),triggerImmediately:c.runNow}};
}
// One adapter invocation is not one RPC: SDK1.24 and its connection may retry.
// The supplied effect boundary owns current authority and durable uncertainty.
export async function mutateTemporalSchedule({scheduleClient,workflowClient,binding,lifetime,effect}) {
  const i=binding.intent,id=i.projection.temporalScheduleId;
  if(i.operation==='schedule_task') {
    await effect('create',()=>sdkMethod(scheduleClient,'create')(scheduleSdkOptions(i)));
  } else if(i.operation==='update_scheduled_task') {
    await effect('update',()=>{
      const h=exactHandle(scheduleClient,id,lifetime),update=sdkMethod(h,'update');lifetime.check();
      return update(current=>{
        lifetime.check();
        const d=current&&Object.getOwnPropertyDescriptor(current,'scheduleId');
        if(!d||!Object.hasOwn(d,'value')||d.value!==id)denySchedule('SCHEDULE_HANDLE');
        const {scheduleId,...options}=scheduleSdkOptions(i);delete options.state.triggerImmediately;
        lifetime.check();return options;
      });
    });
  } else {
    const c=i.cancel;
    await effect(c.mode,()=>{const h=exactHandle(scheduleClient,id,lifetime),fn=sdkMethod(h,c.mode);lifetime.check();return c.mode==='pause'?fn(c.note):fn();});
    if(c.running==='request_cancel')for(const run of c.runs)await effect('cancel_run',()=>{
      const h=sdkMethod(workflowClient,'getHandle')(run.workflowId,run.runId);lifetime.check();
      const cancel=sdkMethod(h,'cancel');lifetime.check();return cancel();
    });
  }
  return {acknowledged:true,physicalStopProven:false};
}

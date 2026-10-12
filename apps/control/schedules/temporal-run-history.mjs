import {types} from 'node:util';
import {frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';

// SDK1.24 helpers.ts labels the pinned protobuf enum; future codes stay UNKNOWN.
const STATUS_NAMES=Object.freeze(['UNSPECIFIED','RUNNING','COMPLETED','FAILED','CANCELLED','TERMINATED','CONTINUED_AS_NEW','TIMED_OUT','PAUSED']);

function field(value,key,optional=false) {
  if(!value||types.isProxy(value))denySchedule('SCHEDULE_HISTORY');
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d){if(optional)return undefined;denySchedule('SCHEDULE_HISTORY');}
  if(!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_HISTORY');return d.value;
}
function instant(value) {
  if(!types.isDate(value)||types.isProxy(value))denySchedule('SCHEDULE_HISTORY');
  const ms=Date.prototype.getTime.call(value);if(!Number.isFinite(ms))denySchedule('SCHEDULE_HISTORY');return new Date(ms).toISOString();
}
export async function inspectOriginalRuns({workflowClient,references,limit,read,lifetime}) {
  const output=[];
  for(const ref of references.slice(0,limit)) {
    const d=await read('describe_original_run',()=>{
      const handle=sdkMethod(workflowClient,'getHandle')(ref.workflowId,ref.firstExecutionRunId);lifetime.check();
      const describe=sdkMethod(handle,'describe');lifetime.check();return describe();
    });
    if(field(d,'workflowId')!==ref.workflowId||field(d,'runId')!==ref.firstExecutionRunId)denySchedule('SCHEDULE_HISTORY_ID');
    const status=field(d,'status'),name=field(status,'name'),code=field(status,'code'),historyLength=field(d,'historyLength');
    if(typeof name!=='string'||name.length>64||!Number.isSafeInteger(code)||!Number.isSafeInteger(historyLength)||historyLength<0)denySchedule('SCHEDULE_HISTORY');
    if(name!==(Object.hasOwn(STATUS_NAMES,code)?STATUS_NAMES[code]:'UNKNOWN'))denySchedule('SCHEDULE_HISTORY_STATUS');
    const end=field(d,'closeTime',true);
    output.push({workflowId:ref.workflowId,runId:ref.firstExecutionRunId,status:{name,code},historyLength,startTime:instant(field(d,'startTime')),closeTime:end===undefined?null:instant(end)});
  }
  return frozenScheduleData({executions:output,coverage:{observedReferences:references.length,returned:output.length,omitted:Math.max(0,references.length-output.length),historyComplete:false,currentRetryVerified:false}});
}

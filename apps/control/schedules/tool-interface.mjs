import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertScheduleAuthority,canonicalSha256,frozenScheduleData,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';

function ownOptions(value,allowed) {
  if(!value||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)denySchedule('SCHEDULE_TOOL_OPTIONS');
  const out={};for(const key of Reflect.ownKeys(value)) {
    const d=Object.getOwnPropertyDescriptor(value,key);
    if(!allowed.includes(key)||!d?.enumerable||!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_TOOL_OPTIONS');out[key]=d.value;
  }return out;
}
/** Model requests select intent content; only the trusted context can resolve authority. */
export function createScheduleToolInterface(options) {
  const {lifecycle,validators,authorize,clock=Date.now}=ownOptions(options,['lifecycle','validators','authorize','clock']);
  if(typeof authorize!=='function'||typeof clock!=='function')denySchedule('SCHEDULE_TOOL_OPTIONS');
  const prepare=sdkMethod(validators,'prepare'),assertResult=sdkMethod(validators,'assertResult'),mutate=sdkMethod(lifecycle,'execute'),list=sdkMethod(lifecycle,'list');
  async function execute(value) {
    let lifetime;
    try {
      const {operation,request,context,signal}=ownOptions(value,['operation','request','context','signal']);
      if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))denySchedule('SCHEDULE_TOOL_SIGNAL');
      const prepared=prepare(operation,request,context),c=prepared.context,now=clock();
      if(!Number.isSafeInteger(now)||c.nowMs>now||c.deadlineMs<=now||c.deadlineMs-now>60000)denySchedule('SCHEDULE_TOOL_CLOCK');
      let deadline=c.deadlineMs;
      lifetime=createOperationLifetime({deadlineMs:deadline,now:clock,signal,errorFactory:code=>Object.assign(new Error(code),{code})});
      const limitDeadline=ms=>{lifetime.limitDeadline(ms);deadline=Math.min(deadline,ms);};
      if(c.approval)limitDeadline(Date.parse(c.approval.expiresAt));
      const binding=frozenScheduleData({callerIdentity:c.callerIdentity,operation,request:prepared.input,context:c,intent:prepared.intent??null,bindingSha256:canonicalSha256({operation,request:prepared.input,context:c})});
      async function current(phase) {
        const a=await lifetime.run(signal=>authorize({phase,binding,signal,limitDeadline}));
        limitDeadline(assertScheduleAuthority(a,binding).expiresAtMs);
      }
      await current('before_tool');let output;
      if(operation==='list_scheduled_tasks') {
        const page=await lifetime.run(signal=>list({selection:prepared.selection,callerIdentity:c.callerIdentity,deadlineMs:deadline,signal}));
        output={operation,status:'listed',page};
      } else if(c.approval===null)output=prepared.proposal;
      else {
        const receipt=await lifetime.run(signal=>mutate({intent:prepared.intent,approval:c.approval,callerIdentity:c.callerIdentity,deadlineMs:deadline,signal}));
        output={operation,status:'acknowledged',receipt};
      }
      const result=assertResult(operation,output,prepared.input,{scheduleContext:c});
      await current('before_tool_release');lifetime.check();return result;
    } catch(error) {
      const code=['DEADLINE','CANCELLED'].includes(scheduleErrorCode(error))?scheduleErrorCode(error):'SCHEDULE_TOOL_FAILED';
      // Effects may already be durably acknowledged/uncertain by the lifecycle.
      // The journal remains authoritative; a tool failure never authorizes retry.
      throw Object.assign(new Error(code),{code});
    } finally {lifetime?.close();}
  }
  return Object.freeze({execute});
}

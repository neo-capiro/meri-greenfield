// Application inspection only. Borrowed SDK client/connection are never closed.
import { types } from 'node:util';
import { createOperationLifetime } from '../../../packages/runtime/operation-lifetime.mjs';
import { snapshotScheduleInspectionBinding, assertScheduleInspectionAuthorization,
  projectScheduleInspection } from '../../../packages/contracts/schedules-0.2/inspection-validation.mjs';

const ownErrors = new WeakMap();
const error = code => { const value=Object.assign(new Error(code),{code});ownErrors.set(value,code);return value; };
function own(value, names) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value)!==Object.prototype) throw error('SCHEDULE_INSPECTION_CONFIGURATION');
  const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
  if(keys.some(k=>!names.includes(k)) || Object.values(d).some(p=>!p.enumerable||!Object.hasOwn(p,'value')))throw error('SCHEDULE_INSPECTION_CONFIGURATION');
  return Object.fromEntries(Object.entries(d).map(([k,p])=>[k,p.value]));
}
export function createTemporalScheduleInspector(options) {
  const {scheduleClient,authorize,clock=Date.now}=own(options,['scheduleClient','authorize','clock']);
  if(!scheduleClient||types.isProxy(scheduleClient)||typeof authorize!=='function'||typeof clock!=='function')throw error('SCHEDULE_INSPECTION_CONFIGURATION');
  // These are trusted, borrowed SDK ports; retain their receivers and exact identity.
  const connection=scheduleClient.connection,getHandle=scheduleClient.getHandle;
  if(!connection||types.isProxy(connection)||typeof getHandle!=='function'||typeof connection.withDeadline!=='function'||typeof connection.withAbortSignal!=='function')throw error('SCHEDULE_INSPECTION_CONFIGURATION');
  const withDeadline=connection.withDeadline,withAbortSignal=connection.withAbortSignal;
  async function inspect(request) {
    const {projection,callerIdentity,deadlineMs,signal}=own(request,['projection','callerIdentity','deadlineMs','signal']);
    if(signal!==undefined&&(!(signal instanceof AbortSignal)||types.isProxy(signal)))throw error('SCHEDULE_INSPECTION_CONFIGURATION');
    const binding=snapshotScheduleInspectionBinding({projection,callerIdentity,deadlineMs},clock());
    const lifetime=createOperationLifetime({deadlineMs,now:clock,signal,errorFactory:code=>error(`SCHEDULE_INSPECTION_${code}`)});
    let effectiveDeadlineMs=deadlineMs;
    const limitDeadline=next=>{lifetime.limitDeadline(next);effectiveDeadlineMs=Math.min(effectiveDeadlineMs,next);};
    async function current(phase) {
      const receipt=await lifetime.run(signal=>authorize(Object.freeze({phase,projection:binding.projection,callerIdentity:binding.callerIdentity,projectionSha256:binding.projectionSha256,signal,limitDeadline})));
      const admitted=assertScheduleInspectionAuthorization(receipt,binding);
      limitDeadline(admitted.expiresAtMs); // Publish before any subsequent port can park.
    }
    try {
      await current('before_describe');
      const description=await lifetime.run(signal=>withDeadline.call(connection,effectiveDeadlineMs,()=>{lifetime.check();return withAbortSignal.call(connection,signal,()=>{
        lifetime.check();
        const handle=getHandle.call(scheduleClient,binding.projection.temporalScheduleId);
        if(!handle||types.isProxy(handle)||handle.scheduleId!==binding.projection.temporalScheduleId||typeof handle.describe!=='function')throw error('SCHEDULE_INSPECTION_DATA');
        return handle.describe();
      });}));
      const output=projectScheduleInspection(description,binding,clock());
      await current('before_release');
      lifetime.check();
      return output;
    } catch(cause) {
      // Never leak SDK service messages, memo, workflow arguments or credentials.
      const code=ownErrors.get(cause);
      if(code==='SCHEDULE_INSPECTION_DEADLINE'||code==='SCHEDULE_INSPECTION_CANCELLED')throw error(code);
      throw error('SCHEDULE_INSPECTION_FAILED');
    } finally { lifetime.close(); }
  }
  return Object.freeze({inspect});
}

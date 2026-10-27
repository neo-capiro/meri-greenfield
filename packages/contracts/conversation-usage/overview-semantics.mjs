import {usageOverviewPeriods,overviewStates} from './overview-protocol.mjs';
export class UsageOverviewResponseError extends Error{constructor(code){super(code);this.name='UsageOverviewResponseError';this.code=code;}}
export const overviewFail=code=>{throw new UsageOverviewResponseError(code);};
export function assertUsageOverviewSemantics(value){
 const periods=usageOverviewPeriods(Date.parse(value.observedAt));
 for(let i=0;i<3;i++){const p=value.periods[i],expected=periods[i];
  if(p.kind!==expected.kind||p.startInclusive!==expected.startInclusive||p.endExclusive!==expected.endExclusive||
   overviewStates.reduce((total,state)=>total+p.states[state],0)!==p.attempts||Object.values(p.recording).reduce((a,b)=>a+b,0)!==p.attempts||
   p.completedAttemptsWithRecordedUsage>p.states.completed||p.completedAttemptsWithRecordedUsage>p.recording.recorded||p.completedAttemptKnownChargeMicroUsd>p.knownChargeMicroUsd||
   p.recording.recorded===0&&p.knownChargeMicroUsd!==0||p.completedAttemptsWithRecordedUsage===0&&p.completedAttemptKnownChargeMicroUsd!==0)overviewFail('INVALID_USAGE_OVERVIEW');
 }
 const admission=value.monthlyAdmission,cap=value.policy.monthlyCapMicroUsd;
 if(admission.startInclusive!==periods[2].startInclusive||admission.remainingKnownMicroUsd!==(cap===null?null:Math.max(0,cap-admission.knownChargeMicroUsd))||
  admission.reached!==(cap===null?null:admission.knownChargeMicroUsd>=cap)||overviewStates.slice(5).some(state=>value.queue.states[state]!==0))overviewFail('INVALID_USAGE_OVERVIEW');
 return value;
}

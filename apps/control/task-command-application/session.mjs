/** Correlate the existing attended session with its native task callbacks. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {fail} from '../action-application/http.mjs';
export function taskSession(value,_intent,started,now,limitDeadline){
 const s=own(value,['binding','prepare','execute','release','checkedAtMs','expiresAtMs']);
 const fact=data({binding:s.binding,checkedAtMs:s.checkedAtMs,expiresAtMs:s.expiresAtMs}),at=now();
 validateShape('RunBinding',fact.binding);
 if(!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<started||fact.checkedAtMs>at||!Number.isSafeInteger(fact.expiresAtMs)||fact.expiresAtMs<=at||['prepare','execute','release'].some(k=>typeof s[k]!=='function'))fail('UNAUTHENTICATED',401);
 limitDeadline(fact.expiresAtMs);return {...fact,prepare:s.prepare,execute:s.execute,release:s.release};
}

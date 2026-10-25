/** Trusted native callbacks, correlated to the existing attended session. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {fail} from './http.mjs';
export function session(value,started,now,limitDeadline){
 const s=own(value,['binding','query','draft','prepare','execute','release','checkedAtMs','expiresAtMs']);
 const fact=data({binding:s.binding,checkedAtMs:s.checkedAtMs,expiresAtMs:s.expiresAtMs}),at=now();validateShape('RunBinding',fact.binding);
 if(!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<started||fact.checkedAtMs>at||!Number.isSafeInteger(fact.expiresAtMs)||fact.expiresAtMs<=at||['query','draft','prepare','execute','release'].some(k=>typeof s[k]!=='function'))fail('UNAUTHENTICATED',401);
 limitDeadline(fact.expiresAtMs);return {...fact,...Object.fromEntries(['query','draft','prepare','execute','release'].map(k=>[k,s[k]]))};
}

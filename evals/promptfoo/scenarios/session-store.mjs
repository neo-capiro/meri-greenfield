/** Durable-recovery scenarios: wraps the existing deterministic SessionStore qualification provider unchanged. */
import SessionStoreQualificationProvider from '../../../apps/worker/qualification/checkpoint/session-store-eval-provider.mjs';
import {observedAnswer} from './envelope.mjs';
const wrapped=new SessionStoreQualificationProvider();
export async function sessionStore(view){const result=await wrapped.callApi(view.scenario.scenario);
 if(result.error!==undefined)throw Object.assign(new Error('SESSION_STORE_SCENARIO_UNKNOWN'),{code:'SESSION_STORE_SCENARIO_UNKNOWN'});
 return observedAnswer(view,{kind:'recovery-state',source:wrapped.id(),observed:JSON.parse(result.output)});}

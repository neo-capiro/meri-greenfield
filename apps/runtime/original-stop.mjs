/** Shared stop-only native adapter for public Stop and Temporal recovery. The native owner proves retirement and grant revocation. */
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {fault} from './config.mjs';

/** Independent bounded cleanup: never borrows the cancelled execution/request signal or creates execution authority. */
export async function stopOriginal({native,binding,expiresAtMs,now,timeoutMs,code}){
 const executionKey=canonicalSha256(binding),life=createOperationLifetime({now,deadlineMs:now()+timeoutMs,errorFactory:()=>fault(code)});
 try{const p=own(await life.run(signal=>native.call('execution/kickoff/stop',{binding,executionId:executionKey},{signal})),['binding','executionId','expiresAtMs']);if(canonicalSha256(p.binding)!==executionKey||p.executionId!==executionKey||!Number.isSafeInteger(p.expiresAtMs)||expiresAtMs!==undefined&&p.expiresAtMs!==expiresAtMs)throw fault(code);}finally{life.close();}
}
/** Each invocation makes a fresh idempotent attempt, including after the workflow has closed. No start or redispatch is exposed. */
export function createOriginalReconciler({native,now=Date.now,timeoutMs}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fault('BROKER_CONFIGURATION');
 return async function reconcileConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);await stopOriginal({native,binding:input.binding,expiresAtMs:undefined,now,timeoutMs,code:'BROKER_RECONCILE_UNKNOWN'});return {state:'reconciled'};};
}

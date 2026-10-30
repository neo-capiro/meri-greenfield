/** Browser RPCs share the existing execution credential/native transport. No
 * provider or host credential is exposed to SDK tools. No browser call retries. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../packages/contracts/validate.mjs';
import {assertBrowserOperationRequest,assertBrowserOperationResponse,browserOperationBudgetMs} from '../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {validateBrowserPolicy} from '../worker/conversation/browser/policy.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_OPERATION_REFUSED'),{code:'BROWSER_OPERATION_REFUSED'});};
export function createNativeBrowserPort({native,binding:raw,deadlineMs,now=Date.now}){
 const binding=data(raw);validateShape('RunBinding',binding);
 if(typeof native?.call!=='function'||typeof now!=='function'||!Number.isSafeInteger(deadlineMs))fail();
 let prepared,preparing;
 async function invoke(name,fields={},signal){
  if(!prepared&&!['browser-prepare','browser-settle'].includes(name))fail();
  nativeSignal(signal);const request=assertBrowserOperationRequest(name,{binding,...data(fields)}),budget=browserOperationBudgetMs(name,prepared??{});
  const until=name==='browser-settle'?now()+budget:Math.min(deadlineMs,now()+budget);
  const result=await native.call('runner/'+name,request,{signal,deadlineMs:until,maxRequestMs:budget});
  return assertBrowserOperationResponse(result,binding);
 }
 async function prepare({signal}={}){
  if(preparing)fail();preparing=true;
  const result=own(await invoke('browser-prepare',{},signal),['binding','policy','activation','approvalDeadlineMs'],['reason','resumeSnapshot']);
  // Reuse the exact binding envelope validator rather than accepting host data
  // from another logical run as this SDK's prepared state.
  assertBrowserOperationResponse({binding:result.binding,result:null},binding);
  const policy=validateBrowserPolicy(result.policy);
  if(!['open','held','not-applicable'].includes(result.activation)||result.activation==='not-applicable'&&policy.enabled||result.activation!=='not-applicable'&&!policy.enabled||result.reason!==undefined&&(typeof result.reason!=='string'||!/^BROWSER_[A-Z_]{1,96}$/u.test(result.reason)))fail();
  browserOperationBudgetMs('browser-approve',result);
  prepared=Object.freeze({...result,policy});return prepared;
 }
 return Object.freeze({transport:'native-control',prepare,
  tools:({signal}={})=>invoke('browser-tools',{},signal).then(result=>own(result,['tools']).tools),
  call:({requestId,tool,args,signal})=>invoke('browser-call',{requestId,tool,args},signal),
  hook:({event,toolUseId,input,signal})=>invoke('browser-hook',{event,toolUseId,input},signal),
  approve:({tool,toolUseId,input,signal})=>invoke('browser-approve',{tool,toolUseId,input},signal),
  settle:({outcome,signal})=>invoke('browser-settle',{outcome},signal),
  prepareTakeover:({controlId,signal})=>invoke('browser-prepare-takeover',{controlId},signal),
  captureTakeover:({controlId,signal})=>invoke('browser-capture-takeover',{controlId},signal),
  retainTakeover:({receipt,signal})=>invoke('browser-retain-takeover',{receipt},signal),
 });
}

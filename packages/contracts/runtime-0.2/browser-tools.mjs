/** Private run-authenticated browser operations. No destination, host identity,
 * provider credential, executable path or caller-selected policy crosses here. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256} from '../validate.mjs';
export const BROWSER_RUN_OPERATIONS=Object.freeze({
 'browser-prepare':'prepareBrowser','browser-tools':'readBrowserTools','browser-call':'callBrowserTool',
 'browser-hook':'browserHook','browser-approve':'approveBrowserTool','browser-settle':'settleBrowser',
 'browser-prepare-takeover':'prepareBrowserTakeover','browser-capture-takeover':'captureBrowserTakeover','browser-retain-takeover':'retainBrowserTakeover',
});
export const BROWSER_NATIVE_LIMITS=Object.freeze({requestBytes:262144,responseBytes:270336,metadataMs:10000,executionMs:130000,approvalMs:900000,defaultApprovalMs:120000});
const fail=()=>{throw Object.assign(Error('BROWSER_OPERATION_REFUSED'),{code:'BROWSER_OPERATION_REFUSED'});};
const tool=value=>typeof value==='string'&&/^browser_[a-z_]{1,80}$/u.test(value);
const toolUse=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
export function browserOperationName(value){const name=typeof value==='string'?value.replace(/^runner\//u,''):'';return Object.hasOwn(BROWSER_RUN_OPERATIONS,name)?name:null;}
export function assertBrowserOperationRequest(operation,raw){
 const name=browserOperationName(operation);if(!name)fail();const value=data(raw);
 if(['browser-prepare','browser-tools'].includes(name))own(value,['binding']);
 else if(name==='browser-call'){
  own(value,['binding','requestId','tool','args']);if(!/^[a-f0-9]{64}$/u.test(value.requestId)||!tool(value.tool)||!value.args||Array.isArray(value.args)||typeof value.args!=='object')fail();
 }else if(name==='browser-hook'){
  own(value,['binding','event','toolUseId','input']);const input=own(value.input,['hook_event_name','session_id','tool_name','tool_input','tool_use_id'],['tool_response']);
  if(!['PreToolUse','PostToolUse','PostToolUseFailure'].includes(value.event)||input.hook_event_name!==value.event||!toolUse(value.toolUseId)||input.tool_use_id!==value.toolUseId||!uuid(input.session_id)||!tool(input.tool_name?.replace(/^mcp__meri_browser__/u,''))||!input.tool_name.startsWith('mcp__meri_browser__')||value.event!=='PostToolUse'&&Object.hasOwn(input,'tool_response'))fail();
 }else if(name==='browser-approve'){
  own(value,['binding','tool','toolUseId','input']);if(!tool(value.tool)||!toolUse(value.toolUseId)||!value.input||Array.isArray(value.input)||typeof value.input!=='object')fail();
 }else if(name==='browser-settle'){
  own(value,['binding','outcome']);if(!['ended','failed','cancelled'].includes(value.outcome))fail();
 }else if(name==='browser-retain-takeover'){
  own(value,['binding','receipt']);if(!value.receipt||typeof value.receipt!=='object'||Array.isArray(value.receipt))fail();
 }else{own(value,['binding','controlId']);if(!uuid(value.controlId))fail();}
 validateShape('RunBinding',value.binding);if(Buffer.byteLength(JSON.stringify(value))>BROWSER_NATIVE_LIMITS.requestBytes)fail();return value;
}
/** Closed envelope; each domain result retains its existing owner validator. */
export function assertBrowserOperationResponse(raw,binding){
 const value=data(own(raw,['binding','result']));validateShape('RunBinding',value.binding);
 if(canonicalSha256(value.binding)!==canonicalSha256(binding)||Buffer.byteLength(JSON.stringify(value))>BROWSER_NATIVE_LIMITS.responseBytes)fail();return value.result;
}
/** Only a ceiling for named routes. The current-policy owner clamps again to its
 * selected policy and remaining canonical run time before executing an effect. */
export function browserOperationCeilingMs(operation){
 const name=browserOperationName(operation);if(!name)return null;
 if(name==='browser-approve')return BROWSER_NATIVE_LIMITS.approvalMs;
 if(name==='browser-hook')return BROWSER_NATIVE_LIMITS.metadataMs;
 return BROWSER_NATIVE_LIMITS.executionMs;
}
export function browserOperationBudgetMs(operation,{policy,approvalDeadlineMs=BROWSER_NATIVE_LIMITS.defaultApprovalMs}={}){
 const name=browserOperationName(operation);if(!name)fail();
 if(name==='browser-approve'){
  if(!Number.isSafeInteger(approvalDeadlineMs)||approvalDeadlineMs<1000||approvalDeadlineMs>BROWSER_NATIVE_LIMITS.approvalMs)fail();return approvalDeadlineMs;
 }
 if(['browser-call','browser-tools'].includes(name)){
  const a=policy?.timeouts?.actionMs,n=policy?.timeouts?.navigationMs;
  if(!Number.isSafeInteger(a)||a<1000||a>60000||!Number.isSafeInteger(n)||n<1000||n>120000)fail();return Math.min(a+n,BROWSER_NATIVE_LIMITS.executionMs);
 }
 return name==='browser-hook'?BROWSER_NATIVE_LIMITS.metadataMs:BROWSER_NATIVE_LIMITS.executionMs;
}

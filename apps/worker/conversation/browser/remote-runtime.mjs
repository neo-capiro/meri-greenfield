/** AgentCore half of the existing browser run. Effects, permission decisions,
 * page tracking, receipts, downloads and physical cleanup remain host-owned. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertBrowserCustody} from '../../../../packages/runtime/browser-custody.mjs';
import {assertBrowserHookResult,assertBrowserApprovalResult} from '../../../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {createBrowserSdkServer} from './sdk-server.mjs';
import {validateBrowserPolicy,browserStatus,BROWSER_TOOLS,INTERACTION_TOOLS} from './policy.mjs';
import {activationOpen} from './activation.mjs';
import {EXPOSED_UNADMITTED_TOOLS} from './fragment.mjs';
import {assertBrowserCleanupReceipt} from './lifecycle.mjs';
const prefix='mcp__meri_browser__',fault=code=>Object.assign(Error(code),{code});
export async function prepareRemoteBrowserRun({port,binding,deadlineMs,now,signal,browserHandoff}){
 let sdk,metadata,settled,retained;
 const settle=input=>settled??=(async()=>{
  try{await sdk?.close();if(retained&&input.outcome!=='failed')return retained;return assertBrowserCleanupReceipt(await port.settle(input),{binding,outcome:input.outcome});}
  catch{throw fault('BROWSER_CLEANUP_UNKNOWN');}
 })();
 try{
  metadata=await port.prepare({signal});const policy=validateBrowserPolicy(metadata.policy),open=metadata.activation==='open';
  if(open&&!activationOpen()||browserHandoff&&!open)throw fault('BROWSER_ACTIVATION_HELD');
  const status=Object.freeze({...browserStatus(policy),activation:metadata.activation,...(metadata.reason?{reason:metadata.reason}:{})});
  let fragment;
  if(!open)fragment=Object.freeze({enabled:false,activation:metadata.activation,policy,status,mcpServers:{},allowedTools:[],disallowedTools:[],hooks:{}});
  else{
   sdk=createBrowserSdkServer({binding,policy,tools:port.tools,call:port.call,deadlineMs,now});
   const hook=event=>async(raw,toolUseId,options)=>{
    try{
     const input={hook_event_name:raw.hook_event_name,session_id:raw.session_id,tool_name:raw.tool_name,tool_input:raw.tool_input,tool_use_id:raw.tool_use_id,...(event==='PostToolUse'?{tool_response:raw.tool_response}:{})};
     if(toolUseId!==undefined&&toolUseId!==raw.tool_use_id)throw fault('BROWSER_PERMISSION_INPUT');
     return assertBrowserHookResult(await port.hook({event,toolUseId:raw.tool_use_id,input:data(input),signal:options?.signal}),event);
    }catch{return event==='PreToolUse'?{hookSpecificOutput:{hookEventName:event,permissionDecision:'deny',permissionDecisionReason:'Browser unavailable'}}:{continue:false,stopReason:'Browser receipt unavailable; browser work stopped.'};}
   };
   const canUseTool=async(name,input,options={})=>{
    if(typeof name!=='string'||!name.startsWith(prefix))return undefined;
    try{if(options.mcpServer!==undefined&&options.mcpServer.name!=='meri_browser')throw fault('BROWSER_SERVER_MISMATCH');return assertBrowserApprovalResult(await port.approve({tool:name.slice(prefix.length),toolUseId:options.toolUseID,input:data(input),signal:options.signal}),{input,toolUseId:options.toolUseID});}
    catch{return {behavior:'deny',message:'Browser approval unavailable'};}
   };
   let resumeSnapshot;
   if(browserHandoff){resumeSnapshot=data(own(metadata.resumeSnapshot,['content']));if(canonicalSha256(resumeSnapshot)!==browserHandoff.returned?.snapshotSha256)throw fault('BROWSER_CUSTODY_REFUSED');}
   fragment=Object.freeze({enabled:true,activation:'open',policy,policySha256:canonicalSha256(policy),status,mcpServers:{meri_browser:sdk.server},
    allowedTools:policy.tools.filter(t=>!INTERACTION_TOOLS.includes(t)).map(t=>prefix+t),
    disallowedTools:[...EXPOSED_UNADMITTED_TOOLS,...BROWSER_TOOLS.filter(t=>!policy.tools.includes(t))].map(t=>prefix+t),canUseTool,
    hooks:Object.fromEntries(['PreToolUse','PostToolUse','PostToolUseFailure'].map(event=>[event,[{matcher:prefix+'.*',hooks:[hook(event)]}]])),
    ...(resumeSnapshot?{resumeSnapshot}:{}),
   });
  }
  return Object.freeze({fragment,status,settle,
   async prepareTakeover(input){if(settled||!open)throw fault('BROWSER_CUSTODY_UNAVAILABLE');return assertBrowserCustody(await port.prepareTakeover(input),{binding});},
   async captureTakeover(input){if(settled||!open)throw fault('BROWSER_CUSTODY_UNAVAILABLE');return assertBrowserCustody(await port.captureTakeover(input),{binding});},
   async retainTakeover(input){if(settled||!open)throw fault('BROWSER_CUSTODY_UNAVAILABLE');const result=own(await port.retainTakeover(input),['retained','custody']);if(result.retained!==true)throw fault('BROWSER_CUSTODY_REFUSED');assertBrowserCustody(result.custody,{binding});retained=result;return result;},
  });
 }catch(error){await settle({outcome:'failed'});throw error;}
}

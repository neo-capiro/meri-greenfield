/** AgentCore half of the existing browser run. Effects, permission decisions,
 * page tracking, receipts, downloads and physical cleanup remain host-owned.
 *
 * The run's browser host is provisioned on first use: nothing here contacts the host until the model's first browser
 * call reaches the PreToolUse gate, which prepares the browser once (`starting()` is told, so the conversation can show
 * that a browser is starting) and then forwards to the host as before. A run that never browses prepares nothing and
 * settles with a local not-applicable receipt. A takeover handoff prepares at once: its browser already holds custody. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertBrowserCustody} from '../../../../packages/runtime/browser-custody.mjs';
import {assertBrowserHookResult,assertBrowserApprovalResult,browserOperationCeilingMs,BROWSER_NATIVE_LIMITS} from '../../../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {createBrowserSdkServer} from './sdk-server.mjs';
import {validateBrowserPolicy,BROWSER_TOOLS,INTERACTION_TOOLS} from './policy.mjs';
import {EXPOSED_UNADMITTED_TOOLS} from './fragment.mjs';
import {assertBrowserCleanupReceipt,BROWSER_CLEANUP_SCHEMA} from './lifecycle.mjs';
const prefix='mcp__meri_browser__',fault=code=>Object.assign(Error(code),{code});
/** The PreToolUse gate may first wait for the browser host (seconds): preparation plus one hook round trip. */
const FIRST_USE_HOOK_TIMEOUT_S=Math.ceil((browserOperationCeilingMs('browser-prepare')+BROWSER_NATIVE_LIMITS.metadataMs)/1000);
export async function prepareRemoteBrowserRun({port,binding,deadlineMs,now,signal,browserHandoff,starting}){
 if(starting!==undefined&&typeof starting!=='function')throw fault('BROWSER_CONFIGURATION');
 let sdk,metadata=null,preparing,settled,retained;
 /** One preparation per run; a failure is final for the run (the browser is unavailable, every gate then denies). */
 const ensure=(options={})=>preparing??=(async()=>{
  try{starting?.();}catch{}
  const result=await port.prepare({signal:options.signal});const policy=validateBrowserPolicy(result.policy);
  if(result.activation!=='open'||!policy.enabled)throw fault('BROWSER_ACTIVATION_HELD');
  metadata=Object.freeze({...result,policy});await sdk?.toolsChanged();return metadata;
 })();
 const settle=input=>settled??=(async()=>{
  try{await sdk?.close();if(retained&&input.outcome!=='failed')return retained;
   // Never prepared: no host, egress grant, process or profile was created for this run's browser.
   if(preparing===undefined)return assertBrowserCleanupReceipt({schema:BROWSER_CLEANUP_SCHEMA,binding:structuredClone(binding),outcome:input.outcome,
    activation:'not-applicable',egress:'not-applicable',process:'not-applicable',profile:'done'},{binding,outcome:input.outcome});
   return assertBrowserCleanupReceipt(await port.settle(input),{binding,outcome:input.outcome});}
  catch{throw fault('BROWSER_CLEANUP_UNKNOWN');}
 })();
 try{
  sdk=createBrowserSdkServer({binding,prepared:()=>metadata,ensure:()=>ensure(),tools:port.tools,call:port.call,deadlineMs,now});
  let resumeSnapshot;
  if(browserHandoff){
   await ensure({signal});
   resumeSnapshot=data(own(metadata.resumeSnapshot,['content']));
   if(canonicalSha256(resumeSnapshot)!==browserHandoff.returned?.snapshotSha256)throw fault('BROWSER_CUSTODY_REFUSED');
  }
  const hook=event=>async(raw,toolUseId,options)=>{
   try{
    await ensure();
    const input={hook_event_name:raw.hook_event_name,session_id:raw.session_id,tool_name:raw.tool_name,tool_input:raw.tool_input,tool_use_id:raw.tool_use_id,...(event==='PostToolUse'?{tool_response:raw.tool_response}:{})};
    if(toolUseId!==undefined&&toolUseId!==raw.tool_use_id)throw fault('BROWSER_PERMISSION_INPUT');
    return assertBrowserHookResult(await port.hook({event,toolUseId:raw.tool_use_id,input:data(input),signal:options?.signal}),event);
   }catch{return event==='PreToolUse'?{hookSpecificOutput:{hookEventName:event,permissionDecision:'deny',permissionDecisionReason:'Browser unavailable'}}:{continue:false,stopReason:'Browser receipt unavailable; browser work stopped.'};}
  };
  const canUseTool=async(name,input,options={})=>{
   if(typeof name!=='string'||!name.startsWith(prefix))return undefined;
   try{await ensure();if(options.mcpServer!==undefined&&options.mcpServer.name!=='meri_browser')throw fault('BROWSER_SERVER_MISMATCH');return assertBrowserApprovalResult(await port.approve({tool:name.slice(prefix.length),toolUseId:options.toolUseID,input:data(input),signal:options.signal}),{input,toolUseId:options.toolUseID});}
   catch{return {behavior:'deny',message:'Browser approval unavailable'};}
  };
  // Pre-approval names only: the host's PreToolUse gate still refuses any tool outside the run's effective policy.
  const fragment=Object.freeze({enabled:true,activation:'open',mcpServers:{meri_browser:sdk.server},
   allowedTools:BROWSER_TOOLS.filter(t=>!INTERACTION_TOOLS.includes(t)).map(t=>prefix+t),
   disallowedTools:EXPOSED_UNADMITTED_TOOLS.map(t=>prefix+t),canUseTool,
   hooks:Object.fromEntries(['PreToolUse','PostToolUse','PostToolUseFailure'].map(event=>[event,[{matcher:prefix+'.*',hooks:[hook(event)],
    ...(event==='PreToolUse'?{timeout:FIRST_USE_HOOK_TIMEOUT_S}:{})}]])),
   ...(resumeSnapshot?{resumeSnapshot}:{}),
  });
  const prepared=()=>{if(settled||metadata===null)throw fault('BROWSER_CUSTODY_UNAVAILABLE');};
  return Object.freeze({fragment,settle,
   async prepareTakeover(input){prepared();return assertBrowserCustody(await port.prepareTakeover(input),{binding});},
   async captureTakeover(input){prepared();return assertBrowserCustody(await port.captureTakeover(input),{binding});},
   async retainTakeover(input){prepared();const result=own(await port.retainTakeover(input),['retained','custody']);if(result.retained!==true)throw fault('BROWSER_CUSTODY_REFUSED');assertBrowserCustody(result.custody,{binding});retained=result;return result;},
  });
 }catch(error){await settle({outcome:'failed'});throw error;}
}

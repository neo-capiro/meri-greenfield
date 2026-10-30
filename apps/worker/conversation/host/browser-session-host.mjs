/** Trusted D005 host composition. Native relay/process/hold ports remain their owners.
 * No host allocation or browser activation is performed here. */
import {randomUUID} from 'node:crypto';
import {assertLifecycleReceipt} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from './binding.mjs';
import {createPinnedBrowserSession} from '../browser/session/connection.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';
import {validateBrowserInstallation,playwrightServerConfig} from '../browser/server.mjs';
import {browserPaths} from '../browser/workspace.mjs';
import {validateSiteWorkflowManifest} from '../browser/site-workflows/manifest.mjs';
import {prepareCurrentSiteWorkflow} from '../browser/site-workflows/current.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createBrowserSessionHost({binding,cwd,installation,upstream,contexts,relay,modelTransport,controls,current,siteWorkflows,hold,processes,dispose,now,allocation,ownerInstanceId=controls?.ownerInstanceId??randomUUID(),retirement}){
 const installed=validateBrowserInstallation(installation,binding),bound=canonicalSha256(binding),paths=browserPaths(cwd);
 if(relay&&modelTransport||!relay&&!modelTransport)fail('BROWSER_CONFIGURATION');
 for(const [port,name]of [[contexts,'create'],...(relay?[[relay,'bind']]:[]),[controls,'bind'],[processes,'waitForExit']])
  if(typeof port?.[name]!=='function')fail('BROWSER_CONFIGURATION');
 if(typeof current!=='function'||typeof hold!=='function'||typeof dispose!=='function'||typeof now!=='function')fail('BROWSER_CONFIGURATION');
 let opened=false,active;
 return Object.freeze({ownerInstanceId,
  async prepareResume(input){if(!active)fail('BROWSER_CUSTODY_UNAVAILABLE');return active.prepareResume(input);},
  async open(raw){
  const q=data(own(raw,['binding','policy','deadlineMs','manifest']));
  if(opened||canonicalSha256(q.binding)!==bound||!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_HOST_BINDING_REFUSED');
  opened=true;const policy=validateBrowserPolicy(q.policy),manifest=q.manifest===null?null:validateSiteWorkflowManifest(q.manifest,{platformMaximumOrigins:policy.allowedOrigins});
  if(manifest?.logoutUrl&&typeof contexts.logout!=='function')fail('BROWSER_CONFIGURATION');
  let context,session,modelRelay,userRelay,closing,workflow,custody,retained=false,captured=false,pendingResume,preparingResume;
  const assertCurrent=async signal=>{
   await current({binding:q.binding,signal});
   await workflow?.assertCurrent({signal});
   signal?.throwIfAborted();
  };
  const close=({trigger})=>closing??=(async()=>{
   pendingResume=undefined;
   // Both native input channels are revoked before teardown. Relay acknowledgements
   // do not stand in for the host's actual process-absence and filesystem proofs.
   let refusal;for(const port of [modelRelay,userRelay])try{await port?.close();}catch(error){refusal??=error;}
   let receipt;try{receipt=await session.destroy({trigger});}catch(error){refusal??=error;}
   if(refusal)throw refusal;return receipt;
  })();
  try{
   await assertCurrent();
   if(manifest){
    if(typeof siteWorkflows?.resolve!=='function')fail('BROWSER_WORKFLOW_CURRENT_REQUIRED');
    workflow=await prepareCurrentSiteWorkflow({binding:q.binding,policy,
     selection:{siteId:manifest.siteId,workflowId:manifest.workflowId,version:manifest.version,manifestSha256:canonicalSha256(manifest)},
     resolve:value=>siteWorkflows.resolve(value)});
    if(canonicalSha256(workflow.policy)!==canonicalSha256(policy))fail('BROWSER_WORKFLOW_POLICY_REFUSED');
   }
   context=await contexts.create({binding:q.binding,policy,paths,installation:installed,deadlineMs:q.deadlineMs});
   session=await createPinnedBrowserSession({upstream,context,policy,manifest,now,deadlineMs:q.deadlineMs,
    current:assertCurrent,hold:signal=>hold({binding:q.binding,signal}),
    ports:{async waitForExit({signal}){return processes.waitForExit({binding:q.binding,profile:paths.profile},{signal});},
     dispose:({signal})=>dispose({paths,signal}),...(manifest?.logoutUrl?{logout:(input,{signal})=>contexts.logout({context,...input,signal})}:{})}});
   const model=relay??(await import('./browser-model-relay.mjs')).createNativeBrowserModelRelay({binding:q.binding,policy,installation:installed,paths,
    ...own(modelTransport,['readable','writable']),onDisconnect:()=>custody?undefined:close({trigger:'disconnect'})});
   modelRelay=await model.bind({binding:q.binding,installation:installed,call:session.call,tools:session.tools});
   if(closing){await modelRelay.close();fail('BROWSER_SESSION_CLOSED');}
   const expected={meri_browser:playwrightServerConfig(policy,installed,paths)};
   if(canonicalSha256(modelRelay.mcpServers)!==canonicalSha256(expected)||typeof modelRelay.close!=='function')fail('BROWSER_RELAY_REFUSED');
   // Controls are bound only by a native host viewer relay. They are never MCP tools.
   userRelay=await controls.bind({binding:q.binding,pages:()=>context.pages(),controls:{readState:session.readState,takeover:session.takeover,prepareResume:session.prepareResume,view:session.view,userInput:session.userInput,
    handBack:session.handBack,endLease:session.endLease,destroy:close}});
   if(closing){await userRelay.close();fail('BROWSER_SESSION_CLOSED');}
   if(typeof userRelay?.close!=='function')fail('BROWSER_RELAY_REFUSED');
   await assertCurrent();
   if(closing)fail('BROWSER_SESSION_CLOSED');
   active=Object.freeze({mcpServers:expected,destroy:close,
    async prepareResume({binding:source,custody:expectedCustody,signal}){
     if(closing||!retained||!custody||canonicalSha256(source)!==bound||canonicalSha256(expectedCustody)!==canonicalSha256(custody))fail('BROWSER_CUSTODY_REFUSED');
     await assertCurrent(signal);
     if(!preparingResume)preparingResume=(async()=>{
      let state=await session.readState({signal});
      if(state.state==='user')state=session.handBack();
      if(state.state!=='returning'||state.leaseEpoch!==custody.leaseEpoch+1)fail('BROWSER_CUSTODY_REFUSED');
      const snapshot=await session.prepareResume({explicit:true,signal});await assertCurrent(signal);
      if(closing)fail('BROWSER_CUSTODY_REFUSED');
      const returned=Object.freeze({ownerInstanceId,leaseEpoch:state.leaseEpoch,snapshotSha256:canonicalSha256(snapshot)});
      pendingResume={snapshot,returned};return returned;
     })().catch(error=>{preparingResume=undefined;throw error;});
     const result=await preparingResume;await assertCurrent(signal);
     if(closing||pendingResume?.returned!==result)fail('BROWSER_CUSTODY_REFUSED');return result;
    },
    async prepareTakeover({controlId,signal}){
     if(closing||custody||!retirement||['prepare','wait','retain'].some(k=>typeof retirement[k]!=='function'))fail('BROWSER_CUSTODY_UNAVAILABLE');
     const a=assertHostAllocation(allocation);assertHostRunBinding(a,q.binding);
     if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(ownerInstanceId)||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(controlId))fail('BROWSER_CUSTODY_REFUSED');
     try{const drained=await session.prepareTakeover({signal});await assertCurrent(signal);
      custody=Object.freeze({schema:'meri-browser-custody/1',binding:q.binding,controlId,ownerInstanceId,hostId:a.hostId,generation:a.generation,
       leaseEpoch:drained.leaseEpoch+1,policySha256:canonicalSha256(policy),expiresAtMs:Math.min(q.deadlineMs,a.leaseDeadlineMs,now()+28800000)});
      await retirement.prepare({custody,signal});return custody;
     }catch(error){await close({trigger:'disconnect'});throw error;}
    },
    async captureTakeover({controlId,signal}){
     if(closing||!custody||custody.controlId!==controlId)fail('BROWSER_CUSTODY_REFUSED');
     try{await retirement.wait({custody,signal});await assertCurrent(signal);captured=true;return custody;}
     catch(error){await close({trigger:'disconnect'});throw error;}
    },
    async retainTakeover({receipt,signal}){
     const r=assertLifecycleReceipt(receipt);
     if(closing||!captured||!custody||r.state!=='APPLIED'||r.intent!=='takeover.begin'||r.controlId!==custody.controlId||
      canonicalSha256(r.sourceBinding)!==bound||r.checkpointId!==q.binding.runId)fail('BROWSER_CUSTODY_REFUSED');
     if(retained)return Object.freeze({retained:true,custody});
     try{await assertCurrent(signal);await retirement.retain({custody,signal});
      const lease=await session.takeover({signal});if(lease.leaseEpoch!==custody.leaseEpoch)fail('BROWSER_CUSTODY_REFUSED');
      retained=true;return Object.freeze({retained:true,custody});
     }catch(error){await close({trigger:'disconnect'});throw error;}
    },
   });return active;
  }catch(error){
   if(session)try{await close({trigger:'disconnect'});}catch{fail('BROWSER_DISPOSE_INCOMPLETE');}
   else try{await context?.close();}finally{await contexts.close?.();}
   throw error;
  }
 }});
}

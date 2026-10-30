/** Trusted D005 host composition. Native relay/process/hold ports remain their owners.
 * No host allocation or browser activation is performed here. */
import {randomUUID} from 'node:crypto';
import {assertLifecycleReceipt} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertHostAllocation,assertHostRunBinding} from './binding.mjs';
import {createPinnedBrowserSession} from '../browser/session/connection.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';
import {validateBrowserInstallation,validateBrowserContextInstallation,playwrightServerConfig} from '../browser/server.mjs';
import {createBoundBrowserModelPort} from './browser-model-port.mjs';
import {browserPaths} from '../browser/workspace.mjs';
import {validateSiteWorkflowManifest} from '../browser/site-workflows/manifest.mjs';
import {prepareCurrentSiteWorkflow} from '../browser/site-workflows/current.mjs';
import {assertBrowserHandoff} from '../../../../packages/runtime/browser-custody.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createBrowserSessionHost({binding,cwd,installation,upstream,contexts,relay,modelTransport,controls,current,siteWorkflows,hold,processes,dispose,now,allocation,ownerInstanceId=controls?.ownerInstanceId??randomUUID(),retirement}){
 const hostOwned=modelTransport==='host-owned';
 const installed=hostOwned?validateBrowserContextInstallation(installation):validateBrowserInstallation(installation,binding),bound=canonicalSha256(binding),paths=browserPaths(cwd);
 if(relay&&modelTransport||!relay&&!modelTransport)fail('BROWSER_CONFIGURATION');
 for(const [port,name]of [[contexts,'create'],...(relay?[[relay,'bind']]:[]),[controls,'bind'],[processes,'waitForExit']])
  if(typeof port?.[name]!=='function')fail('BROWSER_CONFIGURATION');
 if(typeof current!=='function'||typeof hold!=='function'||typeof dispose!=='function'||typeof now!=='function')fail('BROWSER_CONFIGURATION');
 let opened=false,active,adopt,closeOwner,activeRelay=controls;
 return Object.freeze({ownerInstanceId,
  async readAdmission(input){if(!active||typeof activeRelay?.readAdmission!=='function')fail('BROWSER_CUSTODY_UNAVAILABLE');return activeRelay.readAdmission(input);},
  async execute(input){if(!active||typeof activeRelay?.execute!=='function')fail('BROWSER_CUSTODY_UNAVAILABLE');return activeRelay.execute(input);},
  async prepareResume(input){if(!active)fail('BROWSER_CUSTODY_UNAVAILABLE');return active.prepareResume(input);},
  async readModelTools(input){if(!active)fail('BROWSER_CUSTODY_UNAVAILABLE');return active.readModelTools(input);},
  async callModelTool(input){if(!active)fail('BROWSER_CUSTODY_UNAVAILABLE');return active.callModelTool(input);},
  async adopt(input,native){if(!adopt)fail('BROWSER_CUSTODY_UNAVAILABLE');return adopt(input,native);},
  async destroy(input){if(!closeOwner)fail('BROWSER_CUSTODY_UNAVAILABLE');return closeOwner(input);},
  async open(raw){
  const q=data(own(raw,['binding','policy','deadlineMs','manifest']));
  if(opened||canonicalSha256(q.binding)!==bound||!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_HOST_BINDING_REFUSED');
  opened=true;const policy=validateBrowserPolicy(q.policy),manifest=q.manifest===null?null:validateSiteWorkflowManifest(q.manifest,{platformMaximumOrigins:policy.allowedOrigins});
  if(manifest?.logoutUrl&&typeof contexts.logout!=='function')fail('BROWSER_CONFIGURATION');
  let context,session,modelRelay,userRelay,closing,workflow,custody,retained=false,captured=false,pendingResume,preparingResume;
  let run=q,runInstallation=installed,runPorts={relay,modelTransport,controls,retirement,hold},adopting=false,retiringRelays=false,resume,activation;
  const assertCurrent=async signal=>{
   const receipt=await current({binding:q.binding,signal});
   if(run!==q){const handoff=assertBrowserHandoff(receipt?.browserHandoff);
    if(canonicalSha256(handoff.targetBinding)!==canonicalSha256(run.binding)&&
     !(retained&&pendingResume&&canonicalSha256(handoff.custody.binding)===canonicalSha256(run.binding)))fail('BROWSER_CUSTODY_REFUSED');}
   await workflow?.assertCurrent({signal});
   signal?.throwIfAborted();
   return receipt;
  };
  const close=({trigger})=>closing??=(async()=>{
   pendingResume=undefined;
   // Both native input channels are revoked before teardown. Relay acknowledgements
   // do not stand in for the host's actual process-absence and filesystem proofs.
   let refusal;for(const port of [modelRelay,userRelay])try{await port?.close();}catch(error){refusal??=error;}
   let receipt;try{receipt=await session.destroy({trigger});}catch(error){refusal??=error;}
   if(refusal)throw refusal;return receipt;
  })();
  closeOwner=close;
  const activate=async ownerRun=>{
   if(closing||run!==ownerRun)fail('BROWSER_CUSTODY_REFUSED');
   if(!resume)return;
   return activation??=Promise.resolve().then(async()=>{try{
    const prepared=resume,receipt=await assertCurrent();
    if(!prepared||canonicalSha256(receipt.browserHandoff)!==canonicalSha256(prepared.handoff))fail('BROWSER_CUSTODY_REFUSED');
    await session.completeResume({snapshot:prepared.snapshot});
    if(closing||run!==ownerRun)fail('BROWSER_CUSTODY_REFUSED');resume=undefined;
   }catch(error){await close({trigger:'disconnect'});throw error;}});
  };
  const bindRelays=async()=>{
   const ownerRun=run,assertRun=()=>{if(closing||ownerRun!==run)fail('BROWSER_CUSTODY_REFUSED');};
   const modelInput={binding:run.binding,installation:runInstallation,
    async call(input){assertRun();await activate(ownerRun);assertRun();return session.call({...input,requestId:canonicalSha256({binding:ownerRun.binding,requestId:input.requestId})});},
    async tools({signal}={}){assertRun();await activate(ownerRun);assertRun();await assertCurrent(signal);return session.tools({signal});}};
   if(hostOwned){
    const model=createBoundBrowserModelPort({binding:run.binding,policy,deadlineMs:run.deadlineMs,now,call:modelInput.call,tools:modelInput.tools});
    modelRelay=Object.freeze({mcpServers:{},readModelTools:model.tools,callModelTool:model.call,close:model.close});
   }else{
    const model=runPorts.relay??(await import('./browser-model-relay.mjs')).createNativeBrowserModelRelay({binding:run.binding,policy,installation:runInstallation,paths,
     ...own(runPorts.modelTransport,['readable','writable']),onDisconnect:()=>custody?undefined:close({trigger:'disconnect'})});
    modelRelay=await model.bind(modelInput);
   }
   if(closing){await modelRelay.close();fail('BROWSER_SESSION_CLOSED');}
   const expected=hostOwned?{}:{meri_browser:playwrightServerConfig(policy,runInstallation,paths)};
   if(canonicalSha256(modelRelay.mcpServers)!==canonicalSha256(expected)||typeof modelRelay.close!=='function')fail('BROWSER_RELAY_REFUSED');
   // Each target gets a new immutable viewer relay. Even a retained reference
   // to an old control callback cannot read, mutate or destroy its successor.
   const guarded=fn=>(...args)=>{assertRun();return fn(...args);};
   userRelay=await runPorts.controls.bind({binding:run.binding,pages:guarded(()=>context.pages()),controls:{
    readState:guarded(session.readState),takeover:guarded(session.takeover),prepareResume:guarded(session.prepareResume),
    view:guarded(session.view),userInput:guarded(session.userInput),handBack:guarded(session.handBack),
    endLease:guarded(reason=>retiringRelays&&session.state().state==='returning'?session.state():session.endLease(reason)),destroy:guarded(close)}});
   if(closing){await userRelay.close();fail('BROWSER_SESSION_CLOSED');}
   if(typeof userRelay?.close!=='function')fail('BROWSER_RELAY_REFUSED');
   return expected;
  };
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
    current:assertCurrent,hold:signal=>runPorts.hold({binding:run.binding,signal}),
    ports:{async waitForExit({signal}){return processes.waitForExit({binding:q.binding,profile:paths.profile},{signal});},
     dispose:({signal})=>dispose({paths,signal}),...(manifest?.logoutUrl?{logout:(input,{signal})=>contexts.logout({context,...input,signal})}:{})}});
   const expected=await bindRelays();
   await assertCurrent();
   if(closing)fail('BROWSER_SESSION_CLOSED');
   const handle=(expected,snapshot)=>{const ownerRun=run,runModel=modelRelay,runBound=canonicalSha256(run.binding),assertRun=()=>{if(ownerRun!==run||closing)fail('BROWSER_CUSTODY_REFUSED');};
    return Object.freeze({mcpServers:expected,...(snapshot?{resumeSnapshot:structuredClone(snapshot)}:{}),
    async readModelTools(input){assertRun();if(!hostOwned)fail('BROWSER_CUSTODY_UNAVAILABLE');return runModel.readModelTools(input);},
    async callModelTool(input){assertRun();if(!hostOwned)fail('BROWSER_CUSTODY_UNAVAILABLE');return runModel.callModelTool(input);},
    destroy(input){if(ownerRun!==run)fail('BROWSER_CUSTODY_REFUSED');return close(input);},
    async prepareResume({binding:source,custody:expectedCustody,signal}){
     assertRun();if(!retained||!custody||canonicalSha256(source)!==runBound||canonicalSha256(expectedCustody)!==canonicalSha256(custody))fail('BROWSER_CUSTODY_REFUSED');
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
     assertRun();if(custody||resume||!runPorts.retirement||['prepare','wait','retain'].some(k=>typeof runPorts.retirement[k]!=='function'))fail('BROWSER_CUSTODY_UNAVAILABLE');
     const a=assertHostAllocation(allocation);assertHostRunBinding(a,run.binding);
     if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(ownerInstanceId)||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(controlId))fail('BROWSER_CUSTODY_REFUSED');
     try{const drained=await session.prepareTakeover({signal});await assertCurrent(signal);
      custody=Object.freeze({schema:'meri-browser-custody/1',binding:run.binding,controlId,ownerInstanceId,hostId:a.hostId,generation:a.generation,
       leaseEpoch:drained.leaseEpoch+1,policySha256:canonicalSha256(policy),expiresAtMs:Math.min(run.deadlineMs,q.deadlineMs,a.leaseDeadlineMs,now()+28800000)});
      await runPorts.retirement.prepare({custody,signal});return custody;
     }catch(error){await close({trigger:'disconnect'});throw error;}
    },
    async captureTakeover({controlId,signal}){
     assertRun();if(!custody||custody.controlId!==controlId)fail('BROWSER_CUSTODY_REFUSED');
     try{await runPorts.retirement.wait({custody,signal});await assertCurrent(signal);captured=true;return custody;}
     catch(error){await close({trigger:'disconnect'});throw error;}
    },
    async retainTakeover({receipt,signal}){
     assertRun();
     const r=assertLifecycleReceipt(receipt);
     if(closing||!captured||!custody||r.state!=='APPLIED'||r.intent!=='takeover.begin'||r.controlId!==custody.controlId||
      canonicalSha256(r.sourceBinding)!==runBound||r.checkpointId!==run.binding.runId)fail('BROWSER_CUSTODY_REFUSED');
     if(retained)return Object.freeze({retained:true,custody});
     try{await assertCurrent(signal);await runPorts.retirement.retain({custody,signal});
      const lease=await session.takeover({signal});if(lease.leaseEpoch!==custody.leaseEpoch)fail('BROWSER_CUSTODY_REFUSED');
      retained=true;return Object.freeze({retained:true,custody});
     }catch(error){await close({trigger:'disconnect'});throw error;}
    },
   });};
   adopt=async(raw,native)=>{
    const {signal,...input}=own(raw,['binding','policy','deadlineMs','manifest','handoff'],['signal']);
    const next=data(input),handoff=assertBrowserHandoff(next.handoff,{targetBinding:next.binding});
    if(closing||adopting||!retained||!pendingResume||!custody||resume||
     canonicalSha256(handoff.custody)!==canonicalSha256(custody)||canonicalSha256(handoff.returned)!==canonicalSha256(pendingResume.returned)||
     canonicalSha256(next.policy)!==canonicalSha256(policy)||canonicalSha256(next.manifest)!==canonicalSha256(manifest)||
     !Number.isSafeInteger(next.deadlineMs)||next.deadlineMs<=now()||next.deadlineMs>custody.expiresAtMs)fail('BROWSER_CUSTODY_REFUSED');
    const ports=own(native,['installation','controls','retirement','hold'],['relay','modelTransport']);
    const nextInstallation=hostOwned?validateBrowserContextInstallation(ports.installation):validateBrowserInstallation(ports.installation,next.binding);
    const {launch:oldLaunch,...physical}=installed,{launch:newLaunch,...nextPhysical}=nextInstallation;
    if(canonicalSha256(physical)!==canonicalSha256(nextPhysical)||typeof ports.controls?.bind!=='function'||
     ports.controls.ownerInstanceId!==undefined&&ports.controls.ownerInstanceId!==ownerInstanceId||typeof ports.hold!=='function'||
     ['prepare','wait','retain'].some(k=>typeof ports.retirement?.[k]!=='function')||
     (ports.modelTransport==='host-owned')!==hostOwned||
     (ports.relay?typeof ports.relay.bind!=='function'||ports.modelTransport:!ports.modelTransport))fail('BROWSER_CONFIGURATION');
    adopting=true;
    try{
     const receipt=await assertCurrent(signal);
     if(canonicalSha256(receipt?.browserHandoff)!==canonicalSha256(handoff))fail('BROWSER_CUSTODY_REFUSED');
     let nextWorkflow;if(manifest)nextWorkflow=await prepareCurrentSiteWorkflow({binding:next.binding,policy,
      selection:{siteId:manifest.siteId,workflowId:manifest.workflowId,version:manifest.version,manifestSha256:canonicalSha256(manifest)},
      resolve:value=>siteWorkflows.resolve(value),signal});
     if(nextWorkflow&&canonicalSha256(nextWorkflow.policy)!==canonicalSha256(policy))fail('BROWSER_WORKFLOW_POLICY_REFUSED');
     // The old viewer's close ends its transport lease. The canonical hand-back
     // already did that; do not discard the exact prepared snapshot while
     // retiring this expected old relay.
     retiringRelays=true;await modelRelay.close();await userRelay.close();retiringRelays=false;signal?.throwIfAborted();
     const snapshot=pendingResume.snapshot;
     run=next;runInstallation=nextInstallation;runPorts=ports;workflow=nextWorkflow;
     resume={snapshot,handoff};activation=undefined;custody=undefined;retained=false;captured=false;pendingResume=undefined;preparingResume=undefined;
     const expected=await bindRelays();await assertCurrent(signal);
     if(closing)fail('BROWSER_SESSION_CLOSED');activeRelay=ports.controls;active=handle(expected,snapshot);return active;
    }catch(error){await close({trigger:'disconnect'});throw error;}finally{adopting=false;retiringRelays=false;}
   };
   active=handle(expected);return active;
  }catch(error){
   if(session)try{await close({trigger:'disconnect'});}catch{fail('BROWSER_DISPOSE_INCOMPLETE');}
   else try{await context?.close();}finally{await contexts.close?.();}
   throw error;
  }
 }});
}

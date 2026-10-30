/** Authenticated service adapter, not a listener or an authorization source.
 * The existing Control route authenticates before calling this bound owner.
 * readRun supplies fresh canonical facts; no worker chooses paths or policy. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertBrowserOperationRequest,assertBrowserOperationResponse,assertBrowserHookResult,assertBrowserApprovalResult,browserOperationName,browserOperationCeilingMs,browserOperationBudgetMs,BROWSER_NATIVE_LIMITS} from '../../../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {prepareBrowserRun} from '../browser/runtime.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';

const fault=code=>Object.assign(Error(code),{code});
const fail=()=>{throw fault('BROWSER_OPERATION_REFUSED');};
const prefix='mcp__meri_browser__';
const metadata=(binding,run,approvalDeadlineMs)=>data({binding,policy:run.fragment.policy,activation:run.fragment.activation,approvalDeadlineMs,
 ...(run.fragment.reason?{reason:run.fragment.reason}:{}),...(run.fragment.resumeSnapshot?{resumeSnapshot:run.fragment.resumeSnapshot}:{})});

/** Operate the original prepared fragment. Exported for focused composition
 * checks with buildOpenBrowserFragment; production preparation below always
 * uses prepareBrowserRun and its non-injectable source activation gate. */
export async function dispatchPreparedBrowserOperation({binding,run,sessions,operation,request,signal}){
 const name=browserOperationName(operation),q=assertBrowserOperationRequest(name,request);
 nativeSignal(signal);if(signal?.aborted||canonicalSha256(q.binding)!==canonicalSha256(binding))fail();
 if(name==='browser-settle')return run.settle({outcome:q.outcome});
 if(run.fragment.activation!=='open')fail();
 if(name==='browser-tools')return sessions.readModelTools({binding,signal});
 if(name==='browser-call')return sessions.callModelTool({...q,signal});
 if(name==='browser-approve')return assertBrowserApprovalResult(await run.fragment.canUseTool(prefix+q.tool,q.input,{toolUseID:q.toolUseId,mcpServer:{name:'meri_browser'},signal}),{input:q.input,toolUseId:q.toolUseId});
 if(name==='browser-hook'){
  const output={};
  for(const group of run.fragment.hooks[q.event]??[]){
   if(group.matcher&&!new RegExp(group.matcher,'u').test(q.input.tool_name))continue;
   for(const hook of group.hooks){
    const value=assertBrowserHookResult(await hook(q.input,q.toolUseId,{signal}),q.event);signal?.throwIfAborted();
    if(value.continue===false){output.continue=false;output.stopReason??=value.stopReason;}
    if(value.hookSpecificOutput){
     const decision=own(value.hookSpecificOutput,['hookEventName','permissionDecision','permissionDecisionReason']);
     if(q.event!=='PreToolUse'||decision.hookEventName!==q.event||!['ask','deny'].includes(decision.permissionDecision))fail();
     if(output.hookSpecificOutput?.permissionDecision!=='deny')output.hookSpecificOutput=decision;
    }
   }
  }
  if(output.stopReason===undefined)delete output.stopReason;
  return assertBrowserHookResult(output,q.event);
 }
 if(name==='browser-prepare-takeover')return run.prepareTakeover({controlId:q.controlId,signal});
 if(name==='browser-capture-takeover')return run.captureTakeover({controlId:q.controlId,signal});
 if(name==='browser-retain-takeover')return run.retainTakeover({receipt:q.receipt,signal});
 fail();
}

/** readRun({binding,signal}) returns {binding,cwd,deadlineMs,port,
 * siteWorkflow?,siteWorkflows?,browserHandoff?}, derived by the existing canonical
 * owner. sessions is the same stable BrowserSessionHost used by port.sessions.
 * A later binding gets a new operation owner and adopts through that host. */
export function createBrowserOperationHost({binding:raw,readRun,sessions,now=Date.now}){
 const binding=data(raw);validateShape('RunBinding',binding);const digest=canonicalSha256(binding);
 if(typeof readRun!=='function'||typeof now!=='function'||typeof sessions?.readModelTools!=='function'||typeof sessions?.callModelTool!=='function')fail();
 let preparing,prepared,configurationDigest,basePolicyDigest,approvalDeadlineMs,settling=false,settlement;
 const current=async(signal,cleanup)=>{
  const facts=own(await readRun({binding,signal}),['binding','cwd','deadlineMs','port'],['siteWorkflow','siteWorkflows','browserHandoff']);
  if(canonicalSha256(data(facts.binding))!==digest||!Number.isSafeInteger(facts.deadlineMs)||facts.deadlineMs<1||
   !cleanup&&facts.deadlineMs<=now()||facts.port?.modelTransport!=='host-owned'||typeof facts.port.policy!=='function')fail();
  const pinned=canonicalSha256({binding,cwd:facts.cwd,deadlineMs:facts.deadlineMs,siteWorkflow:facts.siteWorkflow??null,browserHandoff:facts.browserHandoff??null});
  if(configurationDigest!==undefined&&pinned!==configurationDigest)fail();
  if(cleanup)return facts;
  const policy=validateBrowserPolicy(data(await facts.port.policy({binding,signal}))),policyDigest=canonicalSha256(policy);
  if(basePolicyDigest!==undefined&&policyDigest!==basePolicyDigest||configurationDigest!==undefined&&pinned!==configurationDigest)fail();
  signal?.throwIfAborted();return {...facts,policy,policyDigest,configurationDigest:pinned};
 };
 return Object.freeze({async executeBrowserOperation(operation,request,options={}){
  let life;const name=browserOperationName(operation),cleanup=name==='browser-settle';
  try{
   const q=assertBrowserOperationRequest(operation,request),{signal,deadlineMs}=own(options,[],['signal','deadlineMs']);nativeSignal(signal);
   if(deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()))fail();
   if(canonicalSha256(q.binding)!==digest||settling&&!cleanup)fail();
   life=createOperationLifetime({deadlineMs:Math.min(deadlineMs??Number.MAX_SAFE_INTEGER,now()+browserOperationCeilingMs(name)),now,signal,errorFactory:()=>fault('BROWSER_OPERATION_REFUSED')});
   const facts=await life.run(inner=>current(inner,cleanup));
   if(!cleanup)life.limitDeadline(facts.deadlineMs);
   if(name==='browser-prepare'){
    if(!preparing){
     configurationDigest=facts.configurationDigest;basePolicyDigest=facts.policyDigest;
     approvalDeadlineMs=facts.port.approvalDeadlineMs??BROWSER_NATIVE_LIMITS.defaultApprovalMs;
     browserOperationBudgetMs('browser-approve',{approvalDeadlineMs});
     preparing=life.run(async inner=>{
      // Pin the policy already read under current authority. prepareBrowserRun
      // still owns workflow intersection, original hooks and activation.
      const port={...facts.port,policy:async()=>facts.policy};
      const run=await prepareBrowserRun({port,binding,cwd:facts.cwd,deadlineMs:facts.deadlineMs,now,signal:inner,
       siteWorkflow:facts.siteWorkflow,siteWorkflows:facts.siteWorkflows,browserHandoff:facts.browserHandoff});
      if(inner.aborted||settling){await run.settle({outcome:'failed'});fail();}
      prepared=run;return metadata(binding,run,approvalDeadlineMs);
     });
    }
    const result=await life.run(()=>preparing);life.check();
    assertBrowserOperationResponse({binding,result},binding);return data({binding,result});
   }
   if(!prepared)fail();
   life.limitDeadline(now()+browserOperationBudgetMs(name,{policy:prepared.fragment.policy,approvalDeadlineMs}));
   let result;
   if(cleanup){
    settling=true;
    // Cleanup has its own lifetime; an expired run is not proof of absence.
    // Control still must authenticate this exact binding before it arrives.
    settlement??=prepared.settle({outcome:q.outcome});result=await life.run(()=>settlement);
   }else result=await life.run(inner=>dispatchPreparedBrowserOperation({binding,run:prepared,sessions,operation:name,request:q,signal:inner}));
   life.check();assertBrowserOperationResponse({binding,result},binding);return data({binding,result});
  }catch{throw fault(cleanup?'BROWSER_CLEANUP_UNKNOWN':'BROWSER_OPERATION_REFUSED');}
  finally{life?.close();}
 }});
}

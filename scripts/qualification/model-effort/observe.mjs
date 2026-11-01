/** Observe the actual pinned query; preserve its iterator/control methods. No replacement model loop. */
import {LIMITS,selectionFor,fail,sha,selectionEqual,PROMPT} from './plan.mjs';
export function assertLoaded(value,c){
 const s=selectionFor(c.id),b=value?.run?.binding;
 if(!b||Object.keys(c.binding).some(k=>b[k]!==c.binding[k])||value.request?.requestId!==c.requestId||value.request.prompt!==PROMPT||!selectionEqual(value.request.modelSelection,s)||value.request.skill!==null||value.request.window!==null||['procedure','siteWorkflow','work','uploads','documentRevision'].some(k=>value.request[k]!==undefined))fail('QUALIFICATION_LOAD');
 const m=value.model;if(m?.provider!==s.provider||m.model!==s.modelId||m.effort!==s.effort||m.region!=='us-east-1'||m.maxOutputTokens!==32000||m.usageBasis?.provider!=='bedrock'||!Number.isInteger(m.maxTurns)||m.maxTurns<1||m.maxTurns>LIMITS.sdkTurnsPerCase||!Number.isInteger(m.maxCostMicroUSD)||m.maxCostMicroUSD<1||m.maxCostMicroUSD>LIMITS.estimateMicroUsdPerCase)fail('QUALIFICATION_CAPS');
 return {requestId:c.requestId,binding:b,modelSelection:value.request.modelSelection,model:m};
}
export function observeQuery({query,caseId,emit,abort}){
 const expected=selectionFor(caseId);let calls=0,terminal=null,init=null,toolAttempts=0;const efforts=[];
 const observed=input=>{
  if(++calls!==1)fail('QUALIFICATION_SECOND_QUERY');const o=input.options;
  if(o?.env?.MERI_MODEL_QUALIFICATION_MANIFEST!==undefined)fail('QUALIFICATION_MANIFEST_CHILD_LEAK');
  if(o?.model!==expected.modelId||(expected.effort===null?Object.hasOwn(o,'effort'):o.effort!==expected.effort)||o.env?.CLAUDE_CODE_USE_BEDROCK!=='1'||o.env.AWS_REGION!=='us-east-1'||o.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS!=='32000'||o.env.ANTHROPIC_API_KEY!==undefined||!Number.isInteger(o.maxTurns)||o.maxTurns<1||o.maxTurns>LIMITS.sdkTurnsPerCase||typeof o.maxBudgetUsd!=='number'||o.maxBudgetUsd<=0||o.maxBudgetUsd>LIMITS.estimateMicroUsdPerCase/1e6||o.systemPrompt?.preset!=='claude_code'||o.tools?.preset!=='claude_code')fail('QUALIFICATION_OPTIONS');
  // The sole qualification restriction: deny every tool at the SDK's existing hook boundary.
  const deny=async()=>{toolAttempts++;emit({event:'tool-attempt-denied'});abort();return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Qualification forbids all tools and delegation.'}};};
  // SDK 0.3.295 BaseHookInput exposes the active post-downgrade level on Stop. This is SDK evidence, not provider acknowledgement.
  const stopped=async input=>{const level=input?.effort?.level;const observation={level:typeof level==='string'&&/^[a-z]{1,16}$/.test(level)?level:null,sessionId:typeof input?.session_id==='string'?input.session_id:null};if(efforts.length>=4){abort();return {};}
   efforts.push(observation);emit({event:'sdk-stop-effort',...observation,providerAcknowledgement:'UNKNOWN'});if(expected.effort!==null&&observation.level!==null&&observation.level!==expected.effort)abort();return {};};
  const options={...o,hooks:{...o.hooks,PreToolUse:[{matcher:'.*',hooks:[deny]},...(o.hooks?.PreToolUse??[])],Stop:[...(o.hooks?.Stop??[]),{hooks:[stopped]}]}};
  emit({event:'sdk-options',model:o.model,effortPresent:Object.hasOwn(o,'effort'),effort:o.effort??null,maxTurns:o.maxTurns,maxBudgetUsd:o.maxBudgetUsd,maxOutputTokens:32000,provider:'bedrock',region:o.env.AWS_REGION,toolGuard:'PreToolUse deny all',systemPromptSha256:sha(JSON.stringify(o.systemPrompt))});
  const stream=query({...input,options});
  const inspect=r=>{const v=r?.value;if(!v||r.done)return r;
   if(v.type==='system'&&v.subtype==='init'){init={model:typeof v.model==='string'?v.model:null,sessionId:typeof v.session_id==='string'?v.session_id:null};emit({event:'sdk-init',...init,effortAcknowledgement:'UNKNOWN'});}
   if(v.type==='result'){
    if(terminal)fail('QUALIFICATION_MULTIPLE_RESULTS');
    const models=v.modelUsage&&typeof v.modelUsage==='object'?Object.entries(v.modelUsage):[];
    if(models.length>32)fail('QUALIFICATION_USAGE_LIMIT');
    const modelUsage=Object.fromEntries(models.map(([name,m])=>{if(name.length>200)fail('QUALIFICATION_MODEL_ID');return [name,Object.fromEntries(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests','costUSD','provider','costBasis'].filter(k=>m?.[k]!==undefined).map(k=>[k,m[k]]))];}));
    terminal={subtype:v.subtype,isError:v.is_error===true,numTurns:v.num_turns,estimateUsd:v.total_cost_usd,sessionId:v.session_id,modelUsage,answerMatches:v.result?.trim()==='model qualification complete.'};
    emit({event:'sdk-result',...terminal,providerEffortAcknowledgement:'UNKNOWN'});
    if(!Number.isInteger(v.num_turns)||v.num_turns<1||v.num_turns>LIMITS.sdkTurnsPerCase||typeof v.total_cost_usd!=='number'||!Number.isFinite(v.total_cost_usd)||v.total_cost_usd<0||v.total_cost_usd>LIMITS.estimateMicroUsdPerCase/1e6)abort();
   }
   return r;
  };
  let proxy;proxy=new Proxy(stream,{get(target,key){if(key===Symbol.asyncIterator)return ()=>proxy;if(key==='next')return async(...args)=>inspect(await target.next(...args));const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});return proxy;
 };
 return {query:observed,summary(){return {queryCalls:calls,init,terminal,toolAttempts,sdkEffortObservations:efforts,providerEffortAcknowledgement:'UNKNOWN'};}};
}

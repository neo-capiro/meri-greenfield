/** Offline reconciliation of retained receipts. Never writes catalog/settings or grants activation. */
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {readFileSync,writeFileSync} from 'node:fs';
import {PAIRS,LIMITS,sha,selectionEqual,validatePlan} from './plan.mjs';
const modelNames=model=>[model,model.replace(/^us\./,''),model.replace(/^us\.anthropic\./,'')];
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-12;
export function assessCase(pair,c,product,runtime,allocationSha256,plan){
 const events=runtime.filter(e=>e.eventNamespace==='meri-model-qualification/1'&&e.caseId===pair.id&&e.allocationSha256===allocationSha256);
 const end=events.filter(e=>e.event==='settled'),options=events.filter(e=>e.event==='sdk-options'),loaded=events.filter(e=>e.event==='loaded-request'),starts=events.filter(e=>e.event==='attempt-started');
 const complete=product.filter(e=>e.event==='case-product-complete'&&e.caseId===pair.id),usage=product.filter(e=>e.event==='http-receipt'&&e.caseId===pair.id&&e.path==='/api/conversations/usage');
 const out={caseId:pair.id,selection:pair.selection,status:'UNKNOWN',providerEffortAcknowledgement:'UNKNOWN',reason:'missing or duplicate retained receipts'};
 if([end,options,starts,complete,usage].some(a=>a.length!==1)||loaded.length<1)return out;
 if(events.some(e=>e.event==='unknown-or-failed')||events.filter(e=>e.event==='sdk-result').length!==1)return {...out,reason:'unknown execution or duplicate/missing SDK result'};
 if(starts[0].requestId!==c.requestId||starts[0].declaredSource!==plan.sourceCommit||starts[0].declaredImage!==plan.imageDigest||starts[0].methodSha256!==plan.methodSha256||starts[0].releaseBindingSha256!==plan.releaseBindingSha256)return {...out,status:'FAIL',reason:'declared source/image/method/Release binding mismatch'};
 const o=options[0],settled=end[0],s=settled.observation,t=s?.terminal,p=usage[0].response;
 const bindingMatches=b=>b&&Object.keys(c.binding).every(k=>b[k]===c.binding[k]);
 if(!bindingMatches(starts[0].binding)||!bindingMatches(settled.receipt?.execution?.binding)||settled.receipt?.settled!==true||settled.receipt.state!=='completed'||loaded.some(v=>v.requestId!==c.requestId||!bindingMatches(v.binding)||!selectionEqual(v.modelSelection,pair.selection)))return {...out,status:'FAIL',reason:'request/binding/settlement mismatch'};
 if(o.model!==pair.selection.modelId||o.effortPresent!==(pair.selection.effort!==null)||o.effort!==pair.selection.effort||o.provider!=='bedrock'||o.region!=='us-east-1'||!Number.isInteger(o.maxTurns)||o.maxTurns<1||o.maxTurns>2||!Number.isFinite(o.maxBudgetUsd)||o.maxBudgetUsd<=0||o.maxBudgetUsd>.25||o.maxOutputTokens!==32000||o.toolGuard!=='PreToolUse deny all'||s?.queryCalls!==1||s?.toolAttempts!==0||t?.isError||t?.subtype!=='success'||t?.answerMatches!==true)return {...out,status:'FAIL',reason:'SDK option/result/tool mismatch'};
 if(!Number.isInteger(t.numTurns)||t.numTurns<1||t.numTurns>2||!Number.isFinite(t.estimateUsd)||t.estimateUsd<0||t.estimateUsd>.25)return {...out,status:'FAIL',reason:'SDK budget exceeded or missing'};
 const names=modelNames(pair.selection.modelId),entries=Object.entries(t.modelUsage??{});
 if(!s.init?.sessionId||s.init.sessionId!==t.sessionId||!names.includes(s.init.model)||entries.length!==1||entries.some(([name,m])=>!names.includes(name)||m.provider!=='bedrock'))return {...out,reason:'native session/profile/provider mapping not established'};
 const efforts=s.sdkEffortObservations??[];
 if(pair.selection.effort!==null){if(!efforts.length||efforts.some(e=>e.level===null))return {...out,reason:'SDK effective effort not observed'};
  if(efforts.some(e=>e.level!==pair.selection.effort||e.sessionId!==t.sessionId))return {...out,status:'FAIL',reason:'SDK effective effort downgraded or wrong session'};}
 if(p?.conversationId!==c.binding.conversationId||p.runId!==c.binding.runId||p.recording!=='recorded'||p.usage?.status!=='recorded'||p.usage.providerBilledUsd!==null||!near(p.usage.runDelta?.sdkEstimateUsd,t.estimateUsd)||!near(p.usage.cumulative?.sdkEstimateUsd,t.estimateUsd)||p.toolAudit?.tools?.length!==0||p.toolAudit.omitted!==0)return {...out,status:'FAIL',reason:'persisted accounting mismatch'};
 const writes=events.filter(e=>e.event==='usage-write'&&e.httpStatus===200),[model,m]=entries[0],saved=p.usage.cumulative.models,delta=p.usage.runDelta.modelCounters;
 if(!writes.length)return {...out,reason:'native usage write acknowledgement missing'};
 const counters=['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests'];
 if(writes.some(w=>w.usage?.sessionId!==t.sessionId||!near(w.usage?.sdkEstimateUsd,t.estimateUsd)||w.usage?.basis?.provider!=='bedrock'||w.toolsUsed?.tools?.length!==0||w.toolsUsed?.omitted!==0)||saved?.length!==1||delta?.length!==1||saved[0].model!==model||delta[0].model!==model||saved[0].provider!=='bedrock'||p.usage.cumulative.basis?.provider!=='bedrock'||!near(saved[0].sdkEstimateUsd,m.costUSD)||counters.some(k=>!Number.isSafeInteger(m[k])||m[k]<0||saved[0][k]!==m[k]||delta[0][k]!==m[k]))return {...out,status:'FAIL',reason:'SDK/native/persisted model counters mismatch'};
 return {...out,status:'RUNTIME_CASE_PASS',reason:'product/native SDK/accounting witnesses agree; independent Release review still required',sdkTurns:t.numTurns,estimateUsd:t.estimateUsd,sdkEffectiveEffort:efforts.map(e=>e.level),providerEffortAcknowledgement:'UNKNOWN'};
}
export function review(plan,product,runtime){validatePlan(plan,plan.notBeforeMs);const hash=sha(JSON.stringify(plan)),cases=PAIRS.map((pair,i)=>assessCase(pair,plan.cases[i],product,runtime,hash,plan));
 const results=runtime.filter(e=>e.eventNamespace==='meri-model-qualification/1'&&e.allocationSha256===hash&&e.event==='sdk-result');
 const allKnown=results.length===5&&PAIRS.every(p=>results.filter(e=>e.caseId===p.id).length===1)&&results.every(e=>Number.isInteger(e.numTurns)&&e.numTurns>=1&&Number.isFinite(e.estimateUsd)&&e.estimateUsd>=0);
 const turns=results.reduce((n,e)=>n+(Number.isInteger(e.numTurns)&&e.numTurns>=1?e.numTurns:0),0),estimate=results.reduce((n,e)=>n+(Number.isFinite(e.estimateUsd)&&e.estimateUsd>=0?e.estimateUsd:0),0);
 return {schema:'meri.model-qualification-review/1',allocationSha256:hash,cases,observedSdkTurns:turns,observedEstimateUsd:estimate,aggregateComplete:allKnown,aggregateWithinBounds:allKnown?turns<=LIMITS.aggregateSdkTurns&&estimate<=LIMITS.aggregateEstimateMicroUsd/1e6:null,activationAuthorized:false};}
export function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){process.stdout.write('Offline: node review.mjs allocation.json driver.jsonl combined-runtime.jsonl new-review.json\n');return 0;}
 if(args.length!==4)return 2;
 try{const jsonl=p=>readFileSync(p,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)),plan=JSON.parse(readFileSync(args[0],'utf8')),out=review(plan,jsonl(args[1]),jsonl(args[2]));writeFileSync(args[3],JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});return 0;}catch{return 2;}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))process.exitCode=main();

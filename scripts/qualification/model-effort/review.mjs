/** Offline reconciliation of retained receipts. Never writes catalog/settings or grants activation. */
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {readFileSync,writeFileSync} from 'node:fs';
import {PAIRS,LIMITS,sha,selectionEqual,validatePlan,requestFor,buildBinding,commitment} from './plan.mjs';
import {readNativeReceipt} from './native-receipt.mjs';
const modelNames=model=>[model,model.replace(/^us\./,''),model.replace(/^us\.anthropic\./,'')];
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-12;
export function assessCase(pair,c,product,runtime,allocationSha256,plan){
 const events=runtime.filter(e=>e.eventNamespace==='meri-model-qualification/1'&&e.caseId===pair.id&&e.allocationSha256===allocationSha256);
 const end=events.filter(e=>e.event==='settled'),options=events.filter(e=>e.event==='sdk-options'),loaded=events.filter(e=>e.event==='loaded-request'),starts=events.filter(e=>e.event==='attempt-started');
 const usage=product.filter(e=>e.event==='http-receipt'&&e.caseId===pair.id&&e.path==='/api/conversations/usage');
 const out={caseId:pair.id,selection:pair.selection,status:'UNKNOWN',providerEffortAcknowledgement:'UNKNOWN',reason:'missing or duplicate retained receipts'};
 if([end,options,starts,usage].some(a=>a.length!==1)||loaded.length<1)return out;
 if(events.some(e=>e.event==='unknown-or-failed')||events.filter(e=>e.event==='sdk-result').length!==1)return {...out,reason:'unknown execution or duplicate/missing SDK result'};
 if(starts[0].requestId!==c.requestId||starts[0].buildBindingSha256!==commitment(buildBinding(plan))||starts[0].methodSha256!==plan.methodSha256||starts[0].invocationImageDigest!==plan.candidateImageDigest||starts[0].releaseBindingSha256!==plan.releaseBindingSha256||loaded.some(e=>e.imageDigest!==plan.candidateImageDigest))return {...out,status:'FAIL',reason:'base/operator/candidate image/method/Release binding mismatch'};
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
/** Closed ordered journal; selected complete-looking rows never override a stop or lost suffix. */
export function driverJournal(plan,product,runtime,readReceipt=readNativeReceipt){
 const hash=plan.allocationSha256;let at=0,historyReads=0,estimate=0,sdkTurns=0;
 const take=event=>{const row=product[at++];if(row?.event!==event)throw Error('missing, duplicate, stopped or out-of-order '+event);return row;};
 try{
  const start=take('allocation-started');if(start.allocationSha256!==hash||start.privateEnvelopeSha256!==commitment(plan)||sha(JSON.stringify(start.limits))!==sha(JSON.stringify(LIMITS)))throw Error('allocation start mismatch');
  for(const [i,c]of plan.cases.entries()){
   const caseStartedAtMs=product[at]?.atMs;let submitAtMs;
   const exchange=(path,body)=>{const intent=take('http-intent'),receipt=take('http-receipt');if(intent.caseId!==c.id||receipt.caseId!==c.id||intent.path!==path||receipt.path!==path||intent.requestSha256!==sha(JSON.stringify(body))||receipt.status!==200||!receipt.response||receipt.response.error)throw Error('original request/receipt sequence mismatch');return receipt.response;};
   exchange('/api/settings/user/read',{});exchange('/api/settings/tenant/read',{});
   const bindingMatches=b=>b&&commitment(b)===commitment(c.binding),allocated=exchange('/api/conversations/input/allocate',requestFor(c)),admitted=exchange('/api/conversations/input/admit',requestFor(c));
   if(allocated.created!==true||allocated.state!=='RESERVED'||allocated.allocation?.requestId!==c.requestId||!bindingMatches(allocated.allocation?.binding)||admitted.replayed!==false||!bindingMatches(admitted.run?.binding)||admitted.request?.requestId!==c.requestId||admitted.request?.prompt!==requestFor(c).prompt||!selectionEqual(admitted.request?.modelSelection,PAIRS[i].selection))throw Error('original allocation/admission mismatch');
   submitAtMs=product[at]?.atMs;const submitted=exchange('/api/conversations/submit',requestFor(c));if(submitted.requestId!==c.requestId||!bindingMatches(submitted.run?.binding))throw Error('original submit mismatch');
   let reads=0,history;while(product[at]?.event==='http-intent'&&product[at]?.path==='/api/conversations/history'){
    if(++reads>LIMITS.historyReads||history?.run?.state==='completed')throw Error('extra history after terminal or over limit');history=exchange('/api/conversations/history',{after:0,limit:100});
    if(!bindingMatches(history.run?.binding)||history.request?.requestId!==c.requestId||history.request?.prompt!==requestFor(c).prompt||!selectionEqual(history.request?.modelSelection,PAIRS[i].selection)||['failed','cancelled','held'].includes(history.run?.state))throw Error('history mismatch');
   }
   if(!reads||history?.run?.state!=='completed')throw Error('missing completed history');historyReads+=reads;
   exchange('/api/conversations/usage',{schemaVersion:'meri.conversation-usage/1',conversationId:c.binding.conversationId,runId:c.binding.runId});
   const verified=take('native-case-verified'),events=runtime.filter(e=>e.eventNamespace==='meri-model-qualification/1'&&e.caseId===c.id&&e.allocationSha256===hash);
   if(!Number.isSafeInteger(caseStartedAtMs)||!Number.isSafeInteger(submitAtMs))throw Error('missing original intent time');
   const collection=readReceipt(c.nativeReceiptFile,{plan,c,submitAtMs,deadline:Math.min(plan.expiresAtMs-LIMITS.cleanupMs,caseStartedAtMs+LIMITS.caseMs)});
   if(!collection||collection.collectionComplete!==true||verified.collectionReceiptSha256!==collection.receiptSha256||JSON.stringify(collection.events)!==JSON.stringify(events))throw Error('missing, incomplete or changed collection custody');
   if(verified.caseId!==c.id||verified.allocationSha256!==hash||verified.runtimeReceiptSha256!==sha(JSON.stringify(events))||!Number.isInteger(verified.sdkTurns)||verified.sdkTurns<1||verified.sdkTurns>LIMITS.sdkTurnsPerCase||!Number.isFinite(verified.estimateUsd)||verified.estimateUsd<0||verified.estimateUsd>.25)throw Error('native barrier receipt mismatch');
   const terminals=events.filter(e=>e.event==='settled');if(terminals.length!==1||terminals[0].observation?.terminal?.numTurns!==verified.sdkTurns||!near(terminals[0].observation?.terminal?.estimateUsd,verified.estimateUsd))throw Error('native barrier totals mismatch');
   sdkTurns+=verified.sdkTurns;estimate+=verified.estimateUsd;
   const complete=take('case-product-complete');if(complete.caseId!==c.id||!selectionEqual(complete.selection,PAIRS[i].selection)||!near(complete.estimateUsd,verified.estimateUsd)||!near(complete.aggregateEstimateUsd,estimate)||complete.qualification!=='PENDING_RUNTIME_RECEIPT_REVIEW')throw Error('case completion mismatch');
  }
  const end=take('product-batch-complete');if(at!==product.length||end.cases!==5||end.historyReads!==historyReads||end.sdkTurns!==sdkTurns||!near(end.estimateUsd,estimate)||end.qualification!=='PENDING_RUNTIME_RECEIPT_REVIEW')throw Error('missing, stopped, duplicate or contradictory batch disposition');
  return {valid:true,reason:null};
 }catch(error){return {valid:false,reason:error.message};}
}
export function review(plan,product,runtime,{readReceipt=readNativeReceipt}={}){validatePlan(plan,plan.notBeforeMs);const hash=plan.allocationSha256,journal=driverJournal(plan,product,runtime,readReceipt),cases=PAIRS.map((pair,i)=>journal.valid?assessCase(pair,plan.cases[i],product,runtime,hash,plan):({caseId:pair.id,selection:pair.selection,status:'UNKNOWN',providerEffortAcknowledgement:'UNKNOWN',reason:'driver journal: '+journal.reason}));
 const results=runtime.filter(e=>e.eventNamespace==='meri-model-qualification/1'&&e.allocationSha256===hash&&e.event==='sdk-result');
 const allKnown=results.length===5&&PAIRS.every(p=>results.filter(e=>e.caseId===p.id).length===1)&&results.every(e=>Number.isInteger(e.numTurns)&&e.numTurns>=1&&Number.isFinite(e.estimateUsd)&&e.estimateUsd>=0);
 const turns=results.reduce((n,e)=>n+(Number.isInteger(e.numTurns)&&e.numTurns>=1?e.numTurns:0),0),estimate=results.reduce((n,e)=>n+(Number.isFinite(e.estimateUsd)&&e.estimateUsd>=0?e.estimateUsd:0),0);
 return {schema:'meri.model-qualification-review/1',allocationSha256:hash,driverJournal:journal,cases,observedSdkTurns:turns,observedEstimateUsd:estimate,aggregateComplete:allKnown,aggregateWithinBounds:allKnown?turns<=LIMITS.aggregateSdkTurns&&estimate<=LIMITS.aggregateEstimateMicroUsd/1e6:null,activationAuthorized:false};}
export function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){process.stdout.write('Offline: node review.mjs allocation.json driver.jsonl combined-runtime.jsonl new-review.json\n');return 0;}
 if(args.length!==4)return 2;
 try{const jsonl=p=>readFileSync(p,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)),plan=JSON.parse(readFileSync(args[0],'utf8')),out=review(plan,jsonl(args[1]),jsonl(args[2]));writeFileSync(args[3],JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});return 0;}catch{return 2;}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))process.exitCode=main();

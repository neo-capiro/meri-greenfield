import {verifyCorpus} from './corpus.mjs';
import {snapshot,hash,publicShape,action,semanticResult,exact,text,digest,instant,enumeration,array,unique,same,freeze,qualification,error} from './contracts.mjs';
const operation={id:'actions.query',version:'0.2.0'};
const stable=b=>({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId});
const statuses=['passed','failed','missing','skipped','ineligible'];
function summary(rows){const counts={total:rows.length,...Object.fromEntries(statuses.map(s=>[s,rows.filter(r=>r.status===s).length]))};return {...counts,allCasePassRate:counts.total?counts.passed/counts.total:null,executedPassRate:counts.passed+counts.failed?counts.passed/(counts.passed+counts.failed):null};}
function delivery(value,binding,scopes){
 exact(value,['lookupId','resultReference','resultSha256','classification','acceptedTasks','events']);digest(value.resultSha256);
 if(value.classification!=='recommendations'||value.acceptedTasks!==false)error('EVAL_NOT_RECOMMENDATIONS');
 array(value.events,2);if(value.events.length!==2)error('EVAL_EVENTS');const [started,completed]=value.events;
 for(const event of value.events){publicShape('UIEvent',event);if(!same(event.binding,binding)||!same(event.scopes,scopes))error('EVAL_EVENT_SCOPE');instant(event.createdAt);}
 if(started.type!=='tool.started'||completed.type!=='tool.completed'||started.data.tool!=='actions.query@0.2.0'||started.data.requestId!==completed.data.requestId||completed.data.resultReference!==value.resultReference||started.eventId===completed.eventId||completed.sequence<=started.sequence)error('EVAL_EVENT_CORRELATION');
 // UUID shape belongs to the existing public protocol, not a new ID vocabulary.
 publicShape('UIEvent',{...completed,data:{requestId:value.lookupId,resultReference:value.resultReference}});
}
function authorization(rows,{binding,scopes,reference,resultSha256,started,completed},returned){
 array(rows,2);if(returned&&(rows.length!==2||rows[0].phase!=='before_read'||rows[1].phase!=='before_release'))error('EVAL_AUTHORITY_TRACE');
 for(const [index,row] of rows.entries()){
  exact(row,['phase','binding','receipt','observedAtMs']);enumeration(row.phase,['before_read','before_release']);if(index===1&&row.phase!=='before_release')error('EVAL_AUTHORITY_TRACE');
  const b=row.binding;exact(b,['original','current','scopes','resultReference','resultSha256','bindingSha256']);digest(b.bindingSha256);const {bindingSha256,...intent}=b;
  if(hash(intent)!==bindingSha256)error('EVAL_AUTHORITY_HASH');publicShape('RunBinding',b.current);if(!same(stable(b.current),stable(binding))||!same(b.scopes,scopes))error('EVAL_AUTHORITY_SCOPE');
  if(reference!==null&&b.resultReference!==reference)error('EVAL_AUTHORITY_REFERENCE');
  if(row.phase==='before_read'){if(b.original!==null||b.resultSha256!==null)error('EVAL_READ_INTENT');}
  else if(!same(b.original,binding)||b.resultSha256!==resultSha256)error('EVAL_RELEASE_INTENT');
  exact(row.receipt,['authorized','bindingSha256','expiresAtMs']);if(typeof row.receipt.authorized!=='boolean'||row.receipt.bindingSha256!==bindingSha256)error('EVAL_AUTHORITY_RECEIPT');
  if(!Number.isSafeInteger(row.observedAtMs)||row.observedAtMs<started||row.observedAtMs>completed||!Number.isSafeInteger(row.receipt.expiresAtMs))error('EVAL_AUTHORITY_TIME');
  if(row.receipt.authorized&&(row.receipt.expiresAtMs<=row.observedAtMs))error('EVAL_AUTHORITY_EXPIRED');
  if(returned&&!row.receipt.authorized)error('EVAL_AUTHORITY_DENIED');
 }
}
function checkObservation(c,pin,o,run,binding,frozen){
 exact(o,['caseId','caseSha256','attemptId','runId','configSha256','sourceSetSha256','status','reason','route','authorization','delivery','read','claims','traceSha256','startedAt','completedAt']);
 text(o.attemptId);digest(o.traceSha256);enumeration(o.status,['returned','denied','clarify','failed','skipped','ineligible']);
 const started=instant(o.startedAt),completed=instant(o.completedAt);if(completed<started||started<instant(run.startedAt)||completed>instant(run.completedAt))error('EVAL_CAPTURE_TIME');
 if(o.caseSha256!==pin.caseSha256||o.runId!==run.runId||o.configSha256!==frozen.configSha256||o.sourceSetSha256!==pin.sourceSetSha256)error('EVAL_OBSERVATION_IDENTITY');
 exact(o.claims,['absence','exhaustive','acceptedTasks']);for(const v of Object.values(o.claims))if(typeof v!=='boolean')error('EVAL_CLAIMS');
 if(o.claims.absence||o.claims.exhaustive||o.claims.acceptedTasks)error('EVAL_UNSUPPORTED_CLAIM');
 if(o.reason!==null)text(o.reason,500);if(o.status!=='returned'&&o.reason===null)error('EVAL_MISSING_REASON');
 const context={...c.context,binding},normalized=action.normalizeInput(c.request,context);
 if(o.route!==null){exact(o.route,['operation','request']);if(!same(o.route.operation,operation)||!same(o.route.request,c.request))error('EVAL_ROUTE');}
 if(o.status==='returned'){
  if(o.route===null||o.reason!==null)error('EVAL_RETURN_ROUTE');delivery(o.delivery,binding,c.scopes);
  exact(o.read,['lookupId','resultReference','resultSha256','classification','acceptedTasks','events','observation']);const {observation,...readDelivery}=o.read;if(!same(o.delivery,readDelivery))error('EVAL_READ_REFERENCE');
  exact(observation,['binding','subject','operation','argumentsSha256','result']);if(!same(observation.binding,binding)||!same(observation.operation,operation)||observation.argumentsSha256!==normalized.argumentsSha256)error('EVAL_RESULT_LINEAGE');
  action.assertOutput(observation.result,{request:c.request,...context});if(!same(observation.subject,observation.result.subject)||!same(observation.subject.scopes,c.scopes))error('EVAL_RESULT_SUBJECT');
  if(hash(observation)!==o.delivery.resultSha256)error('EVAL_RESULT_HASH');
  if(!same(observation.result.sources.map(s=>s.sourceId).sort(),[...c.sourceIds].sort()))error('EVAL_RESULT_SOURCES');
  if(hash(semanticResult(observation))!==c.expected.semanticSha256||!same(observation.result.actions.map(a=>a.id),c.expected.recordIds))error('EVAL_SEMANTIC_GOLD');
  if(c.expected.replaySha256!==null&&hash(observation)!==c.expected.replaySha256)error('EVAL_REPLAY_GOLD');
  authorization(o.authorization,{binding,scopes:c.scopes,reference:o.delivery.resultReference,resultSha256:o.delivery.resultSha256,started,completed},true);
 }else{
  if(o.delivery!==null||o.read!==null)error('EVAL_NONRETURN_DISCLOSURE');
  authorization(o.authorization,{binding,scopes:c.scopes,reference:null,resultSha256:null,started,completed},false);
 }
 if(['skipped','ineligible'].includes(o.status))return o.status;
 if(o.status!==c.expected.outcome)error('EVAL_OUTCOME');
 return 'passed';
}
export function scoreObservations(value,observed){
 const frozen=verifyCorpus(value),capture=snapshot(observed);exact(capture,['run','observations']);const {run,observations}=capture;
 exact(run,['runId','corpusSha256','configSha256','sourceSetSha256','startedAt','completedAt','bindings']);text(run.runId);array(observations,4000);array(run.bindings);unique(run.bindings.map(b=>b.caseId));
 if(instant(run.completedAt)<instant(run.startedAt))error('EVAL_RUN_TIME');
 if(!same(run.bindings.map(b=>b.caseId).sort(),frozen.input.cases.map(c=>c.caseId).sort()))error('EVAL_RUN_BINDINGS');
 for(const row of run.bindings){exact(row,['caseId','binding']);publicShape('RunBinding',row.binding);const c=frozen.input.cases.find(c=>c.caseId===row.caseId);if(!same(stable(row.binding),stable(c.context.binding)))error('EVAL_RUN_SCOPE');}
 const diagnostics=[],rows=[];const grouped=new Map();
 for(const o of observations){if(!o||typeof o!=='object'||!frozen.input.cases.some(c=>c.caseId===o.caseId)){diagnostics.push({code:'FOREIGN_OR_UNIDENTIFIED_OBSERVATION'});continue;}const group=grouped.get(o.caseId)??[];group.push(o);grouped.set(o.caseId,group);}
 const runMatches=run.corpusSha256===frozen.corpusSha256&&run.configSha256===frozen.configSha256&&run.sourceSetSha256===frozen.sourceSetSha256;
 for(const c of frozen.input.cases){const entries=grouped.get(c.caseId)??[];let status='missing',reasons=['MISSING_OBSERVATION'];let observationSha256=null;
  if(!runMatches){status='failed';reasons=['RUN_IDENTITY_MISMATCH'];}
  else if(entries.length>1){status='failed';reasons=['DUPLICATE_OBSERVATION'];diagnostics.push({code:'DUPLICATE_OBSERVATION',caseId:c.caseId,count:entries.length});}
  else if(entries.length===1){observationSha256=hash(entries[0]);try{status=checkObservation(c,frozen.casePins.find(p=>p.caseId===c.caseId),entries[0],run,run.bindings.find(b=>b.caseId===c.caseId).binding,frozen);reasons=status==='passed'?[]:[status.toUpperCase()];}catch(e){status='failed';reasons=[typeof e.code==='string'&&e.code.startsWith('EVAL_')?e.code:'INVALID_CANONICAL_OBSERVATION'];}}
  rows.push({caseId:c.caseId,status,reasons,observationSha256});
 }
 const all=summary(rows),countKeys=['total',...statuses];return freeze({schema:'meri-task-lookup-score/1',corpusSha256:frozen.corpusSha256,runId:run.runId,rows,counts:Object.fromEntries(countKeys.map(k=>[k,all[k]])),allCasePassRate:all.allCasePassRate,executedPassRate:all.executedPassRate,
  bySplit:Object.fromEntries(['development','calibration','held-out'].map(s=>[s,summary(rows.filter(r=>frozen.input.cases.find(c=>c.caseId===r.caseId).split===s))])),byKind:Object.fromEntries(['real','synthetic'].map(s=>[s,summary(rows.filter(r=>frozen.input.cases.find(c=>c.caseId===r.caseId).kind===s))])),diagnostics,observationSetValid:diagnostics.length===0&&runMatches,qualification:{...qualification(),qualifiedRealRequests:0}});
}

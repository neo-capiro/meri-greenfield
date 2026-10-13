/** Deterministic route baseline only; no model, network listener or approval issuer. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createLocalActionDemo} from '../../../apps/control/action-application/local/demo.mjs';
import {receiveActionResponse} from '../../../packages/contracts/dist/action-application.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const bytes=readFileSync(new URL('../../../docs/qualification/candidates/local-application-20261013/pilot/cases.json',import.meta.url));
const gold=JSON.parse(bytes),hash=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const MAX_BYTES=262144;
export async function runLocalPilotBaseline({mode,createDemo=createLocalActionDemo}={}){
 if(mode!=='synthetic-local'||typeof createDemo!=='function')throw Error('BASELINE_CONFIGURATION');
 if(gold.cases.map(c=>c.id).join(',')!=='P01,P02,P03,P04,P05,P06')throw Error('BASELINE_GOLD');
 const results=[],sessions=new Set();
 for(const c of gold.cases){
  const row={id:c.id,promptSha256:hash(c.prompt),goldSha256:canonicalSha256(c),status:'FAIL',checks:[],steps:[],observed:{},effects:null,cleanup:{closed:false,postCloseStatus:null,noAdditionalEffects:false}};
  const l=createOperationLifetime({deadlineMs:Date.now()+6000,now:Date.now,errorFactory:()=>Error('BASELINE_DEADLINE')});let demo,stage='construction';
  const check=(name,condition)=>{row.checks.push({name,passed:!!condition});if(!condition)throw Error('BASELINE_CHECK');};
  try{
   demo=await l.run(()=>Promise.resolve().then(()=>createDemo({mode,ttlMs:10000})).then(value=>{if(l.signal.aborted){value.close();throw Error('BASELINE_LATE_ACQUIRE');}return value;}));
   check('fresh instance and opaque session',!sessions.has(demo)&&!sessions.has(demo.credential));sessions.add(demo);sessions.add(demo.credential);
   const before=demo.stats();check('fresh empty stores and effects',before.sourceReads===0&&before.taskEffects===0&&before.metadataRows===0&&before.lookupRows===0&&before.commandRows===0&&before.approvals===0&&!before.closed);
   const call=async(route,body)=>{
    stage=route;const response=await l.run(signal=>demo.app.handle(new Request(`http://local.invalid/api/action-followthrough/${route}`,{method:'POST',headers:{authorization:`Bearer ${demo.credential}`,'content-type':'application/json'},body:JSON.stringify(body),signal})));
    const raw=await l.run(()=>response.text());check(route+' bounded response',Buffer.byteLength(raw)<=MAX_BYTES);
    const value=await l.run(()=>receiveActionResponse(route,response.status,raw));row.steps.push({route,httpStatus:response.status,requestSha256:canonicalSha256(body),responseSha256:canonicalSha256(value)});return {status:response.status,value};
   };
   let q,d,p;
   if(c.id==='P06')demo.revoke();
   const queried=await call('query',{request:{limit:20}});
   if(c.id==='P06'){
    check('revoked exact refusal',queried.status===401&&same(queried.value,{error:c.expected.error}));row.observed.error=queried.value.error;
   }else{
    check('query HTTP success',queried.status===200);q=queried.value;const page=q.observation.result,a=page.actions[0];
    check('exact recommendation facts',q.classification==='recommendations'&&q.acceptedTasks===false&&page.actions.length===1&&a.id===gold.cases[0].expected.actionId&&a.clientId===gold.cases[0].expected.clientId&&a.title==='Issue'&&a.whatChanged==='Changed'&&a.whyItMatters==='Matters'&&a.recommendedAction==='Recommend'&&a.acceptedAsTask===false);
    check('tool events only',same(q.events.map(e=>e.type),['tool.started','tool.completed'])&&q.events[0].data.tool==='actions.query@0.2.0');
    row.observed.query={tool:q.events[0].data.tool,classification:q.classification,acceptedTasks:q.acceptedTasks,actionId:a.id,clientId:a.clientId,title:a.title,whatChanged:a.whatChanged,whyItMatters:a.whyItMatters,recommendedAction:a.recommendedAction,resultReference:q.resultReference,resultSha256:q.resultSha256};
    if(c.id==='P02'){
     check('scope limits preserved',page.coverage.enumeration==='unknown'&&page.sources.every(s=>s.freshness==='unknown'&&s.asOf===null)&&page.negativeAssertion.kind==='none'&&page.evidenceReady===false&&page.pageCoverage.complete===true&&page.pageCoverage.absenceSupported===false);
     row.observed.coverage={enumeration:page.coverage.enumeration,freshness:page.sources.map(s=>s.freshness),asOf:page.sources.map(s=>s.asOf),negativeAssertion:page.negativeAssertion.kind,evidenceReady:page.evidenceReady,pageComplete:page.pageCoverage.complete,absenceSupported:page.pageCoverage.absenceSupported};
    }
    if(['P03','P04','P05'].includes(c.id)){
     const selection={resultReference:q.resultReference,resultSha256:q.resultSha256,actionId:a.id};const drafted=await call('draft',{selection,edits:gold.cases[2].api.body.edits});check('draft HTTP success',drafted.status===200);d=drafted.value;
     check('editable draft exact task and source',d.status==='draft'&&same(d.task,gold.cases[2].expected.task)&&d.source.resultReference===selection.resultReference&&d.source.resultSha256===selection.resultSha256&&d.source.actionId===selection.actionId&&same(d.source.originalBinding,q.observation.binding)&&d.source.actionSha256===canonicalSha256(a));
     row.observed.draft={status:d.status,task:d.task,draftSha256:d.draftSha256,actionSha256:d.source.actionSha256};
    }
    if(['P04','P05'].includes(c.id)){
     const prepared=await call('prepare',{draft:d});check('prepare HTTP success',prepared.status===200);p=prepared.value;
     check('exact pending task proposal',p.status==='approval_required'&&p.proposal.command.action==='task.create'&&same(p.proposal.command.arguments,d.task)&&p.proposal.command.attachments.length===0&&p.proposal.commandSha256===canonicalSha256(p.proposal.command)&&same(p.draft,d));
     row.observed.proposal={status:p.status,action:p.proposal.command.action,arguments:p.proposal.command.arguments,proposalId:p.proposal.proposalId,commandSha256:p.proposal.commandSha256,requiredApprover:p.proposal.requiredApprover};
    }
    if(c.id==='P05'){const refused=await call('execute',{proposal:p.proposal});check('unapproved exact refusal',refused.status===409&&same(refused.value,{error:c.expected.error}));row.observed.error=refused.value.error;}
   }
   stage='effects';row.effects=demo.stats();check('no approval or task effect',row.effects.approvals===0&&row.effects.taskEffects===0&&row.effects.commandRows===0);
   check('exact case source and metadata counts',row.effects.sourceReads===c.maxSyntheticEffects.sourceReads&&row.effects.metadataRows===c.maxSyntheticEffects.proposalMetadataRows);
   const routes={P01:['query'],P02:['query'],P03:['query','draft'],P04:['query','draft','prepare'],P05:['query','draft','prepare','execute'],P06:['query']}[c.id];check('only exact permitted routes',same(row.steps.map(s=>s.route),routes));row.status='PASS';
  }catch{row.status='FAIL';row.failure={code:'BASELINE_CASE_FAILED',stage};}
  finally{
   l.close();
   if(demo){try{
    const before=demo.stats();demo.close();const after=demo.stats();row.cleanup.closed=after.closed===true;
    const response=await demo.app.handle(new Request('http://local.invalid/api/action-followthrough/query',{method:'POST',headers:{authorization:`Bearer ${demo.credential}`,'content-type':'application/json'},body:'{"request":{"limit":20}}',signal:AbortSignal.timeout(1000)}));
    const raw=await response.text();if(Buffer.byteLength(raw)>MAX_BYTES)throw Error('BASELINE_CLEANUP');const error=await receiveActionResponse('query',response.status,raw);
    row.cleanup.postCloseStatus=response.status;row.cleanup.noAdditionalEffects=demo.stats().sourceReads===before.sourceReads&&demo.stats().taskEffects===before.taskEffects&&demo.stats().metadataRows===before.metadataRows;
    if(!row.cleanup.closed||response.status!==401||error.error?.code!=='UNAUTHENTICATED'||!row.cleanup.noAdditionalEffects)throw Error('BASELINE_CLEANUP');
   }catch{row.status='FAIL';row.failure={code:'BASELINE_CLEANUP_UNKNOWN',stage:'cleanup'};}}
   else row.cleanup.notAcquired=true;
  }
  results.push(row);
 }
 const result={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',mode,caseCount:6,passed:results.filter(r=>r.status==='PASS').length,cases:results,sourceReferenceBase:'658bb5c0f8c47b80904cbc5c7453b3f8c3dba79c',casesSha256:hash(bytes),qualifiedRealRequests:0,modelCalls:0,providerCalls:0,nativeDatabase:false,limitations:['Deterministic route and synthetic semantic baseline only; no language routing or model quality adjudication.','Fresh in-memory scripted stores per case; no native durability claim.','No approval issuance, accepted task or production activation.']};
 if(Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)throw Error('BASELINE_OUTPUT_LIMIT');return result;
}

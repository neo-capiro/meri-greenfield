import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {semanticResult} from '../contracts.mjs';
import {freezeCorpus,runnerCases,verifyCorpus} from '../corpus.mjs';
import {scoreObservations} from '../score.mjs';

// Independent synthetic cases. No customer data, approval or runtime proof exists.
const id=n=>`deafbeef-1111-4111-8111-${String(n).padStart(12,'0')}`;
const at='2026-10-12T00:00:00.000Z';
const digest=x=>hash({independentSynthetic:x});
const binding=()=>({tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
const scope=()=>({tenantId:'synthetic-tenant',kind:'client',resourceId:id(5),policyRevision:'synthetic-policy'});
const record=(caseId='case-a',groupId='group-a',split='development')=>({
 caseId,groupId,split,kind:'synthetic',originSha256:digest(caseId),mode:'original',prompt:'Synthetic request: show selected client recommendations.',
 request:{clientId:id(5)},context:{binding:binding(),clientResolution:{reference:id(5),clientId:id(5)}},scopes:[scope()],sourceIds:['action_recommendation'],
 expected:{outcome:'denied',semanticSha256:null,replaySha256:null,recordIds:[],absence:false,exhaustive:false}
});
function corpus(cases=[record()]) {
 const value={schema:'meri-task-lookup-input/1',cases,sources:[{sourceId:'action_recommendation',snapshotSha256:digest('snapshot'),asOf:at,receiptSha256:digest('source-receipt')}],
 config:{sourceCommit:'a'.repeat(40),catalogSha256:digest('catalog'),contractsSha256:digest('contracts'),imageDigest:null,sdkVersion:null,modelId:null,proxyConfigSha256:digest('proxy'),skillManifestSha256:digest('skills'),executionKind:'source-test'},
 approval:{receiptId:id(10),ownerRef:'synthetic-owner-no-authority',issuedAt:at,inputSha256:''}};
 value.approval.inputSha256=hash({cases:value.cases,sources:value.sources,config:value.config});
 return value;
}
const freeze=value=>freezeCorpus(value,{approvalSha256:hash(value.approval)});
const reseal=value=>{value.approval.inputSha256=hash({cases:value.cases,sources:value.sources,config:value.config});return value;};

test('independent approved-input shape freezes synthetic corpus without modifying input',()=>{const value=corpus(),before=structuredClone(value);const f=freeze(value);assert.deepEqual(value,before);assert.ok(Object.isFrozen(f));assert.notEqual(f,value);});
test('wrong externally pinned approval hash refuses',()=>assert.throws(()=>freezeCorpus(corpus(),{approvalSha256:digest('wrong')})));
test('case/source/config substitutions after approval refuse',()=>{for(const mutate of [v=>v.cases[0].prompt+=' altered',v=>v.sources[0].snapshotSha256=digest('other'),v=>v.config.catalogSha256=digest('other')]){const v=corpus();mutate(v);assert.throws(()=>freeze(v));}});
test('changing synthetic to real without changing approval refuses',()=>{const v=corpus();v.cases[0].kind='real';assert.throws(()=>freeze(v));});
test('duplicate case IDs refuse instead of reducing denominator',()=>assert.throws(()=>freeze(corpus([record(),record()]))));
test('one related group across two splits refuses',()=>assert.throws(()=>freeze(corpus([record('a','related','development'),record('b','related','held-out')]))));
test('related oracle variants may remain in same split without losing cases',()=>{const a=record('a','related'),b=record('b','related');b.mode='correct-tool';assert.equal(runnerCases(freeze(corpus([a,b])),{split:'development'}).cases.length,2);});
test('runner projection retains prompt/request but withholds expected gold',()=>{const f=freeze(corpus()),rows=runnerCases(f,{split:'development'}).cases;assert.equal(rows.length,1);assert.equal(rows[0].prompt,record().prompt);assert.deepEqual(rows[0].request,record().request);assert.ok(!('expected' in rows[0]));assert.ok(!('approval' in rows[0]));assert.ok(!JSON.stringify(rows).includes('resultSha256'));});
test('held-out projection is split-specific and omits gold',()=>{const f=freeze(corpus([record('a','a'),record('b','b','held-out')]));const rows=runnerCases(f,{split:'held-out'}).cases;assert.equal(rows.length,1);assert.equal(rows[0].caseId,'b');assert.ok(!('expected' in rows[0]));});
test('unknown split cannot silently select or omit cases',()=>assert.throws(()=>runnerCases(freeze(corpus()),{split:'training'})));
test('freeze detaches caller references',()=>{const v=corpus(),f=freeze(v);v.cases[0].request.clientId=id(99);v.cases[0].prompt='changed';const [row]=runnerCases(f,{split:'development'}).cases;assert.equal(row.request.clientId,id(5));assert.equal(row.prompt,record().prompt);});
test('freeze refuses unknown schema/input authority flags',()=>{for(const mutate of [v=>v.schema='forged',v=>v.authorized=true,v=>v.cases[0].authorized=true]){const v=corpus();mutate(v);assert.throws(()=>freeze(reseal(v)));}});
test('hostile accessors never execute during freeze',()=>{let effects=0;const v=corpus();Object.defineProperty(v.cases[0],'prompt',{get(){effects++;return 'surprise';},enumerable:true});assert.throws(()=>freezeCorpus(v,{approvalSha256:digest('untrusted')}));assert.equal(effects,0);});
test('non-JSON scalar and unsafe case counts cannot produce frozen evidence',()=>{for(const bad of [undefined,NaN,Infinity,1n,()=>1]){const v=corpus();v.cases[0].prompt=bad;assert.throws(()=>freezeCorpus(v,{approvalSha256:digest('untrusted')}));}});
test('case referencing absent source cannot be admitted as covered',()=>{const v=corpus();v.cases[0].sourceIds=['not-in-snapshot'];assert.throws(()=>freeze(reseal(v)));});
test('duplicate source snapshot IDs refuse instead of selecting arbitrary version',()=>{const v=corpus();v.sources.push({...v.sources[0],snapshotSha256:digest('second')});assert.throws(()=>freeze(reseal(v)));});

test('empty corpus remains unqualified with no fabricated real request count',()=>{const f=freeze(corpus([]));assert.deepEqual(f.counts,{cases:0,declaredRealCases:0,declaredRealSeeds:0,syntheticCases:0,qualifiedRealRequests:0});assert.equal(f.qualification.state,'UNQUALIFIED');assert.equal(f.qualification.runtimeQualified,false);});
test('even operator-pinned real label cannot manufacture qualified provenance',()=>{const c=record();c.kind='real';const f=freeze(corpus([c]));assert.equal(f.counts.declaredRealCases,1);assert.equal(f.counts.qualifiedRealRequests,0);assert.equal(f.qualification.state,'UNQUALIFIED');});
test('runner envelope pins source/config/case identities without approval body',()=>{const f=freeze(corpus()),r=runnerCases(f,{split:'development'});assert.equal(r.corpusSha256,f.corpusSha256);assert.equal(r.configSha256,f.configSha256);assert.equal(r.cases[0].caseSha256,f.casePins[0].caseSha256);assert.equal(r.cases[0].sourceSetSha256,f.casePins[0].sourceSetSha256);assert.ok(!('approval' in r));assert.ok(!('kind' in r.cases[0]));assert.ok(!('originSha256' in r.cases[0]));});

function makePage(nonempty=true){
 const row={id:id(100),districtKey:null,clientId:id(5),clientName:'Synthetic Client',peCode:null,programId:null,deltaId:null,actionType:'protect_funding',issueTitle:'Synthetic issue',whatChanged:'Synthetic change',whyItMatters:'Synthetic relevance',recommendedAction:'Synthetic recommendation',targetAudience:[],suggestedArtifactType:null,deadline:null,deadlineSource:null,ownerUserId:null,priority:1,confidence:{},uncertainty:null,evidence:[],status:'new',dismissalReason:null,outcome:null,createdAt:at,updatedAt:at,title:'Synthetic issue',body:'Synthetic recommendation'};
 const contentSha256=createHash('sha256').update(JSON.stringify(row)).digest('hex');
 Object.assign(row,{recordKind:'action_recommendation',recommendation:true,acceptedAsTask:false,nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'Recommendation only'},sourceProof:{version:1,owner:'action_recommendation',sourceRecordId:row.id,currentClientId:row.clientId,sourceVersion:at,contentSha256,linkedSources:[]}});
 const actions=nonempty?[row]:[];

 const selection={clientId:id(5),actionItemId:null,status:null,sort:'deadline',page:1,limit:20,cursorApplied:false};
 return {kind:'action-item-client-scoped-page',contractVersion:'0.2.0',operation:{id:'query_action_items',version:'0.2.0'},requestId:id(20),traceId:id(21),binding:binding(),subject:{kind:'client',entityType:'client',entityIds:[id(5)],tenantId:'synthetic-tenant',actorId:'synthetic-actor',authorizationDecisionId:id(22),policyRevision:'synthetic-policy',scopes:[scope()],rosterVersionId:null},window:{basis:'unbounded'},argumentsSha256:hash(selection),appliedFilters:[],generatedAt:at,sources:[{sourceId:'action_recommendation',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:at,freshness:'unknown'}],coverage:{sourcesRequested:['action_recommendation'],sourcesChecked:['action_recommendation'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:actions.length,truncated:false,historySupport:'bounded',limitations:['Independent synthetic incomplete source']},selection,order:'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',snapshotVersionId:null,clientId:id(5),scope:{actionItemId:null,status:null,sort:'deadline',page:1,limit:20,cursorApplied:false},total:actions.length,returned:actions.length,actions,pageCoverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:!nonempty,note:'Page only, no overall absence proof'},continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
}
function decision(status='allowed'){return {decisionId:id(30),actor:{tenantId:'synthetic-tenant',actorId:'synthetic-actor'},operation:'actions.query@0.2.0',scopes:[scope()],policyRevision:'synthetic-policy',evaluatedAt:at,decision:status,reasonCode:'synthetic-source-only'};}
function evaluation(outcome='returned',nonempty=true){
 const c=record();c.expected.outcome=outcome;
 let delivery=null,read=null;
 if(outcome==='returned'){
  const page=makePage(nonempty),observation={binding:binding(),subject:page.subject,operation:{id:'actions.query',version:'0.2.0'},argumentsSha256:hash(c.request),result:page};
  const events=[{contractVersion:'0.1.0',eventId:id(40),binding:binding(),sequence:1,createdAt:at,scopes:[scope()],type:'tool.started',data:{requestId:id(41),tool:'actions.query@0.2.0'}},{contractVersion:'0.1.0',eventId:id(42),binding:binding(),sequence:2,createdAt:at,scopes:[scope()],type:'tool.completed',data:{requestId:id(41),resultReference:id(43)}}];
  delivery={lookupId:id(41),resultReference:id(43),resultSha256:hash(observation),classification:'recommendations',acceptedTasks:false,events};read={...structuredClone(delivery),observation};c.expected.semanticSha256=hash(semanticResult(observation));c.expected.recordIds=page.actions.map(x=>x.id);
 }
 const frozen=freeze(corpus([c]));
 const run={runId:id(50),corpusSha256:frozen.corpusSha256,configSha256:frozen.configSha256,sourceSetSha256:frozen.sourceSetSha256,startedAt:at,completedAt:'2026-10-12T00:00:01.000Z',bindings:[{caseId:c.caseId,binding:binding()}]};
 const callback=(phase,authorized)=>{
  const b={original:phase==='before_read'?null:binding(),current:binding(),scopes:[scope()],resultReference:id(43),resultSha256:phase==='before_read'?null:read?.resultSha256};
  const bindingSha256=hash(b);return {phase,binding:{...b,bindingSha256},receipt:{authorized,bindingSha256,expiresAtMs:Date.parse(at)+10000},observedAtMs:Date.parse(at)};
 };
 const authorization=outcome==='returned'?[callback('before_read',true),callback('before_release',true)]:outcome==='denied'?[callback('before_read',false)]:[];
 const o={caseId:c.caseId,caseSha256:frozen.casePins[0].caseSha256,attemptId:id(51),runId:run.runId,configSha256:run.configSha256,sourceSetSha256:frozen.casePins[0].sourceSetSha256,status:outcome,reason:outcome==='returned'?null:'Synthetic expected refusal',route:{operation:{id:'actions.query',version:'0.2.0'},request:structuredClone(c.request)},authorization,startedAt:at,completedAt:run.completedAt,delivery,read,claims:{absence:false,exhaustive:false,acceptedTasks:false},traceSha256:digest('trace')};
 return {frozen,batch:{run,observations:[o]},o};
}
const scored=f=>scoreObservations(f.frozen,f.batch);
function fails(mutator){const f=evaluation();mutator(f.o,f);const result=scored(f);assert.equal(result.counts.passed,0);assert.equal(result.counts.failed,1);}

test('actual closed returned observation and matching frozen gold score',()=>{const f=evaluation(),r=scored(f);assert.equal(r.counts.passed,1);assert.equal(r.rows[0].status,'passed');assert.equal(r.allCasePassRate,1);assert.equal(r.qualification.qualifiedRealRequests,0);assert.equal(r.qualification.runtimeQualified,false);});
test('expected denied and clarify remain independently observable',()=>{for(const status of ['denied','clarify']){const r=scored(evaluation(status));assert.equal(r.counts.passed,1,status);}});
test('wrong route and wrong client argument are visible failures',()=>{fails(o=>o.route.operation.id='tasks.query');fails(o=>o.route.request.clientId=id(99));});
test('wrong case/config/source/run identities cannot score',()=>{for(const key of ['caseSha256','configSha256','sourceSetSha256'])fails(o=>o[key]=digest('wrong'));fails(o=>o.runId=id(99));});
test('wrong run envelope corpus/config/source pin refuses batch',()=>{for(const key of ['corpusSha256','configSha256','sourceSetSha256']){const f=evaluation();f.batch.run[key]=digest('wrong');assert.throws(()=>scored(f));}});
test('altered source records or missing coverage fails',()=>{fails(o=>o.read.observation.result.total=99);fails(o=>delete o.read.observation.result.coverage);});
test('current authorization actor/scope/receipt/denial cannot release success',()=>{fails(o=>o.authorization[1].binding.current.actorId='other');fails(o=>o.authorization[1].binding.scopes[0].resourceId=id(99));fails(o=>o.authorization[1].receipt.bindingSha256=digest('other'));fails(o=>o.authorization[1].receipt.authorized=false);});
test('current read attempt may change while original scope/binding remains',()=>{const f=evaluation();for(const a of f.o.authorization){a.binding.current.attemptId=id(77);a.binding.current.writerFence=2;const {bindingSha256,...b}=a.binding;a.binding.bindingSha256=hash(b);a.receipt.bindingSha256=hash(b);}assert.equal(scored(f).counts.passed,1);});
test('delivery/result reference and UI event correlation are required',()=>{fails(o=>o.delivery.resultReference=id(88));fails(o=>o.delivery.events[1].data.resultReference=id(88));fails(o=>o.delivery.events[0].binding.actorId='other');});
test('task acceptance/completion assertions cannot pass recommendation lookup',()=>{fails(o=>o.claims.acceptedTasks=true);fails(o=>o.delivery.acceptedTasks=true);fails(o=>o.delivery.classification='tasks');});
test('page-only empty result does not prove whole-source absence or exhaustive coverage',()=>{for(const claim of ['absence','exhaustive']){const f=evaluation('returned',false);f.o.claims[claim]=true;assert.equal(scored(f).counts.failed,1);}});
test('missing observations stay in denominator',()=>{const f=evaluation();f.batch.observations=[];const r=scored(f);assert.equal(r.counts.total,1);assert.equal(r.counts.missing,1);assert.equal(r.counts.passed,0);assert.equal(r.allCasePassRate,0);});
test('skipped/ineligible do not improve all-case denominator',()=>{for(const status of ['skipped','ineligible']){const f=evaluation();Object.assign(f.o,{status,reason:'Independent unavailable qualification',delivery:null,read:null,authorization:[],route:null});const r=scored(f);assert.equal(r.counts[status],1);assert.equal(r.counts.total,1);assert.equal(r.allCasePassRate,0);}});
test('failed observations stay failed even when expected branch is denied',()=>{const f=evaluation('denied');Object.assign(f.o,{status:'failed',reason:'source timeout',authorization:[],route:null});const r=scored(f);assert.equal(r.counts.failed,1);assert.equal(r.counts.passed,0);});
test('duplicate known observations fail their case and remain diagnostic',()=>{const f=evaluation();f.batch.observations.push(structuredClone(f.o));const r=scored(f);assert.equal(r.counts.passed,0);assert.equal(r.counts.failed,1);assert.ok(r.diagnostics.length);});
test('foreign observation is diagnosed without displacing missing known case',()=>{const f=evaluation();f.o.caseId='foreign';const r=scored(f);assert.equal(r.counts.missing,1);assert.equal(r.counts.passed,0);assert.ok(r.diagnostics.length);});
test('malformed observation cannot silently disappear',()=>{const f=evaluation();delete f.o.traceSha256;const r=scored(f);assert.equal(r.counts.failed,1);assert.equal(r.counts.passed,0);});
test('zero corpus rates are null with no measured qualification',()=>{const frozen=freeze(corpus([]));const run={runId:id(50),corpusSha256:frozen.corpusSha256,configSha256:frozen.configSha256,sourceSetSha256:frozen.sourceSetSha256,startedAt:at,completedAt:at,bindings:[]};const r=scoreObservations(frozen,{run,observations:[]});assert.equal(r.counts.total,0);assert.equal(r.allCasePassRate,null);assert.equal(r.executedPassRate,null);assert.equal(r.qualification.state,'UNQUALIFIED');});
test('run time reversal refuses rather than reporting negative measurement',()=>{const f=evaluation();f.batch.run.completedAt='2026-10-11T23:59:59.000Z';assert.throws(()=>scored(f));});
test('score result is detached from subsequent observation mutation',()=>{const f=evaluation(),r=scored(f),copy=structuredClone(r);f.o.delivery.acceptedTasks=true;f.o.status='failed';assert.deepEqual(r,copy);});

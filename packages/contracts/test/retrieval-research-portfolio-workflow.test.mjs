/** MO-05 contract boundary: the seven workflow reads and ten governed actions resolve, correlate and refuse model authority. No source access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../validate.mjs';
import {assertCatalog,resolveOperationContract,researchWorkflowValidators as reads,researchActionValidators as actions} from '../retrieval-0.2/validate.mjs';
import {RESEARCH_WORKFLOW_READS} from '../retrieval-0.2/research-portfolio-workflow-validation.mjs';
import {RESEARCH_ACTION_INTENTS,RESEARCH_MANAGEMENT_READ_ONLY_ACTIONS} from '../retrieval-0.2/research-portfolio-action-validation.mjs';
const catalog=JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));
const U=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const binding={tenantId:U('1'),actorId:U('2'),conversationId:U('3'),runId:U('4'),attemptId:U('5'),workerId:U('6'),writerFence:1};
const context={binding,selectedClientId:null,visibleClientIds:[U('7')]},at='2026-10-27T12:00:00.000Z',KEY='meri-rp-'+'a'.repeat(64);
const basis={requestEdition:null,fundingFiscalYear:2027,stage:'request',metric:'funding',unit:'usd_millions',currency:'USD',priceBasis:null,knownAt:null};
const analytics=()=>({portfolioId:U('9'),portfolioRevision:3,calculationVersion:'research-portfolio-analytics-v2',availability:'partial',totals:[{basis,value:'12.5',contributionCount:1}],
 contributions:[{contributionId:'c1',memberId:'m1',targetKind:'program_element',targetId:'0604115A',label:null,basis,value:'12.5',disposition:'included',reason:'observed',sourceObservationId:null,sourceRevisionIds:['r1'],evidence:[{evidenceRefId:'x'}],dedupKey:null,overlapsContributionId:null},
  {contributionId:'c2',memberId:'m2',targetKind:'project',targetId:'p',label:'withheld',basis:null,value:null,disposition:'withheld',sourceDisposition:'withheld',reason:'walled',sourceObservationId:null,sourceRevisionIds:[],evidence:[],dedupKey:null,overlapsContributionId:null}],
 coverage:{eligibleMembers:2,supportedMembers:1,includedContributions:1,excludedContributions:0,overlapContributions:0,unavailableMembers:1},limitations:['one member withheld'],observedAt:at,readAt:at});
const job=id=>({id,tenantId:binding.tenantId,portfolioId:U('9'),operationKey:'k',worksheetKind:'membership',status:'completed',originalHash:'h',originalSize:10,fileName:'m.csv',mediaType:'text/csv',originalStorageKey:null,fileMetadata:{},parserVersion:'1',schemaVersion:'1',targetRevision:2,checkpoint:null,leaseOwner:null,leaseUntil:null,rowCount:1,appliedCount:1,createdAt:at,updatedAt:at,
 rows:[{id:U('c'),tenantId:binding.tenantId,portfolioId:U('9'),importJobId:id,worksheetKind:'membership',sheetName:null,rowNumber:1,rowIdentity:'r1',rawCells:{},parsedData:{},repairs:{},validationIssues:[],selected:true,previewClassification:'resolved',previewReason:null,finalOutcome:'applied',finalReason:null,finalDisposition:{},expectedRevision:2,canonicalTargetKey:null,targetKind:'program_element',targetId:'0604115A',createdAt:at,updatedAt:at}],mappings:[],attempts:[],effects:[],compensationReceipts:[]});
test('catalog maps the seventeen MO-05 originals and resolves every read and action contract',()=>{
 assertCatalog(catalog);
 for(const id of [...RESEARCH_WORKFLOW_READS,...RESEARCH_ACTION_INTENTS]){
  const row=catalog.originals.find(o=>o.id===id);assert.equal(row.disposition,'selected',id);assert.equal(row.state,'mapped',id);assert.deepEqual(row.replacement,{id,version:'0.2.0'});
  const c=resolveOperationContract({id,version:'0.2.0'});
  assert.equal(c.binding.group,RESEARCH_WORKFLOW_READS.includes(id)?'research-portfolio-workflow':'research-portfolio-action');
  assert.equal(c.descriptor.sideEffect,RESEARCH_WORKFLOW_READS.includes(id)?'none':'source-command');
 }
 assert.equal(catalog.originals.filter(o=>o.disposition==='deferred').length,12);
 assert.throws(()=>resolveOperationContract({id:'manage_research_portfolio',version:'0.1.0'}));
});
test('workflow reads bind the conversation and refuse foreign, trimmed or inconsistent producer rows',()=>{
 const c=resolveOperationContract({id:'get_research_portfolio_analytics',version:'0.2.0'});
 assert.equal(c.normalizeInput({conversationId:binding.conversationId},context).input.conversationId,binding.conversationId);
 assert.throws(()=>c.normalizeInput({conversationId:U('8')},context));
 assert.throws(()=>c.normalizeInput({conversationId:binding.conversationId,portfolioId:U('9')},context));
 const page=analytics();assert.deepEqual(c.assertOutput(page,{request:{conversationId:binding.conversationId},...context}),page);
 assert.throws(()=>c.assertOutput({...page,sharePath:'/share/x'},{request:{conversationId:binding.conversationId},...context}));
 const bookmark={id:U('a'),portfolioId:U('9'),userId:binding.actorId,targetKind:'snapshot',targetId:U('b'),label:null,note:null,createdAt:at,updatedAt:at};
 assert.throws(()=>reads.assertOutput('get_research_portfolio_bookmarks',[bookmark,bookmark],{conversationId:binding.conversationId},context));
 assert.throws(()=>reads.assertOutput('get_research_portfolio_bookmarks',[bookmark,{...bookmark,id:U('d'),portfolioId:U('e')}],{conversationId:binding.conversationId},context));
 const fit=clientId=>({portfolioId:U('9'),clientFits:[{portfolioId:U('9'),clientId,clientName:'Example',fitScore:null,availability:'unavailable',ruleMatches:[],refreshedAt:null}],calculatedAt:at});
 reads.assertOutput('get_research_portfolio_fit',fit(U('7')),{conversationId:binding.conversationId},context);
 assert.throws(()=>reads.assertOutput('get_research_portfolio_fit',fit(U('8')),{conversationId:binding.conversationId},context));
 const review={id:U('a'),tenantId:binding.tenantId,portfolioId:U('9'),targetKind:'rule',targetId:'r',trigger:'manual',triggerIdentity:'t',dependencyIdentity:null,assigneeUserId:null,reason:'why',evidenceFor:[],evidenceAgainst:[],revision:1,triggerFingerprint:'f',status:'open',createdAt:at,updatedAt:at,resolvedAt:null};
 reads.assertOutput('get_research_portfolio_reviews',[review],{conversationId:binding.conversationId,lane:'team'},context);
 assert.throws(()=>reads.assertOutput('get_research_portfolio_reviews',[{...review,tenantId:U('f')}],{conversationId:binding.conversationId},context));
 assert.throws(()=>reads.normalizeInput('get_research_portfolio_reviews',{conversationId:binding.conversationId,lane:'everyone'},context));
 reads.assertOutput('get_research_portfolio_imports',job(U('a')),{conversationId:binding.conversationId,jobId:U('a')},context);
 reads.assertOutput('get_research_portfolio_imports',[job(U('a')),job(U('b'))],{conversationId:binding.conversationId},context);
 assert.throws(()=>reads.assertOutput('get_research_portfolio_imports',job(U('b')),{conversationId:binding.conversationId,jobId:U('a')},context));
 assert.throws(()=>reads.assertOutput('get_research_portfolio_imports',[job(U('a'))],{conversationId:binding.conversationId,jobId:U('a')},context));
 const operation={id:U('a'),portfolioId:U('9'),kind:'output',status:'outcome_unknown',actorUserId:null,domainStatus:'unknown',limitations:[],label:null,startedAt:at,completedAt:null,lastErrorCode:null,lastError:null,retryCount:0,createdAt:at,updatedAt:at};
 reads.assertOutput('get_research_portfolio_operations',operation,{conversationId:binding.conversationId,operationId:U('a')},context);
 assert.throws(()=>reads.assertOutput('get_research_portfolio_operations',operation,{conversationId:binding.conversationId,operationId:U('b')},context));
 const rule={id:U('a'),version:1,schemaVersion:1,expression:{kind:'and',clauses:[{kind:'condition',field:'component',operator:'eq',value:'Army'}]},readableExpression:'component = Army',mode:'rules',qualificationPolicy:{},taxonomyVersionId:null,templateVersionId:null,previewHash:'p',authorUserId:'u',predecessorId:null,publishedAt:at,recompute:null};
 reads.assertOutput('get_research_portfolio_rules',[rule],{conversationId:binding.conversationId},context);
 assert.throws(()=>reads.assertOutput('get_research_portfolio_rules',[rule,{...rule,id:U('b')}],{conversationId:binding.conversationId},context));
});
test('governed actions derive the one operation key, refuse model-supplied keys and bind the exact proposal',()=>{
 const manage=actions.normalizeInput('manage_research_portfolio',{conversationId:binding.conversationId,action:'portfolio_archive',parameters:{expectedRevision:3},confirmed:true},{binding});
 assert.equal(actions.bind('manage_research_portfolio',manage,KEY).parameters.idempotencyKey,KEY);
 assert.equal(actions.bind('manage_research_portfolio',{...manage,action:'import_action',parameters:{jobId:U('a'),importAction:'apply'}},KEY).parameters.operationKey,KEY);
 for(const action of RESEARCH_MANAGEMENT_READ_ONLY_ACTIONS){
  const request={conversationId:binding.conversationId,action,parameters:{}};assert.equal(actions.isManagementRead('manage_research_portfolio',request,{binding}),true);
  assert.throws(()=>actions.bind('manage_research_portfolio',request,KEY),'pure reads cannot become approval proposals');
 }
 for(const parameters of [{idempotencyKey:'mine'},{operationKey:'mine'},{portfolioId:U('9')},{scopeVersion:'x'}])assert.throws(()=>actions.normalizeInput('manage_research_portfolio',{conversationId:binding.conversationId,action:'portfolio_archive',parameters,confirmed:true},{binding}));
 assert.throws(()=>actions.normalizeInput('manage_research_portfolio',{conversationId:binding.conversationId,action:'portfolio_archive',parameters:{},confirmed:false},{binding}));
 assert.throws(()=>actions.normalizeInput('manage_research_portfolio',{conversationId:binding.conversationId,action:'nuke_portfolio',parameters:{},confirmed:true},{binding}));
 assert.throws(()=>actions.normalizeInput('create_research_portfolio_snapshot',{conversationId:U('8'),name:'Q1',expectedRevision:3},{binding}));
 assert.throws(()=>actions.bind('create_research_portfolio_snapshot',{conversationId:binding.conversationId,name:'Q1',expectedRevision:3},'mine'));
 const bound=actions.bind('create_research_portfolio_snapshot',{conversationId:binding.conversationId,name:'Q1',expectedRevision:3},KEY);
 assert.deepEqual(actions.unbind('create_research_portfolio_snapshot',bound),{conversationId:binding.conversationId,name:'Q1',expectedRevision:3});
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:U('7'),policyRevision:'p1'}];
 const proposalOf=(operation,request)=>{const p={kind:'research_action',binding,scopes,operation,proposalId:U('b'),request,preview:{label:'Create snapshot',portfolioId:U('9')},createdAt:at,expiresAt:'2026-10-27T12:10:00.000Z'};return {...p,commandSha256:hash(p)};};
 const proposal=proposalOf('create_research_portfolio_snapshot',bound);
 assert.deepEqual(actions.assertProposal(proposal),proposal);
 actions.assertOutput('create_research_portfolio_snapshot',{status:'approval_required',proposal},{conversationId:binding.conversationId,name:'Q1',expectedRevision:3},{binding});
 assert.throws(()=>actions.assertOutput('create_research_portfolio_snapshot',{status:'approval_required',proposal},{conversationId:binding.conversationId,name:'Q2',expectedRevision:3},{binding}));
 assert.throws(()=>actions.assertProposal({...proposal,commandSha256:'0'.repeat(64)}));
 assert.throws(()=>actions.assertProposal({...proposal,sharePath:'/share/'+'a'.repeat(64)}));
 assert.throws(()=>actions.assertProposal(proposalOf('watch_research_portfolio',bound)));
 const save=actions.bind('save_research_portfolio_output_to_client',{conversationId:binding.conversationId,outputId:U('c'),clientId:U('8')},KEY);
 assert.throws(()=>actions.assertProposal(proposalOf('save_research_portfolio_output_to_client',save)));
 assert.deepEqual(actions.decided({proposalStatus:'succeeded',resultSummary:{ok:true,snapshotId:U('d'),client:{id:U('7'),name:'Example'}}}).resultSummary.snapshotId,U('d'));
 assert.throws(()=>actions.decided({proposalStatus:'succeeded',resultSummary:{nested:{deep:true}}}));
 assert.throws(()=>actions.decided({proposalStatus:'succeeded',oneTimeResult:{sharePath:'/share/x'}}));
});

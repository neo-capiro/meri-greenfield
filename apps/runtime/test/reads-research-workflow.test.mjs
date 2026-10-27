/** MO-05 workflow reads mounted through the current execution/Core composition with synthetic current Core and HTTP boundaries. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,uuid} from './reads-native-fixture.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {RESEARCH_WORKFLOW_READS} from '../../../packages/contracts/retrieval-0.2/research-portfolio-workflow-validation.mjs';
const family='research-portfolio-workflow',at='2026-10-27T12:00:00.000Z',portfolioId=uuid('6');
const basis={requestEdition:null,fundingFiscalYear:2027,stage:'request',metric:'funding',unit:'usd_millions',currency:'USD',priceBasis:null,knownAt:null};
function page(id,args,{tenantId,client}){
 if(id==='get_research_portfolio_analytics')return {portfolioId,portfolioRevision:3,calculationVersion:'research-portfolio-analytics-v2',availability:'available',totals:[{basis,value:'1.5',contributionCount:1}],contributions:[{contributionId:'c1',memberId:'m1',targetKind:'program_element',targetId:'0604115A',label:null,basis,value:'1.5',disposition:'included',reason:'observed',sourceObservationId:null,sourceRevisionIds:['r1'],evidence:[{evidenceRefId:'e1'}],dedupKey:null,overlapsContributionId:null}],coverage:{eligibleMembers:1,supportedMembers:1,includedContributions:1,excludedContributions:0,overlapContributions:0,unavailableMembers:0},limitations:[],observedAt:at,readAt:at};
 if(id==='get_research_portfolio_bookmarks')return [{id:uuid('a'),portfolioId,userId:uuid('2'),targetKind:'snapshot',targetId:uuid('b'),label:'Reviewed',note:null,createdAt:at,updatedAt:at}];
 if(id==='get_research_portfolio_fit')return {portfolioId,clientFits:[{portfolioId,clientId:client,clientName:'Example',fitScore:42.5,availability:'available',ruleMatches:[],refreshedAt:at}],calculatedAt:at};
 if(id==='get_research_portfolio_reviews')return [{id:uuid('a'),tenantId,portfolioId,targetKind:'program_element',targetId:'0604115A',trigger:'rule_change',triggerIdentity:'t',dependencyIdentity:null,assigneeUserId:null,reason:'rule changed',evidenceFor:[],evidenceAgainst:[],revision:1,triggerFingerprint:'f',status:'open',createdAt:at,updatedAt:at,resolvedAt:null}];
 if(id==='get_research_portfolio_rules')return [{id:uuid('a'),version:1,schemaVersion:1,expression:{kind:'condition',field:'component',operator:'eq',value:'Army'},readableExpression:'component = Army',mode:'rules',qualificationPolicy:{},taxonomyVersionId:null,templateVersionId:null,previewHash:'p',authorUserId:'u',predecessorId:null,publishedAt:at,recompute:null}];
 if(id==='get_research_portfolio_imports'){const job={id:args.jobId??uuid('a'),tenantId,portfolioId,operationKey:'k',worksheetKind:'membership',status:'completed',originalHash:'h',originalSize:1,fileName:'m.csv',mediaType:'text/csv',originalStorageKey:null,fileMetadata:{},parserVersion:'1',schemaVersion:'1',targetRevision:2,checkpoint:null,leaseOwner:null,leaseUntil:null,rowCount:0,appliedCount:0,createdAt:at,updatedAt:at,rows:[],mappings:[],attempts:[],effects:[],compensationReceipts:[]};return args.jobId?job:[job];}
 return {id:args.operationId,portfolioId,kind:'snapshot',status:'completed',actorUserId:null,domainStatus:'completed',limitations:[],label:null,startedAt:at,completedAt:at,lastErrorCode:null,lastError:null,retryCount:0,createdAt:at,updatedAt:at};
}
const ARGS=id=>id==='get_research_portfolio_operations'?{operationId:uuid('c')}:id==='get_research_portfolio_reviews'?{lane:'team'}:{};
async function setup(id,{selected=false,args}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),client=uuid('5');
 scene.family=family;scene.operation=operation;scene.contract=contract;scene.arguments={conversationId:scene.binding.conversationId,...(args??ARGS(id))};
 scene.authority.sourceIds=['research_portfolios'];scene.authority.decision.operation=id+'@0.2.0';
 if(selected){scene.authority.subject.kind='client';scene.authority.subject.entityType='client';scene.authority.subject.entityIds=[client];scene.authority.subject.scopes=[{tenantId:scene.binding.tenantId,kind:'client',resourceId:client,policyRevision:scene.authority.policyRevision}];}
 scene.visibleClientIds=[client];
 scene.state.page=page(id,scene.arguments,{tenantId:scene.binding.tenantId,client});
 scene.transport.fetchImpl=async(url,options)=>{scene.wire.push({url,options});
  assert.deepEqual(JSON.parse(options.body),{version:1,input:scene.arguments,currentTurn:{tenantId:scene.binding.tenantId,userId:scene.binding.actorId,conversationId:scene.binding.conversationId,selectedClientId:selected?client:null}});
  const out=structuredClone(scene.state.page);scene.state.afterSource?.();return Response.json(out);};
 return fixture(family,id,{scene});
}
test('every workflow read reaches Core inside the trusted current-turn envelope and returns the typed producer rows',async()=>{
 for(const id of RESEARCH_WORKFLOW_READS)for(const selected of [false,true]){
  const f=await setup(id,{selected}),r=await f.execute();assert.equal(r.status,200,id+' '+JSON.stringify({body:await r.clone().text(),calls:f.calls}));
  const out=JSON.parse((await r.json()).resultJson);assert.deepEqual(out.result,f.scene.state.page);assert.equal(f.calls.filter(p=>p==='/api/clio/tools/'+id).length,1);
 }
});
test('a single import job is read by its exact id',async()=>{
 const f=await setup('get_research_portfolio_imports',{args:{jobId:uuid('d')}}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 assert.equal(JSON.parse((await r.json()).resultJson).result.id,uuid('d'));
});
test('foreign conversation, revoked current authority and unknown arguments withhold the read before or after the source',async()=>{
 const foreign=await setup('get_research_portfolio_analytics');assert.notEqual((await foreign.execute({conversationId:uuid('9')})).status,200);assert.equal(foreign.scene.wire.length,0);
 const revoked=await setup('get_research_portfolio_bookmarks');revoked.scene.state.afterSource=revoked.revoke;assert.notEqual((await revoked.execute()).status,200);
 const authority=await setup('get_research_portfolio_rules');assert.notEqual((await authority.execute({conversationId:authority.binding.conversationId,portfolioId:uuid('6')})).status,200);assert.equal(authority.scene.wire.length,0);
});
test('a producer row outside the current tenant or visible clients refuses instead of being trimmed',async()=>{
 const review=await setup('get_research_portfolio_reviews');review.scene.state.page[0].tenantId=uuid('e');const r=await review.execute();assert.notEqual(r.status,200);assert.equal((await r.text()).includes('rule changed'),false);
 const fit=await setup('get_research_portfolio_fit');fit.scene.state.page.clientFits[0].clientId=uuid('7');assert.notEqual((await fit.execute()).status,200);
});

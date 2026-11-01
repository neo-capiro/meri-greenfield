import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {capiroDataPage,privateCapiroDataPage,nextGenerationPage} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';
import {withSqlContract} from '../../../apps/gateway/sources/capiro-data/test/sql-contract-fixture.mjs';
const id='70000000-0000-4000-8000-000000000001';
const capture={kind:'research_portfolio',researchPortfolioId:id,researchPortfolioName:'Captured research',researchPortfolioRevision:2};
const research={...capture,scopeVersion:createHash('sha256').update(JSON.stringify(capture)).digest('hex'),currentResearchPortfolioName:'Current research',currentResearchPortfolioRevision:3,stale:true,resourceRevision:'d'.repeat(64)};
const revisions={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)};
const contract=(operation='query_capiro_data',version='0.5.0')=>resolveOperationContract({id:operation,version});
function fixture(source,operation='query_capiro_data'){
 const relation=source==='research_portfolio'?'research_portfolio_members':'classic_outreach_records';
 const context={capiroDataScope:{source,...revisions,...(source==='research_portfolio'?{researchPortfolio:research}:{clientId:null})}};
 const request=operation==='describe_capiro_data'?{source,relations:[relation]}:{source,sql:`SELECT COUNT(*) AS count FROM ${relation}`,parameters:[],rowLimit:2};
 const page=nextGenerationPage(privateCapiroDataPage(operation));
 page.scope=source==='research_portfolio'?structuredClone(research):{kind:source,clientId:null};
 if(operation==='describe_capiro_data'){
  page.relations[0].name=relation;page.relations[0].coverage.basis=source==='research_portfolio'?'authorized_research_portfolio':'authorized_classic_outreach';
  Object.assign(page,withSqlContract(page));
  page.contract.source=source;const {revisionSha256,...body}=page.contract;page.contract.revisionSha256=canonicalSha256({...body,relations:page.relations});
 }else{page.relationsUsed=[relation];page.coverage.relations[0].name=relation;}
 return {request,page,context,options:{request,...context}};
}
for(const source of ['research_portfolio','classic_outreach']){
 test(`${source}: same SQL receiver admits exact current scope and lossless PostgreSQL cells`,()=>{
  const {request,page,context,options}=fixture(source);assert.deepEqual(contract().normalizeInput(request,context).input,request);assert.deepEqual(contract().assertOutput(page,options),page);
  assert.equal(page.rows[0].count,'9007199254740993');
  const bad=structuredClone(page);bad.scope=source==='research_portfolio'?{...bad.scope,resourceRevision:'e'.repeat(64)}:{...bad.scope,clientId:id};assert.throws(()=>contract().assertOutput(bad,options));
  for(const version of ['0.2.0','0.3.0','0.4.0'])assert.throws(()=>contract('query_capiro_data',version).normalizeInput(request,context));
 });
 test(`${source}: model authority fields, foreign source relations and missing current context refuse`,()=>{
  const {request,page,context,options}=fixture(source);assert.throws(()=>contract().normalizeInput(request));
  for(const extra of [{clientId:id},{researchPortfolioId:id},{scopeVersion:research.scopeVersion},{eligibleIds:[id]},{capiroDataScope:context.capiroDataScope}])assert.throws(()=>contract().normalizeInput({...request,...extra},context));
  for(const key of ['identityRevision','membershipRevision','contextRevision']){const missing=structuredClone(context);delete missing.capiroDataScope[key];assert.throws(()=>contract().normalizeInput(request,missing));}
  const foreign=structuredClone(page);foreign.relationsUsed=['client_objectives'];foreign.coverage.relations[0].name='client_objectives';assert.throws(()=>contract().assertOutput(foreign,options));
 });
 test(`${source}: descriptor binds exact source, grammar, limits and returned relations`,()=>{
  const {page,options}=fixture(source,'describe_capiro_data'),c=contract('describe_capiro_data');assert.deepEqual(c.assertOutput(page,options),page);
  for(const mutate of [p=>p.contract.source='client_records',p=>p.contract.revisionSha256='0'.repeat(64),p=>p.relations[0].description+=' changed',p=>p.contract.grammar.blockedFunctions.push('extra'),p=>p.scope.kind='client_records']){const bad=structuredClone(page);mutate(bad);assert.throws(()=>c.assertOutput(bad,options));}
  const wrongCoverage=structuredClone(page);wrongCoverage.relations[0].coverage.basis='authorized_client_records';const {revisionSha256,...body}=wrongCoverage.contract;wrongCoverage.contract.revisionSha256=canonicalSha256({...body,relations:wrongCoverage.relations});assert.throws(()=>c.assertOutput(wrongCoverage,options));
 });
}
test('Research stale same-portfolio capture is retained, not silently repinned',()=>{
 const f=fixture('research_portfolio');assert.equal(contract().assertOutput(f.page,f.options).scope.researchPortfolioRevision,2);
 for(const key of ['researchPortfolioId','researchPortfolioName','researchPortfolioRevision','scopeVersion','currentResearchPortfolioName','currentResearchPortfolioRevision','stale','resourceRevision']){const bad=structuredClone(f.page);bad.scope[key]=typeof bad.scope[key]==='string'?bad.scope[key]+'x':typeof bad.scope[key]==='boolean'?!bad.scope[key]:bad.scope[key]+1;assert.throws(()=>contract().assertOutput(bad,f.options));}
});
test('new private domains do not reintroduce the obsolete 32-column output cap',()=>{
 const f=fixture('classic_outreach'),page=f.page;page.columns=Array.from({length:40},(_,i)=>({name:`c${i}`,type:'string',nullable:false,pgType:'text'}));page.rows=[Object.fromEntries(page.columns.map(c=>[c.name,'value']))];page.rowCount=1;assert.deepEqual(contract().assertOutput(page,f.options),page);
});
test('historical .4 wire keeps its old envelopes and explicitly refuses new-only Core envelopes',()=>{
 const c=contract('query_capiro_data','0.4.0'),page=privateCapiroDataPage(),options={request:{source:'client_records',sql:'SELECT count FROM client_objectives',parameters:[],rowLimit:2},capiroDataScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
 assert.deepEqual(c.assertOutput(page,options),page);assert.throws(()=>c.assertOutput(nextGenerationPage(page),options));
});
test('v5 preserves the public text-SQL envelope without manufacturing private scope',()=>{
 const request={sql:'SELECT count FROM program_elements',parameters:[],rowLimit:2},page=nextGenerationPage(capiroDataPage());assert.deepEqual(contract().assertOutput(page,{request}),page);
 assert.throws(()=>contract().assertOutput(page,{request,capiroDataScope:{source:'classic_outreach',clientId:null,...revisions}}));
});


test('actual Core producer vectors cross the same .5 receiver unchanged; retained versions refuse them',async()=>{
 const {readFile}=await import('node:fs/promises');const vectors=JSON.parse(await readFile(new URL('./capiro-data-domain-producer-vectors.json',import.meta.url),'utf8'));
 for(const v of [vectors.research,vectors.classic])for(const id of ['describe_capiro_data','query_capiro_data']){
  const page=v[id==='describe_capiro_data'?'describe':'query'];
  const request=id==='describe_capiro_data'?{source:v.source}:{source:v.source,sql:'SELECT COUNT(*) AS total FROM '+page.relationsUsed[0],parameters:[]};
  const context={capiroDataScope:{source:v.source,...revisions,...(v.source==='research_portfolio'?{researchPortfolio:v.scope}:{clientId:v.scope.clientId})}};
  const options={request,...context};assert.deepEqual(contract(id).assertOutput(page,options),page);
  for(const version of ['0.2.0','0.3.0','0.4.0'])assert.throws(()=>contract(id,version).assertOutput(page,options));
  const changed=structuredClone(page);changed.scope=v.source==='research_portfolio'?{...v.scope,currentResearchPortfolioRevision:3}:{...v.scope,clientId:id};assert.throws(()=>contract(id).assertOutput(changed,options));
 }
});

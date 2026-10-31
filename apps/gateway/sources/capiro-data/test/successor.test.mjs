import test from 'node:test';
import assert from 'node:assert/strict';
import {capiroDataCase} from './fixture.mjs';

const original=['congress_bills','congress_bill_subjects','congress_bill_cosponsors','congress_members',
 'program_elements','program_element_projects','program_element_budget_positions','program_element_project_budget_positions'];
const expanded=[...original,'state_bills','committee_hearings','committee_hearing_bills','legislative_agenda_items','state_bill_calendar_events','federal_grants','sam_opportunities'];
function descriptions(f,names){f.page.relations=names.map(name=>({...structuredClone(f.page.relations[0]),name}));}

test('retained default public description works after Core publishes fifteen relations',async()=>{
 const f=capiroDataCase('describe_capiro_data',{request:{}});descriptions(f,expanded);
 const result=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(result.result.relations.map(row=>row.name),original);
 assert.deepEqual(f.wire[0].body,{});assert.equal(result.operation.version,'0.2.0');
});
for(const names of [original,expanded])test(`successor works with old/new Core (${names.length} public relations)`,async()=>{
 const f=capiroDataCase('describe_capiro_data',{version:'0.3.0',request:{}});descriptions(f,names);
 const result=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(result.result,f.page);assert.equal(result.operation.version,'0.3.0');
 assert.equal(new URL(f.wire[0].url).pathname,'/api/clio/tools/describe_capiro_data');
});
test('successor carries an explicit full catalog selection and retained explicit selections are untouched',async()=>{
 for(const [version,names] of [['0.3.0',expanded],['0.2.0',['committee_hearings']]]){
  const f=capiroDataCase('describe_capiro_data',{version,request:{relations:names}});descriptions(f,names);
  assert.deepEqual(JSON.parse(await f.handler()(f.call())).result,f.page);
  assert.deepEqual(f.wire[0].body,f.arguments);
 }
});
test('successor private read retains per-call credentials, exact correlation and no injected reader fallback',async()=>{
 const request={source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
 const f=capiroDataCase('query_capiro_data',{version:'0.3.0',request});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 const result=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
 assert.deepEqual(result.result,f.page);assert.deepEqual(f.wire[0].body,request);
 const correlation=JSON.parse(Buffer.from(f.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.deepEqual(correlation.normalizationContext,f.normalizationContext);
 let reads=0;await assert.rejects(f.handler({getCredentials:undefined,readSource:async()=>{reads++;return f.page;}})(f.call()),{message:'ACCESS_DENIED'});
 assert.equal(reads,0);
});
test('both versions preserve unavailable/errors and malformed results never become empty success',async()=>{
 for(const version of ['0.2.0','0.3.0']){
  const f=capiroDataCase('describe_capiro_data',{version,request:{}});
  f.state.page={version:'0.1.0',generatedAt:f.page.generatedAt,ok:false,error:{code:'SOURCE_UNAVAILABLE',message:'Unavailable'}};
  assert.deepEqual(JSON.parse(await f.handler()(f.call())).result,f.state.page);
  f.state.page={...f.page,relations:'malformed'};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

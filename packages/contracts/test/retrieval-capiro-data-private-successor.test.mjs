import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../retrieval-0.2/capiro-data-validation.mjs';
import {privateCapiroDataPage} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';

const names=[...RETAINED_CAPIRO_PRIVATE_RELATIONS,'client_meetings'];
const scope={capiroDataScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
const contract=(id='describe_capiro_data',version='0.4.0')=>resolveOperationContract({id,version});
const request={source:'client_records',relations:names};

test('private successor preserves both current SQL envelope/descriptor schema documents and their private allowlists',()=>{
 for(const [version,expected] of [['0.2','58e0935a0d113adc1a48ec0f557d232ab9d980ee13737efbafd5bfa0dc0da2ae'],['0.3','daec7d0a52fa16a1ac7acbcccf2f5528967fc27b8fc4d2a64d017fd6841e6add']]){
  const raw=readFileSync(new URL(`../retrieval-${version}/capiro-data.schema.json`,import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),expected);
  assert.deepEqual(JSON.parse(raw).$defs.CapiroDataPrivateRelation.properties.name.enum,RETAINED_CAPIRO_PRIVATE_RELATIONS);
  assert.throws(()=>contract('describe_capiro_data',`${version}.0`).normalizeInput({source:'client_records',relations:['client_meetings']},scope));
 }
});

test('new private describe admits exactly fifteen named projections only under canonical scope',()=>{
 const c=contract(),page=privateCapiroDataPage('describe_capiro_data');
 page.relations=names.map(name=>({...structuredClone(page.relations[0]),name}));
 assert.deepEqual(c.normalizeInput(request,scope).input,request);
 assert.deepEqual(c.assertOutput(page,{request,...scope}),page);
 assert.throws(()=>c.normalizeInput(request));
 for(const relations of [[...names,'sixteenth'],['meetings'],['research_portfolios'],['outreach_records'],['client_meetings','client_meetings']])
  assert.throws(()=>c.normalizeInput({...request,relations},scope));
 assert.throws(()=>c.normalizeInput({...request,clientId:'10000000-0000-4000-8000-000000000001'},scope));
 assert.throws(()=>contract('describe_capiro_data','0.3.0').assertOutput(page,{request:{source:'client_records'},...scope}));
 const missing=structuredClone(page);missing.relations.pop();assert.throws(()=>c.assertOutput(missing,{request,...scope}));
});

test('new private query retains exact coverage, output scope, numeric and byte bounds',()=>{
 const c=contract('query_capiro_data'),request={source:'client_records',sql:'SELECT COUNT(*) AS count FROM client_meetings',parameters:[],rowLimit:2};
 const page=privateCapiroDataPage();page.relationsUsed=names;
 page.coverage.relations=names.map(name=>({...structuredClone(page.coverage.relations[0]),name}));
 assert.deepEqual(c.assertOutput(page,{request,...scope}),page);
 assert.throws(()=>contract('query_capiro_data','0.3.0').assertOutput(page,{request,...scope}));
 const missing=structuredClone(page);missing.coverage.relations.pop();assert.throws(()=>c.assertOutput(missing,{request,...scope}));
 assert.throws(()=>c.assertOutput({...page,scope:{kind:'client_records',clientId:'10000000-0000-4000-8000-000000000001'}},{request,...scope}));
 const lossy=structuredClone(page);lossy.rows[0].count=9007199254740992;assert.throws(()=>c.assertOutput(lossy,{request,...scope}));
 const huge=structuredClone(page);huge.rows[0].outcome='界'.repeat(90000);assert.throws(()=>c.assertOutput(huge,{request,...scope}));
 assert.throws(()=>c.normalizeInput({...request,sql:'x'.repeat(16385)},scope));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {capiroDataPage,privateCapiroDataPage,requests} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';

const publicNames=['congress_bills','congress_bill_subjects','congress_bill_cosponsors','congress_members',
 'program_elements','program_element_projects','program_element_budget_positions','program_element_project_budget_positions',
 'state_bills','committee_hearings','committee_hearing_bills','legislative_agenda_items','state_bill_calendar_events','federal_grants','sam_opportunities'];
const privateNames=['client_objectives','client_activity','client_team_roster','client_account_owners','client_targets',
 'client_profiles','client_profile_codes','client_people','client_contacts','client_engagement_tasks','client_action_items',
 'client_tracked_bills','client_outreach_campaigns','client_campaign_recipients'];
const describe=version=>resolveOperationContract({id:'describe_capiro_data',version});
const context={capiroDataScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};

test('retained SQL schema bytes and descriptor remain frozen while successor advertises larger bounds',()=>{
 const bytes=readFileSync(new URL('../retrieval-0.2/capiro-data.schema.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'862b0f2e22bb6208a0f0396d173fd96fb3b8ccd9fd0f3590da512d440f3c6c43');
 assert.equal(describe('0.2.0').descriptor.inputSchema.sha256,'862b0f2e22bb6208a0f0396d173fd96fb3b8ccd9fd0f3590da512d440f3c6c43');
 assert.equal(describe('0.3.0').binding.group,'capiro-data-v3');
 assert.throws(()=>describe('0.2.0').normalizeInput({relations:publicNames}));
 assert.deepEqual(describe('0.3.0').normalizeInput({relations:publicNames}).input,{relations:publicNames});
});

test('successor permits fifteen public descriptions with exact request correlation and unchanged output budget',()=>{
 const page=capiroDataPage('describe_capiro_data');
 page.relations=publicNames.map(name=>({...structuredClone(page.relations[0]),name}));
 const contract=describe('0.3.0'),request={relations:publicNames};
 assert.deepEqual(contract.assertOutput(page,{request}),page);
 assert.throws(()=>describe('0.2.0').assertOutput(page,{request:{}}));
 assert.throws(()=>contract.normalizeInput({relations:[...publicNames,'sixteenth']}));
 assert.throws(()=>contract.normalizeInput({relations:[publicNames[0],publicNames[0]]}));
 const missing=structuredClone(page);missing.relations.pop();assert.throws(()=>contract.assertOutput(missing,{request}));
 const extra=structuredClone(page);extra.relations.push({...extra.relations[0],name:'sixteenth'});assert.throws(()=>contract.assertOutput(extra,{request:{}}));
 const huge=structuredClone(page);for(const r of huge.relations)r.fields=Array.from({length:64},(_,i)=>({name:`f${i}`,type:'string',nullable:false,description:'界'.repeat(600)}));
 assert.throws(()=>contract.assertOutput(huge,{request:{}}));
});

test('all fourteen private selectors work without expanding private scope or relation allowlist',()=>{
 const contract=describe('0.3.0'),request={source:'client_records',relations:privateNames};
 assert.deepEqual(contract.normalizeInput(request,context).input,request);
 const page=privateCapiroDataPage('describe_capiro_data');
 page.relations=privateNames.map(name=>({...structuredClone(page.relations[0]),name}));
 assert.deepEqual(contract.assertOutput(page,{request,...context}),page);
 for(const relations of [[...privateNames,'committee_hearings'],['visible_clients'],['meetings']])
  assert.throws(()=>contract.normalizeInput({...request,relations},context));
 assert.throws(()=>contract.normalizeInput(request));
 assert.throws(()=>contract.assertOutput({...page,version:'0.1.0'},{request,...context}));
});

test('fifteen query relations retain exact typed cells, correlated coverage and private denial',()=>{
 const contract=resolveOperationContract({id:'query_capiro_data',version:'0.3.0'}),page=capiroDataPage();
 page.relationsUsed=publicNames;
 page.coverage.relations=publicNames.map(name=>({...structuredClone(page.coverage.relations[0]),name}));
 assert.deepEqual(contract.assertOutput(page,{request:requests.query_capiro_data}),page);
 const missing=structuredClone(page);missing.coverage.relations.pop();assert.throws(()=>contract.assertOutput(missing,{request:requests.query_capiro_data}));
 const extra=structuredClone(page);extra.relationsUsed.push('sixteenth');extra.coverage.relations.push({...extra.coverage.relations[0],name:'sixteenth'});
 assert.throws(()=>contract.assertOutput(extra,{request:requests.query_capiro_data}));
 const invalid=structuredClone(page);invalid.rows[0].count=9007199254740992;
 assert.throws(()=>contract.assertOutput(invalid,{request:requests.query_capiro_data}));
 const privateRequest={...requests.query_capiro_data,source:'client_records'};
 assert.throws(()=>contract.assertOutput(page,{request:privateRequest,...context}));
});

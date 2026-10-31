import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {capiroDataCase} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {profileReads,resolveAvailableReads} from '../availability.mjs';
import {advertisedArguments} from '../schema.mjs';

const names=['congress_bills','congress_bill_subjects','congress_bill_cosponsors','congress_members',
 'program_elements','program_element_projects','program_element_budget_positions','program_element_project_budget_positions',
 'state_bills','committee_hearings','committee_hearing_bills','legislative_agenda_items','state_bill_calendar_events','federal_grants','sam_opportunities'];
for(const source of ['public','client_records'])test(`SQL successor uses the actual SDK/control/native receiver for ${source}`,async t=>{
 const request=source==='public'?{relations:names}:{source,relations:['client_objectives']};
 const scene=capiroDataCase('describe_capiro_data',{version:'0.3.0',request});
 if(source==='public')scene.page.relations=names.map(name=>({...structuredClone(scene.page.relations[0]),name}));
 const f=await fixture(scene.family,'describe_capiro_data',{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),['describe_capiro_data']);
 assert.deepEqual(advertisedArguments(scene.contract.descriptor.inputSchema).arguments.parse(request),request);
 const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const envelope=JSON.parse(out.content[0].text);
 assert.equal(envelope.operation.version,'0.3.0');assert.deepEqual(envelope.result,scene.page);
 assert.equal(scene.wire.length,1);assert.deepEqual(scene.wire[0].body,request);assert.equal(m.runtime.receipts().length,1);
});

const old={id:'describe_capiro_data',version:'0.2.0'},current={...old,version:'0.3.0'};
const policy={generalReads:true,readFamilies:['capiro-data','capiro-data-v3'],activeReadOperations:[old,current]};
const setup={policy,installation:{operations:[old,current]},discovery:{operations:[old,current]},scopes:[]};
test('both installed versions expose one current SDK name while exact old skill selection stays old',()=>{
 assert.deepEqual(profileReads({policy}).map(row=>row.operation),[current]);
 assert.deepEqual(resolveAvailableReads(setup).available.map(row=>row.operation),[current]);
 assert.deepEqual(profileReads({policy,narrowTo:[old]}).map(row=>row.operation),[old]);
 assert.deepEqual(resolveAvailableReads({...setup,narrowTo:[old]}).available.map(row=>row.operation),[old]);
 assert.deepEqual(resolveAvailableReads({...setup,installation:{operations:[old]}}).available.map(row=>row.operation),[old]);
 assert.deepEqual(resolveAvailableReads({...setup,discovery:{operations:[old]}}).available,[]);
 assert.deepEqual(profileReads({policy:{...policy,activeReadOperations:[]}}),[]);
});

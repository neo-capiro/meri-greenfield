import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {capiroDataCase} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {profileReads,resolveAvailableReads} from '../availability.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../../../../../packages/contracts/retrieval-0.2/capiro-data-validation.mjs';

test('private meeting description traverses the actual SDK/control/native receiver with all fifteen names',async t=>{
 const names=[...RETAINED_CAPIRO_PRIVATE_RELATIONS,'client_meetings'],request={source:'client_records',relations:names};
 const scene=capiroDataCase('describe_capiro_data',{version:'0.4.0',request});
 scene.page.relations=names.map(name=>({...structuredClone(scene.page.relations[0]),name}));
 const f=await fixture(scene.family,'describe_capiro_data',{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),['describe_capiro_data']);
 const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const envelope=JSON.parse(out.content[0].text);assert.equal(envelope.operation.version,'0.4.0');
 assert.deepEqual(envelope.result,scene.page);assert.deepEqual(scene.wire[0].body,request);assert.equal(m.runtime.receipts().length,1);
});

test('three installed SQL versions expose one tool; retained installations work without downgrading a discovery denial',()=>{
 const refs=['0.2.0','0.3.0','0.4.0'].map(version=>({id:'describe_capiro_data',version}));
 const policy={generalReads:true,readFamilies:['capiro-data','capiro-data-v3','capiro-data-v4'],activeReadOperations:refs};
 const input={policy,installation:{operations:refs},discovery:{operations:refs},scopes:[]};
 assert.deepEqual(profileReads({policy}).map(r=>r.operation),[refs[2]]);
 assert.deepEqual(resolveAvailableReads(input).available.map(r=>r.operation),[refs[2]]);
 for(const ref of refs)assert.deepEqual(profileReads({policy,narrowTo:[ref]}).map(r=>r.operation),[ref]);
 assert.deepEqual(resolveAvailableReads({...input,installation:{operations:refs.slice(0,2)}}).available.map(r=>r.operation),[refs[1]]);
 assert.deepEqual(profileReads({policy:{...policy,activeReadOperations:refs.slice(0,2)}}).map(r=>r.operation),[refs[1]]);
 assert.deepEqual(resolveAvailableReads({...input,discovery:{operations:refs.slice(0,2)}}).available,[]);
});

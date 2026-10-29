import test from 'node:test';
import assert from 'node:assert/strict';
import wire from './fixtures/graph-paths.wire.json' with {type:'json'};
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
const contract=resolveOperationContract({id:'find_path_to',version:'0.2.0'});
for(const [name,vector] of [['client',wire],['General',wire.general]])test(`actual PostgreSQL-backed Core ${name} wire`,()=>{
 assert.doesNotThrow(()=>contract.assertOutput(vector.response,{request:vector.request}));
 assert.deepEqual(contract.normalizeInput(vector.request).input,vector.request);
});
const mutate=(label,change)=>test(label,()=>{
 const {request,response}=structuredClone(wire);contract.assertOutput(response,{request});change(response,request);
 assert.throws(()=>contract.assertOutput(response,{request}));
});
mutate('wrong exact target',r=>{r.target='bill:119-hr-2';});
mutate('foreign client scope',r=>{r.clientId='ffffffff-ffff-4fff-8fff-ffffffffffff';});
mutate('depth drift',r=>{r.coverage.maxDepth=4;});
mutate('historical claim from current source',r=>{r.temporalCoverage='historical';});
mutate('truncated result marked complete',r=>{r.coverage.reasons.push('path_limit');});
mutate('source reference omitted',r=>{r.paths[0].edges[0].sources=[];});
mutate('source reference duplicated',r=>{r.paths[0].edges[0].sources.push(r.paths[0].edges[0].sources[0]);});
mutate('contact points at another canonical record',r=>{r.paths[0].edges[0].sources[0].id='other';});
mutate('thematic mention presented as direct',r=>{r.paths[0].edges[1].basis='direct';r.paths[0].basis='direct';});
mutate('path aggregate upgraded without changing the source edge',r=>{r.paths[0].basis='direct';});
mutate('disconnected route',r=>{r.paths[0].edges[1].src='person:unrelated';});
mutate('inaccessible intermediate client',r=>{r.paths[0].nodes[1]={id:'client:ffffffff-ffff-4fff-8fff-ffffffffffff',type:'client',label:'foreign'};});
mutate('duplicate root paths',r=>{r.paths.push(structuredClone(r.paths[0]));r.coverage.clientsSearched=2;});
mutate('summary claims a different count',r=>{r.summary='Target does not exist.';});
mutate('unexpected authority material',r=>{r.credentials='forged';});
test('strict input has no authority, historical window, lossy target or clamped depth',()=>{
 for(const patch of [{tenantId:'forged'},{normalizationContext:{}},{to:' bill:119-hr-1'},{depth:6},{depth:'3'},{windowStart:'2020-01-01'},{clientId:''}])
  assert.throws(()=>contract.normalizeInput({...wire.request,...patch}));
 assert.throws(()=>contract.normalizeInput(wire.request,{clientId:wire.request.clientId}));
});
test('source limits stay partial while exact references remain unchanged',()=>{
 const {request,response}=structuredClone(wire);response.coverage.state='partial';response.coverage.reasons=['memory_items_row_limit'];
 assert.doesNotThrow(()=>contract.assertOutput(response,{request}));
});

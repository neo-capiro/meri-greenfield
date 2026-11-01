import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {CONNECTED_APP_OPERATION_IDS} from '../retrieval-0.2/connected-apps-validation.mjs';

// Literal synthetic DATA only: the connected-app read contract as every Core connection state projects it.
const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const inputSchema={type:'object',additionalProperties:false,properties:{query:{type:'string'}},required:['query']};
const capability={connectionId:uuid('d'),provider:'slack',tool:'search_messages',inputSchema,schemaHash:createHash('sha256').update(JSON.stringify(inputSchema)).digest('hex')};
const read=resolveOperationContract({id:'read_connected_app',version:'0.2.0'}),list=resolveOperationContract({id:'list_connected_app_reads',version:'0.2.0'});
const readRequest=(clientId=null)=>({clientId,connectionId:capability.connectionId,provider:capability.provider,tool:capability.tool,schemaHash:capability.schemaHash,arguments:{query:'quarterly'}});
const providerResult={content:[{type:'text',text:'Quarterly plan'}]};
const readPage=(fields,clientId=null)=>({operation:'read_connected_app',clientId,connectionId:capability.connectionId,provider:capability.provider,tool:capability.tool,schemaHash:capability.schemaHash,
 observedAt:'2026-11-01T00:00:00.000Z',status:'ok',untrusted:true,scope:'connection_permissions',completeness:'provider_page',content:'Untrusted text',providerResult,reason:null,...fields});
const listPage=(fields,clientId=null)=>({operation:'list_connected_app_reads',clientId,observedAt:'2026-11-01T00:00:00.000Z',status:'ok',untrusted:true,complete:false,
 scope:'current_connection_catalog',managedAvailability:'ok',capabilities:[capability],...fields});

test('exactly the two connected-app reads exist, read-only and approval-free',()=>{
 assert.deepEqual(CONNECTED_APP_OPERATION_IDS,['list_connected_app_reads','read_connected_app']);
 for(const c of [read,list]){assert.equal(c.binding.group,'connected-apps');assert.equal(c.descriptor.sideEffect,'none');assert.equal(c.descriptor.approvalBoundary,'none');}
});

/** Every (status, reason, content, providerResult) combination the read page may carry: `valid` rows are the
 * exact Core projections of a connection state; every other row must be refused. */
const READ_MATRIX=[
 ['connected ok',{status:'ok',reason:null},true],
 ['ok with a reason',{status:'ok',reason:'provider_reported_error'},false],
 ['ok without provider result',{status:'ok',providerResult:null},false],
 ['connected oversized result',{status:'partial',reason:'provider_result_exceeds_safe_json_boundary',providerResult:null},true],
 ['partial keeping a provider result',{status:'partial',reason:'provider_result_exceeds_safe_json_boundary'},false],
 ['partial with another reason',{status:'partial',reason:'provider_reported_error',providerResult:null},false],
 ['connected provider denial',{status:'unavailable',reason:'provider_reported_error',providerResult:{isError:true,content:[]}},true],
 ['connected non-object result',{status:'unavailable',reason:'provider_result_unavailable',providerResult:null},true],
 ['non-object result smuggling a provider result',{status:'unavailable',reason:'provider_result_unavailable'},false],
 ['error or disabled row (schema unavailable)',{status:'unavailable',reason:'current_read_schema_unavailable',content:null,providerResult:null},true],
 ['schema unavailable with content',{status:'unavailable',reason:'current_read_schema_unavailable',providerResult:null},false],
 ['unavailable with a connection reason',{status:'unavailable',reason:'connection_disconnected',content:null,providerResult:null},false],
 ['disconnected or pending row',{status:'disconnected',reason:'connection_disconnected',content:null,providerResult:null},true],
 ['disconnected with content',{status:'disconnected',reason:'connection_disconnected',providerResult:null},false],
 ['disconnected with a provider result',{status:'disconnected',reason:'connection_disconnected',content:null},false],
 ['disconnected claiming permission reason',{status:'disconnected',reason:'connection_permission_required',content:null,providerResult:null},false],
 ['needs_reauth row',{status:'permission_required',reason:'connection_permission_required',content:null,providerResult:null},true],
 ['permission required with content',{status:'permission_required',reason:'connection_permission_required',providerResult:null},false],
 ['permission required claiming disconnected reason',{status:'permission_required',reason:'connection_disconnected',content:null,providerResult:null},false],
 ['unknown status',{status:'connected'},false],
 ['unknown reason',{status:'unavailable',reason:'token_expired',content:null,providerResult:null},false],
];
for(const [label,fields,valid] of READ_MATRIX)test(`read page: ${label} is ${valid?'accepted':'refused'}`,()=>{
 const page=readPage(fields),request=readRequest();
 if(valid)assert.deepEqual(read.assertOutput(page,{request}),page);else assert.throws(()=>read.assertOutput(page,{request}));
});

test('a read page is bound to the exact request: client, connection, provider, tool and schema hash',()=>{
 const request=readRequest(uuid('a'));
 assert.deepEqual(read.assertOutput(readPage({},uuid('a')),{request}),readPage({},uuid('a')));
 for(const [key,value] of [['clientId',null],['clientId',uuid('b')],['connectionId',uuid('e')],['provider','hubspot'],['tool','other'],['schemaHash','0'.repeat(64)],['operation','list_connected_app_reads']])
  assert.throws(()=>read.assertOutput({...readPage({},uuid('a')),[key]:value},{request}),`${key} substitution`);
});

test('the directory lists usable authenticated reads only: ok means at least one capability, never inventory',()=>{
 assert.deepEqual(list.assertOutput(listPage({}),{request:{clientId:null}}),listPage({}));
 for(const state of ['partial','unavailable','no_eligible'])assert.deepEqual(list.assertOutput(listPage({managedAvailability:state}),{request:{clientId:null}}).managedAvailability,state);
 assert.deepEqual(list.assertOutput(listPage({status:'unavailable',capabilities:[]}),{request:{clientId:null}}).capabilities,[]);
 for(const [label,fields] of [
  ['ok with no capability',{capabilities:[]}],
  ['unavailable with a capability',{status:'unavailable'}],
  ['unknown managed availability',{managedAvailability:'connected'}],
  ['duplicate connection and tool',{capabilities:[capability,{...capability}]}],
  ['schema bytes substituted behind the hash',{capabilities:[{...capability,inputSchema:{type:'object'}}]}],
  ['non-object schema',{capabilities:[{...capability,inputSchema:{type:'string'},schemaHash:createHash('sha256').update(JSON.stringify({type:'string'})).digest('hex')}]}],
  ['another client',{clientId:uuid('b')}],
  ['complete claimed',{complete:true}],
 ])assert.throws(()=>list.assertOutput(listPage(fields),{request:{clientId:null}}),label);
});

test('requests carry literal selectors only: no endpoint, URL, header or credential field at any depth',()=>{
 const normalized=read.normalizeInput(readRequest(),{});
 assert.deepEqual(normalized.input,readRequest());assert.deepEqual(normalized.metadata,{scope:'connection_permissions',absenceEvidence:false});
 for(const key of ['endpoint','base_url','baseUrl','server_url','serverUrl','authorization','auth','headers','header','access_token','accessToken','api_key','apiKey','credentials','credential'])
  assert.throws(()=>read.normalizeInput({...readRequest(),arguments:{query:'x',[key]:'value'}},{}),key);
 for(const nested of [{query:'x',filter:{endpoint:'x'}},{query:'x',filter:[{api_key:'x'}]}])assert.throws(()=>read.normalizeInput({...readRequest(),arguments:nested},{}));
 for(const value of ['https://other.invalid','http://127.0.0.1','file:///etc/passwd','data://x'])assert.throws(()=>read.normalizeInput({...readRequest(),arguments:{query:value}},{}),value);
 assert.throws(()=>read.normalizeInput({...readRequest(),arguments:JSON.parse('{"__proto__":{"query":"x"},"query":"x"}')},{}));
 assert.throws(()=>read.normalizeInput({...readRequest(),endpoint:'https://other.invalid'},{}),'no top-level URL field exists');
 assert.throws(()=>read.normalizeInput({...readRequest(),arguments:{query:'x'.repeat(40000)}},{}),'bounded request bytes');
 assert.throws(()=>list.normalizeInput({clientId:null,endpoint:'https://other.invalid'},{}));
});

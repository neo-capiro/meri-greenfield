import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {fixture,uuid} from './reads-native-fixture.mjs';

const inputSchema={type:'object',additionalProperties:false,properties:{query:{type:'string'},cursor:{type:'string'}},required:['query']};
const capability={connectionId:uuid('d'),provider:'slack',tool:'search_messages',inputSchema,
 schemaHash:createHash('sha256').update(JSON.stringify(inputSchema)).digest('hex')};
function scene(id='read_connected_app',{general=false}={}){
 const f=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const a=f.authority;
 if(general){Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],
  scopes:[{tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision}]});}
 else Object.assign(a.subject,{kind:'client',entityType:'client',entityIds:[uuid('a')],
  scopes:[{tenantId:a.binding.tenantId,kind:'client',resourceId:uuid('a'),policyRevision:a.policyRevision}]});
 const clientId=general?null:a.subject.entityIds[0];
 const request=id==='list_connected_app_reads'?{clientId}:{clientId,connectionId:capability.connectionId,
  provider:capability.provider,tool:capability.tool,schemaHash:capability.schemaHash,arguments:{query:'quarterly',cursor:'page-2'}};
 a.decision.operation=`${id}@0.2.0`;a.sourceIds=['connected_app_reads'];
 const page=id==='list_connected_app_reads'?{operation:id,clientId,observedAt:new Date(f.now()).toISOString(),status:'ok',
  untrusted:true,complete:false,scope:'current_connection_catalog',managedAvailability:'ok',capabilities:[capability]}:
 {operation:id,clientId,connectionId:capability.connectionId,provider:capability.provider,tool:capability.tool,
  schemaHash:capability.schemaHash,observedAt:new Date(f.now()).toISOString(),status:'ok',untrusted:true,scope:'connection_permissions',
  completeness:'provider_page',reason:null,content:'Untrusted quarterly text',
  providerResult:{content:[{type:'text',text:'Quarterly plan'}],structuredContent:{messages:[{id:'m2',text:'Quarterly plan'}],next_cursor:'page-3',has_more:true}}};
 const transport={...f.transport,async fetchImpl(url,options){
  f.wire.push({url,options,body:JSON.parse(options.body)});const result=structuredClone(f.state.page??page);
  f.state.afterSource?.();return f.state.responseFactory?f.state.responseFactory(result):Response.json(result);
 }};
 return {...f,family:'connected-apps',operation,contract,arguments:request,normalizationContext:{},page,transport};
}

for(const general of [true,false])for(const id of ['list_connected_app_reads','read_connected_app'])
 test(`${id}: ${general?'General':'selected client'} actual current runtime and fixed HTTP source`,async()=>{
  const s=scene(id,{general}),f=await fixture('connected-apps',id,{scene:s}),r=await f.execute();
  assert.equal(r.status,200,await r.clone().text());
  const out=JSON.parse((await r.json()).resultJson).result;
  assert.deepEqual(out,s.page);assert.deepEqual(s.wire[0].body,s.arguments);
  assert.equal(f.calls.filter(path=>path.endsWith('/application-authority/current')).length,2);
  assert.equal(s.wire.length,1);
 });
test('provider continuation stays exact; result schema/connection substitution is refused',()=>{
 const s=scene(),c=s.contract;
 assert.equal(c.assertOutput(s.page,{request:s.arguments}).providerResult.structuredContent.next_cursor,'page-3');
 for(const key of ['clientId','connectionId','schemaHash','provider','tool'])
  assert.throws(()=>c.assertOutput({...s.page,[key]:key==='schemaHash'?'0'.repeat(64):key.endsWith('Id')?uuid('f'):'other'},{request:s.arguments}));
 assert.throws(()=>c.assertOutput({...s.page,status:'ok',providerResult:null},{request:s.arguments}));
});
test('another selected client and credential/URL arguments are refused before provider HTTP',async()=>{
 const s=scene(),f=await fixture('connected-apps','read_connected_app',{scene:s});
 for(const changes of [{clientId:uuid('f')},{arguments:{query:'x',endpoint:'https://other.invalid'}},{arguments:{query:'https://other.invalid'}}]){
  const r=await f.execute({...s.arguments,...changes});assert.notEqual(r.status,200);assert.equal(s.wire.length,0);
 }
});
test('General cannot acquire a client grant by filling a selector',async()=>{
 const s=scene('read_connected_app',{general:true}),f=await fixture('connected-apps','read_connected_app',{scene:s});
 const r=await f.execute({...s.arguments,clientId:uuid('f')});assert.notEqual(r.status,200);assert.equal(s.wire.length,0);
});
test('execution revoked during source prevents late content release',async()=>{
 const s=scene(),f=await fixture('connected-apps','read_connected_app',{scene:s});s.state.afterSource=f.revoke;
 const r=await f.execute();assert.equal(r.status,403);assert.equal((await r.json()).resultJson,undefined);assert.equal(s.wire.length,1);
});
test('current Core denial is not repaired by earlier availability',async()=>{
 const s=scene(),f=await fixture('connected-apps','read_connected_app',{scene:s});f.deny();
 const r=await f.execute();assert.equal(r.status,403);assert.equal((await r.json()).resultJson,undefined);
});
test('disconnected/permission/partial outcomes retain their exact limited meaning',()=>{
 const s=scene();
 for(const [status,reason] of [['disconnected','connection_disconnected'],['permission_required','connection_permission_required'],
  ['partial','provider_result_exceeds_safe_json_boundary'],['unavailable','provider_result_unavailable']]){
  const page={...s.page,status,reason,content:null,providerResult:null};
  assert.equal(s.contract.assertOutput(page,{request:s.arguments}).status,status);
  assert.throws(()=>s.contract.assertOutput({...page,providerResult:{}},{request:s.arguments}));
 }
});
test('catalog refuses schema bytes substituted behind a retained hash',()=>{
 const s=scene('list_connected_app_reads');
 assert.throws(()=>s.contract.assertOutput({...s.page,capabilities:[{...capability,inputSchema:{type:'object'}}]},{request:s.arguments}));
});

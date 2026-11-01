import test from 'node:test';
import assert from 'node:assert/strict';
import {connectedAppScene as scene,CAPABILITY as capability} from '../../gateway/general-reads/test/connected-apps-fixture.mjs';
import {fixture,uuid} from './reads-native-fixture.mjs';

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

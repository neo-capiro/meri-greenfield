import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeTaskClientResolver} from '../task-client-reference.mjs';
import {createNativeTaskPreparers} from '../native-task-preparers.mjs';
import {binding as seed,id} from '../../../control/conversations/test/store-fixture.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';
const binding={...seed,tenantId:id(80),actorId:id(81)};
const at=1800000000000,clientId=id(5),other=id(6),principal={tenantId:binding.tenantId,actorId:binding.actorId};
function fixture(general=true){
 const state={now:at,credential:'synthetic-native',expiresAtMs:at+30000,requests:[],visible:[clientId,other],resolved:clientId,onResponse:null};
 const selectedClientId=general?null:clientId,now=()=>state.now;
 const nativeCredentials={nativeCredentialFor(){if(!state.credential)throw Error('no session');return {credential:state.credential,expiresAtMs:state.expiresAtMs};}};
 const resolve=createNativeTaskClientResolver({origin:'https://core.invalid',nativeCredentials,now,maxRequestMs:3000,async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.requests.push({path,body,authorization:init.headers.authorization});await state.onResponse?.(path);
  const identity={principal,identityRevision:'a'.repeat(64),checkedAtMs:now(),expiresAtMs:at+30000};
  if(path.endsWith('/identity'))return Response.json(identity);
  if(path.endsWith('/check-ref'))return Response.json({ok:true,clientId:state.resolved},{status:201});
  assert(path.endsWith('/current'));
  return Response.json({...identity,role:'standard_user',permissions:[],clientIds:state.visible,membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId});
 }});
 const call={binding,selectedClientId,reference:'Reviewed client',deadlineMs:at+10000};
 return {state,now,resolve,call};
}
for(const general of [false,true])for(const reference of ['Reviewed client',clientId])test(`${general?'General':'client'} task resolves ${reference===clientId?'UUID':'name'} through current Core visibility`,async()=>{
 const f=fixture(general),r=await f.resolve({...f.call,reference});
 assert.deepEqual(r,{reference,clientId,checkedAtMs:at,expiresAtMs:at+3000});
 assert.equal(f.state.requests.filter(x=>x.path.endsWith('/check-ref')).length,1);
 assert(f.state.requests.every(x=>x.authorization==='Bearer synthetic-native'));
});
for(const failure of ['hidden','wall changes','session replaced','session revoked','selected mismatch','deadline'])test(`task client resolution refuses ${failure}`,async()=>{
 const f=fixture(failure!=='selected mismatch');
 if(failure==='hidden')f.state.visible=[];
 if(failure==='selected mismatch')f.state.resolved=other;
 f.state.onResponse=path=>{if(path.endsWith('/check-ref')){
  if(failure==='wall changes')f.state.visible=[];
  if(failure==='session replaced')f.state.credential='replacement';
  if(failure==='session revoked')f.state.credential=null;
  if(failure==='deadline')f.state.now=at+3001;
 }};
 await assert.rejects(f.resolve(f.call),e=>e.effect==='none');
});
test('task client resolution limits the receipt to the final live session expiry',async()=>{
 const f=fixture();
 f.state.onResponse=path=>{if(path.endsWith('/check-ref'))f.state.expiresAtMs=at+1000;};
 const result=await f.resolve(f.call);
 assert.equal(result.expiresAtMs,at+1000);
 assert.equal(result.clientId,clientId);
});
async function preparerFixture(){
 const core=fixture(),sql=createMetadataPoolFixture(),state={resolves:0,change:false};
 const pool={options:sql.pool.options,async connect(){const c=await sql.pool.connect();return {async query(q){return typeof q==='string'?{rows:[]}:c.query(q);},release:e=>c.release(e)};}};
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const [preparer]=createNativeTaskPreparers({pool,binding,scopes,selectedClientId:null,policyRevision:'p1',expiresAtMs:at+30000,now:core.now,maxRequestMs:3000,
  async currentRights(){return {...principal,scopes,checkedAtMs:at,expiresAtMs:at+30000};},
  async resolveClientReference(value){state.resolves++;if(state.change&&state.resolves>1)core.state.resolved=other;return core.resolve({...value,binding,selectedClientId:null});}});
 return {core,sql,state,prepare:arguments_=>preparer.prepare({arguments:arguments_,deliveryId:'sdk:'+'a'.repeat(64),signal:new AbortController().signal})};
}
test('General task preparation retains explicit Core resolution and rechecks it before release',async()=>{
 const f=await preparerFixture(),r=await f.prepare({title:'Task',clientId:'Reviewed client'});
 assert.equal(r.proposal.command.arguments.clientId,clientId);assert.equal(f.state.resolves,2);assert.equal(f.sql.rows.size,1);
 const row=[...f.sql.rows.values()][0];assert.deepEqual(row.payload.commandContext.clientResolution,{reference:'Reviewed client',clientId});
});
test('changed named destination does not release a prepared task for another client',async()=>{
 const f=await preparerFixture();f.state.change=true;await assert.rejects(f.prepare({title:'Task',clientId:'Reviewed client'}),e=>e.effect==='unknown');
 assert.equal(f.state.resolves,2);
 assert.equal(f.sql.rows.size,1);
});
test('omitted client remains personal and performs no client resolution',async()=>{
 const f=await preparerFixture(),r=await f.prepare({title:'Personal task'});
 assert.equal(r.proposal.command.arguments.clientId,null);assert.equal(f.state.resolves,0);assert.equal(f.core.state.requests.length,0);
});

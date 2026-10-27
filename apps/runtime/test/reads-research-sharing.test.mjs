/** Mounted native read with synthetic current Core and HTTP boundaries. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,uuid} from './reads-native-fixture.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const id='get_research_portfolio_share_links',family='research-portfolio-sharing';
async function setup({selected=false}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),client=uuid('5');
 scene.family=family;scene.operation=operation;scene.contract=contract;scene.arguments={conversationId:scene.binding.conversationId};
 scene.authority.sourceIds=['research_portfolios'];scene.authority.decision.operation=id+'@0.2.0';
 if(selected){scene.authority.subject.kind='client';scene.authority.subject.entityType='client';scene.authority.subject.entityIds=[client];scene.authority.subject.scopes=[{tenantId:scene.binding.tenantId,kind:'client',resourceId:client,policyRevision:scene.authority.policyRevision}];}
 scene.visibleClientIds=[client];
 scene.state.page={sharing:{portfolioId:uuid('6'),enabled:true,tenantEnabled:true,pinSet:true,pinUpdatedAt:null,activeLinkCount:0,updatedAt:null},links:[]};
 scene.transport.fetchImpl=async(url,options)=>{scene.wire.push({url,options});assert.deepEqual(JSON.parse(options.body),scene.arguments);const out=structuredClone(scene.state.page);scene.state.afterSource?.();return Response.json(out);};
 return fixture(family,id,{scene});
}
test('actual native discovery and read serve only conversation-bound redacted metadata',async()=>{
 for(const selected of [false,true]){const f=await setup({selected}),r=await f.execute();assert.equal(r.status,200,JSON.stringify({body:await r.clone().text(),calls:f.calls,wires:f.scene.wire.length}));
  const out=JSON.parse((await r.json()).resultJson);assert.equal(out.result.sharing.pinSet,true);assert.deepEqual(out.result.links,[]);assert.equal(f.calls.filter(p=>p==='/api/clio/tools/'+id).length,1);
 }
});
test('foreign conversation and revoked current authority withhold the read',async()=>{
 const foreign=await setup();assert.notEqual((await foreign.execute({conversationId:uuid('9')})).status,200);assert.equal(foreign.scene.wire.length,0);
 const revoked=await setup();revoked.scene.state.afterSource=revoked.revoke;assert.notEqual((await revoked.execute()).status,200);
});
test('unknown capability and PIN fields in producer output refuse instead of trimming',async()=>{
 for(const key of ['sharePath','token','pin']){const f=await setup();f.scene.state.page[key]='synthetic-secret';const r=await f.execute();assert.notEqual(r.status,200);assert.equal((await r.text()).includes('synthetic-secret'),false);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
const exact=JSON.parse(readFileSync(new URL('./producer-pages.json',import.meta.url))).rows.find(row=>row.name==='exact');
function sceneFor(id='get_florida_budget_project',request={fiscalYear:'2026-27',projectId:'project',clientId:null}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const data={scope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},fiscalYear:'2026-27',projects:[],documents:[],events:[],nextOffset:null,
  amounts:[exact.page.data.left,exact.page.data.right].map(observation=>({id:observation.id,observation})),notice:'Selected publisher evidence. Requests and chamber alternatives are not awards. No statewide aggregate is inferred.'};
 const page=id==='get_florida_budget_project'?{tool:id,generatedAt:new Date(scene.now()).toISOString(),result:data,authority:'Stored publisher evidence'}:exact.page;
 Object.assign(scene,{operation,contract,family:id==='get_florida_budget_project'?'florida-budget':'legislative-comparisons',arguments:request,normalizationContext:{},page});
 scene.authority.decision.operation=`${id}@0.2.0`;scene.authority.sourceIds=contract.descriptor.sourceRequirements.map(source=>source.sourceId);
 scene.transport={...scene.transport,async fetchImpl(url,options){scene.wire.push({url,options,body:JSON.parse(options.body)});return Response.json(page);}};
 return scene;
}
test('actual native project reader exposes exact source IDs/revisions used by comparison',async t=>{
 const scene=sceneFor(),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);const read=await m.call();assert.equal(read.isError,undefined,JSON.stringify(read));
 const amounts=JSON.parse(read.content[0].text).result.result.amounts;
 assert.deepEqual(amounts.map(row=>row.observation),[exact.page.data.left,exact.page.data.right]);
 assert.equal(f.scene.wire.length,1);
 const context=JSON.parse(Buffer.from(scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.deepEqual(context.normalizationContext.legiwatchReviewScope,{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)});
 const request={...exact.input,leftId:amounts[0].id,leftRevision:amounts[0].observation.sourceRevision,rightId:amounts[1].id,rightRevision:amounts[1].observation.sourceRevision};
 const comparison=sceneFor('compare_florida_budget_amounts',request),g=await fixture(comparison.family,comparison.operation.id,{scene:comparison,privateUser:true}),n=await connect(t,g);
 const result=await n.call();assert.equal(result.isError,undefined,JSON.stringify(result));assert.deepEqual(JSON.parse(result.content[0].text).result,exact.page);
});
test('native project read refuses a non-visible client selector before source IO',async t=>{
 const scene=sceneFor(),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);
 const result=await m.call({...scene.arguments,clientId:'20000000-0000-4000-8000-000000000099'});
 assert.equal(result.isError,true);assert.equal(scene.wire.length,0);assert.equal(m.runtime.receipts().length,0);
});

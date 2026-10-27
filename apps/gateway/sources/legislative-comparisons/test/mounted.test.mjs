import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
const {rows}=JSON.parse(readFileSync(new URL('./producer-pages.json',import.meta.url)));
function sceneFor(name){
 const row=rows.find(r=>r.name===name),scene=billTextCase(),operation={id:row.id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const {authority,state,now,wire}=scene,request=structuredClone(row.input),page=structuredClone(row.page);
 authority.decision.operation=`${row.id}@0.2.0`;authority.sourceIds=contract.descriptor.sourceRequirements.map(s=>s.sourceId);
 const normalizationContext={legiwatchReviewScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(page);state.resultMutator?.(value);state.afterSource?.();return Response.json(value);}};
 return {...scene,family:'legislative-comparisons',operation,contract,arguments:request,normalizationContext,transport,page,visibleClientIds:[],now};
}
for(const name of ['exact','versions'])test(`${name}: actual MCP/control/current native read releases the unchanged canonical comparison`,async t=>{
 const scene=sceneFor(name),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);const result=await m.call();assert.equal(result.isError,undefined,JSON.stringify(result));
 assert.deepEqual(JSON.parse(result.content[0].text).result,scene.page);assert.equal(m.runtime.receipts().length,1);
 assert.equal(scene.wire.length,1);assert.deepEqual(scene.wire[0].body,scene.arguments);
 const context=JSON.parse(Buffer.from(scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.deepEqual(context.normalizationContext,scene.normalizationContext);assert.equal(context.subject.kind,'personal');
});
test('current access loss after source withholds comparison and receipt',async t=>{
 const scene=sceneFor('exact'),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);
 scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);
});
test('stale source revision cannot become a tool result or receipt',async t=>{
 const scene=sceneFor('versions'),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);
 scene.state.resultMutator=page=>{page.data.right.revision='stale';};
 assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);
});

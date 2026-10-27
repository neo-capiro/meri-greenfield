import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
const {rows}=JSON.parse(readFileSync(new URL('./brief-producer-pages.json',import.meta.url)));

for(const name of ['saved-brief','snapshot_only'])test(`${name}: mounted native read preserves explicit Core conversation and saved-source meaning`,async t=>{
 const row=rows.find(value=>value.name===name),scene=billTextCase(),operation={id:row.id,version:'0.2.0'},contract=resolveOperationContract(operation);
 scene.operation=operation;scene.contract=contract;scene.family='business-development';scene.arguments=structuredClone(row.input);scene.normalizationContext={};
 scene.authority.decision.operation=`${row.id}@0.2.0`;scene.authority.sourceIds=contract.descriptor.sourceRequirements.map(source=>source.sourceId);
 scene.transport={...scene.transport,async fetchImpl(url,options){scene.wire.push({url,body:JSON.parse(options.body)});return Response.json(row.page);}};
 const f=await fixture(scene.family,row.id,{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);const response=await m.call();assert.equal(response.isError,undefined,JSON.stringify(response));
 assert.deepEqual(JSON.parse(response.content[0].text).result,row.page);assert.equal(m.runtime.receipts().length,1);
 assert.equal(scene.wire.length,1);assert.deepEqual(scene.wire[0].body,row.input);assert.notEqual(row.input.conversationId,f.binding.conversationId);
 assert.ok(scene.wire[0].url.endsWith(`/api/clio/tools/${row.id}`));
});

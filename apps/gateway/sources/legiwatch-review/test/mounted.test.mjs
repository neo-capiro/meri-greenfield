import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {createRoutineReadContext} from '../../../../runtime/objective-generation/read-context.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {legiwatchCase,clientId} from './fixture.mjs';
const id='get_legiwatch_review';
for(const view of ['folders','suggestions','rules','workflows'])test(`${view}: mounted MCP/native read preserves exact owner data and current correlation`,async t=>{
 const scene=legiwatchCase({view}),f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);const r=await m.call();assert.equal(r.isError,undefined,JSON.stringify(r));assert.deepEqual(JSON.parse(r.content[0].text).result,scene.page);assert.equal(m.runtime.receipts().length,1);assert.equal(scene.wire.length,1);
 assert.deepEqual(scene.wire[0].body,scene.arguments);assert.ok(scene.wire[0].url.endsWith('/api/clio/tools/get_legiwatch_review'));
 const c=JSON.parse(Buffer.from(scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.equal(c.subject.kind,'personal');assert.deepEqual(c.normalizationContext,scene.normalizationContext);
});
test('current access loss after source withholds data and receipt',async t=>{
 const scene=legiwatchCase(),f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);assert.equal(scene.wire.length,1);
});
test('selected-client mismatch and saved-job revisions cannot manufacture a current grant',async t=>{
 const scene=legiwatchCase({selected:true}),f=await fixture(scene.family,id,{scene}),m=await connect(t,f);scene.arguments.clientId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,0);
 const a=scene.authority,owner=createRoutineReadContext({record:{binding:a.binding,selectedClientId:null,expiresAtMs:scene.now()+5000},current:{role:'standard_user',clientIds:[clientId]},readSource:async()=>assert.fail('no saved job read'),policyRevision:a.policyRevision,approvedReads:{operations:[scene.operation]},now:scene.now});
 await assert.rejects(owner.nativeReadContextPorts.readCurrent({binding:a.binding,subject:a.subject,operation:scene.operation,request:scene.arguments,requestSha256:canonicalSha256(scene.arguments),policyRevision:a.policyRevision,sourceIds:a.sourceIds,deadlineMs:scene.now()+5000,signal:new AbortController().signal}));
});
test('wrong scope, nonexact continuation and multibyte overflow cannot become a receipt',async t=>{
 for(const mutate of [p=>p.selection.sessionKey='118',p=>p.data.rows[0].folder_id='other',p=>p.data.next='unbound',p=>p.data.rows[0].payload.bill.title='ç•Œ'.repeat(90000)]){
  const scene=legiwatchCase();scene.state.resultMutator=mutate;const f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);
 }
});
test('closed model schema and per-view normalization refuse authority/effect selectors',()=>{
 const scene=legiwatchCase(),schema=advertisedArguments(scene.contract.descriptor.inputSchema).arguments;
 assert.deepEqual(schema.parse(scene.arguments),scene.arguments);
 for(const extra of [{url:'https://foreign.invalid'},{tenantId:clientId},{action:'activate'},{normalizationContext:{}}])assert.equal(schema.safeParse({...scene.arguments,...extra}).success,false);
 assert.throws(()=>scene.contract.normalizeInput({view:'rules',clientId,folderId:'folder',cursor:'ignored'},scene.normalizationContext));
});
test('keyset continuation stays exact and preserves incomplete source evidence',()=>{
 const scene=legiwatchCase(),p=structuredClone(scene.page),row=p.data.rows[0];p.data.rows=Array.from({length:50},(_,i)=>({...structuredClone(row),id:`s${String(i+1).padStart(3,'0')}`}));p.data.next='s050';assert.doesNotThrow(()=>scene.contract.assertOutput(p,{request:scene.arguments,...scene.normalizationContext}));
 const next={...scene.arguments,cursor:'s050'},last=structuredClone(p);last.selection=next;last.data={rows:[{...row,id:'s051'}],next:null};scene.contract.assertOutput(last,{request:next,...scene.normalizationContext});assert.equal(last.data.rows[0].payload.coverage.complete,false);
});

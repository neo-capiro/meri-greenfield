/** Actual service, input journal and native next-run owner over scripted SQL; no DB, SDK or model invocation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,check} from './native-next-run-fixture.mjs';
import {MODEL_CATALOG,CLAUDE_SELECTION} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {hash} from '../boundary.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../../../../packages/contracts/user-preferences-application/document.mjs';
async function session(x,b){x.f.state.context.binding=b;return (await x.f.sessions.issue({identityCredential:'synthetic-native'})).credential;}
for(const terminal of ['failed','cancelled'])test('MP next input inherits the latest '+terminal+' request, separately from its older completed SDK donor',async()=>{
 const x=await nativeFixture();try{
  await x.complete();const second=(await x.select()).binding,credential=await session(x,second),input={requestId:id(750),prompt:'second',modelSelection:CLAUDE_SELECTION};
  const admitted=await x.f.service.admitInput({credential,input});assert.deepEqual(admitted.request.modelSelection,CLAUDE_SELECTION);await x.allocate(second);await x.running(second);
  await x.f.store.append(second,x.status(terminal),check);await x.settle(second);
  const third=(await x.select()).binding,reservation=await x.f.store.nextRuns.readTarget(third,check);assert.deepEqual(reservation.source,second);assert.deepEqual(reservation.facts.sdkSession.binding,binding);
  const document={...USER_PREFERENCE_DEFAULTS,defaultModel:MODEL_CATALOG.defaultSelection};x.f.state.userPreferences.set([binding.tenantId,binding.actorId].join(':'),{document,document_sha256:hash(document)});
  const nextCredential=await session(x,third),next={requestId:id(751),prompt:'third'};const out=await x.f.service.admitInput({credential:nextCredential,input:next});assert.deepEqual(out.request.modelSelection,CLAUDE_SELECTION);
  const replay=await x.f.service.admitInput({credential:nextCredential,input:next});assert.equal(replay.replayed,true);assert.deepEqual(replay.request,out.request);
 }finally{x.f.close();}
});
test('MP explicit later override changes only the new admitted request and original session scope remains exact',async()=>{
 const x=await nativeFixture();try{
  await x.complete();const before=await x.f.store.read(binding,{after:0,limit:1},check),target=(await x.select()).binding,credential=await session(x,target);
  const out=await x.f.service.admitInput({credential,input:{requestId:id(752),prompt:'override',modelSelection:CLAUDE_SELECTION}});
  assert.deepEqual(out.request.modelSelection,CLAUDE_SELECTION);assert.deepEqual(out.run.scopes,scopes);assert.deepEqual((await x.f.store.read(binding,{after:0,limit:1},check)).request,before.request);
  assert.deepEqual(await x.f.store.readModelSelection(target,check),CLAUDE_SELECTION);await assert.rejects(x.f.store.readModelSelection({...target,actorId:id(999)},check),/STALE_WRITER/);
 }finally{x.f.close();}
});

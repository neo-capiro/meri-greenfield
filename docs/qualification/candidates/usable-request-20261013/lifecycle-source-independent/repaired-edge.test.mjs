import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;if(!root)throw Error('Exact reviewed source root required');
const module=path=>import(pathToFileURL(root+'/'+path));
const {applicationFixture,binding,scopes,versions,id}=await module('apps/control/conversations/test/application-fixture.mjs');
const {createConversationService}=await module('apps/control/conversations/service.mjs');
const {createConversationActivity}=await module('apps/worker/conversation/activity.mjs');
const {canonicalSha256:hash}=await module('packages/contracts/validate.mjs');
test('Cancellation binds current scopes to the exact locked run before append',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:f.input});const before=f.state.events.values().next().value.length;
  const store={accept:f.store.accept,append:f.store.append,async read(...args){const read=await f.store.read(...args);const row=f.state.runs.values().next().value;row.projection={...row.projection,scopes:[{...scopes[0],policyRevision:'policy2'}],policyRevision:'policy2'};row.projection_sha256=hash(row.projection);return read;}};
  const service=createConversationService({sessions:f.sessions,store,dispatcher:f.dispatcher,versions});
  let error;try{await service.cancel({credential:f.credential});}catch(e){error=e.message;}
  const after=f.state.events.values().next().value.length;
  console.log(JSON.stringify({case:'cancel stored-scope change',error,before,after,state:f.state.runs.values().next().value.projection.state}));
  assert.equal(error,'SCOPE_REFUSED');assert.equal(after,before,'Scope-refused cancellation cannot append to changed resource');
 }finally{f.close();}
});
test('Immutable fiscal replay uses retained window when current configuration is absent',async()=>{
 const f=await applicationFixture();try{
  const fiscal={basis:'fiscal-year',calendarId:'state-florida',year:2027,stage:'appropriated',revisionId:'law-v2',timezone:'America/New_York',startInclusive:'2026-07-01T04:00:00Z',endExclusive:'2027-07-01T04:00:00Z'};
  const windowRequest=Object.fromEntries(Object.entries(fiscal).filter(([k])=>!['startInclusive','endExclusive'].includes(k)));
  const input={...f.input,windowRequest},configuration={sessions:f.sessions,store:f.store,dispatcher:f.dispatcher,versions};
  const original=createConversationService({...configuration,fiscalCalendars:[fiscal]});
  await original.submit({credential:f.credential,input});const before=f.state.runs.values().next().value.request.window;
  const reconstructed=createConversationService({...configuration,fiscalCalendars:[]});
  let replay,error;try{replay=await reconstructed.submit({credential:f.credential,input});}catch(e){error=e.code??e.message;}
  console.log(JSON.stringify({case:'fiscal config absent on exact replay',error,replay,before}));
  assert.equal(error,undefined,'Replay should not require resolving an already pinned fiscal window again');
  assert.equal(replay.replayed,true);assert.deepEqual(f.state.runs.values().next().value.request.window,before);
 }finally{f.close();}
});
test('The sole SDK query receives the persisted exact normalized window',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:{...f.input,prompt:'Summarize changes',windowRequest:{basis:'calendar-week',offset:-1,timezone:'America/New_York',weekStartsOn:'monday'}}});
  const window=f.state.runs.values().next().value.request.window;let seen,n=950;
  const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024};
  const execute=createConversationActivity({runOwner:f.runOwner,prepareRuntime:async()=>runtime,newId:()=>id(n++),query(args){seen=args;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
  await execute({binding});const context=JSON.stringify({prompt:seen.prompt,systemPrompt:seen.options.systemPrompt});
  console.log(JSON.stringify({case:'SDK immutable calendar context',window,contextIncludesExactStart:context.includes(window.startInclusive),contextIncludesExactEnd:context.includes(window.endExclusive),contextIncludesTimezone:context.includes(window.timezone)}));
  assert.ok(context.includes(window.startInclusive)&&context.includes(window.endExclusive)&&context.includes(window.timezone),'Normalized requested window must reach SDK inputs, not only storage');
 }finally{f.close();}
});
test('SDK close failure never releases raw provider diagnostics from activity',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:f.input});let n=980;
  const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024};
  const execute=createConversationActivity({runOwner:f.runOwner,prepareRuntime:async()=>runtime,newId:()=>id(n++),query:()=>({async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){throw Error('PRIVATE PROVIDER DIAGNOSTIC');}})});
  let error;try{await execute({binding});}catch(e){error=e.message;}
  console.log(JSON.stringify({case:'SDK close diagnostics',rawDiagnosticReleased:error?.includes('PRIVATE')??false,state:f.state.runs.values().next().value.projection.state}));
  assert.equal(error?.includes('PRIVATE')??false,false,'Close failure must cross the content-free activity boundary');
 }finally{f.close();}
});

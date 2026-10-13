import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {setTimeout as delay} from 'node:timers/promises';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;if(!root)throw Error('Exact reviewed source root required');
const module=path=>import(pathToFileURL(root+'/'+path));
const {applicationFixture,binding,scopes,versions,id}=await module('apps/control/conversations/test/application-fixture.mjs');
const {createConversationActivity}=await module('apps/worker/conversation/activity.mjs');
const {createConversationApplication}=await module('apps/control/conversations/http.mjs');
const {createConversationService}=await module('apps/control/conversations/service.mjs');
const {createPostgresConversationStore}=await module('apps/control/conversations/postgres-store.mjs');
const {storeFixture}=await module('apps/control/conversations/test/store-fixture.mjs');
const {canonicalSha256:hash}=await module('packages/contracts/validate.mjs');
const runtime=()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
const status=(n,state)=>({eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});

test('Current changed scope refuses worker publication before any durable event mutation',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:f.input});const before=f.state.events.values().next().value.length;
  f.state.context.scopes=[{...scopes[0],policyRevision:'policy2'}];
  const fresh=await f.sessions.issue({identityCredential:'synthetic-native'});
  await assert.rejects(f.service.publish({credential:fresh.credential,binding,event:status(401,'starting')}),/SCOPE_REFUSED/);
  const after=f.state.events.values().next().value.length;
  console.log(JSON.stringify({case:'changed fresh current scope',before,after,state:f.state.runs.values().next().value.projection.state}));
  assert.equal(after,before,'Denied current-scope publication must not persist an event');
 }finally{f.close();}
});

test('Losing concurrent activity cannot poison the legitimate starting owner',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:f.input});let prepared=0,release,queries=0,closed=0;
  const both=new Promise(r=>release=r);
  const prepareRuntime=async()=>{if(++prepared===2)release();await both;return runtime();};
  const query=()=>{queries++;return {async *[Symbol.asyncIterator](){await delay(15);yield {type:'assistant',message:{id:'winner',content:[{type:'text',text:'Winner'}]}};yield {type:'result',subtype:'success',is_error:false};},close(){closed++;}};};
  let first=410,second=510;
  const one=createConversationActivity({runOwner:f.runOwner,prepareRuntime,query,newId:()=>id(first++)});
  const two=createConversationActivity({runOwner:f.runOwner,prepareRuntime,query,newId:()=>id(second++)});
  const result=await Promise.allSettled([one({binding}),two({binding})]);
  const state=f.state.runs.values().next().value.projection.state;
  console.log(JSON.stringify({case:'concurrent activities',results:result.map(x=>({status:x.status,error:x.reason?.message,value:x.value})),queries,closed,state}));
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1,'Exactly the legitimate starting owner should complete');
  assert.equal(queries,1);assert.equal(closed,1);assert.equal(state,'completed');
 }finally{f.close();}
});

test('Exact calendar request replay retains original resolution across week rollover',async()=>{
 const f=storeFixture(),store=createPostgresConversationStore({pool:f.pool});let at=Date.parse('2026-10-12T03:59:59Z'),starts=0,n=610;
 const authentication=()=>({principal:{sessionId:'session1',tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},sessionRevision:'revision1',checkedAtMs:at,expiresAtMs:at+30000});
 const sessions={async authenticateSession(){return authentication();},async readCurrentState({authentication:a}){return {authenticationSha256:hash(a),binding,scopes,selectedClientId:id(5),checkedAtMs:at,expiresAtMs:at+30000};}};
 const service=createConversationService({sessions,store,dispatcher:{async start(){starts++;},async cancel(){}},versions,now:()=>at,newId:()=>id(n++)});
 const input={requestId:id(607),prompt:'Last week',windowRequest:{basis:'calendar-week',offset:-1,timezone:'America/New_York',weekStartsOn:'monday'}};
 const first=await service.submit({credential:'synthetic-session',input});
 const original=f.state.runs.values().next().value.request.window;
 at=Date.parse('2026-10-12T04:00:01Z');
 let replay,error;try{replay=await service.submit({credential:'synthetic-session',input});}catch(e){error=e.message;}
 console.log(JSON.stringify({case:'calendar rollover replay',original,replay,error,starts,requests:f.state.runs.size}));
 assert.equal(error,undefined,'Identical immutable delivery must replay its original calendar resolution');
 assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.equal(f.state.runs.size,1);
 assert.deepEqual(f.state.runs.values().next().value.request.window,original);
});

test('HTTP original lifetime bounds a slow service even if it ignores cancellation',async()=>{
 const app=createConversationApplication({maxRequestMs:10,service:{async submit(){await delay(35);return {ok:true};},async history(){return{};},async cancel(){return{};}}});
 const response=await app.handle(new Request('https://meri.invalid/api/conversations/submit',{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify({requestId:id(701),prompt:'Hello'})}));
 console.log(JSON.stringify({case:'HTTP outer deadline',status:response.status,body:await response.json()}));
 assert.equal(response.status,408,'HTTP must preserve its original outer deadline during service execution');
});

test('Failure observation cannot park SDK Query cleanup after original activity deadline',async()=>{
 const f=await applicationFixture();let release,closed=0;const blocked=new Promise(r=>release=r);try{
  await f.service.submit({credential:f.credential,input:f.input});
  const owner={load:f.runOwner.load,append:call=>call.event.data.state==='failed'?blocked:f.runOwner.append(call)};
  let n=810;const execute=createConversationActivity({runOwner:owner,prepareRuntime:async()=>({...runtime(),deadlineMs:Date.now()+40}),query:()=>({async *[Symbol.asyncIterator](){yield {type:'result',subtype:'error_during_execution',errors:['synthetic failure']};},close(){closed++;}}),newId:()=>id(n++)});
  const pending=execute({binding});const observation=await Promise.race([pending.then(()=>({settled:true}),()=>({settled:true})),delay(100).then(()=>({settled:false}))]);
  console.log(JSON.stringify({case:'blocked failure observer cleanup',...observation,closed}));
  release();await pending.catch(()=>{});
  assert.equal(observation.settled,true,'Activity failure path must have a finite wait');assert.equal(closed,1);
 }finally{release?.();f.close();}
});

for(const [name,corrupt] of [
 ['event sequence column alias',row=>row.sequence=99],
 ['event ID column alias',row=>row.event_id=id(901)],
])test('Retained '+name+' refuses disclosure despite consistent JSON hash',async()=>{
 const f=await applicationFixture();try{
  await f.service.submit({credential:f.credential,input:f.input});corrupt(f.state.events.values().next().value[0]);
  let error,released;try{released=await f.service.history({credential:f.credential});}catch(e){error=e.message;}
  console.log(JSON.stringify({case:name,error,releasedEvents:released?.events.length}));
  assert.ok(error,'Corrupt redundant event row identity must not release transcript');
 }finally{f.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
if(!root)throw Error('exact source root required');
const load=path=>import(pathToFileURL(join(root,path)).href);
const {assembleConversationRunner}=await load('apps/runtime/conversation-runner.mjs');
const {createWorkerRunApplication}=await load('apps/runtime/worker-http.mjs');
const {lifecycleFixture,binding,scopes,versions,id}=await load('apps/control/conversations/test/lifecycle-fixture.mjs');
const {canonicalSha256}=await load('packages/contracts/validate.mjs');
for(const echo of [true,false])test(`assembled runner uses canonical task-authorized lifecycle RPC; steering echo ${echo?'APPLIED':'UNKNOWN'} remains single delivery`,async()=>{
 const f=await lifecycleFixture();await f.service.submit({credential:f.credential,input:f.input});
 const calls=[],messages=[];let queries=0,closes=0,claims=0;
 const limits={requestMs:500,requestBytes:131072};
 const native={async call(operation,input,{signal}={}){
  calls.push({operation,input});assert.equal(Object.hasOwn(input,'credential'),false,'borrowed task credential must stay outside JSON');
  if(operation==='worker/authorize')return{binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-current',checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000};
  assert.equal(canonicalSha256(input.binding),canonicalSha256(binding));
  if(operation==='runner/runtime')return{binding,versions,proxyUrl:'https://proxy.example.invalid',proxyCredential:'synthetic',model:'scripted',deadlineMs:Date.now()+2000,maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:1024};
  const route=operation.replace(/^runner\//u,'');
  if(route==='claim-control')claims++;
  assert.equal(['load','publish','next-controls','claim-control','ack-control'].includes(route),true,operation);
  const request=new Request('https://control.invalid/internal/conversations/'+route,{method:'POST',headers:{authorization:'Bearer synthetic-task-cap','content-type':'application/json'},body:JSON.stringify(input),signal});
  const response=await worker.handle(request);assert.equal(response.status,200,await response.clone().text());return response.json();
 }};
 const worker=createWorkerRunApplication({service:f.service,sessions:f.sessions,native,configuration:{limits}});
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid'},native,credentialForBinding:async args=>{assert.equal(canonicalSha256(args.binding),canonicalSha256(binding));return'synthetic-task-cap';},query(args){queries++;return{async *[Symbol.asyncIterator](){
  yield{type:'system',subtype:'init',session_id:id(223)};
  const input=args.prompt[Symbol.asyncIterator]();messages.push((await input.next()).value);
  await f.service.control({credential:f.credential,input:{controlId:id(900),intent:'steer',text:'Literal /command @file steering text'}});
  const second=(await input.next()).value;messages.push(second);if(echo)yield second;
  yield{type:'result',subtype:'success',is_error:false};
 },close(){closes++;}};}});
 try{
  assert.deepEqual(await execute({binding}),{state:'completed'});assert.equal(queries,1);assert.equal(closes,1);assert.equal(claims,1);assert.equal(messages.length,2);assert.equal(messages[1].uuid,id(900));assert.equal(messages[1].message.content,'Literal /command @file steering text');
  const row=f.state.controls.get(binding.tenantId+':'+id(900));assert.equal(row.projection.state,echo?'APPLIED':'UNKNOWN');
  assert.equal((await f.service.history({credential:f.credential})).run.state,'completed');
  assert.equal(f.sessions.status().sessions,1,'every temporary task RPC opaque session must be revoked; original browser session remains');
  assert.equal(calls.filter(c=>c.operation==='runner/ack-control').length,1);
 }finally{f.close();}
});

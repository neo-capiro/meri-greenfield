import test from 'node:test';import assert from 'node:assert/strict';
import {createOutreachStartApplication} from '../outreach-generation/start.mjs';
import {createOutreachCore} from '../outreach-generation/core.mjs';
import {outreachSelection,assertOutreachRequest} from '../../../packages/runtime/outreach-generation.mjs';
import {receiveOutreachGenerationStartResponse} from '../../../packages/contracts/outreach-generation.mjs';
import {applicationFixture,binding,id} from '../../control/conversations/test/application-fixture.mjs';
const ids={generationJobId:id(80),itemId:id(81)},prompt='[Capiro Outreach recipient unit v1]\nSynthetic resolved evidence and recipient directives';
const claim={...ids,conversationId:binding.conversationId,clientId:id(5),requestId:id(6),prompt,outputSchema:{type:'object',additionalProperties:false,properties:{plan:{type:'object'},draft:{type:'object'}},required:['plan','draft']},generationKey:'recipient:synthetic',revision:1};
const request=body=>new Request('https://meri.invalid/api/outreach-generation/start',{method:'POST',headers:{authorization:'Bearer synthetic-native','content-type':'application/json'},body:JSON.stringify(body)});
test('Outreach start uses actual ordinary allocation and one existing dispatch; receipt binds exact Core unit',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  let claims=0;const app=createOutreachStartApplication({core:{async claim(input){assert.deepEqual(input,ids);claims++;return claim;}},sessions:f.sessions,service:f.service});
  const response=await app.handle(request(ids)),receipt=receiveOutreachGenerationStartResponse(response.status,await response.text(),ids,Date.now());
  assert.equal(response.status,202);assert.equal(receipt.conversationId,binding.conversationId);assert.equal(receipt.session.context.runId,binding.runId);assert.equal(f.state.starts,1);assert.equal(claims,1);
  const saved=await f.service.history({credential:receipt.session.credential});assert.equal(saved.request.prompt,prompt);assert.equal(saved.request.requestId,claim.requestId);
  const extra=await app.handle(request({...ids,prompt:'browser replacement',outputSchema:{}}));assert.equal(extra.status,400);assert.equal(claims,1);
 }finally{f.close();}
});
test('Outreach start lost dispatch acknowledgement is UNKNOWN, retains accepted request and does not retry',async()=>{
 const f=await applicationFixture({initialInput:true});try{f.state.startUnknown=true;const app=createOutreachStartApplication({core:{async claim(){return claim;}},sessions:f.sessions,service:f.service});
  const r=await app.handle(request(ids));assert.equal(r.status,503);assert.equal((await r.json()).error.code,'OUTREACH_GENERATION_UNKNOWN');assert.equal(f.state.starts,1);assert.equal((await f.service.history({credential:f.credential})).request.requestId,claim.requestId);
 }finally{f.close();}
});
test('Outreach current denial precedes allocation/dispatch and different recipient identity refuses',async()=>{
 const f=await applicationFixture({initialInput:true});try{const app=createOutreachStartApplication({core:{async claim(){throw Error('current access denied');}},sessions:f.sessions,service:f.service});assert.equal((await app.handle(request(ids))).status,503);assert.equal(f.state.starts,0);
  for(const changed of [{conversationId:id(90)},{clientId:id(91)},{requestId:id(92)},{prompt:'different recipient'}])assert.throws(()=>assertOutreachRequest({...claim,...changed},{binding,request:{requestId:claim.requestId,prompt},selectedClientId:claim.clientId}));
  assert.throws(()=>outreachSelection({...claim,outputSchema:{type:'object',$ref:'https://untrusted.invalid/schema'}}));
 }finally{f.close();}
});
test('Outreach Core client uses only fixed actor-auth routes; ordinary absence and refused response remain distinct',async()=>{
 const calls=[];let denied=false;const core=createOutreachCore({origin:'https://core.invalid',fetchImpl:async(url,init)=>{calls.push({url:String(url),init});return denied?Response.json({error:'denied'},{status:403}):Response.json(null);}});
 assert.equal(await core.read({conversationId:binding.conversationId},{credential:'synthetic-current'}),null);assert.equal(calls[0].url,'https://core.invalid/api/engagement/outreach/sdk/read');assert.equal(calls[0].init.headers.authorization,'Bearer synthetic-current');assert.equal(calls[0].init.redirect,'error');
 denied=true;await assert.rejects(core.read({conversationId:binding.conversationId},{credential:'synthetic-current'}));
});

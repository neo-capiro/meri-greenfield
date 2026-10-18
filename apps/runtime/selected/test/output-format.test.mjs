import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import {createTaskSelectedSkills} from '../task.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';
import {runtimeFixture} from '../../../worker/conversation/skills/test/runtime-fixture.mjs';
import {input as commitmentsInput} from '../../../control/document-application/commitments-audit/source.mjs';
import {input as relationshipInput} from '../../../control/document-application/relationship-brief/input.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {fixture} from './fixture.mjs';

const ids=['quick_skill.commitments_audit','quick_skill.relationship_brief'];
const sessionId='71000000-0000-4000-8000-000000000091';
function runOptions(f){const c=f.configuration,binding=c.binding;return {binding,versions:c.versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://synthetic.invalid',proxyCredential:'SYNTHETIC_ONLY',model:'synthetic-no-provider',sessionStore:{async load(){return null;},async append(){}},deadlineMs:c.now()+20000,maxTurns:12,maxCostMicroUSD:1000,maxOutputBytes:1048576};}

for(const skillId of ids)test(`${skillId} requests literal pinned JSON output matching its compiler input`,async()=>{
 const f=runtimeFixture(skillId),c=f.configuration;let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(operation){calls++;assert.equal(operation,'selected/prepare');return {sessionId,binding:c.binding,requestSha256:canonicalSha256(c.request),selection:f.selection,checkedAtMs:c.now(),expiresAtMs:c.now()+5000};}}});
 try{const runtime=await task.prepare({binding:c.binding,versions:c.versions,request:c.request,scopes:c.scopes}),format=runtime.sdkOptions.outputFormat;
  assert.equal(calls,1);assert.equal(format.type,'json_schema');assert.equal(format.schema.properties.skill.properties.skillId.const,skillId);
  const compilerInput=(skillId==='quick_skill.commitments_audit'?commitmentsInput:relationshipInput)(f.input);
  const validate=new Ajv({strict:false}).compile(format.schema);assert.equal(validate(compilerInput),true,JSON.stringify(validate.errors));
  assert.equal(validate({...compilerInput,skill:{...compilerInput.skill,manifestSha256:'0'.repeat(64)}}),false);
  assert.equal(validate({...compilerInput,unapprovedEffect:true}),false);
  if(skillId==='quick_skill.commitments_audit'){
   const long={...compilerInput,observations:[{...compilerInput.observations[0],kind:'tracking',relatedPromiseId:'',passage:{...compilerInput.observations[0].passage,start:0,end:5001,quote:'a'.repeat(5001)}}]};
   commitmentsInput(long);assert.equal(validate(long),true,JSON.stringify(validate.errors));
  }
  await runtime.close();
 }finally{await task.close();}
});

test('the single activity query receives selected outputFormat while source remains opt-in',async()=>{
 const x=await fixture({queued:true}),c=x.f.configuration;let observed,queries=0,published=0;
 const activity=createConversationActivity({now:c.now,runOwner:{load:({binding})=>x.store.read(binding,{},()=>{}),append:({binding,event})=>x.store.append(binding,event,()=>{},c.scopes)},prepareRuntime:async()=>runOptions(x.f),selectedSkills:{async prepare(args){const runtime=await x.task.prepare(args);return {...runtime,finish:async()=>({state:'awaiting-output-approval'})};},async publish(){published++;}},query({options}){queries++;observed=options;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false,structured_output:x.f.input};},async close(){}};}});
 try{const result=await activity({binding:c.binding});assert.equal(result.state,'completed');assert.equal(queries,1);assert.equal(published,1);assert.equal(observed.outputFormat.type,'json_schema');const validate=new Ajv({strict:false}).compile(observed.outputFormat.schema);assert.equal(validate(x.f.input),true,JSON.stringify(validate.errors));}
 finally{await x.task.close();await x.control.close();}
 const inactive=createTaskSelectedSkills({native:{async call(){throw Error('UNEXPECTED_NATIVE_EFFECT');}}});await assert.rejects(inactive.prepare(c),{code:'UNAVAILABLE'});await inactive.close();
});

test('unadmitted original outputs fail before native task preparation',async()=>{
 const f=runtimeFixture(),c=f.configuration,request={...c.request,skill:selectSkill('quick_skill.mail_history','1.0.0').pin};let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(){calls++;}}});
 try{await assert.rejects(task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),{code:'SKILL_OUTPUT_FORMAT_UNAVAILABLE'});assert.equal(calls,0);}finally{await task.close();}
});

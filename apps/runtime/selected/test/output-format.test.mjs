import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import {createTaskSelectedSkills} from '../task.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';
import {query as sdkQuery} from '../../../worker/conversation/agent-sdk.mjs';
import {runtimeFixture} from '../../../worker/conversation/skills/test/runtime-fixture.mjs';
import {input as commitmentsInput} from '../../../control/document-application/commitments-audit/source.mjs';
import {input as relationshipInput} from '../../../control/document-application/relationship-brief/input.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {listSkills,selectSkill,documentCompiler} from '../../../../packages/skills/index.mjs';
import {fixture} from './fixture.mjs';

const ids=['quick_skill.commitments_audit','quick_skill.relationship_brief'];
const sessionId='71000000-0000-4000-8000-000000000091';
function runOptions(f){const c=f.configuration,binding=c.binding;return {binding,versions:c.versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://synthetic.invalid',proxyCredential:'SYNTHETIC_ONLY',model:'synthetic-no-provider',sessionStore:{async load(){return null;},async append(){}},deadlineMs:c.now()+20000,maxTurns:12,maxCostMicroUSD:1000,maxOutputBytes:1048576};}

for(const skillId of ids)test(`${skillId} requests literal pinned JSON output matching its compiler input`,async()=>{
 const f=runtimeFixture(skillId),c=f.configuration;let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(operation){calls++;assert.equal(operation,'selected/prepare');return {sessionId,binding:c.binding,requestSha256:canonicalSha256(c.request),selection:f.selection,checkedAtMs:c.now(),expiresAtMs:c.now()+5000};}}});
 try{const runtime=await task.prepare({binding:c.binding,versions:c.versions,request:c.request,scopes:c.scopes}),format=runtime.sdkOptions.outputFormat;
  assert.equal(calls,1);assert.equal(format.type,'json_schema');assert.equal(format.schema.properties.skill.properties.skillId.const,skillId);
  // Stop at the pinned SDK's spawn hook: verify its real CLI schema argument,
  // without constructing a child process or making a model/network request.
  let descriptor;const noSpawn=Error('SYNTHETIC_SCHEMA_CAPTURE_NO_SPAWN');
  assert.throws(()=>sdkQuery({prompt:'Synthetic schema serialization only',options:{model:'synthetic-no-provider',env:{},outputFormat:format,
   spawnClaudeCodeProcess(request){descriptor=request;throw noSpawn;}}}),error=>error===noSpawn);
  const schemaArgs=descriptor.args.filter(arg=>arg.startsWith('--json-schema='));
  assert.equal(schemaArgs.length,1);assert.deepEqual(JSON.parse(schemaArgs[0].slice('--json-schema='.length)),format.schema);
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

for(const skillId of ids)test(`${skillId}: activity output reaches its actual compiler and canonical pending-output journal`,async()=>{
 const x=await fixture({queued:true,skillId}),c=x.f.configuration;let queries=0;
 const activity=createConversationActivity({now:c.now,runOwner:{load:({binding})=>x.store.read(binding,{},()=>{}),append:({binding,event})=>x.store.append(binding,event,()=>{},c.scopes)},prepareRuntime:async()=>runOptions(x.f),selectedSkills:x.task,query({options}){
  queries++;assert.equal(options.outputFormat.type,'json_schema');
  const validate=new Ajv({strict:false}).compile(options.outputFormat.schema);
  assert.equal(validate(x.f.input),true,JSON.stringify(validate.errors));
  return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false,structured_output:x.f.input};},async close(){}};
 }});
 try{const result=await activity({binding:c.binding});assert.equal(result.state,'completed');assert.equal(queries,1);
  const rows=[...x.base.state.selectedOutputs.values()];assert.equal(rows.length,1);
  assert.equal(rows[0].projection.prepared.request.operation,'create_word');
  assert.equal(rows[0].projection.prepared.provenance.skill.skillId,skillId);
  assert.equal(rows[0].projection.prepared.provenance.inputSha256,canonicalSha256(x.f.input));
  // These legacy synthetic producers deliberately lack signed-source admission.
  // Their absence must remain a disclosed partial result in the actual compiler.
  const unavailable=rows[0].projection.prepared.provenance.gaps??rows[0].projection.prepared.issues;
  assert.ok(unavailable.some(issue=>issue.reason==='UNAVAILABLE'));
  assert.ok(x.calls.includes('finish'));assert.ok(x.calls.includes('publish'));
 }finally{await x.task.close();await x.control.close();}
});

for(const asset of listSkills().filter(asset=>documentCompiler(asset)===null))test(`${asset.skillId}@${asset.skillVersion}: unadmitted original output fails before native task preparation`,async()=>{
 const f=runtimeFixture(),c=f.configuration,request={...c.request,skill:selectSkill(asset.skillId,asset.skillVersion).pin};let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(){calls++;}}});
 try{await assert.rejects(task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),{code:'SKILL_OUTPUT_FORMAT_UNAVAILABLE'});assert.equal(calls,0);}finally{await task.close();}
});

// The sourced cited report is admitted as its OWN installed version through the existing selected-version
// mechanism (packages/skills/plugin.mjs prefers the selected version of the selected skill id). It needs no
// extra allowlist, and the ordinary bill-watch versions keep refusing native preparation.
test('quick_skill.bill_watch@2.0.0 is announced as a selected version and reaches native preparation',async()=>{
 const f=runtimeFixture(),c=f.configuration,pin=selectSkill('quick_skill.bill_watch','2.0.0').pin,selection=f.selection,request={...c.request,skill:pin};let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(operation){calls++;assert.equal(operation,'selected/prepare');
  return {sessionId,binding:c.binding,requestSha256:canonicalSha256(request),selection,checkedAtMs:c.now(),expiresAtMs:c.now()+5000};}}});
 try{const runtime=await task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),format=runtime.sdkOptions.outputFormat;
  assert.equal(calls,1);assert.equal(format.type,'json_schema');
  assert.equal(format.schema.properties.skill.properties.skillId.const,'quick_skill.bill_watch');
  assert.equal(format.schema.properties.skill.properties.skillVersion.const,'2.0.0');
  assert.equal(format.schema.properties.skill.properties.proseSha256.const,pin.proseSha256);
  assert.deepEqual(Object.keys(format.schema.properties),['skill','title','subject','asOf','summary','findings','conflicts','recommendations','limitations']);
  let descriptor;const noSpawn=Error('SYNTHETIC_SCHEMA_CAPTURE_NO_SPAWN');
  assert.throws(()=>sdkQuery({prompt:'Synthetic schema serialization only',options:{model:'synthetic-no-provider',env:{},outputFormat:format,
   spawnClaudeCodeProcess(value){descriptor=value;throw noSpawn;}}}),error=>error===noSpawn);
  const schemaArgs=descriptor.args.filter(arg=>arg.startsWith('--json-schema='));
  assert.equal(schemaArgs.length,1);assert.deepEqual(JSON.parse(schemaArgs[0].slice('--json-schema='.length)),format.schema);
  const valid={skill:pin,title:'Sourced cited report',subject:{congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'},
   asOf:'2026-10-13T12:00:00.000Z',summary:'Draft summary.',
   findings:[{id:'f1',kind:'excerpt',text:'A read passage.',citations:[{sourceId:'bill_text',recordId:'r1',sourceVersionId:'v1',start:0,end:16,url:'https://example.invalid/never-fetched'}]}],
   conflicts:[],recommendations:['Confirm the appropriations basis.'],limitations:['Coverage is not exhaustive.']};
  const validate=new Ajv({strict:false}).compile(format.schema);
  assert.equal(validate(valid),true,JSON.stringify(validate.errors));
  assert.equal(validate({...valid,skill:{...pin,manifestSha256:'0'.repeat(64)}}),false);
  assert.equal(validate({...valid,findings:[{...valid.findings[0],citations:[{...valid.findings[0].citations[0],sourceId:'internal_connector'}]}]}),false);
  assert.equal(validate({...valid,unapprovedEffect:true}),false);
  await runtime.close();
 }finally{await task.close();}
});

// The general long-form cited report is admitted as its OWN installed version through the same mechanism:
// the SDK receives this recipe's own output schema (no subject property), and the model cannot widen it.
test('quick_skill.cited_report@1.0.0 is announced as a selected version and reaches native preparation',async()=>{
 const f=runtimeFixture(),c=f.configuration,pin=selectSkill('quick_skill.cited_report','1.0.0').pin,selection=f.selection,request={...c.request,skill:pin};let calls=0;
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(operation){calls++;assert.equal(operation,'selected/prepare');
  return {sessionId,binding:c.binding,requestSha256:canonicalSha256(request),selection,checkedAtMs:c.now(),expiresAtMs:c.now()+5000};}}});
 try{const runtime=await task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),format=runtime.sdkOptions.outputFormat;
  assert.equal(calls,1);assert.equal(format.type,'json_schema');
  assert.equal(format.schema.properties.skill.properties.skillId.const,'quick_skill.cited_report');
  assert.equal(format.schema.properties.skill.properties.skillVersion.const,'1.0.0');
  assert.equal(format.schema.properties.skill.properties.proseSha256.const,pin.proseSha256);
  assert.deepEqual(Object.keys(format.schema.properties),['skill','title','asOf','summary','findings','conflicts','recommendations','limitations']);
  assert.equal(Object.hasOwn(format.schema.properties,'subject'),false,'the trusted selected subject is never model input');
  assert.deepEqual(runtime.sdkOptions.allowedTools,['mcp__meri_original_reads__mail_read_thread','mcp__meri_original_reads__get_research_evidence','mcp__meri_original_reads__create_word']);
  let descriptor;const noSpawn=Error('SYNTHETIC_SCHEMA_CAPTURE_NO_SPAWN');
  assert.throws(()=>sdkQuery({prompt:'Synthetic schema serialization only',options:{model:'synthetic-no-provider',env:{},outputFormat:format,
   spawnClaudeCodeProcess(value){descriptor=value;throw noSpawn;}}}),error=>error===noSpawn);
  const schemaArgs=descriptor.args.filter(arg=>arg.startsWith('--json-schema='));
  assert.equal(schemaArgs.length,1);assert.deepEqual(JSON.parse(schemaArgs[0].slice('--json-schema='.length)),format.schema);
  const citation={kind:'mail',threadId:'71000000-0000-4000-8000-0000000000a1',messageId:'71000000-0000-4000-8000-0000000000a2',start:0,end:16};
  const valid={skill:pin,title:'General long-form cited report',asOf:'2026-10-28T12:00:00.000Z',summary:'Draft summary.',
   findings:[{id:'f1',kind:'excerpt',text:'A read passage.',citations:[citation]}],
   conflicts:[],recommendations:['Confirm the review basis.'],limitations:['Mail coverage is not exhaustive.']};
  const validate=new Ajv({strict:false}).compile(format.schema);
  assert.equal(validate(valid),true,JSON.stringify(validate.errors));
  assert.equal(validate({...valid,skill:{...pin,manifestSha256:'0'.repeat(64)}}),false);
  assert.equal(validate({...valid,findings:[{...valid.findings[0],citations:[{...citation,sourceId:'internal_connector'}]}]}),false);
  assert.equal(validate({...valid,subject:{kind:'client',entityIds:['71000000-0000-4000-8000-0000000000a3']}}),false,'the model cannot supply a subject');
  assert.equal(validate({...valid,unapprovedEffect:true}),false);
  await runtime.close();
 }finally{await task.close();}
});

// The ordinary bill-watch versions keep their existing behaviour: 1.0.0 is not an SDK-installable
// selected version at all, and 1.0.1/1.1.0 have no separately approved document compiler, so the real
// task owner returns null and makes no native call. Only the report version reaches preparation.
test('the ordinary bill-watch versions still have no selected document compiler',async()=>{
 const f=runtimeFixture(),c=f.configuration;let calls=0;
 for(const [version,expected] of [['1.0.0','SKILL_PLUGIN_SELECTION_REFUSED'],['1.0.1',null],['1.1.0',null]]){
  const request={...c.request,skill:selectSkill('quick_skill.bill_watch',version).pin};
  const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{async call(){calls++;}}});
  try{expected===null?assert.equal(await task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),null)
   :await assert.rejects(task.prepare({binding:c.binding,versions:c.versions,request,scopes:c.scopes}),{code:expected});}
  finally{await task.close();}
 }
 assert.equal(calls,0);
});

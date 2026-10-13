/** Existing fixed UTF-16 window versus adopted canonical JSON hash compatibility. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const load=path=>import(pathToFileURL(root+'/'+path));
const {createMailFixture,bodyText,uuid}=await load('apps/gateway/sources/mail/test/fixtures.mjs');
const {createMailReadHandler}=await load('apps/gateway/sources/mail/handler.mjs');
const {createMailHttpAdapter}=await load('apps/gateway/sources/mail/http-adapter.mjs');
const {createCurrentToolAuthority}=await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createToolDispatch}=await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
function setup(bodyOffset,maxCharacters,changePage){
 const f=createMailFixture('mail.read_thread');f.args.messageId=uuid('9');f.args.bodyOffset=bodyOffset;f.args.maxCharacters=maxCharacters;
 const counts={reserve:0,settle:0,uncertain:0,fetch:0};
 const config={...f.config,fetchImpl:async(_url,options)=>{
  counts.fetch++;const page=f.page(JSON.parse(options.body).input);changePage?.(page);return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});
 }};
 const handler=createMailReadHandler({operation:f.operation,adapter:createMailHttpAdapter(config),now:()=>f.state.now});
 const authority=createCurrentToolAuthority({now:()=>f.state.now,maxFactBytes:1048576,ports:{
  async verifyCapability(){return JSON.stringify(f.claims);},async currentRun(){return JSON.stringify({binding:f.binding,policyRevision:f.authority.policyRevision,deadlineMs:f.authority.deadlineMs,checkedAtMs:f.state.now});},
  async authorizeBusiness(){return JSON.stringify({decision:f.authority.decision,subject:f.subject,grants:f.contract.descriptor.requiredGrants});},async authorizeSources(){return JSON.stringify({sourceIds:f.authority.sourceIds,enabled:true,policyRevision:f.authority.policyRevision,checkedAtMs:f.state.now});},
 }});
 const gateway=createToolDispatch({catalog:{entry:()=>({contract:f.contract,descriptor:f.contract.descriptor,execute:handler}),discoverable:()=>[]},authority,budget:{async reserve({reservationId}){counts.reserve++;return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){counts.settle++;return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){counts.uncertain++;}},limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:500,maxCleanupMs:30},now:()=>f.state.now,newId:()=>f.binding.workerId,sourceEnabled:true});
 return {f,counts,handler,run:()=>gateway.execute(JSON.stringify({operation:f.operation,arguments:f.args}),'SYNTHETIC_OPAQUE')};
}
test('Canonical thread shape accepts the exact one-unit high surrogate but canonical gateway refuses before settlement/release',async()=>{
 const x=setup(bodyText.length-2,1),page=x.f.page();assert.equal(page.messages[0].section.text.charCodeAt(0),0xd83d);
 assert.doesNotThrow(()=>x.f.contract.assertOutput(page,{request:x.f.args}));assert.throws(()=>hash(page));
 const admitted=JSON.parse(await x.handler(x.f.call()));assert.equal(admitted.messages[0].section.text,page.messages[0].section.text);
 await assert.rejects(x.run());assert.equal(x.counts.reserve,1);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Well-formed exact two-unit Unicode window passes the actual canonical gateway',async()=>{
 const x=setup(bodyText.length-2,2),released=JSON.parse(await x.run());assert.equal(released.messages[0].section.text,'😀');assert.equal(released.evidenceReady,false);assert.equal(x.counts.settle,1);assert.equal(x.counts.uncertain,0);
});
test('Producer shortening to a safe Unicode boundary cannot satisfy the unchanged fixed-window contract',async()=>{
 const x=setup(bodyText.length-3,2,page=>{
  const section=page.messages[0].section;section.endExclusive--;section.text=section.text.slice(0,-1);page.nextBodyOffsets[0].bodyOffset=section.endExclusive;
 });
 await assert.rejects(x.run(),/INVALID_RESULT/);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Full well-formed Unicode body remains governed and source-unverified',async()=>{
 const x=setup(0,6000),released=JSON.parse(await x.run());assert.equal(released.messages[0].section.text,bodyText);assert.equal(released.evidenceReady,false);assert.deepEqual(released.negativeAssertion,{kind:'none'});assert.equal(x.counts.settle,1);
});

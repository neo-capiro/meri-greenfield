/** Actual configured producers/HTTP bytes, canonical handlers, current authority and dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createSourceDisabledGateway} from '../index.mjs';
import {createMailHttpAdapter} from '../sources/mail/http-adapter.mjs';
import {createMailReadHandler} from '../sources/mail/handler.mjs';
import {createMailFixture,bodyText} from '../sources/mail/test/fixtures.mjs';
import {createMeetingHttpAdapter} from '../sources/meetings/http-adapter.mjs';
import {createMeetingReadHandler} from '../sources/meetings/handler.mjs';
import {meetingFixture,credentialReceipt,operations,endpoints,NOW as MEETING_NOW,clientId,meetingId,noteId,transcriptId,fullBody} from '../sources/meetings/test/fixtures.mjs';

const ids=['mail.list_messages','mail.search_messages','mail.read_thread',...Object.values(operations).map(o=>o.id)];
function integration(id,request) {
 const mail=id.startsWith('mail.'),op={id,version:'0.2.0'};
 const fixture=mail?createMailFixture(id):meetingFixture(op,request??(id===operations.upcoming.id?{}:{clientId}));
 const args=request??(mail?fixture.args:fixture.request),now=mail?fixture.state.now:MEETING_NOW;
 const state={now,revoked:false,sourceEnabled:true},calls=[],wire=[],records=new Map();
 const auth=mail?fixture.authority:fixture.authority,claims=auth.claims,binding=auth.binding,subject=auth.subject;
 const contract=fixture.contract;
 const ports={
  async verifyCapability(){calls.push('capability');if(state.revoked)throw Error('SYNTHETIC_REVOKED');return JSON.stringify(claims);},
  async currentRun(){calls.push('fence');return JSON.stringify({binding,policyRevision:auth.policyRevision,deadlineMs:now+10000,checkedAtMs:state.now});},
  async authorizeBusiness(){calls.push('policy');return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,
   actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${id}@0.2.0`,scopes:subject.scopes,
   policyRevision:auth.policyRevision,evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},
   subject,grants:contract.descriptor.requiredGrants});},
  async authorizeSources(){calls.push('source-policy');return JSON.stringify({sourceIds:auth.sourceIds,enabled:state.sourceEnabled,
   policyRevision:auth.policyRevision,checkedAtMs:state.now});}
 };
 const budget={async reserve({reservationId}){calls.push('reserve');return JSON.stringify({reservationId,decision:'reserved'});},
  async settle({reservationId}){calls.push('settle');state.onSettle?.();return JSON.stringify({reservationId,decision:'settled'});},
  async markUncertain(){calls.push('uncertain');}};
 const config={endpoints:mail?fixture.config.endpoints:endpoints,now:()=>state.now,maxRequestMs:1000,maxResponseBytes:1048576,
  async getCredentials(pins){calls.push('credentials');state.credentialPins=pins;return mail?fixture.credentials(pins):credentialReceipt(pins);},
  async fetchImpl(url,options){calls.push('fetch');const protocol=JSON.parse(options.body);wire.push({url,options,protocol});
   const value=mail?fixture.page(protocol.input):meetingFixture(op,state.request??args,state.pageOptions).page;
   state.changePage?.(value);state.afterRead?.();
   return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});}
 };
 const adapter=mail?createMailHttpAdapter(config):createMeetingHttpAdapter(config);
 const execute=(mail?createMailReadHandler:createMeetingReadHandler)({operation:op,adapter,now:()=>state.now});
 const entry={descriptor:contract.descriptor,contract,execute};
 const authority=createCurrentToolAuthority({ports,now:()=>state.now,maxFactBytes:1048576});
 const limits={maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:1000,maxCleanupMs:100};
 const mailContextPorts={async loadPrevious({key}){calls.push('load-previous');return JSON.stringify({record:records.get(canonicalSha256(key))??null,checkedAtMs:state.now});},
  async retain({record}){calls.push('retain');records.set(canonicalSha256(record.key),structuredClone(record));
   return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:state.now});}};
 const gateway=createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[]},authority,budget,limits,now:()=>state.now,
  newId:()=>binding.workerId,sourceEnabled:true,mailContextPorts});
 const requestJson=value=>JSON.stringify({operation:op,arguments:value});
 return {fixture,state,calls,wire,records,ports,budget,limits,binding,args,op,requestJson,
  run:async(value=args,signal)=>{state.request=value;return JSON.parse(await gateway.execute(requestJson(value),'SYNTHETIC_OPAQUE',signal));}};
}

for(const id of ids) {
 test(`${id}: actual bounded HTTP handler composes with canonical authority, reservation and final release`,async()=>{
  const f=integration(id),page=await f.run();
  assert.equal(page.operation.id,id);assert.deepEqual(page.binding,f.binding);
  assert.equal(page.evidenceReady,false);assert.equal(page.coverage.enumeration,'unknown');
  assert.deepEqual(page.negativeAssertion,{kind:'none'});
  assert.equal(f.calls.filter(x=>x==='reserve').length,1);assert.equal(f.calls.filter(x=>x==='settle').length,1);
  assert.equal(f.calls.includes('uncertain'),false);assert.equal(f.wire.length,1);
  assert.equal(f.wire[0].options.method,'POST');assert.deepEqual(Object.keys(f.wire[0].protocol).sort(),['input','metadata']);
  assert.equal(f.state.credentialPins.requestSha256,canonicalSha256(f.wire[0].protocol));
  assert.equal(JSON.stringify(f.wire[0].protocol).includes('SYNTHETIC_BEARER'),false);
  assert.equal(f.calls.filter(x=>x==='policy').length>=4,true);
 });
 test(`${id}: canonical source-disabled application refuses before authority, budget or HTTP`,async()=>{
  const f=integration(id),gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits:f.limits,
   now:()=>f.state.now,newId:()=>f.binding.workerId});
  await assert.rejects(gateway.execute(f.requestJson(f.args),'SYNTHETIC_OPAQUE'),/UNAVAILABLE/);assert.deepEqual(f.calls,[]);
 });
 test(`${id}: revocation after actual response prevents release and retains uncertain reservation`,async()=>{
  const f=integration(id);f.state.afterRead=()=>{f.state.revoked=true;};
  await assert.rejects(f.run(),/ACCESS_DENIED/);assert.equal(f.wire.length,1);
  assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
 });
 test(`${id}: a response cannot promote unknown source coverage to verified evidence`,async()=>{
  const f=integration(id);f.state.changePage=page=>{page.evidenceReady=true;};
  await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);
  assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
 });
}
for(const id of ['mail.list_messages','mail.search_messages']) {
 test(`${id}: actual second page uses gateway-retained exact anchor rather than caller-authored prior content`,async()=>{
  const f=integration(id),first=await f.run();assert.equal(f.records.size,1);
  const second=await f.run({...f.args,offset:first.nextOffset,asOf:first.queryScope.asOfInclusive});
  assert.equal(second.messages[0].messageId===first.messages[0].messageId,false);
  assert.equal(f.calls.filter(x=>x==='load-previous').length,1);
  assert.equal(f.calls.filter(x=>x==='settle').length,2);
  assert.equal(second.messages[0].preview.kind,'incomplete-preview');assert.equal(second.evidenceReady,false);
 });
}
test('mail decisive body remains source/version/hash-bound and reaches content omitted from the preview',async()=>{
 const f=integration('mail.read_thread'),first=await f.run({...f.args,maxCharacters:1000});
 assert.equal(first.messages[0].section.text.includes('committee approved'),false);
 const later=await f.run({...f.args,messageId:first.messages[0].messageId,bodyOffset:2100,maxCharacters:1000});
 assert.equal(later.messages[0].section.text.includes('committee approved'),true);
 assert.equal(later.messages[0].section.text,bodyText.slice(2100));
 assert.equal(later.messages[0].contentSha256,first.messages[0].contentSha256);
 assert.equal(later.messages[0].recordVersionId,first.messages[0].recordVersionId);assert.equal(later.evidenceReady,false);
});
for(const sourceKind of ['note','transcript']) {
 test(`meeting ${sourceKind}: inventory is followed by exact late UTF-16 body with original source hash`,async()=>{
  const inventory=await integration(operations.read.id).run();assert.equal(inventory.kind,'meeting-inventory-page');
  const request={clientId,meetingId,sourceKind,sourceId:sourceKind==='note'?noteId:transcriptId,characterOffset:25,characterLimit:1000};
  const f=integration(operations.read.id,request),body=await f.run();assert.equal(body.kind,'meeting-source-body-page');
  assert.equal(body.source.body,fullBody.slice(25));assert.match(body.source.body,/funding was withheld/);
  assert.equal(body.source.provenance.bodySha256,body.source.contentHash);assert.equal(body.evidenceReady,false);
 });
}
test('meeting debrief cursor is preserved in actual HTTP metadata and broker request digest',async()=>{
 const request={clientId,debriefId:noteId,cursor:'opaque-source-cursor',characterLimit:1000};
 const f=integration(operations.debrief.id,request);f.state.pageOptions={start:25};const page=await f.run();
 assert.equal(page.debriefs[0].body,fullBody.slice(25));assert.equal(page.scope.cursorApplied,true);
 assert.equal(f.wire[0].protocol.metadata.cursor,request.cursor);
 assert.equal(f.state.credentialPins.requestSha256,canonicalSha256(f.wire[0].protocol));
});
test('post-settlement revocation still refuses final release without double-charging',async()=>{
 const f=integration(operations.upcoming.id);f.state.onSettle=()=>{f.state.revoked=true;};
 await assert.rejects(f.run(),/ACCESS_DENIED/);assert.equal(f.calls.filter(x=>x==='settle').length,1);
 assert.equal(f.calls.includes('uncertain'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../validate.mjs';
import { assertMailThreadInput, assertMailThreadSourcePage, assertCatalog, assertSkillManifest, assertEvidence, validateShape } from '../retrieval-0.2/validate.mjs';

// Literal synthetic DATA only. No handlers, actual identities or source access.
const uuid = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
const mailboxId = '33333333-3333-4333-8333-333333333333';
const scope = () => ({tenantId:'synthetic',kind:'mailbox',resourceId:mailboxId,policyRevision:'policy-v1'});
const input = () => ({subject:{kind:'personal'},threadId:uuid});
function page(request = input()) {
  const selection = assertMailThreadInput(request);
  return {kind:'mail-thread-source-page',contractVersion:'0.2.0',operation:{id:'mail.read_thread',version:'0.2.0'},
    requestId:uuid,traceId:uuid,binding:{tenantId:'synthetic',actorId:'reader',conversationId:uuid,runId:uuid,attemptId:uuid,workerId:uuid,writerFence:1},
    subject:{kind:'personal',entityType:'user',entityIds:['reader'],tenantId:'synthetic',actorId:'reader',authorizationDecisionId:uuid,policyRevision:'policy-v1',scopes:[scope()],rosterVersionId:null},
    window:{basis:'unbounded'},argumentsSha256:canonicalSha256(selection),appliedFilters:[],
    sources:[{sourceId:'mail',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:'2026-01-01T00:00:00Z',freshness:'unknown'}],
    coverage:{sourcesRequested:['mail'],sourcesChecked:['mail'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:1,returnedCount:1,truncated:false,historySupport:'bounded',limitations:['Synthetic stored read; snapshot and immutable version unknown.']},
    selection,order:'sentAt-asc_receivedAt-asc_createdAt-asc_nulls-and-ties-unspecified',snapshotVersionId:null,
    messages:[{sourceId:'mail',mailboxId,threadId:uuid,messageId,recordVersionId:null,citationId:null,contentSha256:null,scopes:[scope()],removed:false,connectionStatus:'disconnected',bodyCompleteness:'unknown',readHandle:'opaque-read',
      section:{start:0,endExclusive:6,totalCodeUnits:6,unit:'utf16-code-unit',text:'stored',hasMore:false}}],
    totalMessages:1,hasMoreMessages:false,nextMessageOffset:null,nextBodyOffsets:[],
    continuation:{cursor:null,requiredReads:['opaque-read'],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
}
const catalog = () => JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));

test('materializes verified legacy defaults without mutating strict input',()=>{
  const value=input(),copy=structuredClone(value),result=assertMailThreadInput(value);
  assert.deepEqual(result,{subject:{kind:'personal'},threadId:uuid,messageId:null,messageOffset:0,bodyOffset:0,limit:3,maxCharacters:2000});
  assert.deepEqual(value,copy);assert.notEqual(result,value);
  assert.equal(assertMailThreadInput({...value,messageId}).limit,3);
});
test('rejects coercion, null numeric values, injected authority and unsupported subjects',()=>{
  for(const patch of [{limit:'3'},{limit:null},{bodyOffset:false},{maxCharacters:Infinity},{messageOffset:1.5},{actorId:'other'},{cursor:'invented'},{subject:{kind:'portfolio',selection:'active-authorized'}},{subject:{kind:'entity',entityType:'user',entityId:'reader'}}])
    assert.throws(()=>assertMailThreadInput({...input(),...patch}));
  assert.throws(()=>assertMailThreadInput({...input(),threadId:' '+uuid}));
});
test('preserves exact numeric bounds and requires message identity for body continuation',()=>{
  assertMailThreadInput({...input(),messageId,messageOffset:10000,bodyOffset:10000000,limit:10,maxCharacters:6000});
  for(const patch of [{messageOffset:-1},{messageOffset:10001},{bodyOffset:-1},{bodyOffset:10000001},{limit:0},{limit:11},{maxCharacters:0},{maxCharacters:6001},{bodyOffset:1}])
    assert.throws(()=>assertMailThreadInput({...input(),...patch}));
});
test('mail external DTO accessors and cycles refuse before executing getters',()=>{
  let calls=0;const value=input();Object.defineProperty(value,'limit',{enumerable:true,get(){calls++;return 3;}});
  assert.throws(()=>assertMailThreadInput(value),/accessor/);assert.equal(calls,0);
  const cyclic=input();cyclic.subject.extra=cyclic;assert.throws(()=>assertMailThreadInput(cyclic),/acyclic/);
  const p=page();Object.defineProperty(p.messages[0].section,'text',{enumerable:true,get(){calls++;return 'stored';}});
  assert.throws(()=>assertMailThreadSourcePage(p,input()),/accessor/);assert.equal(calls,0);
});
test('stored disconnected reads remain transport-only with unknown immutable identities',()=>{
  const p=page();assertMailThreadSourcePage(p,input());
  assert.equal(p.messages[0].connectionStatus,'disconnected');assert.equal(p.snapshotVersionId,null);
  assert.equal(p.messages[0].recordVersionId,null);assert.equal(p.evidenceReady,false);
  for(const status of ['connected','error','revoked']){const q=page();q.messages[0].connectionStatus=status;assertMailThreadSourcePage(q,input());}
});
test('UTF-16 offsets count a surrogate pair as two units and permit its legacy split',()=>{
  const request={...input(),messageId,maxCharacters:1},p=page(request);
  p.messages[0].section={start:0,endExclusive:1,totalCodeUnits:2,unit:'utf16-code-unit',text:'\ud83d',hasMore:true};
  p.nextBodyOffsets=[{messageId,bodyOffset:1}];p.coverage.truncated=true;assertMailThreadSourcePage(p,request);
  p.messages[0].section.text='😀';assert.throws(()=>assertMailThreadSourcePage(p,request),/UTF-16/);
  p.messages[0].section.unit='unicode-scalar';assert.throws(()=>assertMailThreadSourcePage(p,request));
});
test('late decisive body section remains an unresolved read despite ending the stored body',()=>{
  const request={...input(),messageId,bodyOffset:6,maxCharacters:4},p=page(request);
  p.messages[0].section={start:6,endExclusive:10,totalCodeUnits:10,unit:'utf16-code-unit',text:'LATE',hasMore:false};
  p.messages[0].bodyCompleteness='preview';assertMailThreadSourcePage(p,request);
  assert.equal(p.evidenceReady,false);assert.deepEqual(p.continuation.requiredReads,['opaque-read']);
  p.continuation.requiredReads=[];assert.throws(()=>assertMailThreadSourcePage(p,request),/decisive/);
});
test('offset beyond stored body is disclosed empty transport, not absent material',()=>{
  const request={...input(),messageId,bodyOffset:20},p=page(request);
  p.messages[0].section={start:6,endExclusive:6,totalCodeUnits:6,unit:'utf16-code-unit',text:'',hasMore:false};
  assertMailThreadSourcePage(p,request);assert.equal(p.negativeAssertion.kind,'none');
  p.messages[0].section.start=20;assert.throws(()=>assertMailThreadSourcePage(p,request));
});
test('all upstream completeness states stay incomplete and missing differs from empty',()=>{
  for(const completeness of ['full','preview','truncated','unknown']){const p=page();p.messages[0].bodyCompleteness=completeness;assertMailThreadSourcePage(p,input());assert.equal(p.evidenceReady,false);}
  const p=page();p.messages[0].bodyCompleteness='missing';p.messages[0].section={start:0,endExclusive:0,totalCodeUnits:null,unit:'utf16-code-unit',text:null,hasMore:null};assertMailThreadSourcePage(p,input());
  p.messages[0].section.text='';assert.throws(()=>assertMailThreadSourcePage(p,input()),/Missing mail/);
});
test('unknown body size and snapshot cannot imply completion',()=>{
  const p=page();p.messages[0].section.totalCodeUnits=null;p.messages[0].section.hasMore=null;assertMailThreadSourcePage(p,input());
  p.messages[0].section.hasMore=false;assert.throws(()=>assertMailThreadSourcePage(p,input()),/Unknown body/);
  const q=page();q.coverage.enumeration='partial';assert.throws(()=>assertMailThreadSourcePage(q,input()),/Unknown snapshot/);
});
test('selection and exact normalized argument digest must agree with original request',()=>{
  for(const mutate of [p=>p.argumentsSha256='a'.repeat(64),p=>p.selection.limit=4,p=>p.selection.threadId=messageId,p=>p.messages[0].threadId=messageId,p=>p.messages[0].removed=true]){
    const p=page();mutate(p);assert.throws(()=>assertMailThreadSourcePage(p,input()));
  }
});
test('personal/client request and resolved subject agree without broadening authority',()=>{
  const request={...input(),subject:{kind:'client',entityId:'client-a'}},p=page(request);
  p.subject.kind='client';p.subject.entityType='client';p.subject.entityIds=['client-a'];assertMailThreadSourcePage(p,request);
  p.subject.entityIds=['client-b'];assert.throws(()=>assertMailThreadSourcePage(p,request),/subject/);
  const q=page();q.messages[0].scopes[0].policyRevision='old';assert.throws(()=>assertMailThreadSourcePage(q,input()),/lineage/);
  const r=page();r.binding.actorId='other';assert.throws(()=>assertMailThreadSourcePage(r,input()),/binding/);
});
test('denied source cannot contribute; mixed source accounting keeps eligible stored read',()=>{
  const p=page();p.sources.push({...structuredClone(p.sources[0]),sourceId:'mail-other',status:'denied'});
  p.coverage.sourcesRequested.push('mail-other');p.coverage.sourcesUnavailable.push('mail-other');assertMailThreadSourcePage(p,input());
  p.messages[0].sourceId='mail-other';assert.throws(()=>assertMailThreadSourcePage(p,input()),/not eligible/);
  const q=page();q.coverage.sourcesChecked=[];assert.throws(()=>assertMailThreadSourcePage(q,input()),/coverage/);
});
test('message count and continuation use the filtered message collection',()=>{
  const request={...input(),limit:1},p=page(request);p.totalMessages=2;p.coverage.enumerableTotal=2;p.hasMoreMessages=true;p.nextMessageOffset=1;p.coverage.truncated=true;assertMailThreadSourcePage(p,request);
  p.nextMessageOffset=2;assert.throws(()=>assertMailThreadSourcePage(p,request),/continuation/);
  const exact={...request,messageId},q=page(exact);q.totalMessages=2;q.coverage.enumerableTotal=2;q.hasMoreMessages=true;q.nextMessageOffset=1;q.coverage.truncated=true;assert.throws(()=>assertMailThreadSourcePage(q,exact),/whole thread/);
});
test('unknown message totals cannot invent next positions or aggregate totals',()=>{
  const p=page();p.totalMessages=null;p.coverage.enumerableTotal=null;p.hasMoreMessages=null;assertMailThreadSourcePage(p,input());
  for(const mutate of [q=>q.hasMoreMessages=false,q=>q.nextMessageOffset=1,q=>q.coverage.enumerableTotal=1]){const q=structuredClone(p);mutate(q);assert.throws(()=>assertMailThreadSourcePage(q,input()),/Unknown mail/);}
});
test('body continuation inventory, page bounds and truncation agree',()=>{
  const request={...input(),maxCharacters:3},p=page(request);p.messages[0].section={start:0,endExclusive:3,totalCodeUnits:6,unit:'utf16-code-unit',text:'sto',hasMore:true};p.nextBodyOffsets=[{messageId,bodyOffset:3}];p.coverage.truncated=true;assertMailThreadSourcePage(p,request);
  for(const mutate of [q=>q.nextBodyOffsets=[],q=>q.nextBodyOffsets[0].bodyOffset=4,q=>q.coverage.truncated=false,q=>q.messages[0].section.text='stored']){const q=structuredClone(p);mutate(q);assert.throws(()=>assertMailThreadSourcePage(q,request));}
});
test('duplicate messages cannot inflate count using another citation or version',()=>{
  const p=page();p.messages.push({...structuredClone(p.messages[0]),citationId:uuid,recordVersionId:'different',readHandle:'another-read'});p.totalMessages=2;p.coverage.returnedCount=2;p.coverage.enumerableTotal=2;p.continuation.requiredReads.push('another-read');
  assert.throws(()=>assertMailThreadSourcePage(p,input()),/Duplicate mail message/);
});
test('transport refuses absence, evidence-ready, complete enumeration and cursor guarantees',()=>{
  for(const mutate of [p=>p.evidenceReady=true,p=>p.negativeAssertion={kind:'absence'},p=>p.coverage.enumeration='complete',p=>p.continuation.cursor='invented-snapshot',p=>p.order='receivedAt-asc-id-asc']){const p=page();mutate(p);assert.throws(()=>assertMailThreadSourcePage(p,input()));}
  assert.throws(()=>assertEvidence(page()));assert.throws(()=>validateShape('EvidenceEnvelope',page()));
});
test('empty stored thread page never certifies absence',()=>{
  const p=page();p.messages=[];p.totalMessages=0;p.coverage.returnedCount=0;p.coverage.enumerableTotal=0;p.continuation.requiredReads=[];assertMailThreadSourcePage(p,input());assert.equal(p.negativeAssertion.kind,'none');assert.equal(p.evidenceReady,false);
});
test('concrete catalog preserves every ledger ID/boundary and only one unavailable mapping',()=>{
  const c=catalog();assertCatalog(c);
  const ledger=JSON.parse(readFileSync(new URL('../../../docs/coordination/r2/capabilities.json',import.meta.url)));
  assert.deepEqual(c.originals.map(({id,disposition,boundary})=>({id,disposition,boundary})),ledger.records.map(r=>({id:r.fields.ID,disposition:r.acceptedScope.disposition,boundary:r.acceptedScope.boundary})));
  assert.equal(c.originals.length,139);assert.equal(c.originals.filter(r=>r.disposition==='selected').length,96);assert.equal(c.originals.filter(r=>r.disposition==='deferred').length,43);
  assert.equal(c.operations.length,1);assert.equal(c.originals.filter(r=>r.state==='mapped').length,1);
  assert.equal(c.originals.find(r=>r.state==='mapped').id,'get_email_thread');
  assert.equal(c.operations[0].availability,'unimplemented');assert.equal(c.operations[0].qualification,'pending');assert.equal(c.operations[0].handler,null);
});
test('mail descriptor raw-byte schema pins and exact definition IDs cannot drift',()=>{
  const c=catalog(),raw=readFileSync(new URL('../retrieval-0.2/mail.schema.json',import.meta.url));
  assert.equal(c.operations[0].inputSchema.sha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(c.operations[0].outputSchema.sha256,c.operations[0].inputSchema.sha256);
  for(const field of ['inputSchema','outputSchema']){const q=catalog();q.operations[0][field].sha256='a'.repeat(64);assert.throws(()=>assertCatalog(q),/byte pin/);const r=catalog();r.operations[0][field].id='urn:meri:other';assert.throws(()=>assertCatalog(r),/byte pin/);}
});
test('no skill can expose the pending mail operation',()=>{
  const m={contractVersion:'0.2.0',skillId:'quick_skill.mail_history',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:mail',sha256:'a'.repeat(64)},requiredSources:[{sourceId:'mail',authority:'authoritative',purpose:'evidence'}],allowedOperations:[{id:'mail.read_thread',version:'0.2.0'}],subjectKinds:['personal'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'read',requirement:'Complete actual body reads',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets:{maxTurns:4,maxToolCalls:4,maxRecoveryAttempts:1,maxRuntimeSeconds:30,maxCostMicroUSD:1000,maxOutputBytes:10000},versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
  assert.throws(()=>assertSkillManifest(m,catalog()),/unavailable/);
});
test('mail schema objects stay closed and package public exports stay 0.1 only',()=>{
  const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/mail.schema.json',import.meta.url)));
  const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='object')assert.equal(node.additionalProperties,false);for(const child of Object.values(node))if(child&&typeof child==='object')walk(child);};walk(schema);
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));assert.equal(pkg.version,'0.1.0');assert(!JSON.stringify(pkg.exports).includes('retrieval-0.2'));assert(!pkg.files.includes('retrieval-0.2'));
});

test('mailbox identity and authoritative body lineage cannot be substituted',()=>{
  const p=page();p.messages[0].mailboxId=messageId;assert.throws(()=>assertMailThreadSourcePage(p,input()),/mailbox scope/);
  const q=page();q.sources[0].authority='derived';assert.throws(()=>assertMailThreadSourcePage(q,input()),/authoritative/);
  const r=page();r.snapshotVersionId='snapshot-a';r.sources[0].snapshotVersionId='snapshot-b';assert.throws(()=>assertMailThreadSourcePage(r,input()),/snapshot lineage/);
  const s=page();const other={...structuredClone(s.messages[0]),messageId:uuid,mailboxId:messageId,readHandle:'second'};
  s.messages.push(other);s.totalMessages=2;s.coverage.enumerableTotal=2;s.coverage.returnedCount=2;s.continuation.requiredReads.push('second');assert.throws(()=>assertMailThreadSourcePage(s,input()),/another mailbox/);
});

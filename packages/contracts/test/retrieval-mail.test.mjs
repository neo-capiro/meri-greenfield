import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../validate.mjs';
import { assertMailThreadInput, assertMailThreadSourcePage, assertMailListInput, assertMailSearchInput, assertMailCandidateSourcePage, assertCatalog, assertSkillManifest, assertEvidence, validateShape } from '../retrieval-0.2/validate.mjs';

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
test('concrete catalog preserves every ledger ID/boundary and fourteen unavailable mappings and a partial typed operation',()=>{
  const c=catalog();assertCatalog(c);
  const ledger=JSON.parse(readFileSync(new URL('../../../docs/coordination/r2/capabilities.json',import.meta.url)));
  assert.deepEqual(c.originals.map(({id,disposition,boundary})=>({id,disposition,boundary})),ledger.records.map(r=>({id:r.fields.ID,disposition:r.acceptedScope.disposition,boundary:r.acceptedScope.boundary})));
  assert.equal(c.originals.length,139);assert.equal(c.originals.filter(r=>r.disposition==='selected').length,96);assert.equal(c.originals.filter(r=>r.disposition==='deferred').length,43);
  assert.equal(c.operations.length,71);assert.equal(c.originals.filter(r=>r.state==='mapped').length,70);
  assert.deepEqual(c.originals.filter(r=>r.state==='mapped' && ['list_emails','search_emails','get_email_thread'].includes(r.id)).map(r=>r.id),['list_emails','search_emails','get_email_thread']);
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

const clock = {nowMs:Date.parse('2026-01-02T00:00:00Z')};
const listInput = () => ({subject:{kind:'personal'}});
function candidatePage(request=listInput(),operation='mail.list_messages') {
  const selection=(operation==='mail.list_messages'?assertMailListInput:assertMailSearchInput)(request,clock);
  const p=page();
  for(const k of ['totalMessages','hasMoreMessages','nextMessageOffset','nextBodyOffsets'])delete p[k];
  p.kind='mail-candidate-source-page';p.operation.id=operation;p.selection=selection;p.argumentsSha256=canonicalSha256(selection);
  p.filterSha256=canonicalSha256({...selection,offset:0,asOf:null});p.order='effectiveAt-desc-nullslast_messageId-desc';
  p.queryScope={asOfInclusive:selection.asOf??'2026-01-01T00:00:00Z',storedCreatedAtEndInclusive:selection.asOf??'2026-01-01T00:00:00Z',effectiveStartInclusive:null,missingEffectiveDates:'included'};
  p.messages=[{sourceId:'mail',mailboxId,threadId:uuid,messageId,recordVersionId:null,citationId:null,scopes:[scope()],removed:false,connectionStatus:'disconnected',readHandle:'opaque-read',internetMessageId:'<synthetic@example.invalid>',clientId:null,receivedAt:'2026-01-01T00:00:00Z',sentAt:null,createdAt:'2026-01-01T00:00:00Z',effectiveAt:'2026-01-01T00:00:00Z',subjectText:'synthetic',preview:{kind:'incomplete-preview',text:'preview',fullSizeKnown:false},from:{email:null,name:null},to:[],cc:[],toTruncated:false,ccTruncated:false}];
  p.totalMatches=1;p.hasMore=false;p.nextOffset=null;
  p.threadGroups=operation==='mail.list_messages'?[{mailboxId,threadId:uuid,messageIds:[messageId]}]:null;p.returnedThreadGroupCount=operation==='mail.list_messages'?1:null;
  return p;
}
test('list/search defaults are strict inert normalized DATA with no clock invention',()=>{
  const i=listInput(),snapshot=structuredClone(i);assert.deepEqual(assertMailListInput(i),{subject:{kind:'personal'},folder:'all',withinDays:null,limit:15,offset:0,asOf:null});assert.deepEqual(i,snapshot);
  const s=assertMailSearchInput({...i,folder:'inbox'});assert.equal(s.limit,20);assert.equal(s.query,'');
  assert.throws(()=>assertMailSearchInput(i),/filter/);
  for(const patch of [{limit:null},{limit:'15'},{offset:true},{withinDays:0},{withinDays:3651},{offset:10001},{folder:'Inbox'},{query:'x'},{asOf:null},{actorId:'foreign'}])assert.throws(()=>assertMailListInput({...i,...patch}));
  for(const patch of [{query:null},{query:'x'.repeat(201)},{query:'😀'.repeat(101)},{participant:1}])assert.throws(()=>assertMailSearchInput({...i,folder:'inbox',...patch}));
  for(const patch of [{limit:1},{limit:50},{withinDays:3650}])assertMailListInput({...i,...patch});
  for(const patch of [{limit:0},{limit:51},{offset:-1},{withinDays:1.5}])assert.throws(()=>assertMailListInput({...i,...patch}));
});
test('search literal terms remain distinct AND filters and keyword-free scoped search is valid',()=>{
  const i={...listInput(),query:'  %_\\literal  ',from:'sender',participant:'person'};
  const s=assertMailSearchInput(i);assert.equal(s.query,'%_\\literal');assert.equal(s.from,'sender');assert.equal(s.participant,'person');assert.equal(i.query,'  %_\\literal  ');
  assertMailSearchInput({...listInput(),withinDays:1});assertMailSearchInput({...listInput(),folder:'sent'});
  assert.throws(()=>assertMailSearchInput({...listInput(),query:'   '}));
});
test('list/search getters hidden fields null and nonfinite values are refused without effects',()=>{
  let n=0;const i=listInput();Object.defineProperty(i,'limit',{enumerable:true,get(){n++;return 15;}});assert.throws(()=>assertMailListInput(i),/accessor/);assert.equal(n,0);
  const hidden=listInput();Object.defineProperty(hidden,'secret',{value:'x'});assert.throws(()=>assertMailListInput(hidden),/hidden/);
  for(const value of [null,[],{...listInput(),offset:Infinity},{...listInput(),offset:NaN}])assert.throws(()=>assertMailListInput(value));
});
test('candidate query inclusive anchor is separate from exclusive requester window',()=>{
  const request={...listInput(),withinDays:1,asOf:'2026-01-01T00:00:00Z'},p=candidatePage(request);
  p.queryScope.effectiveStartInclusive='2025-12-31T00:00:00Z';p.queryScope.missingEffectiveDates='excluded';
  p.window={basis:'explicit',timezone:'UTC',startInclusive:'2025-12-31T00:00:00Z',endExclusive:'2026-01-01T00:00:00Z',weekStartsOn:null};
  assertMailCandidateSourcePage(p,request,'mail.list_messages',clock);
  const q=structuredClone(p);q.messages[0].effectiveAt=q.messages[0].receivedAt='2025-12-31T00:00:00Z';assertMailCandidateSourcePage(q,request,'mail.list_messages',clock);
  for(const edit of [q=>q.queryScope.asOfInclusive='2026-01-01T00:00:00.001Z',q=>q.queryScope.effectiveStartInclusive='2025-12-31T00:00:00.001Z',q=>q.messages[0].effectiveAt=q.messages[0].receivedAt=null]){const q=structuredClone(p);edit(q);assert.throws(()=>assertMailCandidateSourcePage(q,request,'mail.list_messages',clock));}
  assert.throws(()=>assertMailListInput({...listInput(),asOf:'2026-01-02T00:00:01.001Z'},clock),/clock/);
  assert.throws(()=>assertMailListInput({...listInput(),asOf:'2026-01-01T00:00:00Z'}),/nowMs/);
});
test('message totals and page-only groups differ; exhausted preview never proves absence',()=>{
  const p=candidatePage();p.messages.push({...structuredClone(p.messages[0]),messageId:uuid,internetMessageId:'<second>',readHandle:'second'});p.totalMatches=2;p.coverage.enumerableTotal=2;p.coverage.returnedCount=2;p.continuation.requiredReads.push('second');p.threadGroups[0].messageIds.push(uuid);
  assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock);assert.equal(p.returnedThreadGroupCount,1);assert.equal(p.totalMatches,2);
  assert.throws(()=>assertEvidence(p));
  for(const edit of [q=>q.returnedThreadGroupCount=2,q=>q.threadGroups[0].messageIds.reverse(),q=>q.evidenceReady=true,q=>q.coverage.enumeration='complete',q=>q.negativeAssertion={kind:'absence'}]){const q=structuredClone(p);edit(q);assert.throws(()=>assertMailCandidateSourcePage(q,listInput(),'mail.list_messages',clock));}
});
test('continuation binds retained anchor filters actor window and message offset',()=>{
  const request={...listInput(),limit:1},prior=candidatePage(request);prior.totalMatches=2;prior.coverage.enumerableTotal=2;prior.hasMore=true;prior.nextOffset=1;prior.coverage.truncated=true;
  assertMailCandidateSourcePage(prior,request,'mail.list_messages',clock);
  const nextRequest={...request,offset:1,asOf:'2026-01-01T00:00:00Z'},p=candidatePage(nextRequest);p.totalMatches=2;p.coverage.enumerableTotal=2;
  assertMailCandidateSourcePage(p,nextRequest,'mail.list_messages',{...clock,previousPage:prior});
  assert.throws(()=>assertMailCandidateSourcePage(p,nextRequest,'mail.list_messages',clock));
  for(const edit of [q=>q.queryScope.asOfInclusive='2026-01-01T00:00:00.001Z',q=>q.filterSha256='a'.repeat(64),q=>q.binding.writerFence=2,q=>q.nextOffset=2,q=>q.argumentsSha256='a'.repeat(64)]){const q=structuredClone(prior);edit(q);assert.throws(()=>assertMailCandidateSourcePage(p,nextRequest,'mail.list_messages',{...clock,previousPage:q}));}
  assert.throws(()=>assertMailListInput({...request,offset:1}),/asOf/);
});
test('dedup is mailbox-specific; order nulls-last and immutable versions are conservative',()=>{
  const p=candidatePage();p.messages.push({...structuredClone(p.messages[0]),messageId:uuid,readHandle:'other'});p.totalMatches=2;p.coverage.enumerableTotal=2;p.coverage.returnedCount=2;p.continuation.requiredReads.push('other');p.threadGroups[0].messageIds.push(uuid);
  assert.throws(()=>assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock),/deduplication/);
  p.messages[1].internetMessageId='<different>';p.messages[0].effectiveAt=p.messages[0].receivedAt=null;assert.throws(()=>assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock),/order/);
  const q=candidatePage();q.messages[0].recordVersionId='proof-format-1';assert.throws(()=>assertMailCandidateSourcePage(q,listInput(),'mail.list_messages',clock));
  const r=candidatePage();r.snapshotVersionId='asOf-is-not-snapshot';assert.throws(()=>assertMailCandidateSourcePage(r,listInput(),'mail.list_messages',clock));
});
test('authorization source and mailbox scopes are independent of connection state',()=>{
  for(const status of ['connected','disconnected','error','revoked']){const p=candidatePage();p.messages[0].connectionStatus=status;assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock);}
  for(const edit of [p=>{p.sources[0].status='denied';p.coverage.sourcesChecked=[];p.coverage.sourcesUnavailable=['mail'];},p=>p.messages[0].mailboxId=messageId,p=>p.messages[0].scopes[0].policyRevision='foreign',p=>p.messages[0].removed=true,p=>p.continuation.requiredReads=[]]){const p=candidatePage();edit(p);assert.throws(()=>assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock));}
});
test('preview has no body offsets size guarantee or recipient completeness upgrade',()=>{
  for(const text of [null,'','😀']){const p=candidatePage();p.messages[0].preview.text=text;assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock);}
  for(const edit of [p=>p.messages[0].preview.fullSizeKnown=true,p=>p.messages[0].preview.bodyOffset=0,p=>p.messages[0].preview.text='😀'.repeat(20000),p=>p.messages[0].to=Array.from({length:9},()=>({email:null,name:null}))]){const p=candidatePage();edit(p);assert.throws(()=>assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock));}
});
test('search page operation groups counts filters and all pending descriptor pins are closed',()=>{
  const request={...listInput(),query:'synthetic'},p=candidatePage(request,'mail.search_messages');assertMailCandidateSourcePage(p,request,'mail.search_messages',clock);
  for(const edit of [p=>p.operation.id='mail.list_messages',p=>p.threadGroups=[],p=>p.argumentsSha256='a'.repeat(64),p=>p.totalMatches=3]){const q=structuredClone(p);edit(q);assert.throws(()=>assertMailCandidateSourcePage(q,request,'mail.search_messages',clock));}
  const c=catalog();for(const op of c.operations){assert.equal(op.handler,null);assert.equal(op.retry.maxRetries,0);assert.equal(op.availability,'unimplemented');const q=catalog();q.operations.find(r=>r.operation.id===op.operation.id).inputSchema.sha256='b'.repeat(64);assert.throws(()=>assertCatalog(q),/byte pin/);}
});
test('cross-mailbox identical internet IDs stay distinct stored candidates',()=>{
  const p=candidatePage(),other={...scope(),resourceId:messageId};p.subject.scopes.push(other);
  p.messages.push({...structuredClone(p.messages[0]),mailboxId:messageId,scopes:[structuredClone(other)],messageId:uuid,readHandle:'other-mailbox'});
  p.totalMatches=2;p.coverage.enumerableTotal=2;p.coverage.returnedCount=2;p.continuation.requiredReads.push('other-mailbox');p.threadGroups.push({mailboxId:messageId,threadId:uuid,messageIds:[uuid]});p.returnedThreadGroupCount=2;
  assertMailCandidateSourcePage(p,listInput(),'mail.list_messages',clock);
  const client='client-synthetic',request={subject:{kind:'client',entityId:client}},q=candidatePage(request);q.subject.kind='client';q.subject.entityType='client';q.subject.entityIds=[client];q.messages[0].clientId=client;
  assertMailCandidateSourcePage(q,request,'mail.list_messages',clock);q.messages[0].clientId='foreign';assert.throws(()=>assertMailCandidateSourcePage(q,request,'mail.list_messages',clock),/client selection/);
});
test('offset ceiling keeps hasMore true with null nextOffset and no completeness',()=>{
  const priorRequest={...listInput(),limit:1,offset:9999,asOf:'2026-01-01T00:00:00Z'},prior=candidatePage(priorRequest);prior.totalMatches=10002;prior.coverage.enumerableTotal=10002;prior.hasMore=true;prior.nextOffset=10000;prior.coverage.truncated=true;
  const request={...priorRequest,offset:10000},p=candidatePage(request);p.totalMatches=10002;p.coverage.enumerableTotal=10002;p.hasMore=true;p.nextOffset=null;p.coverage.truncated=true;
  assertMailCandidateSourcePage(p,request,'mail.list_messages',{...clock,previousPage:prior});
  for(const edit of [q=>q.totalMatches=10000,q=>q.coverage.truncated=false,q=>q.queryScope.storedCreatedAtEndInclusive='2026-01-01T00:00:00.001Z',q=>q.selection.asOf='2025-12-31T00:00:00Z']){const q=structuredClone(prior);edit(q);assert.throws(()=>assertMailCandidateSourcePage(p,request,'mail.list_messages',{...clock,previousPage:q}));}
});
test('empty search and unknown stored totals cannot become complete or absent',()=>{
  const request={...listInput(),folder:'inbox'},p=candidatePage(request,'mail.search_messages');p.messages=[];p.totalMatches=0;p.hasMore=false;p.nextOffset=null;p.coverage.returnedCount=0;p.coverage.enumerableTotal=0;p.continuation.requiredReads=[];
  assertMailCandidateSourcePage(p,request,'mail.search_messages',clock);assert.equal(p.evidenceReady,false);assert.equal(p.negativeAssertion.kind,'none');assert.throws(()=>assertEvidence(p));
  const q=candidatePage();q.totalMatches=null;q.hasMore=null;q.coverage.enumerableTotal=null;assertMailCandidateSourcePage(q,listInput(),'mail.list_messages',clock);q.hasMore=false;assert.throws(()=>assertMailCandidateSourcePage(q,listInput(),'mail.list_messages',clock),/Unknown stored total/);
});

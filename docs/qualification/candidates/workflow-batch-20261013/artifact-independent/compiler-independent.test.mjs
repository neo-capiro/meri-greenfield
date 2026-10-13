import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createMailHistoryCompiler} from '../../../../../apps/control/document-application/mail-history/compose.mjs';
import {bindPreparedMailHistoryArtifactOptions} from '../../../../../apps/control/document-application/mail-history/binding.mjs';
import {unitContext,selected,makeInput,sourcePage,NOW,corpus,lateQuote,uid} from '../../../../../apps/control/document-application/mail-history/test/fixtures.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const compile=(source=sourcePage,limits={},context=unitContext(),input=makeInput(),options={})=>createMailHistoryCompiler({readSource:source,now:()=>NOW,defaultCongress:119,limits,...options}).prepare(input,context,{selection:selected(context)});
const text=p=>p.request.content.blocks.flatMap(b=>b.runs?.map(r=>r.text)??[]).join('\n');
const sha=b=>createHash('sha256').update(b).digest('hex');

test('actual original prose, canonical pages and full late body bind exact passage while all coverage stays partial',async()=>{
 const p=await compile();const prose=await readFile(new URL('../../../../../packages/skills/originals/mail_history/1.0.0/SKILL.md',import.meta.url));
 assert.equal(sha(prose),p.provenance.skill.proseSha256);assert.equal(p.provenance.readsSha256,v.hash(p.reads));
 assert.equal(p.bodies[0].text,corpus);assert(p.quotes[0].start>2000);assert.equal(p.quotes[0].passage,lateQuote);
 assert.equal(p.quotes[0].passageSha256,sha(Buffer.from(lateQuote)));assert.equal(p.context.evidence[0].contentSha256,sha(Buffer.from(corpus)));
 assert.deepEqual(p.bodies[0].sections.map(s=>[s.start,s.end]),[[0,1999],[1999,corpus.length]]);
 assert.deepEqual([...new Set(p.coverage.map(c=>c.sourceId))].sort(),['entity_candidates','mail','tenant_contacts']);
 assert(p.coverage.every(c=>c.verified===false&&c.enumeration==='unknown'));assert.match(text(p),/\[unverified interpretation\]/u);
});

test('body call exhaustion after a real first section preserves unread locator, cap and zero evidence',async()=>{
 const p=await compile(sourcePage,{maxCalls:5});assert.equal(p.bodies[0].sections.length,1);assert.equal(p.context.evidence.length,0);
 const c=p.coverage.find(c=>c.operation==='mail.read_thread');assert.equal(c.unreadCount,1);assert.equal(c.boundBodyCount,0);assert.equal(c.unread[0].reason,'CALL_BUDGET_EXHAUSTED');
 assert.match(text(p),/unread 1/u);assert.match(text(p),/CALL_BUDGET_EXHAUSTED/u);assert.equal(p.provenance.collection.limits.maxCalls,5);assert.equal(p.provenance.collection.capHits[0].kind,'call-cap');
});

test('message body cap discloses exact distinct unread candidates rather than counting previews as evidence',async()=>{
 const source=call=>{const page=sourcePage(call);if(call.operation.id==='mail.search_messages'){
  page.messages=[0,1,2].map(n=>{const row=structuredClone(page.messages[0]);row.messageId=uid(74-n);row.internetMessageId=`<independent-${n}@example.invalid>`;row.readHandle=`independent-preview-${n}`;row.receivedAt=new Date(Date.parse(row.receivedAt)-n*1000).toISOString();row.effectiveAt=row.receivedAt;row.createdAt=row.receivedAt;return row;});
  page.totalMatches=3;page.coverage.returnedCount=3;page.coverage.enumerableTotal=3;page.continuation.requiredReads=page.messages.map(m=>m.readHandle);
 }return page;};
 const p=await compile(source,{maxMessages:1});const c=p.coverage.find(c=>c.operation==='mail.read_thread');
 assert.equal(c.distinctEligibleCount,3);assert.equal(c.boundBodyCount,1);assert.equal(c.unreadCount,2);assert.deepEqual(c.unread.map(r=>r.reason),['MESSAGE_BODY_CAP','MESSAGE_BODY_CAP']);
 for(const handle of ['independent-preview-1','independent-preview-2'])assert(text(p).includes(handle));assert.equal(p.provenance.collection.unreadCount,2);assert.equal(p.context.evidence.length,1);
});

test('visible required source failure remains a partial artifact, not absence or guessed contacts',async()=>{
 const p=await compile(call=>{if(call.operation.id==='find_contacts')throw Object.assign(Error('synthetic refusal'),{code:'SOURCE_UNAVAILABLE'});return sourcePage(call);});
 const c=p.coverage.find(c=>c.sourceId==='tenant_contacts');assert.equal(c.status,'unavailable');assert.equal(c.result,null);assert.match(text(p),/tenant_contacts.*unavailable/u);assert.match(text(p),/never establish complete history or absence/u);
});

test('preview text containing the selected quote and its locator URL still produces no verified excerpt',async()=>{
 const p=await compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread')page.messages[0].bodyCompleteness='preview';return page;});
 assert.equal(p.quotes[0].status,'missing-or-unread-version');assert.equal(p.quotes[0].evidence,null);assert.equal(p.context.evidence.length,0);assert.match(text(p),/locator URL, not verification/u);
});

test('changed citation after the first real section is visibly conflicting and cannot bind the late quote',async()=>{
 const p=await compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'&&call.request.bodyOffset>0)page.messages[0].citationId=uid(99);return page;});
 assert.equal(p.bodies[0].status,'conflicting-body-sections');assert.equal(p.context.evidence.length,0);assert.equal(p.quotes[0].passage,null);assert.match(text(p),/conflicting-body-sections/u);
});

test('wellformed contiguous Unicode pages bind the exact recombined full body',async()=>{
 const body='x'.repeat(1980)+'😀'+'x'.repeat(50)+lateQuote,input=makeInput();input.quotes[0].start=2032;input.quotes[0].end=2032+lateQuote.length;
 const p=await compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'){
  const row=page.messages[0],start=call.request.bodyOffset,end=Math.min(body.length,start+call.request.maxCharacters);row.contentSha256=sha(Buffer.from(body));row.section={start,endExclusive:end,totalCodeUnits:body.length,unit:'utf16-code-unit',text:body.slice(start,end),hasMore:end<body.length};page.nextBodyOffsets=end<body.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<body.length;
 }return page;},{},unitContext(),input);
 assert.equal(p.bodies[0].text,body);assert.equal(p.quotes[0].status,'bound-source-excerpt');assert.equal(p.quotes[0].passage,lateQuote);assert.equal(p.context.evidence[0].contentSha256,sha(Buffer.from(body)));assert.equal(p.bodies[0].sections.length,2);
});

test('split-surrogate producer section is explicitly refused by the canonical boundary validator',async()=>{
 const body='x'.repeat(1999)+'😀'+lateQuote;
 await assert.rejects(compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'){
  const row=page.messages[0],start=call.request.bodyOffset,end=Math.min(body.length,start+call.request.maxCharacters);row.contentSha256=sha(Buffer.from(body));row.section={start,endExclusive:end,totalCodeUnits:body.length,unit:'utf16-code-unit',text:body.slice(start,end),hasMore:end<body.length};page.nextBodyOffsets=end<body.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<body.length;
 }return page;}),/Mail UTF-16 boundary mismatch/u);
});

test('one-unit body budget returns a whole astral pair, advances actual end and binds exact final hash',async()=>{
 const body='A😀Q',input=makeInput();Object.assign(input.quotes[0],{start:3,end:4,text:'Q'});
 const spans=new Map([[0,1],[1,3],[3,4]]);
 const p=await compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'){
  const row=page.messages[0],start=call.request.bodyOffset,end=spans.get(start);assert.notEqual(end,undefined);row.contentSha256=sha(Buffer.from(body));row.section={start,endExclusive:end,totalCodeUnits:4,unit:'utf16-code-unit',text:body.slice(start,end),hasMore:end<4};page.nextBodyOffsets=end<4?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<4;
 }return page;},{bodySectionCodeUnits:1},unitContext(),input);
 assert.equal(p.bodies[0].text,body);assert.deepEqual(p.bodies[0].sections.map(s=>[s.start,s.end]),[[0,1],[1,3],[3,4]]);assert.equal(p.quotes[0].passage,'Q');assert.equal(p.quotes[0].status,'bound-source-excerpt');assert.equal(p.context.evidence[0].contentSha256,sha(Buffer.from(body)));
});

test('safe shortened boundary followed by complete emoji produces exact contiguous source bytes',async()=>{
 const body='x'.repeat(1999)+'😀'+lateQuote,input=makeInput();input.quotes[0].start=2001;input.quotes[0].end=2001+lateQuote.length;
 const spans=new Map([[0,1999],[1999,body.length]]);
 const p=await compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'){
  const row=page.messages[0],start=call.request.bodyOffset,end=spans.get(start);assert.notEqual(end,undefined);row.contentSha256=sha(Buffer.from(body));row.section={start,endExclusive:end,totalCodeUnits:body.length,unit:'utf16-code-unit',text:body.slice(start,end),hasMore:end<body.length};page.nextBodyOffsets=end<body.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<body.length;
 }return page;},{},unitContext(),input);
 assert.equal(p.bodies[0].text,body);assert.deepEqual(p.bodies[0].sections.map(s=>[s.start,s.end]),[[0,1999],[1999,body.length]]);assert.equal(p.quotes[0].status,'bound-source-excerpt');assert.equal(p.context.evidence[0].contentSha256,sha(Buffer.from(body)));
});

test('altered late body bytes retain valid lengths yet are refused by exact full-body SHA256',async()=>{
 await assert.rejects(compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'&&call.request.bodyOffset>0){const row=page.messages[0];row.section.text=row.section.text.replace('Friday','Monday');}return page;}),/MAIL_HISTORY_BODY_HASH/u);
});

test('current policy revision on canonical source subject cannot be substituted',async()=>{
 await assert.rejects(compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread')page.subject.policyRevision='different-current-policy';return page;}));
});

test('canonical required-read inventory cannot be removed from a returned body',async()=>{
 await assert.rejects(compile(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread')page.continuation.requiredReads=[];return page;}),/requires unresolved decisive read/u);
});

test('private binder preserves authority receiver and rejects mutated request/context before current authority',async()=>{
 const p=await compile();let calls=0;const receiver=new WeakMap();const authority={async check(){assert.equal(receiver.get(this),'current authority');calls++;return {allowed:true};}};receiver.set(authority,'current authority');
 const bound=bindPreparedMailHistoryArtifactOptions(p,{context:p.context,authority});const good={input:{request:p.request,context:p.context,baseVersionId:null}};
 await bound.authority.check(good);assert.equal(calls,1);
 const bad=structuredClone(good);bad.input.request.title='substituted title';await assert.rejects(bound.authority.check(bad),/ACCESS_DENIED/u);
 const foreign=structuredClone(good);foreign.input.context.binding.actorId='other actor';await assert.rejects(bound.authority.check(foreign),/ACCESS_DENIED/u);assert.equal(calls,1);
});

test('abort of parked trusted source observes cancellation and no later returned page can produce an artifact',async()=>{
 const controller=new AbortController();let reached,late,observed=false;const entered=new Promise(resolve=>reached=resolve);
 const compiler=createMailHistoryCompiler({now:()=>NOW,defaultCongress:119,readSource:call=>new Promise(resolve=>{late=()=>resolve(sourcePage(call));call.signal.addEventListener('abort',()=>observed=true,{once:true});reached();})});
 const context=unitContext();const result=compiler.prepare(makeInput(),context,{selection:selected(context),signal:controller.signal});await entered;controller.abort();await assert.rejects(result,/CANCELLED/u);assert.equal(observed,true);late();
});

test('original deadline on a parked trusted source remains a deadline outcome and aborts its owned signal',async()=>{
 const context=unitContext();context.deadlineMs=NOW+30;let late,observed=false;
 const compiler=createMailHistoryCompiler({now:()=>NOW,defaultCongress:119,readSource:call=>new Promise(resolve=>{late=()=>resolve(sourcePage(call));call.signal.addEventListener('abort',()=>observed=true,{once:true});})});
 await assert.rejects(compiler.prepare(makeInput(),context,{selection:selected(context)}),/MAIL_HISTORY_DEADLINE/u);assert.equal(observed,true);late();
});

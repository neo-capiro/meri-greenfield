import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const shaForUnicode=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');
import {createMailHistoryCompiler,admitPreparedMailHistory} from '../compose.mjs';
import {unitContext,selected,makeInput,sourcePage,NOW,corpus,lateQuote,uid} from './fixtures.mjs';
const make=(readSource=sourcePage,limits)=>createMailHistoryCompiler({readSource,now:()=>NOW,defaultCongress:119,limits});
const prepare=(compiler=make(),i=makeInput(),context=unitContext())=>compiler.prepare(i,context,{selection:selected(context)});
const text=result=>result.request.content.blocks.flatMap(b=>b.runs?.map(r=>r.text)??[]).join('\n');

test('actual canonical pages produce editable Word specification, late bound body quote and all original source coverage',async()=>{
 const result=await prepare();assert.equal(result.request.operation,'create_word');assert.equal(result.request.format,'docx');assert.equal(result.bodies[0].text,corpus);assert.equal(result.bodies[0].sections.length,2);
 assert.equal(result.quotes[0].status,'bound-source-excerpt');assert.equal(result.context.evidence[0].recordId,uid(74));assert.equal(result.provenance.collection.calls,6);
 assert.deepEqual([...new Set(result.coverage.map(c=>c.sourceId))].sort(),['entity_candidates','mail','tenant_contacts']);
 for(const phrase of [lateQuote,'unverified interpretation','Metadata is unversioned and unverified','enumeration unknown','locator URL, not verification','snapshot unknown','connection disconnected','Original skill and immutable revision provenance'])assert(text(result).includes(phrase),phrase);
 assert(Object.isFrozen(result.context.evidence));assert.equal(result.coverage[0].verified,false);
});

test('preview, unversioned or incomplete body cannot verify an excerpt',async()=>{
 for(const change of [row=>row.bodyCompleteness='preview',row=>row.recordVersionId=null,row=>row.contentSha256=null]){
  const out=await prepare(make(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread')change(page.messages[0]);return page;}));assert.equal(out.quotes[0].status,'missing-or-unread-version');assert.equal(out.context.evidence.length,0);
 }
});
test('version/hash/citation change across sections remains conflicting and provides no complete-body evidence',async()=>{
 const out=await prepare(make(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'&&call.request.bodyOffset>0)page.messages[0].recordVersionId='changed-v2';return page;}));assert.equal(out.bodies[0].status,'conflicting-body-sections');assert.equal(out.context.evidence.length,0);assert.equal(out.quotes[0].status,'missing-or-unread-version');
});
test('source missing/disconnected and bounded call budget are visible, with no negative claim',async()=>{
 const out=await prepare(make(call=>{if(call.operation.id==='find_contacts')throw Object.assign(Error('SOURCE_UNAVAILABLE'),{code:'SOURCE_UNAVAILABLE'});return sourcePage(call);},{maxCalls:4}));assert.equal(out.coverage.find(c=>c.sourceId==='tenant_contacts').status,'unavailable');assert.equal(out.bodies[0].status,'body-unavailable');assert.match(text(out),/does not establish|never establish/u);assert.equal(out.context.evidence.length,0);
});
for(const [name,change]of [
 ['foreign actor',p=>p.binding.actorId='foreign'],['foreign tenant',p=>p.binding.tenantId='foreign'],['different conversation',p=>p.binding.conversationId=uid(99)],['different run',p=>p.binding.runId=uid(99)],['different attempt',p=>p.binding.attemptId=uid(99)],['stale fence',p=>p.binding.writerFence=99],
 ['mailbox substitution',p=>p.messages[0].mailboxId=uid(99)],['scope substitution',p=>p.messages[0].scopes[0].resourceId=uid(99)],['body hash',p=>p.messages[0].contentSha256='a'.repeat(64)],['operation source substitution',p=>p.operation={id:'mail.list_messages',version:'0.2.0'}],['body range',p=>p.messages[0].section.start=1],['window substitution',p=>p.window={basis:'explicit',startInclusive:'2026-01-01T00:00:00.000Z',endExclusive:'2026-01-02T00:00:00.000Z',timezone:'UTC',weekStartsOn:null}],['authority promotion',p=>p.sources[0].authority='derived']
])test(`refuses ${name}`,async()=>{await assert.rejects(prepare(make(call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread')change(page);return page;})));});

test('an exact source citation does not verify free-form interpretations or mismatched quoted text',async()=>{
 const i=makeInput();i.quotes[0].text=i.quotes[0].text.replace('Friday','Monday');const out=await prepare(make(),i);assert.equal(out.quotes[0].status,'quote-mismatch');assert(text(out).includes('[unverified interpretation]'));
});
test('immutable selected skill and private prepared result cannot be replaced or cloned',async()=>{
 const i=makeInput();i.skill={...i.skill,skillVersion:'1.0.1'};await assert.rejects(prepare(make(),i));const result=await prepare();assert.throws(()=>admitPreparedMailHistory(structuredClone(result),result.context));const guard=admitPreparedMailHistory(result,result.context);assert.throws(()=>guard({request:result.request,baseVersionId:uid(99)}));
});
test('authority loss and cancellation abort instead of producing an unavailable-source draft',async()=>{
 await assert.rejects(prepare(make(()=>{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});})),/SOURCE_AUTHORITY/u);
 const controller=new AbortController();controller.abort();await assert.rejects(make().prepare(makeInput(),unitContext(),{selection:selected(unitContext()),signal:controller.signal}));
});

test('body cap cannot hide five unread decisive messages from fifteen paged candidates',async()=>{
 const {manySourcePage}=await import('./fixtures.mjs');const i=makeInput();i.quotes=[];
 const out=await prepare(make(call=>manySourcePage(call,15)),i),coverage=out.coverage.find(c=>c.operation==='mail.read_thread');
 assert.equal(coverage.distinctEligibleCount,15);assert.equal(coverage.boundBodyCount,10);assert.equal(coverage.unreadCount,5);assert.equal(coverage.unread.length,5);assert(coverage.unread.every(row=>row.reason==='MESSAGE_BODY_CAP'));
 assert.equal(out.provenance.collection.unreadCount,5);assert.equal(out.context.evidence.length,10);
 assert(text(out).includes('Decisive body reads: 10 bound / 15 eligible; unread 5'));assert(text(out).includes('MESSAGE_BODY_CAP'));assert(coverage.unread.every(row=>text(out).includes(row.readHandle)));
});
test('candidate page/call/body-size caps retain their exact stop reason and unverified coverage',async()=>{
 const {manySourcePage}=await import('./fixtures.mjs');const i=makeInput();i.quotes=[];
 const pages=await prepare(make(call=>manySourcePage(call,20)),i);assert(pages.provenance.collection.capHits.some(row=>row.kind==='candidate-page-cap'));assert(text(pages).includes('CANDIDATE_PAGE_CAP'));
 const calls=await prepare(make(sourcePage,{maxCalls:4}));assert(calls.provenance.collection.capHits.some(row=>row.kind==='call-cap'));assert(text(calls).includes('CALL_BUDGET_EXHAUSTED'));
 const body=await prepare(make(sourcePage,{maxBodyCodeUnits:1000}));assert.equal(body.context.evidence.length,0);assert(text(body).includes('BODY_CODE_UNIT_CAP'));assert.equal(body.provenance.collection.unreadCount,1);
});

test('canonical disabled-source GatewayDenied UNAVAILABLE is disclosed partial coverage',async()=>{
 const {deny}=await import('../../../../gateway/dispatch/operation-result.mjs');
 const out=await prepare(make(call=>{if(call.operation.id==='find_contacts')deny('UNAVAILABLE');return sourcePage(call);}));
 const coverage=out.coverage.find(c=>c.sourceId==='tenant_contacts');assert.equal(coverage.status,'unavailable');assert.equal(coverage.reason,'UNAVAILABLE');assert.equal(coverage.verified,false);assert(text(out).includes('tenant_contacts'));assert(text(out).includes('UNAVAILABLE'));assert.equal(out.quotes[0].status,'bound-source-excerpt');
});
function unicodeSource(full){return call=>{
 const page=sourcePage(call);if(call.operation.id!=='mail.read_thread')return page;
 const row=page.messages[0],start=call.request.bodyOffset,end=Math.min(full.length,start+call.request.maxCharacters);
 row.contentSha256=shaForUnicode(full);row.section={start,endExclusive:end,totalCodeUnits:full.length,unit:'utf16-code-unit',text:full.slice(start,end),hasMore:end<full.length};page.nextBodyOffsets=end<full.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<full.length;return page;
};}
test('well-formed contiguous Unicode sections reconstruct only against the exact full body hash',async()=>{
 const full='a'.repeat(1998)+'😀'+' exact retained suffix',i=makeInput();i.quotes=[];
 const out=await prepare(make(unicodeSource(full)),i);assert.equal(out.bodies[0].text,full);assert.equal(out.bodies[0].sections.length,2);assert.equal(out.context.evidence[0].contentSha256,shaForUnicode(full));
});
test('fixed UTF16 page boundary splitting a surrogate pair is refused by the canonical JSON hash',async()=>{
 const full='a'.repeat(1999)+'😀'+' exact retained suffix',i=makeInput();i.quotes=[];
 await assert.rejects(prepare(make(unicodeSource(full)),i),/Lone surrogate is not allowed/u);
});

// Retained initial hypothesis: legitimate UTF16 slices could be accepted and stitched.
// This is intentionally not part of the final PASS suite: canonical gateway/page
// serialization refuses lone surrogates before a compiler can receive such pages.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createMailHistoryCompiler} from '../../../../../apps/control/document-application/mail-history/compose.mjs';
import {unitContext,selected,makeInput,sourcePage,NOW,lateQuote} from '../../../../../apps/control/document-application/mail-history/test/fixtures.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('initial hypothesis: split-surrogate canonical page reaches exact reconstruction',async()=>{
 const body='x'.repeat(1999)+'😀'+lateQuote,input=makeInput(),context=unitContext();input.quotes[0].start=2001;input.quotes[0].end=2001+lateQuote.length;
 const compiler=createMailHistoryCompiler({now:()=>NOW,defaultCongress:119,readSource:call=>{const page=sourcePage(call);if(call.operation.id==='mail.read_thread'){
  const row=page.messages[0],start=call.request.bodyOffset,end=Math.min(body.length,start+call.request.maxCharacters);row.contentSha256=sha(Buffer.from(body));row.section={start,endExclusive:end,totalCodeUnits:body.length,unit:'utf16-code-unit',text:body.slice(start,end),hasMore:end<body.length};page.nextBodyOffsets=end<body.length?[{messageId:row.messageId,bodyOffset:end}]:[];page.coverage.truncated=end<body.length;
 }return page;}});
 const p=await compiler.prepare(input,context,{selection:selected(context)});assert.equal(p.bodies[0].text,body);assert.equal(p.quotes[0].status,'bound-source-excerpt');
});

/** Production-path proof for the report's native source receiving.
 * Every read here crosses the actual gateways (bill-text, federal-legislation) over synthetic Core DTOs and
 * the exact selected-runtime request shape; nothing is asserted about a synthetic envelope. No provider,
 * backend, database, credential or renderer is touched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCongressionalReportCompiler} from '../compose.mjs';
import {reportSkillPin} from '../skill.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {nativeReportPort,REVISION,sha} from './native-source-fixture.mjs';
const NOW=Date.parse('2026-10-13T12:00:00.000Z'),stamp=new Date(NOW).toISOString();
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=uid(9),policy='report-policy-1';
const subject={congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'};
// Eight characters per unit: 2 500 units is exactly 20 000 characters, i.e. three real pages.
const LONG='Clause. '.repeat(2500);
const SHORT='Original independent source: an authorization review is required. No appropriation is stated.';
const context=()=>({binding:{tenantId:'independent-report',actorId:'source-reviewer',conversationId:uid(1),runId:uid(2),attemptId:uid(3),workerId:uid(4),writerFence:1},
 scopes:[{tenantId:'independent-report',kind:'client',resourceId:client,policyRevision:policy}],evidence:[],assets:[],deadlineMs:NOW+5000,maxBytes:1048576});
const selection=()=>({subject:{kind:'client',entityType:'client',entityIds:[client],tenantId:'independent-report',actorId:'source-reviewer',policyRevision:policy,scopes:context().scopes,rosterVersionId:null},
 window:{basis:'explicit',startInclusive:'2026-10-13T11:00:00.000Z',endExclusive:'2026-10-13T13:00:00.000Z',timezone:'UTC',weekStartsOn:null},mondayBoardIds:['101']});
const portFor=(options={})=>nativeReportPort({saved:{binding:context().binding,subject:selection().subject,window:selection().window},bill:subject,...options});
const inputWith=(citations,at=stamp)=>({skill:reportSkillPin(),title:'Independent sourced cited report',subject:structuredClone(subject),asOf:at,summary:'Draft summary.',
 findings:[{id:'excerpt',kind:'excerpt',text:citations[0].text,citations:citations.map(({text,...c})=>c)}],
 conflicts:[],recommendations:['Confirm the appropriations basis.'],limitations:['State docket coverage is not exhaustive.']});
const cite=(start,end,text)=>({text,sourceId:'bill_text',recordId:subject.billId,sourceVersionId:REVISION,start,end,url:'https://example.invalid/never-fetched'});
const prepare=(port,options={})=>createCongressionalReportCompiler({readSource:port.readSource,now:()=>NOW})
 .prepare(inputWith(options.citations??[cite(0,SHORT.length,SHORT)],options.asOf),context(),{selection:selection()});
const document=result=>result.request.content.blocks.flatMap(block=>block.runs?.map(run=>run.text)??[]).join('\n');

test('a multi-page bill text is received page by page under one pin and cited by exact offsets',async()=>{
 const port=portFor({text:LONG}),passage=cite(8500,9500,LONG.slice(8500,9500)),result=await prepare(port,{citations:[passage]});
 // Canonical selector first, then the continuation the source itself produced, then the status record.
 assert.deepEqual(port.calls.map(call=>call.operation.id),['read_bill_text','read_bill_text','read_bill_text','get_bill_status']);
 assert.deepEqual(port.calls[0].request,{billId:subject.billId,versionCode:subject.billVersion});
 for(const call of port.calls.slice(1,3)){
  assert.equal(call.request.billId,subject.billId);assert.equal(call.request.versionCode,subject.billVersion);
  assert.equal(typeof call.request.cursor,'string');}
 assert.deepEqual(port.calls[3].request,{billId:subject.billId});
 const [billText]=result.coverage;
 assert.deepEqual({pages:billText.coverage.pages,offset:billText.coverage.offset,total:billText.coverage.totalCharacters,
  complete:billText.coverage.complete,truncated:billText.coverage.truncated},{pages:3,offset:20000,total:20000,complete:true,truncated:false});
 assert.equal(billText.records[0].text,LONG);
 assert.equal(billText.evidence.contentSha256,sha(LONG));
 assert.equal(billText.evidence.recordId,subject.billId);assert.equal(billText.evidence.sourceVersionId,REVISION);
 // The excerpt straddles a page boundary: it is only citable because the pages were byte-contiguous.
 assert.equal(result.findings[0].status,'bound-excerpt');
 assert.equal(result.findings[0].links[0].passage,LONG.slice(8500,9500));
 assert.equal(result.findings[0].links[0].passageSha256,sha(LONG.slice(8500,9500)));
 assert.ok(document(result).includes('characters 8500-9500'));
 for(const item of result.context.evidence)v.nativeSourceEvidence(item);
});

test('the compiled read mirror is exactly the receipt set retention compares',async()=>{
 const port=portFor({text:SHORT}),result=await prepare(port);
 assert.equal(result.reads.length,port.receipts.length);
 for(const [index,receipt] of port.receipts.entries()){
  const compiled=result.reads[index];
  assert.equal(canonicalSha256(compiled.operation),canonicalSha256(receipt.operation),'operation');
  assert.equal(canonicalSha256(compiled.request),canonicalSha256(receipt.request),'request');
  assert.equal(compiled.resultSha256,receipt.resultSha256,'result');
 }
 assert.equal(result.provenance.readsSha256,v.hash(result.reads));
 assert.equal(result.provenance.sourcesSha256,v.hash(result.coverage));
});

test('a page from another revision is refused and never accepted as a continuation',async()=>{
 const port=portFor({text:LONG,edit:(wrapper,call)=>{if(call.request.cursor!==undefined)wrapper.result.revisionId=uid(90);}});
 await assert.rejects(prepare(port,{citations:[cite(0,8,LONG.slice(0,8))]}),/REPORT_SOURCE_(VERSION|RESULT)/);
});

test('text of the same length that does not hash to the pin is refused, never cited',async()=>{
 // Equal length keeps the shape valid, so only the pinned text hash can catch the substitution.
 const port=portFor({text:SHORT,edit:wrapper=>{wrapper.result.text='X'+wrapper.result.text.slice(1);}});
 assert.notEqual('X'+SHORT.slice(1),SHORT);
 await assert.rejects(prepare(port),/REPORT_SOURCE_TEXT_HASH/);
});

test('an unavailable bill-text install is disclosed truthfully and never fabricated',async()=>{
 const port=portFor({text:SHORT,installed:{read_bill_text:false,get_bill_status:true}}),result=await prepare(port);
 const billText=result.coverage.find(source=>source.sourceId==='bill_text');
 assert.equal(billText.status,'unavailable');assert.equal(billText.evidence,null);
 assert.deepEqual(billText.records,[]);assert.equal(result.findings[0].status,'missing-evidence');
 assert.equal(result.context.evidence.length,1);assert.equal(result.context.evidence[0].sourceId,'federal_legislation');
 assert.ok(document(result).includes('bill_text: status unavailable (UNAVAILABLE)'));
});

test('a read observed after the report as-of instant is disclosed but not bound',async()=>{
 const result=await prepare(portFor({text:SHORT}),{asOf:'2026-10-12T00:00:00.000Z'});
 assert.equal(result.context.evidence.length,0);
 for(const source of result.coverage.filter(item=>item.status==='read'))
  assert.ok(source.limitations.some(text=>text.includes('after the report as-of instant')),source.sourceId);
 assert.equal(result.findings[0].status,'missing-evidence');
});

test('program elements stay disclosed as unread because the subject has no canonical selector',async()=>{
 const result=await prepare(portFor({text:SHORT})),program=result.coverage.find(source=>source.sourceId==='program_elements');
 assert.deepEqual({status:program.status,reason:program.reason,operation:program.operation},
  {status:'not-read',reason:'NO_CANONICAL_SELECTOR',operation:'get_pe_budget_timeline'});
 assert.equal(program.evidence,null);assert.deepEqual(program.records,[]);
 assert.ok(document(result).includes('program_elements: status not-read (NO_CANONICAL_SELECTOR)'));
});

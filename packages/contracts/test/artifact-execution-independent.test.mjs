import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256,validateShape as validatePublicShape} from '../validate.mjs';
import {createArtifactValidators} from '../artifacts-0.2/artifact-validation.mjs';
import {documentSchema} from '../document-application/schema.mjs';
import {documentAccessSchema} from '../document-access-application/schema.mjs';
const schema=JSON.parse(readFileSync(new URL('../artifacts-0.2/artifact.schema.json',import.meta.url)));
const publicSchema=JSON.parse(readFileSync(new URL('../meri.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(publicSchema);ajv.addSchema(schema);
const validators=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const v=createArtifactValidators({validatePublicShape,canonicalSha256,validateShape(name,value){const fn=validators.get(name);assert.ok(fn,`known private definition ${name}`);if(!fn(value))throw Error(ajv.errorsText(fn.errors));return value;}});
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenantId:'tenant-a',kind:'client',resourceId:'client-a',policyRevision:'p1'};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const context=()=>({binding:structuredClone(binding),scopes:[structuredClone(scope)],evidence:[],assets:[],deadlineMs:200000,maxBytes:1048576});
const word=()=>({operation:'create_word',format:'docx',title:'Quarterly brief',content:{blocks:[{kind:'paragraph',runs:[{text:'Revenue ↑',bold:true}]},{kind:'table',rows:[['Region','Amount'],['North','250']]}]}});
test('Word structural fields are optional and preserve legacy request identity',()=>{
 const input=word(),bytes=JSON.stringify(input),hash=canonicalSha256(input);
 const out=v.request(input);
 assert.equal(JSON.stringify(out),bytes);
 assert.equal(canonicalSha256(out),hash);
 assert.equal(Object.hasOwn(out.content.blocks[0],'quoteDepth'),false);
 for(const field of ['strike','underline'])assert.equal(Object.hasOwn(out.content.blocks[0].runs[0],field),false);
});
test('Word accepts bounded quote depth and explicit visible text marks for DOCX and PDF',()=>{
 for(const format of ['docx','pdf'])for(const quoteDepth of [1,8])for(const mark of [false,true]){
  const input=word();input.format=format;
  Object.assign(input.content.blocks[0],{quoteDepth});
  Object.assign(input.content.blocks[0].runs[0],{strike:mark,underline:mark});
  assert.deepEqual(v.request(input),input);
 }
});
test('Word rejects malformed structural fields and unsupported rich table content',()=>{
 for(const quoteDepth of [0,9,-1,1.5,true,'1',null]){
  const input=word();input.content.blocks[0].quoteDepth=quoteDepth;assert.throws(()=>v.request(input));
 }
 for(const field of ['strike','underline'])for(const value of [0,1,'true',null,{}]){
  const input=word();input.content.blocks[0].runs[0][field]=value;assert.throws(()=>v.request(input));
 }
 for(const rows of [[['a','b'],['c']],[[{text:'rich'}]],[[['nested']]]]){
  const input=word();input.content.blocks[1].rows=rows;assert.throws(()=>v.request(input));
 }
 const input=word();input.content.blocks[0].sourceSpan={start:0,end:1};assert.throws(()=>v.request(input));
});
const excel=()=>({operation:'create_excel',format:'xlsx',title:'Revenues',content:{sheets:[{name:'Data',rows:[[{value:'=literal'},{value:2},{formula:'=SUM(B1:B1)'}]]}]}});
test('XML is a distinct nonempty exact-text request; TXT retains empty text',()=>{
 const text='\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n<bill>α &amp; β</bill>\r\n';
 const request={operation:'create_word',format:'xml',title:'Bill',content:{text}};
 assert.deepEqual(v.request(request),request);
 assert.equal(v.request({...request,format:'txt',content:{text:''}}).content.text,'');
 for(const content of [{text:''},{text:'x'.repeat(100001)},{text:'<bill/>',schemaUrl:'https://example.invalid/schema'},{blocks:[{kind:'paragraph',runs:[{text:'XML'}]}]}])assert.throws(()=>v.request({...request,content}));
 for(const format of ['html','XML','xhtml'])assert.throws(()=>v.request({...request,format}));
});
test('XML inspection admits only nonempty bytes, empty members and truthful well-formedness evidence',()=>{
 const inspection={sha256:'a'.repeat(64),bytes:7,format:'xml',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged',wellFormed:true}};
 assert.deepEqual(v.inspection(inspection),inspection);
 for(const change of [{bytes:0},{members:['file']},{nativeOpened:true},{details:{...inspection.details,wellFormed:false}},{details:{...inspection.details,schemaQualified:true}}])assert.throws(()=>v.inspection({...inspection,...change}));
});
test('XML request admission rejects malformed XML, DTDs and custom entities before dispatch',()=>{
 for(const text of ['', ' \r\n', '<a>', '<a/><b/>', '<a>&unknown;</a>', '<p:a/>', '<a>\0</a>', '<!DOCTYPE a><a/>', '<!DOCTYPE a [<!ENTITY x "expanded">]><a>&x;</a>', '<!DOCTYPE a SYSTEM "file:///no-read"><a/>', '<!DOCTYPE a SYSTEM "https://example.invalid/no-fetch"><a/>', '<?xml version="1.0" encoding="ISO-8859-1"?><a>α</a>'])assert.throws(()=>v.request({operation:'create_word',format:'xml',title:'XML',content:{text}}));
});
test('XML request admission matches the fixed writer grammar without imposing xml:id validity',()=>{
 const input=text=>({operation:'create_word',format:'xml',title:'XML',content:{text}});
 for(const text of ['<r xml:id="not an ID"/>','<r><a xml:id="same"/><b xml:id="same"/></r>','<r>'.repeat(256)+'</r>'.repeat(256)])assert.deepEqual(v.request(input(text)),input(text));
 for(const text of ['\ufeff\ufeff<r/>','<?xml version="1.1"?><r/>','<?xml version="1.1"?><r>&#x1;</r>','<r>'.repeat(257)+'</r>'.repeat(257)])assert.throws(()=>v.request(input(text)));
});
test('canonical document projections admit XML writes, inspections and retained history metadata',()=>{
 const write=documentSchema(schema,{INVALID_REQUEST:400}),read=documentAccessSchema(schema,{INVALID_REQUEST:400});
 ajv.addSchema(write);ajv.addSchema(read);
 const valid=(owner,name,value)=>{const check=ajv.compile({$ref:`${owner.$id}#/$defs/${name}`});assert.ok(check(value),ajv.errorsText(check.errors));};
 const request={operation:'create_word',format:'xml',title:'Bill',content:{text:'<bill/>'}};
 valid(write,'DocumentCreateRequest',{deliveryId:'xml-create',request});
 valid(write,'DocumentReviseRequest',{deliveryId:'xml-revise',baseVersionId:id(49),request});
 const version={contractVersion:'0.1.0',artifactId:id(50),versionId:id(51),parentVersionId:null,binding,object:{objectId:id(52),versionId:'immutable',sha256:'a'.repeat(64),bytes:7,scopes:[scope]},filename:'Bill.xml',mimeType:'application/xml; charset=utf-8',scopes:[scope],evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-12T00:00:00.000Z'};
 const inspection={sha256:'a'.repeat(64),bytes:7,format:'xml',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged',wellFormed:true},currentBytesVerified:true};
 for(const owner of [write,read])valid(owner,'DocumentInspectionResponse',{version,inspection});
 valid(read,'DocumentHistoryResponse',{anchorVersionId:id(51),artifactId:id(50),headVersionId:id(51),versions:[version],nextCursor:null});
});
const slides=()=>({operation:'create_powerpoint',format:'pptx',title:'Brief',content:{slides:[{title:'Overview',bullets:['First','Second'],notes:'Retained notes'},{title:'Data',table:[['Region','Amount'],['North','250']]}]}});
const analysis=()=>({operation:'run_analysis',format:'zip',title:'Totals',content:{tables:[{name:'data',columns:['region','value'],rows:[['N',100],['N',150],['S',80]]}],source:'data',steps:[{kind:'aggregate',groupBy:['region'],column:'value',function:'sum',name:'total'}]}});
for(const [name,make] of [['word',word],['workbook',excel],['slides',slides],['analysis',analysis]])test(`independent ${name} request is admitted and detached`,()=>{const input=make(),before=structuredClone(input),out=v.request(input);assert.deepEqual(out,before);assert.notEqual(out,input);input.title='changed';assert.equal(out.title,before.title);});
test('independent exact text preserves whitespace and final newline',()=>{for(const text of ['', ' \t\n', 'α\r\nβ\n']){const req={operation:'create_word',format:'txt',title:'Text',content:{text}};assert.equal(v.request(req).content.text,text);}});
test('independent request refuses arbitrary analysis code',()=>{const r=analysis();r.content.code='print(1)';assert.throws(()=>v.request(r));});
test('independent request refuses executable and destination selectors',()=>{for(const field of ['path','filename','executable','module','command','url']){const r=word();r[field]='/outside';assert.throws(()=>v.request(r));}});
test('independent request refuses operation-format substitution',()=>{for(const format of ['xlsx','html','svg','exe']){const r=word();r.format=format;assert.throws(()=>v.request(r));}});
test('independent request refuses unknown formula executable and URL options',()=>{for(const extra of [{url:'https://example.invalid'},{script:'x'},{formula:'=WEBSERVICE("https://example.invalid")'}]){const r=excel();r.content.sheets[0].rows=[[extra]];assert.throws(()=>v.request(r));}});
test('independent inert input rejects proxy and getter without invoking it',()=>{let touched=0;const r=word();Object.defineProperty(r,'secret',{enumerable:true,get(){touched++;return 1;}});assert.throws(()=>v.request(r));assert.equal(touched,0);assert.throws(()=>v.request(new Proxy(word(),{ownKeys(){touched++;return [];}})));assert.equal(touched,0);});
test('independent inert input rejects nonfinite and sparse data',()=>{const r=analysis();r.content.tables[0].rows[0][1]=Infinity;assert.throws(()=>v.request(r));r.content.tables[0].rows=Array(2);assert.throws(()=>v.request(r));});
test('independent request rejects hidden keys and unknown rich text fields',()=>{const r=word();r.content.blocks[0].runs[0].html='<script/>';assert.throws(()=>v.request(r));const x=word();Object.defineProperty(x,'hidden',{value:1});assert.throws(()=>v.request(x));});
test('independent request enforces bounded content arrays and cells',()=>{const r=slides();r.content.slides=Array.from({length:101},()=>({title:'x'}));assert.throws(()=>v.request(r));const x=analysis();x.content.tables[0].columns=Array.from({length:101},(_,i)=>String(i));assert.throws(()=>v.request(x));});
test('independent context is detached and grants no request-selected authority',()=>{const c=context(),out=v.context(c);assert.deepEqual(out,c);assert.notEqual(out,c);c.binding.actorId='changed';assert.equal(out.binding.actorId,'actor-a');const r=word();r.binding=binding;assert.throws(()=>v.request(r));});
test('independent context rejects foreign scope and asset scope',()=>{const c=context();c.scopes[0].tenantId='foreign';assert.throws(()=>v.context(c));const d=context();d.assets=[{id:'logo',object:{objectId:id(20),versionId:'v1',sha256:'a'.repeat(64),bytes:1,scopes:[{...scope,tenantId:'foreign'}]}}];assert.throws(()=>v.context(d));});
test('independent context refuses unknown authority flags and oversized output budget',()=>{const c=context();c.authorized=true;assert.throws(()=>v.context(c));const d=context();d.maxBytes=8388609;assert.throws(()=>v.context(d));});
test('independent scope and evidence boundaries preserve source identity',()=>{const c=context();c.evidence=[{sourceId:'test-source',recordId:'record-1',sourceVersionId:'r1',observedAt:'2026-10-12T00:00:00.000Z',sourceUpdatedAt:null,citationId:id(21),scopes:[structuredClone(scope)],contentSha256:'b'.repeat(64),authorizationDecisionId:id(22)}];const out=v.context(c);assert.deepEqual(out.evidence,c.evidence);assert.notEqual(out.evidence,c.evidence);});


test('native request identity survives only a renewed access deadline',()=>{
 const input=word(),c=context(),first=v.nativeRequestSha256(input,c);
 assert.equal(v.nativeRequestSha256(input,{...c,deadlineMs:c.deadlineMs+5000}),first);
 for(const changed of [{...c,maxBytes:c.maxBytes-1},{...c,binding:{...c.binding,writerFence:2}},{...c,assets:[{id:'logo',object:{objectId:id(40),versionId:'v1',sha256:'c'.repeat(64),bytes:1,scopes:c.scopes}}]}])
  assert.notEqual(v.nativeRequestSha256(input,changed),first);
 assert.notEqual(v.nativeRequestSha256({...input,title:'Different'},c),first);
 assert.notEqual(v.nativeRequestSha256(input,c,id(41)),first);
 assert.throws(()=>v.nativeRequestSha256(input,c,'not-a-version'));
 assert.throws(()=>v.nativeRequestSha256(input,{...c,extra:true}));
});

test('native output retains actual file provenance without a budget ticket',()=>{
 const input={operation:'create_word',format:'txt',title:'Native',content:{text:'text'}},c=context();
 const sha='e'.repeat(64),object={objectId:id(50),versionId:'immutable',sha256:sha,bytes:4,scopes:c.scopes};
 const value={version:{contractVersion:'0.1.0',artifactId:id(51),versionId:id(52),parentVersionId:null,binding:c.binding,object,filename:'Native.txt',mimeType:'text/plain; charset=utf-8',scopes:c.scopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-12T00:00:00.000Z'},
  inspection:{sha256:sha,bytes:4,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}},
  execution:{kind:'native-document',invocationId:'sdk:'+'a'.repeat(64),requestSha256:v.nativeRequestSha256(input,c),authorizationReceiptId:id(53),objectCommitted:true,versionCommitted:true,nativeQualified:false}};
 assert.equal(v.assertArtifactOutput('create_word',value,input,c).execution.kind,'native-document');
 assert.equal(v.assertArtifactOutput('create_word',value,input,{...c,deadlineMs:c.deadlineMs+1}).execution.requestSha256,value.execution.requestSha256);
 for(const change of [{budgetTicketId:'fake'},{invocationId:'invalid'},{authorizationReceiptId:'fake'},{nativeQualified:true},{requestSha256:'0'.repeat(64)}])
  assert.throws(()=>v.assertArtifactOutput('create_word',{...value,execution:{...value.execution,...change}},input,c));
 assert.throws(()=>v.assertArtifactOutput('create_word',value,input,{...c,maxBytes:5}));
});

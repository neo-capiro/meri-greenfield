import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createClientDocumentsValidators} from '../retrieval-0.2/client-documents-validation.mjs';

// Test-only Ajv composition and literal synthetic data. No source/extractor.
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const schema=json('../retrieval-0.2/client-documents.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
ajv.addSchema(json('../meri.schema.json'));ajv.addSchema(json('../retrieval-0.2/common.schema.json'));ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const validateShape=(name,value)=>{assert.ok(checks.get(name)(value),ajv.errorsText(checks.get(name).errors));return value;};
const {normalizeClientDocumentsInput:normalize,assertClientDocumentsResult:check}=
  createClientDocumentsValidators({validateShape,assertSubject,canonicalSha256});
const uuid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const now='2026-10-12T00:00:00.000Z',hash='a'.repeat(64),digest=t=>createHash('sha256').update(t).digest('hex');
const ctx=()=>({binding:{tenantId:'synthetic',actorId:'reader',conversationId:uuid,runId:uuid,attemptId:uuid,workerId:uuid,writerFence:1},
  subject:{tenantId:'synthetic',actorId:'reader',kind:'client',entityType:'client',entityIds:['client'],rosterVersionId:null,
    policyRevision:'synthetic-policy',authorizationDecisionId:uuid,scopes:[{tenantId:'synthetic',kind:'client',resourceId:'client',policyRevision:'synthetic-policy'}]}});
const req={clientId:'client',documentId:'doc'};
const cursor=(changes={})=>'document:'+Buffer.from(JSON.stringify({version:1,documentId:'doc',clientId:'client',contentHash:hash,
  query:'',section:1,offset:5,sectionHash:digest('ABCDEFGHIJ'),...changes})).toString('base64url');
const item=()=>({id:'doc',fileName:'Synthetic.txt',contentType:'text/plain',byteSize:5,createdAt:now,indexedAt:null,
  extractionStatus:null,extractionMetadata:null,usable:true,blockedReason:null,disclosure:'Synthetic unscanned disclosure'});
const listing=()=>({...ctx(),data:{tool:'read_client_documents',generatedAt:now,clientId:'client',
  coverage:{total:1,returned:1,truncated:false,nextCursor:null,complete:true,paginationComplete:true,query:null,queryAppliesTo:'fileName'},
  note:'A listing is not a content read.',documents:[item()]}});
function reading(text='ABCDE') {
  const reference=`doc:${hash.slice(0,16)}:1:0-${text.length}`;
  return {...ctx(),data:{tool:'read_client_documents',generatedAt:now,clientId:'client',
    document:{id:'doc',fileName:'Synthetic.txt',contentType:'text/plain',contentHash:hash},
    coverage:{contentScope:'extractable_text_only',extractedSectionEmpty:false,readability:null,continuationBlocked:false,
      nextCursor:null,truncated:false,complete:true,section:1,sectionCount:1,sectionCharacters:text.length,
      characterStart:0,characterEnd:text.length,sectionComplete:true,query:null,matched:null,extractionTruncated:false,
      extractionMetadata:null,disclosure:null,note:'Extraction does not cover images.'},
    records:[{recordId:reference,payload:{id:reference,documentId:'doc',title:'Synthetic.txt',fileName:'Synthetic.txt',contentType:'text/plain',
      source:'text',section:1,sectionKind:'document',sectionLabel:'Document text',characterStart:0,characterEnd:text.length,text},
      provenance:{sourceTable:'engagement_attachment',sourceRecordId:'doc',clientId:'client',contentHash:hash,sectionHash:digest(text),
        section:1,characterStart:0,characterEnd:text.length,trust:'external_untrusted'}}]}};
}
function first() {
  const page=reading();Object.assign(page.data.coverage,{sectionCharacters:10,nextCursor:cursor(),truncated:true,complete:false,sectionComplete:false});
  page.data.records[0].provenance.sectionHash=digest('ABCDEFGHIJ');return page;
}
function unreadable() {
  const p=reading();p.data.records=[];
  Object.assign(p.data.coverage,{extractedSectionEmpty:true,continuationBlocked:true,missingContent:true,nextAction:'Inspect original page.',
    explicitNextSection:2,truncated:true,complete:false,sectionCount:2,sectionCharacters:0,characterStart:0,characterEnd:0,sectionComplete:false,
    readability:{status:'ocr_unavailable',method:'openai_pdf',scope:'section',section:1,sectionCount:2,chars:0,reason:'unavailable',note:'Synthetic refusal'},
    contentScope:'provider_transcribed_page_text'});return p;
}

test('list/read defaults and nullish numeric defaults preserve explicit selected client',()=>{
  const list=normalize({clientId:' client '},ctx());
  assert.deepEqual(list,{mode:'list',clientId:'client',documentId:null,query:'',section:1,characterOffset:0,limit:25,cursor:null,cursorBinding:null,listAfter:null});
  assert.equal(normalize(req,ctx()).limit,5000);
  assert.equal(normalize({...req,section:null,characterOffset:null,limit:null},ctx()).section,1);
  assert.equal(normalize({...req,documentId:' doc ',query:' text '},ctx()).query,'text');
});
test('raw selectors refuse authority injection, explicit null text and foreign client',()=>{
  for(const raw of [{},{clientId:'other'},{...req,documentId:null},{...req,query:null},{...req,cursor:null},
    {...req,query:''},{...req,query:'   '},{...req,tenantId:'synthetic'},{...req,role:'admin'},{...req,subject:ctx().subject}])
    assert.throws(()=>normalize(raw,ctx()));
});
test('UTF-16 selector bounds differ from Unicode code point schema counts',()=>{
  for(const [key,value]of[['query','😀'.repeat(121)],['documentId','😀'.repeat(41)],['clientId','😀'.repeat(41)],['cursor','😀'.repeat(2049)]])
    assert.throws(()=>normalize({...req,[key]:value},ctx()));
  assert.equal(normalize({...req,query:'😀'.repeat(120)},ctx()).query.length,240);
});
test('mode-specific bounds and explicit range/list/cursor exclusions',()=>{
  for(const raw of [{clientId:'client',limit:51},{...req,limit:6001},{...req,limit:1.5},{...req,limit:'5'},
    {...req,section:0},{...req,characterOffset:-1},{clientId:'client',section:null},
    {...req,cursor:cursor(),section:null},{...req,cursor:cursor(),characterOffset:0}])assert.throws(()=>normalize(raw,ctx()));
  assert.equal(normalize({...req,limit:6000},ctx()).limit,6000);
});
test('closed canonical context requires current selected-client subject',()=>{
  for(const c of [{},null,{...ctx(),nowMs:1},{...ctx(),subject:{...ctx().subject,actorId:'other'}},
    {...ctx(),subject:{...ctx().subject,kind:'portfolio',rosterVersionId:'roster'}},
    {...ctx(),subject:{...ctx().subject,entityType:'research-portfolio'}}])assert.throws(()=>normalize(req,c));
});
test('read cursor retains content/query/section hash and exact decoded selection',()=>{
  const selected=normalize({...req,cursor:cursor()},ctx());
  assert.equal(selected.characterOffset,5);assert.equal(selected.cursorBinding.contentHash,hash);
  assert.equal(selected.cursorBinding.sectionHash,digest('ABCDEFGHIJ'));
  for(const value of [cursor({clientId:'other'}),cursor({documentId:'other'}),cursor({query:'other'}),cursor({contentHash:'bad'}),
    cursor({section:0}),cursor({offset:-1}),cursor({version:2}),cursor({extra:true}),'document:!!!!','documents:doc'])
    assert.throws(()=>normalize({...req,cursor:value},ctx()));
});
test('listing cursor remains a bounded identity hint, not a signed query or grant',()=>{
  assert.equal(normalize({clientId:'client',cursor:'documents:doc',query:'new query'},ctx()).listAfter,'doc');
  for(const value of ['documents:','documents:x/y',cursor()])assert.throws(()=>normalize({clientId:'client',cursor:value},ctx()));
});
test('exact listing metadata retains extraction and scan disclosure without content proof',()=>{
  const page=listing();check(page,{clientId:'client'},ctx());
  for(const code of schema.$defs.ClientDocumentListItem.properties.blockedReason.anyOf[0].enum){
    const p=listing();p.data.documents[0].usable=false;p.data.documents[0].blockedReason=code;
    p.data.documents[0].extractionMetadata={chars:0,timedOut:true};check(p,{clientId:'client'},ctx());
  }
  const p=listing();p.data.documents[0].usable=false;assert.throws(()=>check(p,{clientId:'client'},ctx()));
});
test('listing next cursor requires a full sorted page and partial coverage',()=>{
  const p=listing();Object.assign(p.data.coverage,{total:2,truncated:true,nextCursor:'documents:doc',complete:false,paginationComplete:false});
  check(p,{clientId:'client',limit:1},ctx());assert.throws(()=>check(p,{clientId:'client',limit:2},ctx()));
  p.data.coverage.nextCursor='documents:other';assert.throws(()=>check(p,{clientId:'client',limit:1},ctx()));
});
test('continued listing cannot upgrade to full listing completeness or repeat previous identity',()=>{
  const p=listing();p.data.coverage.total=2;p.data.coverage.complete=false;check(p,{clientId:'client',cursor:'documents:aaa'},ctx());
  assert.throws(()=>check(p,{clientId:'client',cursor:'documents:doc'},ctx()));
  p.data.coverage.complete=true;assert.throws(()=>check(p,{clientId:'client',cursor:'documents:aaa'},ctx()));
});
test('list total, returned count, filename query and mode variants are correlated',()=>{
  for(const mutate of [p=>p.data.coverage.total=2,p=>p.data.coverage.returned=0,p=>p.data.coverage.query='absent',
    p=>p.data.documents.push({...item()})]){const p=listing();mutate(p);assert.throws(()=>check(p,{clientId:'client'},ctx()));}
  assert.throws(()=>check(reading(),{clientId:'client'},ctx()));assert.throws(()=>check(listing(),req,ctx()));
});
test('complete text extraction checks full section hash, UTF-16 reference and external trust',()=>{
  check(reading(),req,ctx());check(reading('A😀B'),req,ctx());
  for(const mutate of [p=>p.data.records[0].provenance.sectionHash='b'.repeat(64),p=>p.data.records[0].provenance.trust='trusted',
    p=>p.data.records[0].payload.characterEnd=3,p=>p.data.records[0].payload.documentId='other',
    p=>p.data.records[0].recordId='invented']){const p=reading('A😀B');mutate(p);assert.throws(()=>check(p,req,ctx()));}
});
test('partial read preserves hash and exact next UTF-16 offset',()=>{
  check(first(),{...req,limit:5},ctx());
  for(const token of [cursor({offset:4}),cursor({section:2}),cursor({contentHash:'b'.repeat(64)}),cursor({sectionHash:'b'.repeat(64)})]){
    const p=first();p.data.coverage.nextCursor=token;assert.throws(()=>check(p,{...req,limit:5},ctx()));
  }
});
test('incoming continuation refuses changed document bytes and extraction hash',()=>{
  const p=reading('FGHIJ'),ref=`doc:${hash.slice(0,16)}:1:5-10`;
  Object.assign(p.data.coverage,{sectionCharacters:10,characterStart:5,characterEnd:10,complete:false,sectionComplete:false});
  Object.assign(p.data.records[0].payload,{id:ref,characterStart:5,characterEnd:10});p.data.records[0].recordId=ref;
  Object.assign(p.data.records[0].provenance,{characterStart:5,characterEnd:10,sectionHash:digest('ABCDEFGHIJ')});
  check(p,{...req,cursor:cursor()},ctx());
  for(const extra of [{contentHash:'b'.repeat(64)},{sectionHash:'b'.repeat(64)}])
    assert.throws(()=>check(p,{...req,cursor:cursor(extra)},ctx()));
});
test('a physical next section resets offset and omits previous section hash',()=>{
  const p=reading();p.data.coverage.sectionCount=2;p.data.coverage.complete=false;p.data.coverage.truncated=true;
  p.data.coverage.nextCursor=cursor({section:2,offset:0,sectionHash:undefined});check(p,req,ctx());
  p.data.coverage.nextCursor=cursor({section:2,offset:0});assert.throws(()=>check(p,req,ctx()));
});
test('unreadable PDF reports gap without evidence or automatic traversal',()=>{
  check(unreadable(),req,ctx());
  for(const mutate of [p=>p.data.coverage.complete=true,p=>p.data.coverage.truncated=false,p=>p.data.coverage.nextCursor=cursor(),
    p=>p.data.coverage.explicitNextSection=null,p=>p.data.records=reading().data.records]){
    const p=unreadable();mutate(p);assert.throws(()=>check(p,req,ctx()));
  }
});
test('section-local no-match may advance but does not become complete evidence',()=>{
  const p=reading();p.data.records=[];
  Object.assign(p.data.coverage,{characterStart:5,characterEnd:5,query:'needle',matched:false,complete:false,sectionComplete:false,
    sectionCount:2,nextCursor:cursor({query:'needle',section:2,offset:0,sectionHash:undefined}),truncated:true});
  check(p,{...req,query:'needle'},ctx());p.data.coverage.complete=true;assert.throws(()=>check(p,{...req,query:'needle'},ctx()));
});
test('search match remains incomplete and uses query-bound cursor context',()=>{
  const p=reading();Object.assign(p.data.coverage,{query:'BCD',matched:true,complete:false});check(p,{...req,query:'BCD'},ctx());
  assert.throws(()=>check(p,{...req,query:'different'},ctx()));
});
test('reported query matches require a record actually containing the literal query',()=>{
  const p=reading();Object.assign(p.data.coverage,{query:'absent',matched:true,complete:false});
  assert.throws(()=>check(p,{...req,query:'absent'},ctx()));
  const missing=first();missing.data.records=[];missing.data.coverage.query='ABC';missing.data.coverage.matched=true;
  missing.data.coverage.nextCursor=cursor({query:'ABC'});
  assert.throws(()=>check(missing,{...req,query:'ABC',limit:5},ctx()));
});
test('Unicode lowercase index expansion is not mistaken for evidence of a returned match',()=>{
  // Independent arithmetic characterization, not execution/import of Capiro.
  // Unicode lowercase offsets need not index the same original UTF-16 text.
  const text='İ'.repeat(300)+'NEEDLE'+'Z'.repeat(1000),match=text.toLowerCase().indexOf('needle');
  assert.equal(match,600);const start=match-240,end=match+6;
  assert.equal(text.slice(start,end),'Z'.repeat(246));
  const p=reading(text.slice(start,end)),reference=`doc:${hash.slice(0,16)}:1:${start}-${end}`;
  Object.assign(p.data.coverage,{query:'NEEDLE',matched:true,complete:false,sectionComplete:false,sectionCharacters:text.length,
    characterStart:start,characterEnd:end,truncated:true,nextCursor:cursor({query:'NEEDLE',offset:end,sectionHash:digest(text)})});
  p.data.records[0].recordId=reference;
  Object.assign(p.data.records[0].payload,{id:reference,characterStart:start,characterEnd:end});
  Object.assign(p.data.records[0].provenance,{characterStart:start,characterEnd:end,sectionHash:digest(text)});
  assert.throws(()=>check(p,{...req,query:'NEEDLE',limit:1},ctx()),/reported match/);
});
test('OCR partial/readability metadata cannot silently claim ordinary complete extraction',()=>{
  const p=reading();Object.assign(p.data.coverage,{contentScope:'provider_transcribed_page_text',extractionTruncated:true,truncated:true,complete:false,sectionComplete:false,
    readability:{status:'ocr_partial',method:'openai_pdf',scope:'section',section:1,sectionCount:1,chars:5,model:'synthetic',note:'Partial'}});
  p.data.records[0].payload.source='pdf';p.data.records[0].payload.sectionKind='page';
  p.data.coverage.extractionMetadata={sectionRead:true,chars:5,truncated:true,emptySection:false,section:1,sectionCount:1,readability:structuredClone(p.data.coverage.readability)};
  check(p,req,ctx());p.data.coverage.extractionMetadata.chars=6;assert.throws(()=>check(p,req,ctx()));
  p.data.coverage.extractionMetadata=null;p.data.coverage.extractionTruncated=false;assert.throws(()=>check(p,req,ctx()));
});
test('readability reports cannot upgrade an empty section or a non-PDF source',()=>{
  const empty=unreadable();empty.data.coverage.readability.status='ocr_readable';assert.throws(()=>check(empty,req,ctx()));
  const p=reading();Object.assign(p.data.coverage,{contentScope:'provider_transcribed_page_text',
    readability:{status:'ocr_readable',method:'openai_pdf',scope:'section',section:1,sectionCount:1,chars:5,note:'Synthetic'}});
  assert.throws(()=>check(p,req,ctx()));
});
test('empty extraction is not an empty evidence record or a claim about other sections',()=>{
  const p=reading();p.data.records=[];Object.assign(p.data.coverage,{extractedSectionEmpty:true,complete:false,sectionCharacters:0,characterStart:0,characterEnd:0});
  check(p,req,ctx());p.data.coverage.complete=true;assert.throws(()=>check(p,req,ctx()));
});
test('UTF-16 text and serialized JSON ceiling are independent of character schema bounds',()=>{
  assert.throws(()=>check(reading('😀'.repeat(3001)),{...req,limit:6000},ctx()));
  assert.throws(()=>check(reading('\u0000'.repeat(1100)),{...req,limit:6000},ctx()));
  assert.throws(()=>check(reading('A'.repeat(6)),{...req,limit:5},ctx()));
});
test('closed output shapes, timestamps and exact binding/subject correlation fail closed',()=>{
  for(const mutate of [p=>p.binding.writerFence++,p=>p.subject.authorizationDecisionId=other,p=>p.data.clientId='other',
    p=>p.data.generatedAt='2016-12-31T23:59:60Z',p=>p.data.records[0].payload.approved=true,p=>p.data.coverage.authorized=true,
    p=>p.data.document.contentHash='bad']){const p=reading();mutate(p);assert.throws(()=>check(p,req,ctx()));}
});
test('metadata is bounded inert reported JSON and cannot mutate the caller input',()=>{
  const p=listing();p.data.documents[0].extractionMetadata={reported:{complete:true,authorized:true},warnings:[null,'synthetic']};
  const before=structuredClone(p);const result=check(p,{clientId:'client'},ctx());assert.deepEqual(p,before);assert.notEqual(result,p);
  let nested={};p.data.documents[0].extractionMetadata=nested;for(let i=0;i<65;i++)nested=nested.next={};
  assert.throws(()=>check(p,{clientId:'client'},ctx()));
});
test('canonical admission refuses getters/proxies/hidden fields/cycles without invoking them',()=>{
  let calls=0;const proxy=new Proxy({}, {get(){calls++;throw Error('effect');},ownKeys(){calls++;throw Error('effect');}});
  const getter={get clientId(){calls++;return 'client';}};
  for(const raw of [proxy,getter,Object.create({clientId:'client'}),Object.defineProperty({clientId:'client'},'hidden',{value:1})])
    assert.throws(()=>normalize(raw,ctx()));
  assert.throws(()=>normalize(req,proxy));assert.throws(()=>check(proxy,req,ctx()));
  const p=reading();p.data.coverage.extractionMetadata=p;assert.throws(()=>check(p,req,ctx()));assert.equal(calls,0);
});

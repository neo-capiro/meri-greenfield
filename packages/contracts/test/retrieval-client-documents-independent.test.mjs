import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createClientDocumentsValidators} from '../retrieval-0.2/client-documents-validation.mjs';

// Synthetic independent projections, never an imported or executed producer.
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const schema=read('../retrieval-0.2/client-documents.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const s of [read('../meri.schema.json'),read('../retrieval-0.2/common.schema.json'),schema])ajv.addSchema(s);
const shapes=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const family=createClientDocumentsValidators({assertSubject,canonicalSha256,validateShape(n,v){assert.equal(shapes.get(n)(v),true,`Invalid ${n}`);return v;}});
const normalize=family.normalizeClientDocumentsInput, check=family.assertClientDocumentsResult;
const uuid=n=>`${String(n).padStart(8,'0')}-4567-4abc-8def-123456789012`;
const T='2026-01-02T03:04:05.000Z',client='review-client',doc='document-9',fileHash='a'.repeat(64);
const hash=s=>createHash('sha256').update(s).digest('hex');
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const input=()=>({clientId:client,documentId:doc});
function context(){return {binding:{tenantId:'tenant-r',actorId:'actor-r',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:7},subject:{kind:'client',entityType:'client',entityIds:[client],tenantId:'tenant-r',actorId:'actor-r',authorizationDecisionId:uuid(5),policyRevision:'policy-r',rosterVersionId:null,scopes:[{kind:'client',tenantId:'tenant-r',resourceId:client,policyRevision:'policy-r'}]}};}
function cursor(extra={}){return {version:1,documentId:doc,clientId:client,contentHash:fileHash,query:'',section:1,offset:0,...extra};}
function item(id='doc-a'){return {id,fileName:'Report.txt',contentType:'text/plain',byteSize:12,createdAt:T,indexedAt:null,extractionStatus:null,extractionMetadata:null,usable:true,blockedReason:null,disclosure:null};}
function listing(){return {...context(),data:{tool:'read_client_documents',generatedAt:T,clientId:client,coverage:{total:1,returned:1,truncated:false,nextCursor:null,complete:true,paginationComplete:true,query:null,queryAppliesTo:'fileName'},note:'Synthetic metadata listing; no document content read.',documents:[item()]}};}
function page(text='A😀B\ncontent'){const end=text.length,reference=`${doc}:${fileHash.slice(0,16)}:1:0-${end}`;return {...context(),data:{tool:'read_client_documents',generatedAt:T,clientId:client,document:{id:doc,fileName:'Report.txt',contentType:'text/plain',contentHash:fileHash},coverage:{contentScope:'extractable_text_only',extractedSectionEmpty:false,readability:null,continuationBlocked:false,nextCursor:null,truncated:false,complete:true,section:1,sectionCount:1,sectionCharacters:end,characterStart:0,characterEnd:end,sectionComplete:true,query:null,matched:null,extractionTruncated:false,extractionMetadata:null,disclosure:null,note:'Synthetic extracted text; current authorization is external.'},records:[{recordId:reference,payload:{id:reference,documentId:doc,title:'Report.txt',fileName:'Report.txt',contentType:'text/plain',source:'text',section:1,sectionKind:'document',sectionLabel:'Document text',characterStart:0,characterEnd:end,text},provenance:{sourceTable:'engagement_attachment',sourceRecordId:doc,clientId:client,contentHash:fileHash,sectionHash:hash(text),section:1,characterStart:0,characterEnd:end,trust:'external_untrusted'}}]}};}
const reject=(p,raw=input())=>assert.throws(()=>check(p,raw,context()));
function mutants(make,changes,raw=input()){for(const mutate of changes){const p=make();mutate(p);reject(p,raw);}}

test('independent nonempty list and Unicode read fixtures use exact source projections',()=>{
  const l=listing(),r=page();check(l,{clientId:client},context());check(r,input(),context());
  assert.equal(r.data.records[0].payload.text.length,12);assert.equal(r.data.records[0].provenance.trust,'external_untrusted');
});
test('list/read defaults and required client scope never derive authority from model fields',()=>{
  const l=normalize({clientId:client},context()),r=normalize(input(),context());
  assert.equal(l.mode,'list');assert.equal(l.limit,25);assert.equal(l.section,1);assert.equal(l.characterOffset,0);
  assert.equal(r.mode,'read');assert.equal(r.limit,5000);assert.equal(r.documentId,doc);
  for(const raw of [{},{clientId:'foreign'},{...input(),actorId:'forged'},{...input(),tenantId:'forged'},{...input(),proof:true}])assert.throws(()=>normalize(raw,context()));
});
test('declared null numeric defaults and list/read bounds refuse coercion',()=>{
  const n=normalize({...input(),section:null,characterOffset:null,limit:null},context());assert.equal(n.section,1);assert.equal(n.characterOffset,0);assert.equal(n.limit,5000);
  for(const raw of [{...input(),limit:'5'},{...input(),limit:0},{...input(),limit:6001},{...input(),section:0},{...input(),characterOffset:-1},{...input(),section:1.5},{clientId:client,limit:51}])assert.throws(()=>normalize(raw,context()));
});
test('actual input limits use trimmed UTF16 characters, not Unicode code-point counts',()=>{
  assert.equal(normalize({...input(),query:'😀'.repeat(120)},context()).query.length,240);
  assert.throws(()=>normalize({...input(),query:'😀'.repeat(121)},context()));
  assert.throws(()=>normalize({...input(),documentId:'😀'.repeat(41)},context()));
  assert.equal(normalize({...input(),query:'  needle  '},context()).query,'needle');
});
test('read cursor decodes closed client/document/query/content and offset binding',()=>{
  const c=cursor({query:'needle',section:2,offset:7,sectionHash:'b'.repeat(64)});
  const n=normalize({...input(),query:'needle',cursor:encode(c)},context());assert.deepEqual(n.cursorBinding,c);assert.equal(n.section,2);assert.equal(n.characterOffset,7);
  for(const change of [c=>c.clientId='foreign',c=>c.documentId='foreign',c=>c.query='changed',c=>c.version=2,c=>c.section=0,c=>c.offset=-1,c=>c.contentHash='invalid',c=>c.extra=true]){const x=cursor();change(x);assert.throws(()=>normalize({...input(),cursor:encode(x)},context()));}
});
test('malformed mode-crossed cursors never become a source request',()=>{
  for(const value of ['%bad','{}',encode([]),encode(null)])assert.throws(()=>normalize({...input(),cursor:value},context()));
  assert.throws(()=>normalize({...input(),cursor:'documents:doc-a'},context()));
  assert.throws(()=>normalize({clientId:client,cursor:encode(cursor())},context()));
});
test('current context and full returned binding or subject cannot be substituted',()=>{
  for(const mutate of [c=>c.subject.actorId='foreign',c=>c.subject.tenantId='foreign',c=>c.subject.entityIds.push('other'),c=>c.subject.entityType='research-portfolio',c=>c.role='admin']){const c=context();mutate(c);assert.throws(()=>normalize(input(),c));}
  for(const field of Object.keys(context().binding))mutants(page,[p=>p.binding[field]=field==='writerFence'?8:field==='tenantId'||field==='actorId'?'foreign':uuid(9)]);
  mutants(page,[p=>p.subject.authorizationDecisionId=uuid(9),p=>p.subject.policyRevision='foreign',p=>p.subject.entityIds=['foreign']]);
});
test('document/client/content/provenance and record reference substitutions refuse',()=>{
  mutants(page,[p=>p.data.clientId='foreign',p=>p.data.document.id='foreign',p=>p.data.records[0].payload.documentId='foreign',p=>p.data.records[0].provenance.sourceRecordId='foreign',p=>p.data.records[0].provenance.clientId='foreign',p=>p.data.records[0].provenance.contentHash='b'.repeat(64),p=>p.data.records[0].recordId='invented',p=>p.data.records[0].payload.id='invented',p=>p.data.records[0].provenance.trust='trusted']);
});
test('full-section returned text hash rejects content or digest substitution',()=>{
  mutants(page,[p=>p.data.records[0].payload.text='B'+p.data.records[0].payload.text.slice(1),p=>p.data.records[0].provenance.sectionHash='b'.repeat(64)]);
});
test('UTF16 ranges correlate coverage, payload, provenance and returned text length',()=>{
  mutants(page,[p=>p.data.coverage.characterEnd--,p=>p.data.records[0].payload.characterEnd--,p=>p.data.records[0].provenance.characterEnd--,p=>p.data.coverage.characterStart=1,p=>p.data.records[0].payload.section=2,p=>p.data.records[0].provenance.section=2]);
});
test('stale content and section extraction cursors refuse despite same document identity',()=>{
  reject(page(),{...input(),cursor:encode(cursor({contentHash:'b'.repeat(64)}))});
  reject(page(),{...input(),cursor:encode(cursor({sectionHash:'b'.repeat(64)}))});
});
test('list coverage, ordering, uniqueness and filename selector stay correlated',()=>{
  mutants(listing,[p=>p.data.coverage.returned=0,p=>p.data.coverage.total=0,p=>p.data.documents.push(item()),p=>p.data.coverage.queryAppliesTo='content'],{clientId:client});
  const p=listing();p.data.documents=[item('z'),item('a')];p.data.coverage.total=2;p.data.coverage.returned=2;reject(p,{clientId:client});
  reject(listing(),{clientId:client,query:'unmatched'});
});
test('blocked metadata never silently becomes usable or a document content read',()=>{
  const p=listing();p.data.documents[0].usable=false;p.data.documents[0].blockedReason='ATTACHMENT_SCAN_THREAT';check(p,{clientId:client},context());
  p.data.documents[0].usable=true;reject(p,{clientId:client});
  const r=page();reject(r,{clientId:client});reject(listing(),input());
});
test('nullable listing metadata remains distinct from omission and invalid dates',()=>{
  for(const field of ['indexedAt','extractionStatus','extractionMetadata','blockedReason','disclosure'])mutants(listing,[p=>delete p.data.documents[0][field]],{clientId:client});
  mutants(listing,[p=>p.data.documents[0].createdAt='2016-12-31T23:59:60Z',p=>p.data.documents[0].byteSize=Number.MAX_SAFE_INTEGER+1],{clientId:client});
});
test('closed projections refuse invented proof fields while inert metadata stays untrusted',()=>{
  const p=listing();p.data.documents[0].extractionMetadata={approved:true,scope:{complete:true}};check(p,{clientId:client},context());
  mutants(page,[p=>p.authorized=true,p=>p.data.evidenceReady=true,p=>p.data.coverage.fresh=true,p=>p.data.records[0].payload.sourcePermission=true]);
});
test('readability section, count and character declarations must agree with coverage',()=>{
  const p=page();p.data.coverage.readability={status:'text_readable',method:'text',scope:'section',section:1,sectionCount:1,chars:p.data.coverage.sectionCharacters,note:'Reported extractor classification'};check(p,input(),context());
  for(const key of ['section','sectionCount','chars']){const x=structuredClone(p);x.data.coverage.readability[key]++;reject(x);}
});
test('extraction truncation cannot be erased by outer complete coverage',()=>{
  mutants(page,[p=>p.data.coverage.extractionTruncated=true,p=>p.data.coverage.continuationBlocked=true,p=>p.data.coverage.extractedSectionEmpty=true]);
});
test('row provenance is paired and ordered when present',()=>{
  const p=page();Object.assign(p.data.records[0].payload,{source:'spreadsheet',sectionKind:'sheet_rows',rowStart:1,rowEnd:2});check(p,input(),context());
  for(const change of [p=>delete p.data.records[0].payload.rowEnd,p=>p.data.records[0].payload.rowEnd=0]){const x=structuredClone(p);change(x);reject(x);}
});
test('hostile request/context/result admission invokes no supplied property effects',()=>{
  let effects=0;const getter=Object.defineProperty({},'clientId',{enumerable:true,get(){effects++;return client;}});const proxy=new Proxy({}, {get(){effects++;},ownKeys(){effects++;return [];},getPrototypeOf(){effects++;return null;}});
  for(const value of [getter,proxy,{toJSON(){effects++;return {};}}]){assert.throws(()=>normalize(value,context()));assert.throws(()=>normalize(input(),value));reject(value);}
  assert.equal(effects,0);
});
test('opaque metadata refuses exotic, sparse, cyclic and hidden data without mutation',()=>{
  const cycle={};cycle.self=cycle;
  for(const bad of [cycle,new Date(),Object.defineProperty({},'x',{value:1}),{[Symbol('x')]:1},[,,],NaN,1n]){const p=page();p.data.coverage.extractionMetadata={bad};reject(p);}
  const p=page(),before=structuredClone(p),raw=input();check(p,raw,context());assert.deepEqual(p,before);assert.deepEqual(raw,input());
});

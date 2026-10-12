import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createDisclosuresValidators} from '../retrieval-0.2/disclosures-validation.mjs';

// Local test compiler only; the root owns canonical family registration.
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/disclosures.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape=(name,value)=>{const check=checks.get(name);assert.ok(check(value),ajv.errorsText(check.errors));return value;};
const {normalizeDisclosuresInput:normalize,assertDisclosuresOutput:check}=createDisclosuresValidators({validateShape});
const SEC='search_sec_filings',FARA='search_fara_registrations',LDA='search_lda_filings';
const NOW='2026-10-12T00:00:00.000Z',OLDER='2026-10-11T00:00:00.000Z';
const sec=()=>({tool:SEC,generatedAt:NOW,total:1,data:[{id:'sec-one',cik:'0000000123',companyName:'Synthetic issuer',
  formType:'10-K',accessionNumber:'opaque-accession',filingDate:NOW,description:'Synthetic summary...',url:null}]});
const fara=()=>({tool:FARA,generatedAt:NOW,total:1,data:[{id:'fara-one',registrationNumber:'opaque-registration',
  registrantName:'Synthetic registrant',foreignPrincipal:'Synthetic principal',country:null,status:null,registrationDate:null,description:''}]});
const lda=()=>({tool:LDA,generatedAt:NOW,total:1,page:1,limit:15,data:[{filingUuid:'opaque-source-filing',filingType:'LD-2',
  filingYear:2026,filingPeriod:null,income:null,expenses:0,dtPosted:null,registrantId:null,registrantName:'Synthetic registrant',
  clientId:4,clientName:'Synthetic disclosure client',clientState:null,issueCodes:['DEF']}]});
const fixtures=[[SEC,sec],[FARA,fara],[LDA,lda]];

test('global reads default without any caller policy context',()=>{
  assert.deepEqual(normalize(SEC,{}),{limit:20});assert.deepEqual(normalize(FARA,{},{}),{limit:20});
  assert.deepEqual(normalize(LDA,{}),{limit:15,page:1});
  for(const options of [null,[],{actorId:'user'},{tenantId:'tenant'},{role:'standard_user'},{authorized:true},{binding:{}}])
    assert.throws(()=>normalize(SEC,{},options));
});
test('text aliases have exact primary precedence and blank/null fallback',()=>{
  assert.deepEqual(normalize(SEC,{query:' primary ',companyName:'fallback',formType:' 10-K ',cik:' 123 '}),{limit:20,query:'primary',formType:'10-K',cik:'123'});
  assert.equal(normalize(SEC,{query:' ',companyName:' fallback '}).query,'fallback');
  assert.equal(normalize(FARA,{registrantName:null,registrant:' alternate '}).registrantName,'alternate');
  assert.deepEqual(normalize(LDA,{clientName:'primary',query:'fallback',registrantName:' ',registrant:' agent ',issueCode:null,issue:' DEF '}),
    {limit:15,clientName:'primary',registrantName:'agent',issueCode:'DEF',page:1});
});
test('every text normalization ceiling counts UTF-16 units and trims before slicing',()=>{
  for(const [op,key,max] of [[SEC,'query',240],[SEC,'companyName',240],[SEC,'formType',20],[SEC,'cik',20],
    [FARA,'query',240],[FARA,'registrantName',240],[FARA,'registrant',240],[FARA,'foreignPrincipal',240],[FARA,'country',120],[FARA,'status',20],
    [LDA,'clientName',200],[LDA,'query',200],[LDA,'registrantName',200],[LDA,'registrant',200],[LDA,'issueCode',120],[LDA,'issue',120]]){
    const normalized=normalize(op,{[key]:`  ${'😀'.repeat(max)}  `});
    const effective=key==='companyName'?'query':key==='registrant'?'registrantName':key==='issue'?'issueCode':op===LDA&&key==='query'?'clientName':key;
    assert.equal(normalized[effective].length,max);assert.equal(normalized[effective],'😀'.repeat(max/2));
  }
});
test('limit follows finite number/string clamp and family defaults',()=>{
  for(const [op,fallback] of [[SEC,20],[FARA,20],[LDA,15]]){
    for(const [raw,expected] of [[undefined,fallback],[null,fallback],['bad',fallback],['Infinity',fallback],['',1],['  ',1],[-4,1],[0,1],[3.9,3],['4.9',4],[99,50]]){
      const input=raw===undefined?{}:{limit:raw};assert.equal(normalize(op,input).limit,expected);
    }
  }
});
test('LDA page is bounded1..100 and cannot expand to direct service maximum',()=>{
  for(const [page,expected] of [[null,1],['bad',1],['',1],[-3,1],[3.9,3],['1000',100]])assert.equal(normalize(LDA,{page}).page,expected);
  assert.throws(()=>normalize(SEC,{page:1}));assert.throws(()=>normalize(FARA,{page:1}));
  assert.equal(normalize(LDA,{limit:100}).limit,50);
});
test('LDA effective year preserves truthiness but refuses invalid database Int selectors',()=>{
  for(const year of [null,0,'',' ','0','-0','bad'])assert.ok(!Object.hasOwn(normalize(LDA,{year}),'year'));
  for(const [year,expected] of [[2026,2026],['2026',2026],['2.026e3',2026],[-1,-1],[-2147483648,-2147483648]])
    assert.equal(normalize(LDA,{year}).year,expected);
  for(const year of [1.5,'2026.5',2147483648,-2147483649,'Infinity','1e100'])assert.throws(()=>normalize(LDA,{year}));
});
test('typed raw admission rejects ignored legacy objects/booleans and unknown authority keys',()=>{
  for(const [op,raw] of [[SEC,{query:false}],[FARA,{country:3}],[LDA,{clientName:{}}],[LDA,{year:true}],[SEC,{limit:[]}],
    [SEC,{tenantId:'other'}],[FARA,{clientId:'uuid'}],[LDA,{role:'admin'}],[LDA,{hasMore:true}],[SEC,{cursor:'next'}]])
    assert.throws(()=>normalize(op,raw));
});
test('normalization leaves caller data unchanged and returns detached ordinary data',()=>{
  const raw={registrantName:' test ',limit:'2'},before=structuredClone(raw);
  const normalized=normalize(FARA,raw);normalized.registrantName='changed';assert.deepEqual(raw,before);
});
test('all three exact nonempty result projections validate without source effects',()=>{
  for(const [op,fixture] of fixtures){const page=fixture(),before=structuredClone(page);assert.equal(check(op,page,{}),page);assert.deepEqual(page,before);}
  assert.throws(()=>check(SEC,fara(),{}));assert.throws(()=>check(FARA,sec(),{}));assert.throws(()=>check(LDA,sec(),{}));
});
test('independent count races preserve total smaller than row count or page offset',()=>{
  for(const [op,fixture] of fixtures){const page=fixture();page.total=0;check(op,page,{});assert.equal(page.total,0);}
  const page=lda();page.page=100;page.total=0;check(LDA,page,{page:100});
  for(const [op,fixture] of fixtures){const page=fixture();page.data=[];page.total=50;check(op,page,{});}
});
test('total must remain a nonnegative safe integer rather than fabricated nullable/string metadata',()=>{
  for(const total of [-1,1.1,null,'3',Number.MAX_SAFE_INTEGER+1]){
    const page=sec();page.total=total;assert.throws(()=>check(SEC,page,{}));
  }
});
test('rows cannot exceed normalized limit while independent totals remain unconstrained by row length',()=>{
  for(const [op,fixture] of fixtures){const page=fixture();page.data.push({...page.data[0],id:'other',accessionNumber:'other',registrationNumber:'other',filingUuid:'other'});
    // Remove fields not in the original row so only the requested bound is tested.
    for(const key of Object.keys(page.data[1]))if(!Object.hasOwn(page.data[0],key))delete page.data[1][key];
    if(op===LDA)page.limit=1;assert.throws(()=>check(op,page,{limit:1}));
  }
});
test('SEC exact CIK/form selectors remain case-sensitive and no zero-padding is invented',()=>{
  const page=sec();page.data[0].cik='123';check(SEC,page,{cik:' 123 ',formType:'10-K'});
  assert.throws(()=>check(SEC,page,{cik:'0000000123'}));assert.throws(()=>check(SEC,page,{formType:'10-k'}));
  check(SEC,page,{query:'SQL collation-owned selection'});
});
test('FARA exact status has no enum, and text searches need not survive projected summary',()=>{
  const page=fara();page.data[0].status='Historical unknown status';page.data[0].country='Stored label, collation-owned';
  check(FARA,page,{query:'not in returned summary',country:'not exact',foreignPrincipal:'DB collation-owned'});
  page.data[0].status='Other';check(FARA,page,{status:'Other'});
  assert.throws(()=>check(FARA,page,{status:'other'}));page.data[0].status=null;assert.throws(()=>check(FARA,page,{status:'Other'}));
});
test('selected FARA country cannot match a null stored country',()=>{
  const page=fara();check(FARA,page,{});
  assert.throws(()=>check(FARA,page,{country:'France'}));
});
test('SEC/FARA summaries preserve empty/null-source and 300 UTF-16 bounds',()=>{
  for(const [op,fixture] of [[SEC,sec],[FARA,fara]]){
    const page=fixture();for(const description of ['', 'x'.repeat(300),'😀'.repeat(150),'x'.repeat(297)+'...']){
      page.data[0].description=description;check(op,page,{});
    }
    for(const description of [null,'😀'.repeat(151),'x'.repeat(301),' leading','trailing ','two  spaces','line\nbreak','non\tspace']){
      page.data[0].description=description;assert.throws(()=>check(op,page,{}));
    }
  }
});
test('SEC/FARA summary does not establish truncation status or a full-text result',()=>{
  const page=sec();page.data[0].description='Short summary...';check(SEC,page,{});
  for(const field of ['descriptionComplete','fullText','truncated','summaryLength','sourceText']){
    const bad=sec();bad.data[0][field]=true;assert.throws(()=>check(SEC,bad,{}));
  }
});
test('stored disclosure dates serialize at UTC midnight; LDA timestamp can carry a time',()=>{
  const p=lda();p.data[0].dtPosted='2026-10-12T14:12:13.123Z';check(LDA,p,{});
  for(const [op,fixture,key] of [[SEC,sec,'filingDate'],[FARA,fara,'registrationDate']]){
    const page=fixture();page.data[0][key]=NOW;check(op,page,{});
    for(const stamp of ['2026-10-12','2026-10-12T12:00:00Z','2016-12-31T23:59:60Z']){
      page.data[0][key]=stamp;assert.throws(()=>check(op,page,{}));
    }
  }
  const required=sec();required.data[0].filingDate=null;assert.throws(()=>check(SEC,required,{}));
});
test('observation order descends with equal times and nullable source dates preserved',()=>{
  for(const [op,fixture,key] of [[SEC,sec,'filingDate'],[FARA,fara,'registrationDate'],[LDA,lda,'dtPosted']]){
    const page=fixture();page.data[0][key]=NOW;const second={...page.data[0],[key]:OLDER};
    for(const id of ['id','accessionNumber','registrationNumber','filingUuid'])if(Object.hasOwn(second,id))second[id]+='-second';
    page.data.push(second);check(op,page,{});second[key]=NOW;check(op,page,{});
    page.data[0][key]=OLDER;assert.throws(()=>check(op,page,{}));
    if(op!==SEC){page.data[0][key]=null;check(op,page,{});}
  }
});
test('LDA finite numeric projection preserves negative, zero, large rounded and null amounts',()=>{
  for(const income of [null,0,-10.5,123.45,10000000000000000]){
    const page=lda();page.data[0].income=income;page.data[0].expenses=income;check(LDA,page,{});
    assert.equal(page.data[0].income,income);
  }
  for(const income of ['12.00',{},NaN,Infinity]){const page=lda();page.data[0].income=income;assert.throws(()=>check(LDA,page,{}));}
});
test('LDA uses source filing identity and nullable numeric source IDs, never tenant-client UUID',()=>{
  const page=lda();page.data[0].clientId=-1;page.data[0].registrantId=2147483647;check(LDA,page,{});
  for(const key of ['clientId','registrantId']){
    for(const value of ['11111111-1111-4111-8111-111111111111',1.5,2147483648]){
      const bad=lda();bad.data[0][key]=value;assert.throws(()=>check(LDA,bad,{}));
    }
  }
  page.data[0].id='internal-id';assert.throws(()=>check(LDA,page,{}));
});
test('LDA keeps exact year/issue and original page/limit correlation',()=>{
  const page=lda();check(LDA,page,{year:2026,issueCode:'DEF'});
  for(const request of [{year:2025},{issueCode:'def'},{page:2},{limit:14}])assert.throws(()=>check(LDA,page,request));
  page.page=100;page.limit=50;check(LDA,page,{page:999,limit:999});
});
test('nullable projected fields are required and strings remain opaque',()=>{
  for(const [op,fixture,fields] of [[SEC,sec,['url']],[FARA,fara,['country','status','registrationDate']],[LDA,lda,['filingPeriod','income','expenses','dtPosted','registrantId','clientId','clientState']]]){
    for(const field of fields){const page=fixture();page.data[0][field]=null;check(op,page,{});delete page.data[0][field];assert.throws(()=>check(op,page,{}));}
  }
  const page=sec();page.data[0].url='stored non-URL value';check(SEC,page,{});
});
test('duplicates reject exact unique record identities without inventing unique fiscal periods',()=>{
  for(const [op,fixture] of fixtures){const page=fixture();page.data.push({...page.data[0]});assert.throws(()=>check(op,page,{}));}
});
test('generated timestamp cannot become stale-proof or a malformed finite instant',()=>{
  for(const [op,fixture] of fixtures){const page=fixture();page.generatedAt=OLDER;check(op,page,{});
    page.generatedAt='2016-12-31T23:59:60Z';assert.throws(()=>check(op,page,{}));}
});
test('closed envelopes reject invented cursor, snapshot, authority or completeness claims',()=>{
  for(const [op,fixture] of fixtures)for(const key of ['hasMore','nextPage','nextCursor','complete','available','authorized','tenantId','snapshotId','absenceEvidence']){
    const page=fixture();page[key]=true;assert.throws(()=>check(op,page,{}));
  }
  for(const [op,fixture] of fixtures){const page=fixture();page.data[0].sourceQualified=true;assert.throws(()=>check(op,page,{}));}
});
test('canonical hostile data checks execute no getter/proxy effects',()=>{
  let effects=0;const getter={get query(){effects++;return 'x';}};
  assert.throws(()=>normalize(SEC,getter));assert.throws(()=>normalize(SEC,new Proxy({},{ownKeys(){effects++;return [];}})));
  const page=lda();Object.defineProperty(page.data[0],'income',{get(){effects++;return 0;},enumerable:true});
  assert.throws(()=>check(LDA,page,{}));assert.equal(effects,0);
});
test('canonical data boundary refuses hidden fields, symbols, cycles and alternate prototypes',()=>{
  const symbol={query:'x',[Symbol('authority')]:true},inherited=Object.create({query:'x'}),hidden={};
  Object.defineProperty(hidden,'query',{value:'x'});
  for(const raw of [symbol,inherited,hidden,{query:undefined}])assert.throws(()=>normalize(SEC,raw));
  const page=lda();page.data[0].issueCodes=[page];assert.throws(()=>check(LDA,page,{}));
  assert.throws(()=>normalize('search_lda_contributions',{}));assert.throws(()=>normalize('constructor',{}));
});
test('operation selector refuses object coercion without invoking caller code',()=>{
  let effects=0;
  const operation={get [Symbol.toPrimitive](){effects++;return ()=>SEC;}};
  assert.throws(()=>normalize(operation,{}));assert.equal(effects,0);
  assert.throws(()=>check(new Proxy({},{get(){effects++;return ()=>SEC;}}),sec(),{}));assert.equal(effects,0);
});

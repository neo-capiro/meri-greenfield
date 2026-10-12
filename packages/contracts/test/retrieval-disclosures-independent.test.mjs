import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const source=process.env.MERI_DISCLOSURES_REVIEW_SOURCE_ROOT?pathToFileURL(process.env.MERI_DISCLOSURES_REVIEW_SOURCE_ROOT.replace(/\/$/,'')+'/packages/contracts/'):new URL('../',import.meta.url);
const {createDisclosuresValidators}=await import(new URL('retrieval-0.2/disclosures-validation.mjs',source));
const schema=JSON.parse(readFileSync(new URL('retrieval-0.2/disclosures.schema.json',source)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const shapes=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const family=createDisclosuresValidators({validateShape(n,v){assert.equal(shapes.get(n)(v),true,`Invalid ${n}`);return v;}});
const normalize=family.normalizeDisclosuresInput,check=family.assertDisclosuresOutput;
const SEC='search_sec_filings',FARA='search_fara_registrations',LDA='search_lda_filings',ops=[SEC,FARA,LDA];
const T='2026-09-01T00:00:00.000Z',prior='2026-08-01T00:00:00.000Z';
// Independently authored synthetic projections; no private implementation/data imported.
const sec=()=>({id:'sec-review',cik:'0000000099',companyName:'Review Company',formType:'10-K',accessionNumber:'opaque-accession',filingDate:T,description:'Synthetic summary',url:null});
const fara=()=>({id:'fara-review',registrationNumber:'opaque-registration',registrantName:'Review Registrant',foreignPrincipal:'Synthetic Principal',country:null,status:null,registrationDate:null,description:''});
const lda=()=>({filingUuid:'opaque-filing-identity',filingType:'LD-2',filingYear:2026,filingPeriod:null,income:null,expenses:0,dtPosted:null,registrantId:null,registrantName:'Review Registrant',clientId:null,clientName:'Review Client',clientState:null,issueCodes:[]});
const row=op=>op===SEC?sec():op===FARA?fara():lda();
function page(op){return {tool:op,generatedAt:T,total:1,data:[row(op)],...(op===LDA?{page:1,limit:15}:{})};}
const reject=(op,p,raw={})=>assert.throws(()=>check(op,p,raw));
const mutate=(op,list,raw={})=>{for(const f of list){const p=page(op);f(p);reject(op,p,raw);}};

test('three nonempty projections admit exact fields and retained nullable values',()=>{for(const op of ops){const p=page(op);assert.equal(check(op,p,{}),p);}});
test('global empty context refuses invented binding, actor or client authority',()=>{
  for(const op of ops){assert.doesNotThrow(()=>normalize(op,{}));for(const c of [{tenantId:'t'},{actorId:'a'},{binding:{}},{subject:{}},{authorized:true}])assert.throws(()=>normalize(op,{},c));}
  assert.throws(()=>normalize('toString',{}));assert.throws(()=>normalize('search_all_disclosures',{}));
});
test('SEC aliases use first nonempty trimmed value and literal form/cik selectors',()=>{
  assert.deepEqual(normalize(SEC,{query:'  Primary ',companyName:'Other',formType:' 10-k ',cik:' 0099 '}),{limit:20,query:'Primary',formType:'10-k',cik:'0099'});
  assert.deepEqual(normalize(SEC,{query:' ',companyName:' Fallback '}),{limit:20,query:'Fallback'});
});
test('FARA aliases and all normalized filters remain distinct',()=>{
  assert.deepEqual(normalize(FARA,{query:' general ',registrantName:' primary ',registrant:'alternate',foreignPrincipal:'principal',country:' country ',status:'Historic'}),{limit:20,query:'general',registrantName:'primary',foreignPrincipal:'principal',country:'country',status:'Historic'});
  assert.equal(normalize(FARA,{registrantName:null,registrant:' alias '}).registrantName,'alias');
});
test('LDA alias precedence preserves independent client, issue and registrant dimensions',()=>{
  assert.deepEqual(normalize(LDA,{clientName:'preferred',query:'other',issueCode:'TAX',issue:'HCR',registrantName:'main',registrant:'other'}),{limit:15,clientName:'preferred',issueCode:'TAX',registrantName:'main',page:1});
  assert.deepEqual(normalize(LDA,{clientName:' ',query:' q ',issueCode:null,issue:' i ',registrantName:'',registrant:' r '}),{limit:15,clientName:'q',issueCode:'i',registrantName:'r',page:1});
});
test('aliases trim then truncate by UTF16 and can preserve a split surrogate',()=>{
  assert.equal(normalize(SEC,{query:'😀'.repeat(121)}).query.length,240);
  assert.equal(normalize(FARA,{country:'😀'.repeat(61)}).country.length,120);
  assert.equal(normalize(LDA,{clientName:'😀'.repeat(101)}).clientName.length,200);
  const n=normalize(SEC,{formType:'a'.repeat(19)+'😀'});assert.equal(n.formType.length,20);assert.equal(n.formType.charCodeAt(19),0xd83d);
});
test('numeric clamp defaults, truncation, numeric strings and fallback are preserved',()=>{
  for(const op of ops){assert.equal(normalize(op,{}).limit,op===LDA?15:20);assert.equal(normalize(op,{limit:null}).limit,op===LDA?15:20);assert.equal(normalize(op,{limit:'not-a-number'}).limit,op===LDA?15:20);assert.equal(normalize(op,{limit:'3.9'}).limit,3);assert.equal(normalize(op,{limit:' '}).limit,1);assert.equal(normalize(op,{limit:-9}).limit,1);assert.equal(normalize(op,{limit:999}).limit,50);}
  assert.equal(normalize(LDA,{page:'9.9'}).page,9);assert.equal(normalize(LDA,{page:999}).page,100);
});
test('LDA zero or NaN year is absent while finite Int32 selectors remain exact',()=>{
  for(const year of [null,0,'0','',' ','not-a-year'])assert.equal(normalize(LDA,{year}).year,undefined);
  for(const year of [-1,2026,'2026',-2147483648,2147483647])assert.equal(normalize(LDA,{year}).year,Number(year));
  for(const year of [1.2,'1.2',2147483648,-2147483649,'Infinity'])assert.throws(()=>normalize(LDA,{year}));
});
test('typed ingress refuses non-scalar legacy coercions and unknown request fields',()=>{
  for(const op of ops)for(const raw of [{limit:true},{limit:[]},{limit:{}},{query:15},{query:false},{query:[]},{tenantId:'x'},{actorId:'x'},{authorized:true},{cursor:'x'}])assert.throws(()=>normalize(op,raw));
  assert.throws(()=>normalize(SEC,{page:1}));assert.throws(()=>normalize(FARA,{clientId:'tenant-private-client'}));assert.throws(()=>normalize(LDA,{year:true}));
});
test('independent count race permits zero total with rows and large total with none',()=>{
  for(const op of ops){const p=page(op);p.total=0;check(op,p,{});p.total=999;p.data=[];check(op,p,{});}
});
test('total is finite nonnegative safe integer without deriving completeness or pages',()=>{
  for(const op of ops)mutate(op,[p=>p.total=-1,p=>p.total=1.5,p=>p.total=Number.MAX_SAFE_INTEGER+1,p=>p.complete=true,p=>p.hasMore=true,p=>p.nextCursor='next']);
});
test('request row bound and LDA page/window cannot be substituted',()=>{
  for(const op of ops){const p=page(op);p.data.push({...row(op),id:'other',accessionNumber:'other'});reject(op,p,{limit:1});}
  mutate(LDA,[p=>p.page=2,p=>p.limit=16]);const p=page(LDA);p.page=2;p.limit=4;check(LDA,p,{page:2,limit:4});
});
test('unique source identities reject duplicates even if other projected fields differ',()=>{
  for(const [op,key] of [[SEC,'id'],[SEC,'accessionNumber'],[FARA,'id'],[FARA,'registrationNumber'],[LDA,'filingUuid']]){const p=page(op);const r=row(op);if(op!==LDA){r.id='different';if(op===SEC)r.accessionNumber='different';else r.registrationNumber='different';}r[key]=p.data[0][key];p.data.push(r);reject(op,p);}
});
test('SEC exact cik and formType filtering refuses cross-request results',()=>{
  check(SEC,page(SEC),{cik:'0000000099',formType:'10-K'});reject(SEC,page(SEC),{cik:'99'});reject(SEC,page(SEC),{formType:'10-k'});
});
test('FARA exact status filtering does not invent a status enum',()=>{
  const p=page(FARA);p.data[0].status='arbitrary-stored-status';check(FARA,p,{status:'arbitrary-stored-status'});reject(FARA,p,{status:'active'});reject(FARA,page(FARA),{status:'active'});
});
test('FARA nonempty country filter cannot return a null storage country',()=>{
  reject(FARA,page(FARA),{country:'France'});
});
test('FARA general query may match unreturned description suffix without a visible match',()=>{
  const p=page(FARA);p.data[0].description='Visible prefix only...';check(FARA,p,{query:'match-in-unreturned-suffix'});
});
test('LDA exact issue and year relations preserve case and array membership',()=>{
  const p=page(LDA);p.data[0].issueCodes=['TAX','TAX'];check(LDA,p,{issue:'TAX',year:2026});reject(LDA,p,{issue:'tax'});reject(LDA,p,{year:2025});
});
test('descriptions preserve empty summaries but refuse unnormalized whitespace and UTF16 overflow',()=>{
  for(const op of [SEC,FARA]){const p=page(op);p.data[0].description='';check(op,p,{});p.data[0].description='😀'.repeat(150);check(op,p,{});p.data[0].description+='x';reject(op,p);for(const description of [' leading','trailing ','two  spaces','line\nbreak','a\tb',null]){p.data[0].description=description;reject(op,p);}}
});
test('SEC and FARA native date-only fields require midnight UTC; nullable FARA stays null',()=>{
  for(const [op,key] of [[SEC,'filingDate'],[FARA,'registrationDate']]){const p=page(op);p.data[0][key]=T;check(op,p,{});p.data[0][key]='2026-09-01T01:00:00Z';reject(op,p);}
  check(FARA,page(FARA),{});mutate(SEC,[p=>p.data[0].filingDate=null]);
});
test('observation order descends and permits ties without an invented tie-breaker',()=>{
  for(const [op,key] of [[SEC,'filingDate'],[FARA,'registrationDate'],[LDA,'dtPosted']]){const p=page(op);p.data[0][key]=T;const r=row(op);if(op===LDA)r.filingUuid='other';else{r.id='other';if(op===SEC)r.accessionNumber='other';else r.registrationNumber='other';}r[key]=T;p.data.push(r);check(op,p,{});r[key]=prior;check(op,p,{});p.data.reverse();reject(op,p);}
});
test('finite timestamps reject leap seconds, malformed values and Date objects',()=>{
  for(const op of ops)mutate(op,[p=>p.generatedAt='bad',p=>p.generatedAt='2016-12-31T23:59:60Z',p=>p.generatedAt=new Date(T)]);
  mutate(LDA,[p=>p.data[0].dtPosted='2016-12-31T23:59:60Z']);
});
test('nullable dates do not provide a fake snapshot or global source freshness bound',()=>{
  const p=page(LDA);p.data[0].dtPosted='2027-01-01T18:00:00Z';check(LDA,p,{});p.data[0].dtPosted=null;check(LDA,p,{});
  const f=page(FARA);f.data[0].registrationDate=null;check(FARA,f,{});
});
test('LDA monetary values preserve null zero negative and rounded Number behavior',()=>{
  for(const value of [null,0,-12.5,0.1+0.2,9007199254740992]){const p=page(LDA);p.data[0].income=value;check(LDA,p,{});assert.equal(p.data[0].income,value);}
  mutate(LDA,[p=>p.data[0].income='12.00',p=>p.data[0].income=NaN,p=>p.data[0].expenses=Infinity,p=>p.data[0].income={decimal:'1.00'}]);
});
test('LDA disclosure numeric IDs are nullable signed Int32, not Capiro client UUIDs',()=>{
  for(const v of [null,-1,0,2147483647,-2147483648]){const p=page(LDA);p.data[0].clientId=v;p.data[0].registrantId=v;check(LDA,p,{});}
  mutate(LDA,[p=>p.data[0].clientId='tenant-client',p=>p.data[0].registrantId=1.5,p=>p.data[0].filingYear=2147483648]);
});
test('nullable projected fields are required, and discarded storage fields cannot leak',()=>{
  for(const [op,key] of [[SEC,'url'],[FARA,'country'],[FARA,'status'],[FARA,'registrationDate'],[LDA,'filingPeriod'],[LDA,'income'],[LDA,'dtPosted'],[LDA,'clientState']])mutate(op,[p=>delete p.data[0][key]]);
  mutate(SEC,[p=>p.data[0].primaryDoc='body']);mutate(FARA,[p=>p.data[0].address='private']);mutate(LDA,[p=>p.data[0].lobbyists=[],p=>p.data[0].lobbyingActivities=[],p=>p.data[0].governmentEntities={},p=>p.data[0].id='internal']);
});
test('opaque URL, CIK, registration and filing identifiers are not reformatted',()=>{
  const s=page(SEC);s.data[0].url='source supplied opaque URL';s.data[0].cik='source-label';check(SEC,s,{});
  const f=page(FARA);f.data[0].registrationNumber='non-numeric';check(FARA,f,{});check(LDA,page(LDA),{});
});
test('inert request and options admission never invokes getters or proxy traps',()=>{
  let effects=0;const getter={};Object.defineProperty(getter,'query',{enumerable:true,get(){effects++;return 'x';}});const proxy=new Proxy({},{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');}});
  for(const raw of [getter,proxy,Object.create({query:'x'}),{[Symbol('x')]:1}])assert.throws(()=>normalize(SEC,raw));
  assert.throws(()=>normalize(SEC,{},proxy));assert.equal(effects,0);
});
test('hostile nested output values refuse without effects and normalization stays detached',()=>{
  let effects=0;const p=page(SEC);Object.defineProperty(p.data[0],'description',{enumerable:true,get(){effects++;return 'x';}});reject(SEC,p);reject(SEC,new Proxy(page(SEC),{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');}}));assert.equal(effects,0);
  const raw={query:' q '},n=normalize(SEC,raw);n.query='other';assert.equal(raw.query,' q ');
});

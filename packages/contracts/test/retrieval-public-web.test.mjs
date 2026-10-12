import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createPublicWebValidators, PUBLIC_WEB_OPERATION_IDS} from '../retrieval-0.2/public-web-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/public-web.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createPublicWebValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);}});
const [search,scrape]=PUBLIC_WEB_OPERATION_IDS,stamp='2026-10-12T19:00:00.000Z',url='https://example.invalid/article';
const norm=(id,input,options)=>v.normalizePublicWebInput(id,input,options);
const check=(id,page,request=id===search?{query:'synthetic'}:{url},options)=>v.assertPublicWebOutput(id,page,request,options);
function result(provider='tavily',count=1){return{tool:search,contentStatus:'discovered',generatedAt:stamp,provider,total:count,results:Array.from({length:count},()=>({title:'Synthetic title',url:'https://example.invalid/result',snippet:null,source:provider,...(provider==='duckduckgo'?{}:{publishedAt:null})}))};}
function html(text='Synthetic text',truncated=false){return{tool:scrape,generatedAt:stamp,url,title:null,contentType:'text/html; charset=utf-8',text,totalChars:truncated?null:text.length,truncated,links:[],contentHash:'a'.repeat(64),authoritativeOwner:'public_url',currentStatus:'available',trust:'external_untrusted',coverage:{locator:{url,characterStart:0,characterEnd:text.length},complete:!truncated,truncated}};}
function pdf(text='Synthetic text',totalChars=text.length){const p=html(text,totalChars>4000);return{...p,kind:'pdf',title:null,contentType:'application/pdf',pages:0,totalChars,coverage:{...p.coverage,pages:0}};}

test('exact two-operation API and private definitions',()=>{
 assert.deepEqual(PUBLIC_WEB_OPERATION_IDS,['search_public_web','scrape_web_page']);assert.equal(v.publicWebSchemaId,'urn:meri:retrieval:public-web:0.2.0');
 for(const [id,prefix] of [[search,'PublicWebSearch'],[scrape,'PublicWebPage']]){assert.equal(v.publicWebInputDefinition(id),prefix+'Input');assert.equal(v.publicWebOutputDefinition(id),prefix+'Output');}
 assert.throws(()=>createPublicWebValidators({schema:{...schema,$id:'other'},validateShape(){}}));
});
test('normalization preserves source clamps and mode-specific defaults',()=>{
 assert.deepEqual(norm(search,{query:'  synthetic  '}).input,{query:'synthetic',limit:6});
 for(const [limit,want] of [[-2,1],[22,12],[2.8,2],['3.9',3],['bad',6],[null,6],['',1]])assert.equal(norm(search,{query:'q',limit}).input.limit,want);
 for(const [mode,want] of [[undefined,4000],[null,4000],[' ',4000],['extract',12000],['EXTRACT',4000],['unknown',4000]])assert.equal(norm(scrape,{url,...(mode===undefined?{}:{mode})}).input.maxChars,want);
 for(const [maxChars,want] of [[0,500],['20',500],[25000,20000],[1000.7,1000],['bad',4000],[null,4000]])assert.equal(norm(scrape,{url,maxChars}).input.maxChars,want);
});
test('strict JSON scalar admission and required selectors',()=>{
 for(const raw of [{},{query:null},{query:''},{query:' \t '},{query:5},{query:[]}])assert.throws(()=>norm(search,raw));
 for(const raw of [{},{url:null},{url:''},{url:' '},{url:5},{url:[]}])assert.throws(()=>norm(scrape,raw));
 for(const value of [true,{},[],NaN,Infinity,undefined]){assert.throws(()=>norm(search,{query:'q',limit:value}));assert.throws(()=>norm(scrape,{url,maxChars:value}));}
 for(const mode of [3,true,{},[]])assert.throws(()=>norm(scrape,{url,mode}));
});
test('UTF16 slicing and no second trim or mode case folding',()=>{
 assert.equal(norm(search,{query:'x'.repeat(239)+'😀'}).input.query,'x'.repeat(239)+'\ud83d');
 assert.equal(norm(search,{query:'x'.repeat(239)+' y'}).input.query,'x'.repeat(239)+' ');
 assert.equal(norm(scrape,{url,mode:'x'.repeat(19)+' y'}).input.mode,'x'.repeat(19)+' ');
 assert.equal(norm(scrape,{url,mode:'EXTRACT'}).input.mode,'EXTRACT');
});
test('page URL syntax rejects schemes and credentials without certifying network admission',()=>{
 for(const bad of ['data:text/plain,x','file:///tmp/x','ftp://example.invalid','relative','https://user:secret@example.invalid'])assert.throws(()=>norm(scrape,{url:bad}));
 // Syntactic admission deliberately says nothing about DNS/SSRF. Never fetch these fixtures.
 for(const candidate of ['http://127.0.0.1/','http://localhost/','https://example.invalid/'])assert.equal(norm(scrape,{url:candidate}).input.url,candidate);
});
for(const provider of ['tavily','serper','duckduckgo'])test(`${provider}: exact provider row nullability and returned count`,()=>{
 const p=result(provider,2);check(search,p);assert.equal(check(search,p).total,2);
 p.results[0].snippet='Synthetic snippet';check(search,p);p.total=1;assert.throws(()=>check(search,p));
 p.total=2;assert.throws(()=>check(search,p,{query:'q',limit:1}));p.results[0].source=provider==='tavily'?'serper':'tavily';assert.throws(()=>check(search,p));
});
test('publication text is opaque required provider text, omitted in DuckDuckGo',()=>{
 for(const provider of ['tavily','serper']){const p=result(provider);for(const text of ['yesterday','Jun 2, 2026','not a date',null]){p.results[0].publishedAt=text;check(search,p);}delete p.results[0].publishedAt;assert.throws(()=>check(search,p));}
 const ddg=result('duckduckgo');ddg.results[0].publishedAt=null;assert.throws(()=>check(search,ddg));
});
test('DuckDuckGo raw nonempty URL is not strengthened into normalized provider URL',()=>{
 const ddg=result('duckduckgo');for(const raw of ['/l/?synthetic','javascript:untrusted-result','not a URL']){ddg.results[0].url=raw;check(search,ddg);}
 const p=result();p.results[0].url='ftp://example.invalid';assert.throws(()=>check(search,p));p.results[0].url='HTTP://';check(search,p); // provider only checks prefix
});
test('search retains duplicate rows and empty discovery without absence proof',()=>{
 check(search,result('serper',12),{query:'q',limit:12});check(search,result('duckduckgo',0));
 for(const key of ['complete','absenceEvidence','authoritative','contentHash','query']){const p=result();p[key]=true;assert.throws(()=>check(search,p));}
});
test('search field caps are UTF16 normalized excerpts without fabricated date parsing',()=>{
 for(const [key,cap] of [['title',180],['snippet',320],['publishedAt',40]]){
  const p=result();p.results[0][key]='x'.repeat(cap-1)+'\ud83d';check(search,p);
  for(const value of ['x'.repeat(cap+1),' leading','two  spaces','line\nbreak','']){p.results[0][key]=value;assert.throws(()=>check(search,p));}
 }
});
test('HTML exact untrusted owner, raw-byte hash syntax and coverage',()=>{
 const p=html('a😀b');check(scrape,p);assert.equal(p.totalChars,4);assert.equal(p.coverage.locator.characterEnd,4);
 for(const mutate of [p=>p.trust='trusted',p=>p.authoritativeOwner='tenant',p=>p.currentStatus='verified',p=>p.contentHash='A'.repeat(64),p=>p.contentHash='a'.repeat(63),p=>p.coverage.locator.characterEnd--,p=>p.coverage.locator.characterStart=1,p=>p.coverage.locator.url+='other',p=>p.coverage.complete=false,p=>p.coverage.truncated=true]){const p=html();mutate(p);assert.throws(()=>check(scrape,p));}
});
test('HTML truncated unknown totals and complete empty text remain distinct',()=>{
 check(scrape,html('',false));check(scrape,html('x'.repeat(3997)+'...',true));
 const p=html('partial',true);p.totalChars=7;assert.throws(()=>check(scrape,p));const full=html();full.totalChars=null;assert.throws(()=>check(scrape,full));
});
test('HTML title is nullable unbounded source text, no invented title length limit',()=>{
 const p=html();p.title='x'.repeat(1000);check(scrape,p);p.title=null;check(scrape,p);
 for(const title of ['', 'two  spaces',' leading']){p.title=title;assert.throws(()=>check(scrape,p));}
});
test('HTML link cap, URL uniqueness and nullable 120-unit labels',()=>{
 const p=html();p.links=Array.from({length:8},(_,i)=>({url:`https://example.invalid/${i}`,text:null}));check(scrape,p);
 p.links[0].url='https://user:label@example.invalid/';check(scrape,p); // projected links lack main-response credential guard
 p.links[1].url=p.links[0].url;assert.throws(()=>check(scrape,p));
 p.links=Array.from({length:9},(_,i)=>({url:`https://example.invalid/${i}`,text:null}));assert.throws(()=>check(scrape,p));
 for(const text of ['x'.repeat(121),'']){p.links=[{url,text}];assert.throws(()=>check(scrape,p));}
});
test('HTML and PDF content classification differs including suffix fallback',()=>{
 check(scrape,pdf());for(const contentType of ['text/html','application/xhtml+xml']){const p=html();p.contentType=contentType;check(scrape,p);}
 for(const contentType of ['application/json','application/pdf','TEXT/HTML','']){const p=html();p.contentType=contentType;assert.throws(()=>check(scrape,p));}
 for(const contentType of ['application/octet-stream','']){const p=pdf();p.url='https://example.invalid/report.PDF?view=1';p.coverage.locator.url=p.url;p.contentType=contentType;check(scrape,p);}
 const p=pdf();p.contentType='text/html';assert.throws(()=>check(scrape,p));
});
test('PDF exact fields preserve zero pages and differ from HTML',()=>{
 const p=pdf();check(scrape,p);
 for(const mutate of [p=>p.title='invented',p=>p.pages=-1,p=>p.pages=1.5,p=>p.coverage.pages=1,p=>p.links=[{url,text:null}],p=>delete p.kind,p=>delete p.pages,p=>p.totalChars=null]){const p=pdf();mutate(p);assert.throws(()=>check(scrape,p));}
 const h=html();h.pages=0;assert.throws(()=>check(scrape,h));
});
test('PDF totalChars is full normalized extraction count, not displayed length when truncated',()=>{
 const p=pdf('x'.repeat(3997)+'...',4001);check(scrape,p);assert.notEqual(p.totalChars,p.text.length);
 for(const mutate of [p=>p.totalChars=3,p=>p.truncated=false,p=>p.coverage.complete=true,p=>p.totalChars=4000]){const q=structuredClone(p);mutate(q);assert.throws(()=>check(scrape,q));}
 const full=pdf('partial',8);assert.throws(()=>check(scrape,full));
});
test('maxChars context bounds UTF16 output and exact PDF truncation threshold',()=>{
 const exact=pdf('x'.repeat(500),500);exact.truncated=false;exact.coverage.complete=true;exact.coverage.truncated=false;check(scrape,exact,{url,maxChars:500});
 const p=pdf('x'.repeat(500),501);p.truncated=true;p.coverage.complete=false;p.coverage.truncated=true;check(scrape,p,{url,maxChars:500});
 assert.throws(()=>check(scrape,html('x'.repeat(501)),{url,maxChars:500}));assert.throws(()=>check(scrape,p,{url,maxChars:501}));
});
test('redirect final URL differs; generatedAt and hash do not attest request bytes or freshness',()=>{
 const p=html();p.url='https://example.invalid/redirected';p.coverage.locator.url=p.url;p.generatedAt='2000-01-01T00:00:00.000Z';p.contentHash='0'.repeat(64);check(scrape,p);
 for(const field of ['requestedUrl','httpStatus','dnsVerified','byteHashVerified','authorized']){const q=html();q[field]=true;assert.throws(()=>check(scrape,q));}
});
test('canonical instant narrowing does not use an ambient clock',()=>{
 for(const generatedAt of ['2026-10-12T19:00:00Z','2026-10-12T20:00:00.000+01:00','not-a-date',null]){const p=result();p.generatedAt=generatedAt;assert.throws(()=>check(search,p));}
 const original=Date.now;Date.now=()=>{throw new Error('ambient');};try{check(search,result());check(scrape,html());}finally{Date.now=original;}
});
test('input/output are detached and normalized input metadata frozen',()=>{
 const request={url,mode:' extract '},copy=structuredClone(request),normalized=norm(scrape,request);assert.deepEqual(request,copy);assert.ok(Object.isFrozen(normalized));assert.ok(Object.isFrozen(normalized.input));assert.ok(Object.isFrozen(normalized.metadata));assert.deepEqual(normalized.metadata,{});
 const p=html(),out=check(scrape,p);out.coverage.locator.url='changed';assert.equal(p.coverage.locator.url,url);assert.notEqual(out,p);
});
test('model authority and unknown context/properties are refused',()=>{
 for(const id of PUBLIC_WEB_OPERATION_IDS){const request=id===search?{query:'q'}:{url};for(const key of ['tenantId','actorId','nowMs','provider','sourceConnected','defaultCongress']){assert.throws(()=>norm(id,{...request,[key]:'x'}));assert.throws(()=>norm(id,request,{[key]:'x'}));}}
});
test('hostile selectors and JSON hooks are rejected without effects',()=>{
 let effects=0;const hostile={[Symbol.toPrimitive](){effects++;return search;},toString(){effects++;return search;}};
 for(const id of [hostile,{},[],null,Symbol('id'),'__proto__','constructor']){assert.throws(()=>v.publicWebInputDefinition(id));assert.throws(()=>v.publicWebOutputDefinition(id));assert.throws(()=>v.validatePublicWebShape(id,{}));assert.throws(()=>norm(id,{}));}
 const getter={get query(){effects++;return'q';}},proxy=new Proxy({},{ownKeys(){effects++;return[];}}),cyclic={};cyclic.self=cyclic;
 for(const bad of [getter,proxy,cyclic,new Date(),{toJSON(){effects++;return{};}}]){assert.throws(()=>norm(search,bad));assert.throws(()=>check(search,bad));}
 assert.throws(()=>norm(search,{query:'q'},{get asOf(){effects++;return stamp;}}));assert.equal(effects,0);
});
test('canonical resolver binds immutable normalized hash and zero context keys without activation',()=>{
 const bindings=PUBLIC_WEB_OPERATION_IDS.map(id=>({id,version:'0.2.0',contextKeys:[],normalize:(_,request)=>norm(id,request),outputAssert:(_,value,request)=>check(id,value,request)}));
 const catalog={operations:bindings.map(b=>({operation:{id:b.id,version:b.version},handler:null,status:'unavailable'}))};
 const resolver=createOperationContracts({catalog,bindings,validators:v,assertCatalog(){},canonicalSha256});
 for(const id of PUBLIC_WEB_OPERATION_IDS){const contract=resolver.resolveOperationContract({id,version:'0.2.0'}),request=id===search?{query:' synthetic '}:{url,mode:'extract'},n=contract.normalizeInput(request);assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.ok(Object.isFrozen(n.request));assert.equal(contract.descriptor.handler,null);contract.assertOutput(id===search?result():html(),{request:n.request});assert.throws(()=>contract.normalizeInput(request,{nowMs:1}));assert.throws(()=>contract.assertOutput(id===search?result():html(),{}));}
});

test('truncated HTML/PDF cannot return a shorter-than-requested prefix window',()=>{
 assert.throws(()=>check(scrape,html('partial',true)));
 assert.throws(()=>check(scrape,pdf('partial',4001)));
 const h=html('x'.repeat(500),true);assert.throws(()=>check(scrape,h,{url,maxChars:500}));
});

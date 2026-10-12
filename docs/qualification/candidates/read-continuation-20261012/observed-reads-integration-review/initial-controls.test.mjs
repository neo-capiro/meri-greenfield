import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract,assertCatalog} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../retrieval-0.2/catalog-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {fixture,limits,NOW,uuid} from '../../../apps/gateway/test/fixtures.mjs';
const ids=['search_public_web','scrape_web_page','search_sam_opportunities','get_florida_budget_project'];
const [SEARCH,PAGE,SAM,FLORIDA]=ids,T='2026-10-12T12:00:00.000Z',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ev=new URL('../../../docs/qualification/candidates/read-continuation-20261012/observed-reads-integration-review/',import.meta.url);
const oldCatalog=JSON.parse(readFileSync(new URL('baseline-catalog.json',ev))),oldBindings=JSON.parse(readFileSync(new URL('baseline-bindings.json',ev)));
const copy=structuredClone, resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const schema=group=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
function context(id){return id===SAM?{asOf:T,sourceStatusAsOf:T,sourceHealthAsOf:T,evidenceAccuracyMode:'off'}:id===FLORIDA?{asOf:T,effectiveScope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},clientResolution:null}:{};}
const request=id=>id===SEARCH?{query:' synthetic evidence '}:id===PAGE?{url:'https://example.test/original'}:{};
function output(id){switch(id){
case SEARCH:return {tool:SEARCH,contentStatus:'discovered',generatedAt:T,provider:'duckduckgo',total:0,results:[]};
case PAGE:{const url='https://example.test/final',text='Synthetic body.';return {tool:PAGE,generatedAt:T,url,title:null,contentType:'text/html',text,totalChars:text.length,truncated:false,links:[],contentHash:'0'.repeat(64),authoritativeOwner:'public_url',currentStatus:'available',trust:'external_untrusted',coverage:{locator:{url,characterStart:0,characterEnd:text.length},complete:true,truncated:false}};}
case SAM:return {tool:SAM,generatedAt:T,total:0,sourceFreshness:[],sourceStatus:'unknown',sourceReason:'source_freshness_unavailable',notes:schema('sam-opportunities').$defs.SamOpportunitiesOutput.properties.notes.enum[1],results:[]};
case FLORIDA:return {tool:FLORIDA,generatedAt:T,result:{scope:context(FLORIDA).effectiveScope,fiscalYear:'2026-27',projects:[],nextOffset:null,documents:[],amounts:[],events:[],notice:schema('florida-budget').$defs.FloridaBudgetNotice.const},authority:schema('florida-budget').$defs.FloridaBudgetAuthority.const};
}}
const check=(id,page=output(id),req=request(id),ctx=context(id))=>resolve(id).assertOutput(page,{...ctx,request:req});
const samRow=()=>({id:U,noticeId:'notice',solicitationNumber:null,title:'Synthetic notice',noticeType:'stored',agency:null,office:null,pscCode:null,naicsCode:'541100',postedDate:null,responseDeadline:null,description:'Synthetic description.',sourceUrl:null,active:true});

test('original139 rows and63 descriptors/callbacks survive exactly four full mappings',()=>{
 assertCatalog(catalog);assert.equal(catalog.operations.length,67);assert.equal(bindings.length,67);assert.deepEqual(catalog.operations.filter(x=>!ids.includes(x.operation.id)),oldCatalog.operations);
 assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,66);assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,30);
 for(const old of oldCatalog.originals)assert.deepEqual(catalog.originals.find(x=>x.id===old.id),ids.includes(old.id)?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
 assert.deepEqual(JSON.parse(JSON.stringify(bindings.filter(x=>!ids.includes(x.id)),(k,v)=>typeof v==='function'?{source:v.toString()}:v)),oldBindings);assert.equal(catalog.originals.find(x=>x.id==='query_action_items').replacement,null);
 for(const id of ['query_global_data','save_memory','create_task','run_analysis'])assert.throws(()=>resolve(id));
});
test('all67 descriptors have exact schema byte pins and no implementation admission',()=>{
 for(const b of bindings){const d=resolve(b.id).descriptor,bytes=readFileSync(new URL(`../retrieval-0.2/${b.group}.schema.json`,import.meta.url)),s=JSON.parse(bytes);for(const [field,def]of[['inputSchema',b.input],['outputSchema',b.output]])assert.deepEqual(d[field],{id:`${s.$id}#/$defs/${def}`,sha256:createHash('sha256').update(bytes).digest('hex')});assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);}
});
for(const id of ids){
 test(`${id}: actual canonical normalizer/output callbacks preserve detached request and digest`,()=>{
  const raw=request(id),ctx=context(id),selected=resolve(id).normalizeInput(raw,ctx),saved=copy(selected);assert.deepEqual(selected.request,raw);assert.equal(selected.argumentsSha256,canonicalSha256(selected.input));raw.injected=true;if(ctx.effectiveScope)ctx.effectiveScope.jurisdiction='OTHER';assert.deepEqual(selected,saved);for(const x of [selected,selected.request,selected.input,selected.metadata])if(x&&typeof x==='object')assert.ok(Object.isFrozen(x));
  const p=output(id),accepted=check(id,p);assert.deepEqual(accepted,p);assert.notEqual(accepted,p);p.injected=true;assert.equal(accepted.injected,undefined);if(id===FLORIDA){p.result.scope.jurisdiction='OTHER';assert.equal(accepted.result.scope.jurisdiction,'FL');}
 });
 test(`${id}: allowlisted contexts and original request survive callback stripping`,()=>{
  const keys=id===SAM?['asOf','sourceStatusAsOf','sourceHealthAsOf','evidenceAccuracyMode']:id===FLORIDA?['asOf','effectiveScope','clientResolution']:[];assert.deepEqual(resolve(id).binding.contextKeys,keys);check(id);assert.throws(()=>resolve(id).assertOutput(output(id),context(id)));
  for(const key of ['actorId','sourceEnabled','currentAccess','nowMs','previousPage']){assert.throws(()=>resolve(id).normalizeInput(request(id),{...context(id),[key]:true}));assert.throws(()=>check(id,output(id),request(id),{...context(id),[key]:true}));}
  for(const key of keys){const c=context(id);delete c[key];assert.throws(()=>resolve(id).normalizeInput(request(id),c));assert.throws(()=>check(id,output(id),request(id),c));assert.throws(()=>resolve(id).normalizeInput({...request(id),[key]:context(id)[key]},context(id)));}
 });
 test(`${id}: family substitution and hostile JSON refuse before effects`,()=>{
  for(const other of ids.filter(x=>x!==id))assert.throws(()=>check(id,output(other)));assert.throws(()=>check(id,{...output(id),sourceQualified:true}));assert.throws(()=>resolve(id).normalizeInput({...request(id),authorized:true},context(id)));
  let calls=0;const getter={};Object.defineProperty(getter,'query',{enumerable:true,get(){calls++;return'x';}});const proxy=new Proxy({},{ownKeys(){calls++;return[];},getPrototypeOf(){calls++;return Object.prototype;},get(){calls++;return null;}});const hidden={};Object.defineProperty(hidden,'query',{value:'x'});const cycle={};cycle.self=cycle;
  for(const value of [getter,proxy,hidden,cycle,{[Symbol('x')]:true},{toJSON(){calls++;return{};}},[,],{n:NaN}]){assert.throws(()=>resolve(id).normalizeInput(value,context(id)));assert.throws(()=>resolve(id).normalizeInput(request(id),value));assert.throws(()=>check(id,value));}assert.equal(calls,0);
 });
 test(`${id}: mapping, handler, retry, and schema mutation are rejected`,()=>{
  for(const edit of [(c,d)=>d.inputSchema.sha256='0'.repeat(64),(c,d)=>d.outputSchema.id='urn:meri:unreviewed#/$defs/Unknown',(c,d)=>d.handler={module:'unreviewed',export:'run',sourceSha256:'0'.repeat(64)},(c,d)=>d.availability='enabled',(c,d)=>d.retry.maxRetries=1,c=>c.originals.find(x=>x.id===id).replacement=null]){const bad=copy(catalog);edit(bad,bad.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(bad));}
 });
}
test('production gateway denies every descriptor before authority/budget and rejects activation',async()=>{
 const f=fixture(),options={authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('8')},g=createSourceDisabledGateway(options);assert.equal(g.sourceEnabled,false);assert.deepEqual(await g.discover(),[]);for(const row of catalog.operations)await assert.rejects(g.execute(JSON.stringify({operation:row.operation,arguments:ids.includes(row.operation.id)?request(row.operation.id):{}}),'synthetic'),/UNAVAILABLE/);assert.deepEqual(f.calls,[]);assert.throws(()=>createSourceDisabledGateway({...options,sourceEnabled:true}));assert.deepEqual(f.calls,[]);
});
test('web search callback retains limit/UTF16 and discovered evidence only',()=>{
 const n=resolve(SEARCH).normalizeInput({query:'😀'.repeat(121),limit:'2.9'});assert.equal(n.input.query.length,240);assert.equal(n.input.limit,2);const row={title:'Synthetic title',url:'https://example.test/',snippet:null,source:'duckduckgo'};const p={...output(SEARCH),total:2,results:[row,{...row,title:'Other'}]};assert.throws(()=>check(SEARCH,p,{query:'x',limit:1}));check(SEARCH,p,{query:'x',limit:2});assert.throws(()=>check(SEARCH,{...p,contentStatus:'read'},{query:'x',limit:2}));assert.throws(()=>resolve(SEARCH).normalizeInput({query:'   '}));
});
test('web page callback preserves redirects and coverage but no network/hash proof',()=>{
 check(PAGE);const p=output(PAGE);p.coverage.locator.characterEnd++;assert.throws(()=>check(PAGE,p));assert.throws(()=>resolve(PAGE).normalizeInput({url:'https://user:password@example.test/'}));assert.throws(()=>resolve(PAGE).normalizeInput({url:'file:///tmp/private'}));assert.equal(resolve(PAGE).normalizeInput({url:'http://127.0.0.1/'}).input.url,'http://127.0.0.1/');
 // Syntax admission alone never reaches an effect: the production gateway above is disabled.
});
test('web truncation callback is connected to original requested window',()=>{
 const p=output(PAGE);p.text='x'.repeat(497)+'...';p.totalChars=null;p.truncated=true;p.coverage={locator:{url:p.url,characterStart:0,characterEnd:500},complete:false,truncated:true};check(PAGE,p,{url:'https://example.test/',maxChars:500});assert.throws(()=>check(PAGE,p,{url:'https://example.test/',maxChars:501}));p.text='x'.repeat(500);assert.throws(()=>check(PAGE,p,{url:'https://example.test/',maxChars:500}));
});
test('SAM independent status and health clocks are consumed by real callbacks',()=>{
 const c=context(SAM),p=output(SAM);p.sourceFreshness=[{source:'sam_gov',state:'current',recordCount:0,activeRecordCount:0,lastSyncedAt:'2026-10-11T12:00:00.000Z',countsUnavailable:false,neverSynced:false,lastRunStatus:'current',lastRunDegraded:false,hoursSinceLastSuccess:24}];p.sourceStatus='healthy';p.sourceReason=null;p.notes=schema('sam-opportunities').$defs.SamOpportunitiesOutput.properties.notes.enum[0];check(SAM,p,{},c);assert.throws(()=>check(SAM,p,{}, {...c,sourceStatusAsOf:'2026-10-14T12:00:00.000Z'}));assert.throws(()=>check(SAM,p,{}, {...c,sourceHealthAsOf:'2026-10-12T13:00:00.000Z'}));assert.throws(()=>check(SAM,p,{}, {...c,asOf:'2026-10-12T12:00:01.000Z'}));
});
test('SAM count races, active selector and trusted mode are distinct from completeness',()=>{
 const p=output(SAM);p.results=[samRow()];p.total=0;check(SAM,p);assert.throws(()=>check(SAM,p,{}, {...context(SAM),evidenceAccuracyMode:'enforce'}));check(SAM,output(SAM),{}, {...context(SAM),evidenceAccuracyMode:'enforce'});p.results[0].active=false;assert.throws(()=>check(SAM,p));check(SAM,p,{includeInactive:true});p.results[0].active=true;assert.throws(()=>check(SAM,p,{naics:'99'}));check(SAM,p,{naics:'541'});assert.equal(resolve(SAM).normalizeInput({query:'😀'.repeat(130)},context(SAM)).input.query.length,240);
});
test('Florida normalized Input pin retains raw defaults and named client resolution',()=>{
 const contract=resolve(FLORIDA);assert.equal(contract.binding.input,'FloridaBudgetInput');const n=contract.normalizeInput({},context(FLORIDA));assert.equal(n.input.fiscalYear,'2026-27');assert.equal(n.input.offset,0);assert.deepEqual(n.request,{});const c=context(FLORIDA);c.effectiveScope.clientId=U;c.clientResolution={selector:'Named client',clientId:U};assert.equal(contract.normalizeInput({clientId:' Named client '},c).input.clientId,U);const p=output(FLORIDA);p.result.scope=c.effectiveScope;check(FLORIDA,p,{clientId:'Named client'},c);assert.throws(()=>contract.normalizeInput({clientId:V},{...c,clientResolution:{selector:V,clientId:U}}));assert.equal(n.metadata.authorizationEstablished,false);
});
test('Florida nested output callback binds all scope facts and request continuation',()=>{
 const p=output(FLORIDA);for(const field of ['jurisdiction','sessionKey','folderId','clientId']){const bad=copy(p);bad.result.scope[field]='other';assert.throws(()=>check(FLORIDA,bad));}assert.throws(()=>check(FLORIDA,{...p,generatedAt:'2026-10-12T12:00:01.000Z'}));const bad=copy(p);bad.result.nextOffset=100;assert.throws(()=>check(FLORIDA,bad));assert.throws(()=>check(FLORIDA,p,{fiscalYear:'2027-28'}));
});
test('Florida folder derived client cannot override explicit selector',()=>{
 const c=context(FLORIDA);c.effectiveScope.folderId='f';c.effectiveScope.clientId=U;const p=output(FLORIDA);p.result.scope=c.effectiveScope;check(FLORIDA,p,{folderId:'f'},c);assert.throws(()=>resolve(FLORIDA).normalizeInput({folderId:'f',clientId:'Other'},{...c,clientResolution:{selector:'Other',clientId:V}}));assert.throws(()=>resolve(FLORIDA).normalizeInput({}, {...c,effectiveScope:{...c.effectiveScope,folderId:null}}));
});

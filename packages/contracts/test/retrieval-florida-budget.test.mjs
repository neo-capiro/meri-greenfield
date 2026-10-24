import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createFloridaBudgetValidators} from '../retrieval-0.2/florida-budget-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';

const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/florida-budget.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createFloridaBudgetValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw Error(`${name}: ${ajv.errorsText(check?.errors)}`);return value;}});
const id='get_florida_budget_project', at='2026-10-12T12:00:00.000Z';
const cid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', other='11111111-2222-3333-4444-555555555555';
const clone=structuredClone;
const context=()=>({asOf:at});
const scope=(overrides={})=>({jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null,...overrides});
const amount=(n='a')=>({id:`amount-${n}`,observation:{minorUnits:'-900719925474099312',measure:'positions',qualified:false}});
const recent=(projectId,n='a')=>({project_id:projectId,...amount(n)});
const project=(n='p')=>({id:`project-${n}`,fiscal_year:'2026-27',title:'Synthetic publisher item',agency:null,identities:[],relations:{unresolved:true},evidence:null,saved:false,tracking_version:null,recentAmounts:[]});
const document=(n='d')=>({id:`document-${n}`,publisher:'Synthetic publisher',source_url:'stored arbitrary locator',content_hash:'stored-text-hash',title:'Source',fiscal_year:'2026-27',session_key:'',chamber:'source-defined chamber',stage:'source-defined stage',role:'source-defined role',offer:null,publication_date:'unknown source date',observed_at:at,complete:false,metadata:[null,{basis:'source wording'}]});
const event=(n='e')=>({id:`event-${n}`,project_id:null,document_id:'not-in-returned-document-window',kind:'veto_outcome',payload:false,observed_at:at,title:'Source',source_url:'not-a-URL',stage:'source stage',fiscal_year:'2026-27'});
const output=(selected={})=>({tool:id,generatedAt:at,result:{scope:scope(selected),fiscalYear:'2026-27',projects:[],nextOffset:null,documents:[],amounts:[],events:[],notice:schema.$defs.FloridaBudgetNotice.const},authority:schema.$defs.FloridaBudgetAuthority.const});
const check=(value,request={},ctx=context())=>v.assertResult(id,value,request,ctx);

test('single private operation and schema definitions are exact',()=>{
 assert.equal(v.schemaId,'urn:meri:retrieval:florida-budget:0.2.0');assert.deepEqual(v.operationIds,[id]);
 assert.equal(v.inputDefinition(id),'FloridaBudgetInput');assert.equal(v.outputDefinition(id),'FloridaBudgetOutput');
 for(const bad of ['search_legiwatch_news','__proto__','constructor',null])assert.throws(()=>v.normalizeInput(bad,{},context()));
});
test('defaults retain frozen fiscal year and untrimmed fiscal/query selection',()=>{
 const n=v.normalizeInput(id,{},context());assert.deepEqual(n.input,{q:'',fiscalYear:'2026-27',projectId:'',offset:0,sessionKey:'',folderId:null,clientId:null});
 assert.equal(n.metadata.authorizationEstablished,false);assert.equal(n.metadata.sourceConnected,false);
 assert.equal(v.normalizeInput(id,{q:'  x  ',fiscalYear:'2026-99'},context()).input.q,'  x  ');
 assert.throws(()=>v.normalizeInput(id,{fiscalYear:' 2026-27'},context()));
});
test('normalization uses UTF16 caps and preserves session/project text',()=>{
 const request={q:'😀'.repeat(101),sessionKey:'long session'.repeat(50),projectId:'project-💰',folderId:'  '};
 const n=v.normalizeInput(id,request,context({sessionKey:request.sessionKey,folderId:'  '}));
 assert.equal(n.input.q.length,200);assert.equal(n.input.sessionKey,request.sessionKey);assert.equal(n.input.projectId,request.projectId);
 assert.throws(()=>v.normalizeInput(id,{folderId:'😀'.repeat(51)},context()));
});
test('offset preserves number/string fallback and nonnegative clamp',()=>{
 for(const [raw,want] of [[null,0],['',0],['nonsense',0],[-2,0],['-0.4',0],['3',3],[10000,10000]])assert.equal(v.normalizeInput(id,{offset:raw},context()).input.offset,want);
 for(const raw of [1.5,'1.5',10001,'Infinity',true,[],{}])assert.throws(()=>v.normalizeInput(id,{offset:raw},context()));
});
test('typed narrowing rejects object/array/boolean selectors without coercion',()=>{
 for(const field of ['q','fiscalYear','projectId','sessionKey','folderId','clientId'])for(const bad of [true,3,[],{}])assert.throws(()=>v.normalizeInput(id,{[field]:bad},context()));
 for(const field of ['q','projectId','sessionKey','folderId','clientId'])assert.doesNotThrow(()=>v.normalizeInput(id,{[field]:null},context()));
});
test('context is mandatory, closed and never model supplied',()=>{
 assert.throws(()=>v.normalizeInput(id,{}));assert.throws(()=>v.normalizeInput(id,{},{}));
 assert.throws(()=>v.normalizeInput(id,{asOf:at},context()));
 for(const key of ['actorId','tenantId','nowMs','role'])assert.throws(()=>v.normalizeInput(id,{}, {...context(),[key]:'forged'}));
});
test('canonical UUID selectors stay exact and names reach the actual Core resolver',()=>{
 const c=context();assert.equal(v.normalizeInput(id,{clientId:cid.toUpperCase()},c).input.clientId,cid);check(output({clientId:cid}),{clientId:cid.toUpperCase()},c);
 assert.equal(v.normalizeInput(id,{clientId:'  Synthetic client  '},c).input.clientId,'Synthetic client');check(output({clientId:cid}),{clientId:'Synthetic client'},c);
 assert.throws(()=>check(output({clientId:other}),{clientId:cid},c));assert.throws(()=>check(output(),{clientId:'Synthetic client'},c));
});
test('client selector truncates80 after trim and empty selectors cannot imply a client',()=>{
 const label='x'.repeat(85);assert.equal(v.normalizeInput(id,{clientId:label},context()).input.clientId,label.slice(0,80));
 for(const clientId of [undefined,null,'','  ']){const req=clientId===undefined?{}:{clientId};assert.equal(v.normalizeInput(id,req,context()).input.clientId,null);assert.throws(()=>check(output({clientId:cid}),req));}
});
test('folder-derived client is distinct from an explicit UUID selector',()=>{
 const c=context(),page=output({folderId:'folder',clientId:cid});assert.equal(v.normalizeInput(id,{folderId:'folder'},c).input.clientId,null);check(page,{folderId:'folder'},c);
 for(const clientId of [null,'','  '])check(page,{folderId:'folder',clientId},c);
 check(page,{folderId:'folder',clientId:'Client'},c);assert.throws(()=>check(page,{folderId:'folder',clientId:other},c));assert.throws(()=>check(output({clientId:cid}),{},c));
});
test('scope substitutions reject session, folder, explicit client and jurisdiction changes',()=>{
 const selected={folderId:'folder',clientId:cid,sessionKey:'2026'},req={...selected};
 for(const [key,bad] of [['folderId','else'],['clientId',other],['sessionKey','2027'],['jurisdiction','GA']]){const p=output(selected);p.result.scope[key]=bad;assert.throws(()=>check(p,req));}
});
test('empty response is selected data with no completeness or absence inference',()=>{
 const p=output();assert.deepEqual(check(p),p);assert.notStrictEqual(check(p),p);assert.equal(v.classifyResult(id,p).absenceEvidence,false);
 for(const key of ['complete','total','hasMore','awardedAmount']){const q=output();q.result[key]=0;assert.throws(()=>check(q));}
});
test('full projected arrays preserve opaque JSON and nullable fields',()=>{
 const p=output();const row=project();row.recentAmounts=[recent(row.id)];p.result.projects=[row];p.result.documents=[document()];p.result.events=[event()];
 check(p);assert.equal(p.result.projects[0].evidence,null);assert.equal(p.result.events[0].payload,false);
 for(const opaque of [null,false,3,'source wording',[],{a:[null,{value:7}]}]){const q=clone(p);q.result.projects[0].recentAmounts[0].observation=opaque;check(q);}
});
test('all five producer row caps are independent and retained at exact boundary',()=>{
 const p=output();p.result.projects=Array.from({length:100},(_,i)=>project(i));p.result.documents=Array.from({length:101},(_,i)=>document(i));p.result.events=Array.from({length:101},(_,i)=>event(i));
 for(const row of p.result.projects)row.recentAmounts=Array.from({length:4},(_,i)=>recent(row.id,`${row.id}-${i}`));
 p.result.nextOffset=100;check(p);p.result.nextOffset=null;check(p);
 for(const [key,extra] of [['projects',project('extra')],['documents',document('extra')],['events',event('extra')]]){const q=clone(p);q.result[key].push(extra);assert.throws(()=>check(q));}
 const q=clone(p);q.result.projects[0].recentAmounts.push(recent(q.result.projects[0].id,'extra'));assert.throws(()=>check(q));
 const history=output();history.result.amounts=Array.from({length:501},(_,i)=>amount(i));check(history,{projectId:'selected'});history.result.amounts.push(amount('extra'));assert.throws(()=>check(history,{projectId:'selected'}));
});
test('project nextOffset describes extra-row lookup, not other array truncation',()=>{
 const p=output();p.result.documents=Array.from({length:101},(_,i)=>document(i));check(p);
 p.result.nextOffset=100;assert.throws(()=>check(p));p.result.projects=Array.from({length:100},(_,i)=>project(i));check(p);
 p.result.nextOffset=101;assert.throws(()=>check(p));p.result.nextOffset=10100;check(p,{offset:10000});
});
test('exact project selector bounds project identity and offset without restricting documents',()=>{
 const p=output(),row=project();p.result.projects=[row];p.result.documents=[document()];check(p,{projectId:row.id});
 assert.throws(()=>check(p,{projectId:'other'}));assert.throws(()=>check(p,{projectId:row.id,offset:1}));
 p.result.projects=[];p.result.amounts=[amount()];p.result.events=[{...event(),project_id:row.id}];check(p,{projectId:row.id,offset:1});
 p.result.events[0].project_id=null;assert.throws(()=>check(p,{projectId:row.id,offset:1}));
});
test('history requires explicit project while recent observations require their displayed project',()=>{
 const p=output();p.result.amounts=[amount()];assert.throws(()=>check(p));check(p,{projectId:'selected'});
 const q=output(),row=project();row.recentAmounts=[recent('wrong')];q.result.projects=[row];assert.throws(()=>check(q));
});
test('duplicate primary identities reject within each independent query',()=>{
 for(const [key,row,request] of [['projects',project(),{}],['documents',document(),{}],['events',event(),{}],['amounts',amount(),{projectId:'selected'}]]){
  const p=output();p.result[key]=[row,clone(row)];assert.throws(()=>check(p,request));
 }
 const p=output(),a=project('a'),b=project('b');a.recentAmounts=[recent(a.id,'same')];b.recentAmounts=[recent(b.id,'same')];p.result.projects=[a,b];assert.throws(()=>check(p));
});
test('full and recent amount windows may share identity without forced observation equality',()=>{
 const p=output(),row=project();row.recentAmounts=[recent(row.id,'same')];p.result.projects=[row];p.result.amounts=[{...amount('same'),observation:'independent read'}];check(p,{projectId:row.id});
});
test('saved/version joins preserve absence, removed rows and signed versions',()=>{
 const p=output(),row=project();p.result.projects=[row];check(p);
 row.tracking_version=0;assert.throws(()=>check(p));
 const c=context();p.result.scope=scope({folderId:'folder'});check(p,{folderId:'folder'},c);row.tracking_version=-1;check(p,{folderId:'folder'},c);row.saved=true;check(p,{folderId:'folder'},c);
 row.tracking_version=null;assert.throws(()=>check(p,{folderId:'folder'},c));
});
test('fiscal/session result correlations do not invent consecutive fiscal years',()=>{
 const p=output();p.result.fiscalYear='2026-00';const row=project();row.fiscal_year='2026-00';p.result.projects=[row];check(p,{fiscalYear:'2026-00'});
 assert.throws(()=>check(p));p.result.documents=[document()];assert.throws(()=>check(p,{fiscalYear:'2026-00'}));
 const c=context(),q=output({sessionKey:'Session X'});q.result.documents=[document()];assert.throws(()=>check(q,{sessionKey:'Session X'},c));q.result.documents[0].session_key='Session X';check(q,{sessionKey:'Session X'},c);
});
test('observed timestamps are finite canonical and descend without collation claims',()=>{
 const p=output();p.result.documents=[document('z'),document('a')];p.result.events=[event('z'),event('a')];check(p);
 p.result.documents[1].observed_at='2026-10-13T12:00:00.000Z';assert.throws(()=>check(p));
 for(const bad of ['2026-06-30T23:59:60Z','2026-10-12T12:00:00Z','not a date']){const q=output();q.result.events=[{...event(),observed_at:bad}];assert.throws(()=>check(q));}
});
test('clock binds generatedAt only and does not reject future stored observations',()=>{
 const p=output();p.result.documents=[{...document(),observed_at:'2027-01-01T00:00:00.000Z'}];check(p);
 p.generatedAt='2026-10-12T12:00:01.000Z';assert.throws(()=>check(p));
 const c=context();c.asOf='2026-06-30T23:59:60Z';assert.throws(()=>v.normalizeInput(id,{},c));
});
test('closed raw projections refuse private source bytes and invented money guarantees',()=>{
 for(const [key,row,extra] of [['documents',document(),'sections'],['projects',project(),'totalAmount'],['events',event(),'receipt_id']]){const p=output();row[extra]='unexpected';p.result[key]=[row];assert.throws(()=>check(p));}
 const p=output();p.result.projects=[{...project(),id:'not-a-UUID'}];p.result.documents=[{...document(),content_hash:'not-hex',publication_date:'unparsed source wording'}];check(p);
});
test('authority and notice are fixed compatibility caveats, never grants',()=>{
 for(const change of [p=>p.authority='approved',p=>p.result.notice='All projects awarded',p=>p.tool='search_legiwatch_news']){const p=output();change(p);assert.throws(()=>check(p));}
});
test('inert admission rejects getters, proxies, sparse arrays and cycles without effects',()=>{
 let calls=0;const request={};Object.defineProperty(request,'q',{enumerable:true,get(){calls++;return'x';}});assert.throws(()=>v.normalizeInput(id,request,context()));assert.equal(calls,0);
 const proxy=new Proxy({}, {get(){calls++;return null;}});assert.throws(()=>v.normalizeInput(id,proxy,context()));assert.equal(calls,0);
 for(const bad of [()=>{const a=[];a.length=2;return a;},()=>{const a={};a.self=a;return a;}]){const p=output();p.result.projects=[{...project(),evidence:bad()}];assert.throws(()=>check(p));}
 const c=context();Object.defineProperty(c,'asOf',{enumerable:true,get(){calls++;return cid;}});assert.throws(()=>v.normalizeInput(id,{},c));assert.equal(calls,0);
});
test('no ambient clock and direct normalization snapshots the observation timestamp',()=>{
 const original=Date.now;Date.now=()=>{throw Error('ambient clock forbidden');};try{const c=context(),request={q:'x'},n=v.normalizeInput(id,request,c);request.q='changed';c.asOf='changed';assert.equal(n.input.q,'x');assert.equal(n.metadata.asOf,at);assert(Object.isFrozen(n.input));assert(Object.isFrozen(n.metadata));check(output());}finally{Date.now=original;}
});
test('actual canonical resolver preserves request, hashes effective selection and filters context',()=>{
 const binding={id,version:'0.2.0',contextKeys:['asOf'],normalize:(validators,request,ctx)=>validators.normalizeInput(id,request,ctx),outputAssert:(validators,page,request,ctx,binding)=>validators.assertResult(id,page,request,Object.fromEntries(binding.contextKeys.map(key=>[key,ctx[key]])))};
 const resolver=createOperationContracts({catalog:{operations:[{operation:{id,version:'0.2.0'}}]},bindings:[binding],validators:v,assertCatalog(){},canonicalSha256:value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')});
 const operation=resolver.resolveOperationContract({id,version:'0.2.0'}),request={clientId:'Synthetic'},c=context(),n=operation.normalizeInput(request,c);request.clientId='mutated';assert.equal(n.request.clientId,'Synthetic');assert.equal(n.input.clientId,'Synthetic');assert.match(n.argumentsSha256,/^[a-f0-9]{64}$/);assert(Object.isFrozen(n.request));
 assert.doesNotThrow(()=>operation.assertOutput(output({clientId:cid}),{...c,request:n.request}));assert.throws(()=>operation.assertOutput(output({clientId:cid}),c));assert.throws(()=>operation.normalizeInput({}, {...context(),role:'admin'}));
});

test('truncated client reference remains a Core selector and never an authority receipt',()=>{
 const raw=`${cid}${' '.repeat(44)}x`,selector=raw.trim().slice(0,80);assert.equal(v.normalizeInput(id,{clientId:raw},context()).input.clientId,cid);assert.throws(()=>check(output({clientId:other}),{clientId:raw}));
 assert.throws(()=>v.normalizeInput(id,{clientId:raw},{...context(),clientResolution:{selector,clientId:other}}));
});

test('validated Florida output is detached from subsequent caller mutation',()=>{
 const original=output();original.result.projects=[project()];
 const accepted=check(original);assert.notStrictEqual(accepted,original);
 original.result.projects[0].title='Mutated after admission';original.result.scope.sessionKey='foreign';
 assert.equal(accepted.result.projects[0].title,'Synthetic publisher item');assert.equal(accepted.result.scope.sessionKey,'');
});


test('normalized catalog definition does not impose effective fields on raw requests',()=>{
 assert.equal(v.inputDefinition(id),'FloridaBudgetInput');assert(checks.get('FloridaBudgetRequest')({}));
 assert.equal(checks.get('FloridaBudgetInput')({}),false);
 const normalized=v.normalizeInput(id,{},context());assert(checks.get('FloridaBudgetInput')(normalized.input));
 assert.equal(normalized.input.fiscalYear,'2026-27');
});

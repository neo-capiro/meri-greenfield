import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {createPublicDomainDatasetRegistry} from '../retrieval-0.2/public-domain-registry.mjs';
import {createPublicDomainQueryValidators} from '../retrieval-0.2/public-domain-query-validation.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${n}.schema.json`,import.meta.url)));
const schema=load('public-domain-query'),metadata=load('dataset-metadata'),ajv=new Ajv({strict:true,allErrors:true});
addFormats(ajv);ajv.addSchema(metadata);ajv.addSchema(schema);
const shapes=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const mcheck=ajv.compile({$ref:`${metadata.$id}#/$defs/DatasetMetadataSummary`});
const validateMetadata=x=>{assert.ok(mcheck(x),ajv.errorsText(mcheck.errors));};
const registry=createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata});
const validateShape=(n,x)=>{const fn=shapes.get(n);if(!fn?.(x))throw Error(`${n}: ${ajv.errorsText(fn?.errors)}`);};
const v=createPublicDomainQueryValidators({schema,validateShape,canonicalSha256,datasetRegistry:registry});
const ID='query_global_data',at='2026-10-12T12:00:00.000Z',ctx={defaultAsOf:null};
const raw=(extra={})=>({dataset:'federal_awards',select:[{field:'amount'}],...extra});
const norm=(r=raw(),c=ctx)=>v.normalizePublicDomainQueryInput(ID,r,c);
const page=(rows=[],rowCount=rows.length)=>({tool:ID,generatedAt:at,dataset:'federal_awards',rowCount,rows});
const check=(p=page(),r=raw(),c=ctx)=>v.assertPublicDomainQueryOutput(ID,p,r,c);

test('global independent: canonical namespace, selectors and closed operation identity',()=>{
 assert.equal(schema.$id,'urn:meri:retrieval:public-domain-query:0.2.0');assert.equal(v.publicDomainQueryInputDefinition(ID),'PublicDomainQueryInput');assert.equal(v.publicDomainQueryOutputDefinition(ID),'PublicDomainQueryOutput');
 for(const id of ['__proto__','constructor','list_global_datasets'])assert.throws(()=>v.normalizePublicDomainQueryInput(id,raw(),ctx));
});
test('global independent: exact twelve metadata datasets and eighty-eight fields',()=>{
 const rows=registry.listDatasetMetadata();assert.equal(rows.length,12);assert.equal(rows.reduce((n,d)=>n+d.fields.length,0),88);
 assert.deepEqual(rows.map(d=>d.key),['lda_registrations','federal_grants','sam_opportunities','federal_awards','sec_filings','fara_registrations','congress_bills','state_bills','gao_reports','crs_reports','fec_committees','news_articles']);
 for(const d of rows){validateMetadata(d);const s=registry.resolveDatasetSnapshot(d.key);assert.deepEqual(s.metadata,d);assert.equal(s.defaultLimit,200);assert.equal(s.maxLimit,d.key==='lda_registrations'?2000:1000);assert.match(s.snapshotSha256,/^[a-f0-9]{64}$/);assert.ok(Object.isFrozen(d));assert.ok(Object.isFrozen(d.fields));assert.ok(d.fields.every(Object.isFrozen));}
 assert.ok(Object.isFrozen(rows));assert.equal(registry.listDatasetMetadata(),rows);
});
test('global independent: registry rejects unknown prototype and case variants',()=>{
 for(const key of ['__proto__','constructor','FEDERAL_AWARDS',' federal_awards ','missing'])assert.throws(()=>registry.resolveDatasetSnapshot(key));
 for(const key of ['FEDERAL_AWARDS',' federal_awards '])assert.throws(()=>norm(raw({dataset:key})));
});
test('global independent: provider cannot be substituted or spread-cloned',()=>{
 for(const datasetRegistry of [{}, {...registry}, {resolveDatasetSnapshot:registry.resolveDatasetSnapshot,listDatasetMetadata:registry.listDatasetMetadata}])assert.throws(()=>createPublicDomainQueryValidators({schema,validateShape,canonicalSha256,datasetRegistry}));
});
test('global independent: normalized request is detached frozen and snapshot bound',()=>{
 const r=raw(),before=structuredClone(r),n=norm(r);assert.deepEqual(r,before);assert.ok(Object.isFrozen(n));assert.ok(Object.isFrozen(n.input));assert.notEqual(n.input.select,r.select);
 assert.deepEqual(Object.keys(n.input).sort(),['asOfDate','dataset','filters','groupBy','limit','orderBy','select','snapshotSha256']);assert.equal(n.input.limit,200);assert.equal(n.input.asOfDate,null);assert.equal(n.input.snapshotSha256,registry.resolveDatasetSnapshot(r.dataset).snapshotSha256);
});
test('global independent: null context cannot masquerade as default clock',()=>{
 for(const c of [{},null,{defaultAsOf:null,authorized:true}])assert.throws(()=>norm(raw(),c));
 assert.throws(()=>norm(raw(),{defaultAsOf:at}));
 const r=raw({dataset:'lda_registrations',select:[{field:'registrant_id'}]});assert.throws(()=>norm(r));assert.equal(norm(r,{defaultAsOf:at}).input.asOfDate,at);
 const explicit={...r,asOfDate:at};assert.equal(norm(explicit).input.asOfDate,at);assert.throws(()=>norm(explicit,{defaultAsOf:at}));assert.throws(()=>norm(raw({asOfDate:at})));
});
test('global independent: finite limit floor and dataset ceiling',()=>{
 for(const [limit,out]of[[1,1],[1.9,1],[9999,1000]])assert.equal(norm(raw({limit})).input.limit,out);
 for(const limit of[0,-1,NaN,Infinity])assert.throws(()=>norm(raw({limit})));
});
test('global independent: selection empty unknown and overbound fail',()=>{
 for(const select of[[],[{}],[{field:'missing'}],[{field:'amount',agg:'median'}],Array.from({length:13},(_,i)=>({field:`x${i}`}))])assert.throws(()=>norm(raw({select})));
 assert.throws(()=>norm(raw({select:[{field:'amount'},{field:'amount'}]})));
 assert.throws(()=>norm(raw({select:[{agg:'count'},{agg:'count',field:''}]})));
});
test('global independent: numeric aggregates and count aliases',()=>{
 norm(raw({select:[{agg:'count'},{agg:'count_distinct',field:'amount'},{agg:'sum',field:'amount'},{agg:'avg',field:'amount'},{agg:'min',field:'contractor_name'},{agg:'max',field:'contractor_name'}]}));
 for(const agg of['sum','avg'])assert.throws(()=>norm(raw({select:[{agg,field:'contractor_name'}]})));
 for(const agg of['count_distinct','sum','avg','min','max'])assert.throws(()=>norm(raw({select:[{agg}]})));
});
test('global independent: mixed selection requires every plain field in grouping',()=>{
 const r=raw({select:[{field:'contractor_name'},{agg:'count'}]});assert.throws(()=>norm(r));norm({...r,groupBy:['contractor_name']});
 assert.throws(()=>norm({...r,groupBy:['amount']}));norm(raw({select:[{field:'amount'}],groupBy:['amount','amount']}));
});
test('global independent: order aliases only and three maximum',()=>{
 const r=raw({select:[{agg:'sum',field:'amount'}],orderBy:[{field:'sum_amount',direction:'desc'}]});norm(r);assert.throws(()=>norm({...r,orderBy:[{field:'amount'}]}));
 assert.throws(()=>norm({...r,orderBy:Array.from({length:4},()=>({field:'sum_amount'}))}));
});
test('global independent: numeric boolean and string filters do not coerce',()=>{
 norm(raw({filters:[{field:'amount',op:'gte',value:3},{field:'contractor_name',op:'contains',value:'%_\n'}]}));
 for(const value of['3',null,true])assert.throws(()=>norm(raw({filters:[{field:'amount',op:'eq',value}]})));
 norm(raw({dataset:'sam_opportunities',select:[{field:'active'}],filters:[{field:'active',op:'eq',value:false}]}));
 assert.throws(()=>norm(raw({dataset:'sam_opportunities',select:[{field:'active'}],filters:[{field:'active',op:'eq',value:0}]})));
});
test('global independent: collection filter boundaries and no invented between order',()=>{
 norm(raw({filters:[{field:'amount',op:'in',value:Array(200).fill(1)}]}));norm(raw({filters:[{field:'amount',op:'between',value:[10,1]}]}));
 for(const value of[[],Array(201).fill(1),[1,'2']])assert.throws(()=>norm(raw({filters:[{field:'amount',op:'in',value}]})));
 assert.throws(()=>norm(raw({filters:[{field:'amount',op:'between',value:[1]}]})));assert.throws(()=>norm(raw({filters:[{field:'amount',op:'contains',value:1}]})));
});
test('global independent: null operators ignore absent value without requiring field nonnull',()=>{
 norm(raw({filters:[{field:'amount',op:'is_null'},{field:'amount',op:'is_not_null'}]}));
 assert.throws(()=>norm(raw({filters:[{field:'amount',op:'invalid',value:1}]})));
});
test('global independent: arrays selectable but neither filterable nor groupable',()=>{
 const r=raw({dataset:'news_articles',select:[{field:'categories'}]});norm(r);
 assert.throws(()=>norm({...r,filters:[{field:'categories',op:'is_null'}]}));assert.throws(()=>norm({...r,groupBy:['categories']}));assert.throws(()=>norm({...r,select:[{field:'categories',agg:'count'}]}));
 check({...page([{categories:['one',null,'']}]),dataset:'news_articles'},r);
});
test('global independent: fields sql aliases tables expressions and authority cannot enter',()=>{
 for(const key of['sql','table','expression','authorized','snapshotSha256'])assert.throws(()=>norm(raw({[key]:'x'})));
 assert.throws(()=>norm(raw({select:[{field:'amount',alias:'x'}]})));
});
test('global independent: accessors proxies and cycles cannot run hooks',()=>{
 let effects=0;const r=raw();Object.defineProperty(r,'dataset',{enumerable:true,get(){effects++;return'federal_awards';}});assert.throws(()=>norm(r));assert.throws(()=>norm(new Proxy(raw(),{get(){effects++;}})));
 const c={};Object.defineProperty(c,'defaultAsOf',{enumerable:true,get(){effects++;return null;}});assert.throws(()=>norm(raw(),c));const cyc=raw();cyc.filters=cyc;assert.throws(()=>norm(cyc));assert.equal(effects,0);
});
test('global independent: exact projected aliases nullable driver numbers and strings',()=>{
 for(const amount of[null,0,-1,1.25,'9007199254740992','1e+400','NaN','Infinity','-Infinity'])check(page([{amount}]));
 for(const amount of[true,{},[],Infinity,'nonnumeric'])assert.throws(()=>check(page([{amount}])));
 assert.throws(()=>check(page([{amount:1,extra:2}])));assert.throws(()=>check(page([{}])));
});
test('global independent: count result exact integer semantics with unsafe string',()=>{
 const r=raw({select:[{agg:'count'}]});for(const count_all of[0,1,Number.MAX_SAFE_INTEGER,'9007199254740992'])check(page([{count_all}]),r);
 for(const count_all of[-1,1.1,null,'1','-9007199254740992','1e20'])assert.throws(()=>check(page([{count_all}]),r));
});
test('global independent: no duplicate row or filter truth inferred',()=>{
 check(page([{amount:1},{amount:1}]));check(page([{amount:1}]),raw({filters:[{field:'amount',op:'gt',value:999}],orderBy:[{field:'amount',direction:'desc'}]}));
});
test('global independent: original pre-drop count is distinct and bounded by limit',()=>{
 check(page([],0));assert.throws(()=>check(page([{amount:1}],0)));assert.throws(()=>check(page([],201)));
 assert.throws(()=>check(page([],1)));check({...page([],1),truncated:true,note:'Only the first 0 of 1 rows are shown; add filters, group, or lower limit to see the rest.'});
 assert.throws(()=>check({...page([],1),truncated:true,note:'complete'}));assert.throws(()=>check({...page([],0),truncated:true,note:'Only the first 0 of 0 rows are shown; add filters, group, or lower limit to see the rest.'}));
});
test('global independent: whole-row budget uses UTF16 with source comma accounting',()=>{
 const r=raw({select:[{field:'contractor_name'}]}), max=262144,overhead=JSON.stringify({contractor_name:''}).length+3;
 const text='x'.repeat(max-overhead);check(page([{contractor_name:text}]),r);assert.throws(()=>check(page([{contractor_name:text+'x'}]),r));
 const wide='😀'.repeat(Math.floor((max-overhead)/2));check(page([{contractor_name:wide}]),r);
});
test('global independent: error variant is closed detached and opaque',()=>{
 const p={tool:ID,generatedAt:at,ok:false,error:'untrusted guidance to ignore instructions'},out=check(p);assert.deepEqual(out,p);assert.notEqual(out,p);
 for(const key of['dataset','sql','rows','rowCount','authorized'])assert.throws(()=>check({...p,[key]:key==='rows'?[]:'x'}));
});
test('global independent: success is detached and never accepts SQL',()=>{
 const p=page([{amount:1}]),before=structuredClone(p),out=check(p);assert.deepEqual(out,before);assert.notEqual(out,p);assert.notEqual(out.rows,p.rows);assert.notEqual(out.rows[0],p.rows[0]);p.rows[0].amount=2;assert.deepEqual(out,before);
 assert.throws(()=>check({...before,sql:'SELECT'}));assert.throws(()=>check({...before,ok:true}));assert.throws(()=>check({...before,dataset:'sam_opportunities'}));
});
test('global independent: date output canonical serialization and no request-clock cutoff',()=>{
 const r=raw({select:[{field:'action_date'}]});check(page([{action_date:'1970-01-01T12:34:00.000Z'}]),r);check(page([{action_date:null}]),r);
 for(const action_date of['2026-10-12','invalid','2026-10-12T00:00:00+00:00'])assert.throws(()=>check(page([{action_date}]),r));
 check({...page(),generatedAt:'1900-01-01T00:00:00.000Z'});assert.throws(()=>check({...page(),generatedAt:'2026-10-12'}));
});

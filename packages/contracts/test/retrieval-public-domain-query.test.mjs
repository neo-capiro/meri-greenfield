import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {createPublicDomainDatasetRegistry} from '../retrieval-0.2/public-domain-registry.mjs';
import {createPublicDomainQueryValidators,PUBLIC_DOMAIN_QUERY_OPERATION_IDS} from '../retrieval-0.2/public-domain-query-validation.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${name}`,import.meta.url)));
const schema=read('public-domain-query.schema.json'),metadata=read('dataset-metadata.schema.json'),data=read('public-domain-datasets.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);ajv.addSchema(metadata);
const validate=(s,name,value)=>{const check=ajv.getSchema(`${s.$id}#/$defs/${name}`)??ajv.compile({$ref:`${s.$id}#/$defs/${name}`});if(!check(value))throw Error(ajv.errorsText(check.errors));return value;};
for(const name of Object.keys(schema.$defs))ajv.compile({$ref:`${schema.$id}#/$defs/${name}`});
const registry=createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata:(name,value)=>validate(metadata,name,value)});
const v=createPublicDomainQueryValidators({schema,canonicalSha256,datasetRegistry:registry,validateShape:(name,value)=>validate(schema,name,value)});
const operation='query_global_data',at='2026-10-12T12:00:00.000Z',context={defaultAsOf:null};
const request=(changes={})=>({dataset:'federal_grants',select:[{field:'agency'}],...changes});
const normalize=(raw=request(),ctx=context)=>v.normalizePublicDomainQueryInput(operation,raw,ctx);
const output=(rows=[{agency:'Agency'}],extra={})=>({tool:operation,generatedAt:at,dataset:'federal_grants',rowCount:rows.length,rows,...extra});
const check=(page,raw=request(),ctx=context)=>v.assertPublicDomainQueryOutput(operation,page,raw,ctx);

test('one immutable provider supplies all12 datasets and88 fields without physical expressions',()=>{
 assert.equal(registry.listDatasetMetadata().length,12);assert.equal(registry.listDatasetMetadata().reduce((n,d)=>n+d.fields.length,0),88);
 assert.equal(registry.projectionSha256,canonicalSha256(data));
 for(const entry of data.datasets){const d=registry.resolveDatasetSnapshot(entry.metadata.key);assert.deepEqual(d.metadata,entry.metadata);assert.equal(d.snapshotSha256,canonicalSha256(entry));assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.metadata.fields[0]));}
 const walk=value=>{if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){assert.ok(!['table','column','expression','sql','params'].includes(key));walk(item);}};walk(data);
});
test('unknown or decorative provider refuses instead of adopting arbitrary field maps',()=>{
 assert.throws(()=>createPublicDomainQueryValidators({schema,canonicalSha256,validateShape(){},datasetRegistry:{resolveDatasetSnapshot(){return{};}}}));
 for(const key of ['__proto__','constructor','tenant_clients',' federal_grants','federal_grants '])assert.throws(()=>registry.resolveDatasetSnapshot(key));
 assert.throws(()=>registry.resolveDatasetSnapshot({toString(){throw Error('must not run');}}));
});
test('exact family exports and normalization bind selected immutable snapshot',()=>{
 assert.deepEqual(PUBLIC_DOMAIN_QUERY_OPERATION_IDS,[operation]);assert.equal(v.publicDomainQueryInputDefinition(operation),'PublicDomainQueryInput');assert.equal(v.publicDomainQueryOutputDefinition(operation),'PublicDomainQueryOutput');
 const n=normalize();assert.deepEqual(n.input,{dataset:'federal_grants',select:[{field:'agency'}],filters:[],groupBy:[],orderBy:[],limit:200,asOfDate:null,snapshotSha256:registry.resolveDatasetSnapshot('federal_grants').snapshotSha256});
});
test('model SQL/table/alias/registry authority is refused at closed boundaries',()=>{
 for(const key of ['sql','table','where','expression','snapshotSha256','defaultAsOf','registry'])assert.throws(()=>normalize(request({[key]:'caller'})));
 assert.throws(()=>normalize(request({select:[{field:'agency',alias:'evil'}]})));
 for(const field of ['constructor','agency; DROP TABLE x','*','tenant_id'])assert.throws(()=>normalize(request({select:[{field}]})));
});
test('selectors reject coercion hooks, hidden fields, proxies and callbacks',()=>{
 let calls=0;const evil={[Symbol.toPrimitive](){calls++;return operation;}};
 assert.throws(()=>v.publicDomainQueryInputDefinition(evil));assert.throws(()=>v.validatePublicDomainQueryShape(evil,{}));
 assert.throws(()=>normalize({...request(),get limit(){calls++;return1;}}));
 assert.throws(()=>normalize(new Proxy(request(),{get(){calls++;return'x';}})));assert.equal(calls,0);
});
test('typed requests exclude legacy nonarray ignoring and broad Number coercion',()=>{
 for(const key of ['filters','select','groupBy','orderBy'])for(const value of [null,{},'x',true])assert.throws(()=>normalize(request({[key]:value})));
 for(const limit of [true,{},[],NaN,Infinity,undefined])assert.throws(()=>normalize(request({limit})));
});
test('positive finite row limit preserves floor/default and per-dataset maximum',()=>{
 assert.equal(normalize(request({limit:'5.9'})).input.limit,5);assert.equal(normalize(request({limit:99999})).input.limit,1000);
 for(const limit of [0,-1,.5,null,'','invalid'])assert.throws(()=>normalize(request({limit})));
 assert.equal(normalize({dataset:'lda_registrations',select:[{agg:'count'}],limit:99999},{defaultAsOf:at}).input.limit,2000);
});
test('all six aggregates preserve source type/group capabilities',()=>{
 for(const agg of ['count','count_distinct','sum','avg','min','max'])normalize(request({select:[{field:'award_ceiling',agg}]}));
 for(const agg of ['count','count_distinct','min','max'])normalize(request({select:[{field:'agency',agg}]}));
 for(const agg of ['sum','avg'])assert.throws(()=>normalize(request({select:[{field:'agency',agg}]})));
 assert.throws(()=>normalize(request({select:[{field:'agency',agg:'median'}]})));
 for(const agg of ['count','min'])assert.throws(()=>normalize({dataset:'news_articles',select:[{field:'topics',agg}]}));
});
test('bare count and alias collision rules remain exact',()=>{
 assert.deepEqual(normalize(request({select:[{agg:'count',field:''}]})).input.select,[{agg:'count'}]);
 for(const select of [[{}],[{agg:'sum'}],[{field:'agency'},{field:'agency'}],[{agg:'count'},{agg:'count'}],Array.from({length:13},()=>({agg:'count'}))])assert.throws(()=>normalize(request({select})));
});
test('grouped mixed projections retain ordinary fields and groupable flags',()=>{
 normalize(request({select:[{field:'agency'},{agg:'count'}],groupBy:['agency'],orderBy:[{field:'count_all',direction:'desc'}]}));
 assert.throws(()=>normalize(request({select:[{field:'agency'},{agg:'count'}]})));
 assert.throws(()=>normalize(request({groupBy:['status']})));
 assert.throws(()=>normalize({dataset:'news_articles',select:[{field:'topics'}],groupBy:['topics']}));
 normalize(request({groupBy:['agency','agency']})); // Duplicate GROUP BY expressions are not fabricated source errors.
 assert.throws(()=>normalize(request({groupBy:Array(7).fill('agency')})));
});
test('ordering is limited to selected aliases and preserves legacy desc-exact default',()=>{
 assert.deepEqual(normalize(request({orderBy:[{field:'agency',direction:'DESC'}]})).input.orderBy,[{field:'agency',direction:'asc'}]);
 assert.throws(()=>normalize(request({orderBy:[{field:'status'}]})));assert.throws(()=>normalize(request({orderBy:Array(4).fill({field:'agency'})})));
});
test('every closed filter operator is admitted with its actual value contract',()=>{
 for(const op of ['eq','ne','gte','lte','gt','lt','contains'])normalize(request({filters:[{field:'agency',op,value:'a'}]}));
 for(const op of ['in','not_in'])normalize(request({filters:[{field:'agency',op,value:['a','b']}]}));
 normalize(request({filters:[{field:'agency',op:'between',value:['a','z']}]}));
 for(const op of ['is_null','is_not_null'])assert.deepEqual(normalize(request({filters:[{field:'agency',op,value:{ignored:true}}]})).input.filters,[{field:'agency',op}]);
 assert.throws(()=>normalize(request({filters:[{field:'agency',op:'raw',value:'x'}]})));
});
test('numeric boolean and date filters remain type-correct without invented ordering',()=>{
 normalize(request({filters:[{field:'award_ceiling',op:'between',value:[10,1]}]}));
 assert.throws(()=>normalize(request({filters:[{field:'award_ceiling',op:'eq',value:'10'}]})));
 assert.throws(()=>normalize(request({filters:[{field:'award_ceiling',op:'contains',value:10}]})));
 assert.equal(normalize(request({filters:[{field:'open_date',op:'eq',value:'2026-01-01'}]})).input.filters[0].value,'2026-01-01T00:00:00.000Z');
 assert.throws(()=>normalize(request({filters:[{field:'open_date',op:'eq',value:'bad'}]})));
 normalize({dataset:'sam_opportunities',select:[{field:'active'}],filters:[{field:'active',op:'eq',value:false}]});
 assert.throws(()=>normalize({dataset:'sam_opportunities',select:[{field:'active'}],filters:[{field:'active',op:'eq',value:'false'}]}));
});
test('filter windows and nonfilterable arrays fail closed',()=>{
 for(const value of [[],Array(201).fill('a'),null,'a'])assert.throws(()=>normalize(request({filters:[{field:'agency',op:'in',value}]})));
 for(const value of [[],['a'],['a','b','c']])assert.throws(()=>normalize(request({filters:[{field:'agency',op:'between',value}]})));
 for(const op of ['is_null','eq'])assert.throws(()=>normalize({dataset:'news_articles',select:[{field:'topics'}],filters:[{field:'topics',op,value:'a'}]}));
});
test('trusted default as-of is distinct from explicit date and generatedAt',()=>{
 const r={dataset:'lda_registrations',select:[{agg:'count'}]};assert.equal(normalize(r,{defaultAsOf:at}).input.asOfDate,at);
 assert.throws(()=>normalize(r));assert.throws(()=>normalize(r,{defaultAsOf:'2026-10-12T12:00:00Z'}));
 assert.equal(normalize({...r,asOfDate:'January 1, 2020'}).input.asOfDate,'2020-01-01T00:00:00.000Z');
 assert.throws(()=>normalize({...r,asOfDate:'invalid'}));assert.throws(()=>normalize({...r,asOfDate:at},{defaultAsOf:at}));
 assert.throws(()=>normalize(request({asOfDate:at})));assert.throws(()=>normalize(request(),{defaultAsOf:at}));
});
test('all twelve dataset projections accept their complete field selection windows',()=>{
 for(const d of registry.listDatasetMetadata())for(const f of d.fields)normalize({dataset:d.key,select:[{field:f.name}]},{defaultAsOf:d.supportsAsOf?at:null});
});
test('success omits SQL and retains exact aliases, dataset and pretrim count',()=>{
 check(output());check(output([]));assert.throws(()=>check({...output(),sql:'SELECT agency'}));assert.throws(()=>check({...output(),dataset:'sam_opportunities'}));
 for(const rows of [[{}],[{agency:'A',extra:1}],[{other:'A'}]])assert.throws(()=>check(output(rows)));
 assert.throws(()=>check(output([{agency:'A'}],{rowCount:0})));assert.throws(()=>check(output([],{rowCount:201})));
});
test('counts retain exact unsafe integer strings and refuse fractional or null values',()=>{
 const req=request({select:[{agg:'count'}]});for(const value of [0,10,Number.MAX_SAFE_INTEGER,'9007199254740992'])check(output([{count_all:value}]),req);
 for(const value of [-1,1.5,null,'1','-1','NaN',9007199254740992])assert.throws(()=>check(output([{count_all:value}]),req));
});
test('numbers preserve decimal strings and nullable stored/aggregate results',()=>{
 const req=request({select:[{field:'award_ceiling'}]});for(const value of [null,1.5,-3,'9007199254740993','1e999','Infinity','NaN'])check(output([{award_ceiling:value}]),req);
 for(const value of [true,[],{},'arbitrary'])assert.throws(()=>check(output([{award_ceiling:value}]),req));
 check(output([{sum_award_ceiling:null}]),request({select:[{field:'award_ceiling',agg:'sum'}]}));
});
test('array scalars preserve null elements; dates and booleans retain source types',()=>{
 check(output([{topics:['one',null]}],{dataset:'news_articles'}),{dataset:'news_articles',select:[{field:'topics'}]});
 check(output([{active:false}],{dataset:'sam_opportunities'}),{dataset:'sam_opportunities',select:[{field:'active'}]});
 assert.throws(()=>check(output([{agency:1}])));assert.throws(()=>check(output([{open_date:'2026-01-01'}]),request({select:[{field:'open_date'}]})));
 check(output([{open_date:'2026-01-01T00:00:00.000Z'}]),request({select:[{field:'open_date'}]}));
});
test('truncation reports whole-row prefix and original fetched count, including zero retained',()=>{
 for(const rows of [[],[{agency:'A'}]])check(output(rows,{rowCount:2,truncated:true,note:`Only the first ${rows.length} of 2 rows are shown; add filters, group, or lower limit to see the rest.`}));
 assert.throws(()=>check(output([],{rowCount:2})));assert.throws(()=>check(output([],{truncated:true,note:'wrong'})));
});
test('legacy256Ki ceiling counts UTF16 not UTF8 and never silently drops half a row',()=>{
 const value='😀'.repeat(70000);check(output([{agency:value}])); // UTF8 exceeds256Ki; UTF16 does not.
 assert.throws(()=>check(output([{agency:'x'.repeat(256*1024)}])));
});
test('error envelope remains explicit and never doubles as empty success',()=>{
 for(const error of ['Unknown selected expression','The query could not be run (likely a timeout on an expensive query — try narrowing filters or lowering limit).'])check({tool:operation,generatedAt:at,ok:false,error});
 assert.throws(()=>check({...output([]),ok:false,error:'failed'}));assert.throws(()=>check({...output([]),ok:true}));
});
test('result observation is independent; validator never claims audit or role admission',()=>{
 check({...output(),generatedAt:'1900-01-01T00:00:00.000Z'});
 for(const key of ['sourceConnected','queryAuthorized','producerQualified','absenceEvidence','auditWriteQualified','sqlExposed'])assert.equal(normalize().metadata[key],false);
});
test('snapshots cannot mutate provider, requests, normalized tuples or returned siblings',()=>{
 const r=request({filters:[{field:'agency',op:'in',value:['A']}]});const saved=structuredClone(r),n=normalize(r);assert.deepEqual(r,saved);assert.ok(Object.isFrozen(n.input.filters[0].value));
 assert.throws(()=>registry.listDatasetMetadata()[0].fields.pop());assert.throws(()=>registry.resolveDatasetSnapshot('federal_grants').metadata.fields[0].name='other');
 const p=output(),out=check(p);out.rows[0].agency='changed';assert.equal(p.rows[0].agency,'Agency');
});

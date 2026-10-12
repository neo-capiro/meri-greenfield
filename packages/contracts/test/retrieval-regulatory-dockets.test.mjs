import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createRegulatoryDocketsValidators,REGULATORY_DOCKETS_OPERATION_IDS} from '../retrieval-0.2/regulatory-dockets-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
// Strict compilation is test-only until root owns canonical registration.
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/regulatory-dockets.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createRegulatoryDocketsValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw Error(`${name}: ${ajv.errorsText(check?.errors)}`);return value;}});
const id='query_regulatory_dockets',stamp='2026-10-12T12:00:00.000Z';
const row=(i=0)=>({id:`opaque row ${i}`,documentId:`document ${i}`,agencyId:'Agency',docketId:null,documentType:'Notice',title:' Raw\n title ',postedDate:stamp,commentStartDate:null,commentEndDate:null,frDocNum:null,subtype:null,withdrawn:false,lastModified:null,syncedAt:stamp});
const ordinary=(n=1)=>({tool:id,generatedAt:stamp,total:n,results:Array.from({length:n},(_,i)=>row(i))});
const upcoming=(total=1,limit=20,days=30)=>({...ordinary(Math.min(total,limit)),total,windowDays:days,results:Array.from({length:Math.min(total,limit)},(_,i)=>({...row(i),commentEndDate:stamp}))});
const normalize=input=>v.normalizeRegulatoryDocketsInput(id,input);
const check=(output,input={})=>v.assertRegulatoryDocketsOutput(id,output,input);

test('exact family definitions and operation identifiers refuse coercion',()=>{
 assert.deepEqual(REGULATORY_DOCKETS_OPERATION_IDS,[id]);assert.equal(v.regulatoryDocketsSchemaId,schema.$id);
 assert.equal(v.regulatoryDocketsInputDefinition(id),'RegulatoryDocketsQueryInput');assert.equal(v.regulatoryDocketsOutputDefinition(id),'RegulatoryDocketsQueryOutput');
 let hooks=0;for(const unknown of ['__proto__','query_global_data',{toString(){hooks++;return id;}}])assert.throws(()=>normalize.call(null,unknown));
 assert.throws(()=>v.normalizeRegulatoryDocketsInput({toString(){hooks++;return id;}},{}));assert.equal(hooks,0);
});
test('defaults and optional bool/null behavior preserve branch semantics',()=>{
 for(const upcomingOnly of [undefined,false,null]){const input=upcomingOnly===undefined?{}:{upcomingOnly};assert.deepEqual(normalize(input).input,{upcomingOnly:false,limit:20});}
 assert.deepEqual(normalize({upcomingOnly:true}).input,{upcomingOnly:true,limit:20,days:30});
 for(const upcomingOnly of ['true',1,{},[]])assert.throws(()=>normalize({upcomingOnly}));
});
test('strict integer limit and days admission intentionally excludes legacy clamps',()=>{
 for(const limit of [1,50])assert.equal(normalize({limit}).input.limit,limit);
 for(const days of [1,365])assert.equal(normalize({upcomingOnly:true,days}).input.days,days);
 for(const [key,max]of[['limit',50],['days',365]])for(const value of [null,0,max+1,-1,1.5,'20',false,undefined,NaN,Infinity])assert.throws(()=>normalize({[key]:value}));
});
test('optional selectors trim clip UTF16 and retain case without aliases',()=>{
 assert.deepEqual(normalize({agencyId:' \n ',documentType:null}).input,{upcomingOnly:false,limit:20});
 assert.equal(normalize({agencyId:' '+ 'a'.repeat(39)+'😀 '}).input.agencyId,'a'.repeat(39)+'\ud83d');
 assert.equal(normalize({documentType:' '+ 'd'.repeat(79)+'😀 '}).input.documentType,'d'.repeat(79)+'\ud83d');
 assert.equal(normalize({agencyId:' Agency '}).input.agencyId,'Agency');
 for(const key of ['agencyId','documentType'])for(const value of [true,4,[],{}])assert.throws(()=>normalize({[key]:value}));
 for(const key of ['page','pageSize','query','q','now','asOf','tenantId','actorRole','withdrawn'])assert.throws(()=>normalize({[key]:'caller'}));
});
test('branch-irrelevant supplied selectors remain hash-bound without becoming filters',()=>{
 const input={upcomingOnly:true,agencyId:' Other ',documentType:' Rule ',days:2};
 assert.deepEqual(normalize(input).input,{upcomingOnly:true,agencyId:'Other',documentType:'Rule',days:2,limit:20});
 check(upcoming(1,20,2),input);check(ordinary(),{days:365});assert.equal(normalize({days:365}).input.days,365);
});
test('metadata denies source authority and current clock qualification',()=>{
 for(const request of [{},{upcomingOnly:true}]){const n=normalize(request);for(const k of ['authoritative','sourceConnected','producerQualified','absenceEvidence','currentWindowQualified'])assert.equal(n.metadata[k],false);assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.input)&&Object.isFrozen(n.metadata));}
 assert.equal(normalize({}).metadata.countScope,'separate-local-count');assert.equal(normalize({upcomingOnly:true}).metadata.countScope,'bounded-service-window-before-limit');
});
test('request and output are not mutated',()=>{const input={agencyId:' Agency '},saved=structuredClone(input),out=ordinary(),before=structuredClone(out);normalize(input);assert.deepEqual(input,saved);assert.equal(check(out,input),out);assert.deepEqual(out,before);});
test('ordinary total is independent including empty or fewer-count observations',()=>{for(const total of [0,1,1000]){const out=ordinary(2);out.total=total;check(out);}const empty=ordinary(0);empty.total=9;check(empty);});
test('ordinary request filters bind exact projected fields and row limit',()=>{
 check(ordinary(),{agencyId:' Agency ',documentType:' Notice ',limit:1});
 for(const request of [{agencyId:'agency'},{documentType:'notice'},{limit:1}])assert.throws(()=>check(ordinary(2),request));
});
test('ordinary posted dates descend among nonnull values with null placement unqualified',()=>{
 const out=ordinary(4);out.results[0].postedDate=null;out.results[2].postedDate=null;out.results[3].postedDate='2026-10-01T00:00:00.000Z';check(out);
 out.results[3].postedDate='2026-10-13T00:00:00.000Z';assert.throws(()=>check(out));
});
test('all raw stored scalars are required and nullable fields remain explicit',()=>{
 const out=ordinary();for(const key of ['docketId','postedDate','commentStartDate','commentEndDate','frDocNum','subtype','lastModified'])out.results[0][key]=null;out.results[0].withdrawn=true;check(out);
 for(const key of Object.keys(row())){const missing=ordinary();delete missing.results[0][key];assert.throws(()=>check(missing));}
 for(const key of ['id','documentId','agencyId','documentType','title','syncedAt','withdrawn']){const missing=ordinary();missing.results[0][key]=null;assert.throws(()=>check(missing));}
});
test('no UUID format title clipping enum or stored date relationship is fabricated',()=>{
 const out=ordinary();Object.assign(out.results[0],{id:'',documentId:'',agencyId:'',docketId:'',documentType:'Future type',title:' Raw\n\t  text '.repeat(200),frDocNum:'',subtype:'',commentStartDate:'2027-01-01T00:00:00.000Z',commentEndDate:'2020-01-01T00:00:00.000Z'});check(out);
});
test('single-query row and document uniqueness both hold',()=>{
 for(const key of ['id','documentId']){const out=ordinary(2);out.results[1][key]=out.results[0][key];assert.throws(()=>check(out));}
});
test('upcoming total counts capped service window before wrapper slicing',()=>{
 for(const [total,limit]of[[0,1],[1,1],[4,1],[20,20],[50,1],[50,50]])check(upcoming(total,limit),{upcomingOnly:true,limit});
 for(const total of [51,100])assert.throws(()=>check(upcoming(total,1),{upcomingOnly:true,limit:1}));
 const fewer=upcoming(2);fewer.results.pop();assert.throws(()=>check(fewer,{upcomingOnly:true}));
 const more=upcoming(2,1);more.results.push({...row(4),commentEndDate:stamp});assert.throws(()=>check(more,{upcomingOnly:true,limit:1}));
});
test('upcoming window selectors and output branches cannot substitute',()=>{
 check(upcoming(1,20,365),{upcomingOnly:true,days:365});
 assert.throws(()=>check(upcoming(),{}));assert.throws(()=>check(ordinary(),{upcomingOnly:true}));
 assert.throws(()=>check(upcoming(),{upcomingOnly:true,days:1}));
 for(const windowDays of [0,366,1.5,'30',null]){const out=upcoming();out.windowDays=windowDays;assert.throws(()=>check(out,{upcomingOnly:true}));}
});
test('upcoming has nonnull ascending end dates and excludes withdrawn rows',()=>{
 for(const mutate of [x=>x.withdrawn=true,x=>x.commentEndDate=null]){const out=upcoming();mutate(out.results[0]);assert.throws(()=>check(out,{upcomingOnly:true}));}
 const out=upcoming(2);out.results[0].commentEndDate='2026-10-13T00:00:00.000Z';assert.throws(()=>check(out,{upcomingOnly:true}));
});
test('elapsed upcoming span admits inclusive boundary and refuses one millisecond excess',()=>{
 const out=upcoming(2,20,1);out.results[0].commentEndDate='2026-03-08T00:00:00.000Z';out.results[1].commentEndDate='2026-03-09T00:00:00.000Z';check(out,{upcomingOnly:true,days:1});
 out.results[1].commentEndDate='2026-03-09T00:00:00.001Z';assert.throws(()=>check(out,{upcomingOnly:true,days:1}));
});
test('generatedAt never acts as query clock cutoff freshness or comment eligibility',()=>{
 for(const generatedAt of ['2000-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z']){const out=upcoming();out.generatedAt=generatedAt;check(out,{upcomingOnly:true});}
 const out=upcoming();out.results[0].commentStartDate='2099-01-01T00:00:00.000Z';out.results[0].syncedAt='1900-01-01T00:00:00.000Z';check(out,{upcomingOnly:true});
});
test('canonical date policy is explicit for every nullable or required date',()=>{
 for(const key of ['generatedAt','postedDate','commentStartDate','commentEndDate','lastModified','syncedAt'])for(const value of ['2026-02-30T00:00:00.000Z','2026-10-12T12:00:00Z','2026-10-12T12:00:00.000+00:00','+010000-01-01T00:00:00.000Z','invalid']){const out=ordinary();(key==='generatedAt'?out:out.results[0])[key]=value;assert.throws(()=>check(out));}
});
test('unprojected coverage query fields and invalid counts refuse',()=>{
 for(const key of ['complete','page','current','queryClock','sourceConnected','note']){const out=ordinary();out[key]=false;assert.throws(()=>check(out));}
 for(const key of ['comments','rawPayload','clientId','sql']){const out=ordinary();out.results[0][key]='synthetic';assert.throws(()=>check(out));}
 for(const total of [-1,1.5,'1',Number.MAX_SAFE_INTEGER+1]){const out=ordinary();out.total=total;assert.throws(()=>check(out));}
});
test('hostile input and output are rejected without executing hooks',()=>{
 let hooks=0;const getter={};Object.defineProperty(getter,'agencyId',{enumerable:true,get(){hooks++;return'Agency';}});
 const proxy=new Proxy({},{ownKeys(){hooks++;return[];},get(){hooks++;}});
 for(const request of [getter,proxy,{toJSON(){hooks++;return{};}}])assert.throws(()=>normalize(request));
 const out=ordinary();Object.defineProperty(out.results[0],'title',{enumerable:true,get(){hooks++;return'fake';}});assert.throws(()=>check(out));assert.equal(hooks,0);
});
test('cycles sparse arrays nonfinite symbols and foreign prototypes refuse',()=>{
 const out=ordinary();out.results[0].title=out;assert.throws(()=>check(out));
 const sparse=ordinary();sparse.results=[,];assert.throws(()=>check(sparse));
 for(const input of [Object.create({agencyId:'Agency'}),{agencyId:Symbol('x')},{days:Infinity}])assert.throws(()=>normalize(input));
});
test('real canonical resolver binds requests digests empty context and unavailable descriptor',()=>{
 const bindings=[{id,version:'0.2.0',contextKeys:[],normalize:(_,request)=>normalize(request),outputAssert:(_,value,request)=>check(value,request)}];
 const catalog={operations:[{operation:{id,version:'0.2.0'},handler:null,status:'unavailable'}]};
 const resolver=createOperationContracts({catalog,bindings,validators:v,assertCatalog(){},canonicalSha256});
 const contract=resolver.resolveOperationContract({id,version:'0.2.0'}),original={upcomingOnly:true,agencyId:' Ignored '},n=contract.normalizeInput(original);
 assert.deepEqual(n.request,original);assert.ok(Object.isFrozen(n.request));assert.equal(n.argumentsSha256,canonicalSha256(n.input));
 contract.assertOutput(upcoming(),{request:n.request});
 const second=contract.normalizeInput({...original,agencyId:'Different'});assert.notEqual(n.argumentsSha256,second.argumentsSha256);
 for(const context of [{now:stamp},{queryClock:stamp},{actorRole:'admin'},{tenantId:'caller'}])assert.throws(()=>contract.normalizeInput(original,context));
 assert.throws(()=>contract.assertOutput(upcoming(),{}));
});

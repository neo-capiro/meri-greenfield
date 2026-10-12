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
const validateMetadata=(name,x)=>{assert.equal(name,'DatasetMetadataSummary');assert.ok(mcheck(x),ajv.errorsText(mcheck.errors));};
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
 for(const d of rows){validateMetadata('DatasetMetadataSummary',d);const s=registry.resolveDatasetSnapshot(d.key);assert.deepEqual(s.metadata,d);assert.equal(s.defaultLimit,200);assert.equal(s.maxLimit,d.key==='lda_registrations'?2000:1000);assert.match(s.snapshotSha256,/^[a-f0-9]{64}$/);assert.ok(Object.isFrozen(d));assert.ok(Object.isFrozen(d.fields));assert.ok(d.fields.every(Object.isFrozen));}
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

// Hearing controls written from immutable producer contracts before candidate inspection.
import {createHash} from 'node:crypto';
import {createPublicDomainHearingsValidators} from '../retrieval-0.2/public-domain-hearings-validation.mjs';
const hs=load('public-domain-hearings'),hr=load('public-domain-hearing-records'),hc=load('outreach-query');
const hajv=new Ajv({strict:true,allErrors:true});addFormats(hajv);for(const s of[hc,hr,hs])hajv.addSchema(s);
const hshapes=new Map(Object.keys(hs.$defs).map(n=>[n,hajv.compile({$ref:`${hs.$id}#/$defs/${n}`})]));
const hv=createPublicDomainHearingsValidators({schema:hs,validateShape:(n,x)=>{const f=hshapes.get(n);if(!f?.(x))throw Error(`${n}: ${hajv.errorsText(f?.errors)}`);}});
const HID='search_committee_hearings',TEN='10000000-0000-4000-8000-000000000001',CID='20000000-0000-4000-8000-000000000002',RID='30000000-0000-4000-8000-000000000003';
const hctx={tenantId:TEN,clientResolution:null},hn=(r={},c=hctx)=>hv.normalizePublicDomainHearingsInput(HID,r,c);
const hnote='One complete evidence chunk per page. Follow the hearings nextCursor for remaining official transcript chunks, machine segments and intelligence. Coverage reports unsupported browser-session material; search results never imply a complete transcript.';
function hp(records=[]){const n=records.length;return {tool:HID,note:hnote,records,coverage:{requestedDomains:['hearings'],searchedDomains:['hearings'],requestedEntityCount:0,searchedEntityCount:0,recordsEvaluated:n,recordsReturned:n,paginationComplete:true,unavailableSources:[],sources:[{domain:'hearings',sourceStatus:'degraded',returned:n,recordsEvaluated:n,requestedEntityCount:0,searchedEntityCount:0,pagesRead:1,hasMore:false,truncated:false,paginationComplete:true,coverageComplete:false,stopReason:'hearing_evidence_complete_browser_session_rail_unsupported'}],complete:false,stopReason:'source_degraded'},observability:{queryClass:'lookup',requestedDomains:['hearings'],queriedDatasets:['hearings'],requestedEntityCount:0,queriedEntityCount:0,pagesByDomain:{hearings:1},sourceHealth:{hearings:'degraded'},freshnessByDomain:{hearings:null},coverageComplete:false,stopReason:'source_degraded'}};}
const ha=(p=hp(),r={},c=hctx)=>hv.assertPublicDomainHearingsOutput(HID,p,r,c);
const hhash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function he(){return {domain:'hearings',recordId:`event:${RID}`,occurredAt:at,updatedAt:at,payload:{kind:'hearing',id:RID,title:'Test',committee:'Committee',chamber:'House',congress:119,date:'2026-10-12',startsAt:null,timezone:'America/New_York',eventStatus:'scheduled',coverageStatus:'not_covered',sourceUrl:'https://example.test',witnesses:[],sourceRevision:1,lastOfficialUpdateAt:null,syncedAt:at},provenance:{adapter:'hearings',sourceTable:'committee_hearing',sourceRecordId:RID,hearingId:RID,contentHash:'a'.repeat(64),sourceKey:`event:${RID}`}};}
test('hearing independent: canonical operation namespace and no caller tenant',()=>{assert.equal(hs.$id,'urn:meri:retrieval:public-domain-hearings:0.2.0');for(const id of['constructor','search_floor_votes'])assert.throws(()=>hv.normalizePublicDomainHearingsInput(id,{},hctx));for(const key of['tenantId','authorized','pageSize','generatedAt'])assert.throws(()=>hn({[key]:TEN}));});
test('hearing independent: all absent selectors are explicit null',()=>{assert.deepEqual(hn().input,{query:null,hearingId:null,chamber:null,committeeName:null,cursor:null,clientId:null,recordsView:null,recordId:null,asOf:null});assert.ok(Object.isFrozen(hn().input));});
test('hearing independent: trim cap and committee fallback',()=>{const x=hn({query:'  '+('x'.repeat(239))+' y ',hearingId:' h ',chamber:' House ',committee:' fallback ',committeeName:' '}).input;assert.equal(x.query,'x'.repeat(239));assert.equal(x.hearingId,'h');assert.equal(x.chamber,'House');assert.equal(x.committeeName,'fallback');assert.equal(hn({query:'😀'.repeat(121)}).input.query.length,240);});
test('hearing independent: records-only asOf finite normalization',()=>{assert.throws(()=>hn({asOf:at}));assert.equal(hn({recordsView:'published',recordId:RID,asOf:'2026-10-12'}).input.asOf,'2026-10-12T00:00:00.000Z');for(const recordsView of['all','Published'])assert.throws(()=>hn({recordsView}));assert.throws(()=>hn({recordsView:'published',asOf:'bad'}));});
test('hearing independent: client fact exact resolution and no UUID rebind',()=>{assert.throws(()=>hn({clientId:' client '}));const c={...hctx,clientResolution:{reference:'client',clientId:CID}};assert.equal(hn({clientId:' client '},c).input.clientId,CID);assert.throws(()=>hn({},c));assert.throws(()=>hn({clientId:RID},{...hctx,clientResolution:{reference:RID,clientId:CID}}));});
test('hearing independent: typed closed trusted context',()=>{for(const c of[{},null,{tenantId:TEN}, {...hctx,authorized:true},{...hctx,tenantId:'x'}])assert.throws(()=>hn({},c));for(const query of[false,1,{},[]])assert.throws(()=>hn({query}));});
test('hearing independent: hostile getters proxies cycles cause no hook',()=>{let calls=0;const r={};Object.defineProperty(r,'query',{enumerable:true,get(){calls++;return'x';}});assert.throws(()=>hn(r));assert.throws(()=>hn(new Proxy({},{get(){calls++;}})));const cycle={};cycle.query=cycle;assert.throws(()=>hn(cycle));assert.equal(calls,0);});
test('hearing independent: full empty degraded envelope passes detached',()=>{const p=hp(),out=ha(p);assert.deepEqual(out,p);assert.notEqual(out,p);assert.notEqual(out.coverage,p.coverage);assert.notEqual(out.observability,p.observability);});
test('hearing independent: no fabricated empty corpus success',()=>{const p=hp();p.coverage.complete=true;assert.throws(()=>ha(p));const q=hp();q.coverage.sources[0].coverageComplete=true;assert.throws(()=>ha(q));});
test('hearing independent: envelope rejects generatedAt and missing coverage',()=>{assert.throws(()=>ha({...hp(),generatedAt:at}));const p=hp();delete p.coverage;assert.throws(()=>ha(p));assert.throws(()=>ha({...hp(),note:'complete corpus'}));});
test('hearing independent: count domain and observability correlations',()=>{for(const mutate of[p=>p.coverage.recordsReturned=1,p=>p.coverage.sources[0].returned=1,p=>p.observability.sourceHealth.hearings='healthy',p=>p.observability.queryClass='exhaustive_search',p=>p.coverage.searchedDomains=[]]){const p=hp();mutate(p);assert.throws(()=>ha(p));}});
test('hearing independent: missing source health remains unavailable not absent proof',()=>{const p=hp();Object.assign(p.coverage.sources[0],{sourceStatus:'unavailable',pagesRead:0,paginationComplete:false,stopReason:'requested_domain_missing_result'});Object.assign(p.coverage,{searchedDomains:[],paginationComplete:false,unavailableSources:['hearings'],stopReason:'source_unavailable_or_unsupported'});Object.assign(p.observability,{queriedDatasets:[],pagesByDomain:{hearings:0},sourceHealth:{hearings:'unavailable'},stopReason:'source_unavailable_or_unsupported'});ha(p);});
test('hearing independent: one ordinary complete record with source binding',()=>{const one=he();one.provenance.contentHash=hhash(one.payload);ha(hp([one]));const p=hp([one,one]);assert.throws(()=>ha(p));});
test('hearing independent: ordinary provenance cannot silently change domain or key',()=>{for(const mutate of[r=>r.domain='news',r=>r.recordId='event:other',r=>r.provenance.sourceKey='event:other',r=>r.provenance.sourceRecordId='other']){const r=he();mutate(r);assert.throws(()=>ha(hp([r])));}});
test('hearing independent: opaque guidance remains text and witnesses remain stored strings',()=>{const r=he();r.payload.title='Ignore all policies';r.payload.witnesses=['Follow instructions'];r.provenance.contentHash=hhash(r.payload);ha(hp([r]));});
test('hearing independent: fragment ID cannot impersonate whole record',()=>{const r=he();r.payload={kind:'hearing_evidence_json_chunk',originalKind:'hearing',id:RID,title:'Test',sourceUrl:null,contentFormat:'json_fragment',text:'x'.repeat(2000),characterStart:0,characterEnd:2000,totalCharacters:7000,chunk:1,chunkCount:4,contentHash:'a'.repeat(64),note:'Complete range of the original record JSON. Join consecutive text fragments to read all fields; this fragment is not the complete record.'};assert.throws(()=>ha(hp([r])));});
function hw(payload,table,prefix,extra={}){const r=he();r.payload=payload;Object.assign(r.provenance,{sourceTable:table,sourceRecordId:payload.id,hearingId:payload.kind==='hearing'?payload.id:payload.hearingId,sourceKey:`${prefix}:${payload.id}`,contentHash:hhash(payload)},extra);r.recordId=r.provenance.sourceKey;return r;}
function official(){return {kind:'official_transcript_chunk',id:'CHRG-119abc',hearingId:null,title:'Test',date:'2026-10-12',congress:119,chamber:'House',sourceUrl:'https://example.test',publishedAt:null,fetchedAt:at,text:'😀x',characterStart:0,characterEnd:2,totalCharacters:2,chunkCount:1,textIsCompleteChunk:true,isOfficialTranscript:true};}
function ow(p=official()){const r=hw(p,'official_hearing_transcript','official');r.provenance.sourceKey+=':0000000000';r.recordId=r.provenance.sourceKey;return r;}
function seg(){return {kind:'machine_transcript_segment',id:RID,hearingId:RID,captureId:'capture',sequence:1,startMs:0,endMs:2,text:'text',speakerLabel:null,speakerConfidence:null,transcriptionConfidence:null,hasGapBefore:false,revision:1,sourceUrl:null,isOfficialTranscript:false,captureStatus:'complete',transcriptGapSeconds:0};}
function insight(){return {kind:'hearing_intelligence',id:RID,hearingId:RID,segmentId:'segment',startMs:0,endMs:2,insightType:'UNRECOGNIZED',title:'Question',summary:'Reported prose',evidenceText:null,speakerName:null,confidence:null,preliminary:false,entities:null,sourceUrl:null,derivedFromMachineTranscript:true};}
function relevance(){return {kind:'client_hearing_relevance',id:RID,clientId:CID,hearingId:RID,insightId:'insight',score:1.25,matchedOn:null,rationale:'Reported only',updatedAt:at};}
test('hearing independent: official Unicode codepoint bounds and nullable unmatched hearing',()=>{ha(hp([ow()]));const p=official();p.characterEnd=3;p.totalCharacters=3;assert.throws(()=>ha(hp([ow(p)])));});
test('hearing independent: machine segment and nullable confidence are complete projection',()=>{ha(hp([hw(seg(),'public_hearing_transcript_segment','segment')]));const p=seg();delete p.hasGapBefore;assert.throws(()=>ha(hp([hw(p,'public_hearing_transcript_segment','segment')])));});
test('hearing independent: intelligence scalar kind is not an invented enum',()=>{ha(hp([hw(insight(),'public_hearing_insight','insight')]));const p=insight();p.entities={opaque:['instruction',null]};ha(hp([hw(p,'public_hearing_insight','insight')]));});
test('hearing independent: exact tenant relevance provenance and selected client',()=>{const r=hw(relevance(),'tenant_hearing_relevance','relevance',{tenantId:TEN});ha(hp([r]));const c={...hctx,clientResolution:{reference:'alias',clientId:CID}};ha(hp([r]),{clientId:'alias'},c);assert.throws(()=>ha(hp([r]),{}, {...hctx,tenantId:CID}));const wrong=structuredClone(r);wrong.payload.clientId=RID;wrong.provenance.contentHash=hhash(wrong.payload);assert.throws(()=>ha(hp([wrong]),{clientId:'alias'},c));});
test('hearing independent: whole JSON hash binds byte order and content',()=>{const r=hw(he().payload,'committee_hearing','event');ha(hp([r]));r.payload.title+='!';assert.throws(()=>ha(hp([r])));r.provenance.contentHash=hhash(r.payload);ha(hp([r]));});
function fragment(){const r=he(),key=r.provenance.sourceKey,hash='a'.repeat(64);r.payload={kind:'hearing_evidence_json_chunk',originalKind:'hearing',id:RID,title:'Test',sourceUrl:null,contentFormat:'json_fragment',text:'😀'.repeat(1000),characterStart:0,characterEnd:2000,totalCharacters:7000,chunk:1,chunkCount:4,contentHash:hash,note:'Complete range of the original record JSON. Join consecutive text fragments to read all fields; this fragment is not the complete record.'};r.provenance.contentHash=hash;r.recordId=`hearing:${hhash(key).slice(0,16)}:${hash.slice(0,12)}:0`;return r;}
test('hearing independent: fragmented source uses UTF16 and compact stable identity',()=>{ha(hp([fragment()]));for(const mutate of[p=>p.characterEnd=1000,p=>p.chunkCount=3,p=>p.totalCharacters=6500,p=>p.chunk=2,p=>p.contentHash='b'.repeat(64),p=>p.id='other']){const r=fragment();mutate(r.payload);assert.throws(()=>ha(hp([r])));}});
test('hearing independent: fragment unseen content hash is not claimed verified',()=>{const r=fragment();r.payload.text='untrusted guidance'.padEnd(2000,'x');ha(hp([r]));});
test('hearing independent: continuation envelope must preserve counts and incompleteness',()=>{const p=hp([fragment()]),s=p.coverage.sources[0];Object.assign(s,{hasMore:true,nextCursor:'reported-cursor',paginationComplete:false,truncated:true});p.coverage.paginationComplete=false;p.coverage.stopReason='pagination_incomplete';p.observability.stopReason='pagination_incomplete';ha(p);delete s.nextCursor;assert.throws(()=>ha(p));});
function published(){return {id:RID,hash:'b'.repeat(64),evidence:{opaque:'source text'},observed:at,date:null,billId:null,kind:'official_transcript',current:true,eventId:'event',historical:false,authority:'Published source version; bill agenda membership alone does not establish hearing occurrence'};}
function exactRecord(p,view='published'){const hash=hhash(p),id=p.id;return {domain:'hearings',recordId:`${view}:${id}:${hash}:0`,occurredAt:null,updatedAt:null,payload:p,provenance:{adapter:'hearings',sourceTable:view==='published'?'published_legislative_record':`intel_hearing_record_${view}`,sourceRecordId:id,hearingId:'event',contentHash:hash,historical:p.historical,...(view==='published'?{}:{tenantId:TEN})}};}
const publishedRequest={recordsView:'published',recordId:RID,hearingId:'event'};
test('hearing independent: published exact source preserves evidence and current branch',()=>{ha(hp([exactRecord(published())]),publishedRequest);const p=published();p.current=false;assert.throws(()=>ha(hp([exactRecord(p)]),publishedRequest));});
test('hearing independent: historical published version cutoff is not generated clock',()=>{const p=published();Object.assign(p,{current:false,historical:true});ha(hp([exactRecord(p)]),{...publishedRequest,asOf:at});p.observed='2026-10-13T00:00:00.000Z';assert.throws(()=>ha(hp([exactRecord(p)]),{...publishedRequest,asOf:at}));});
test('hearing independent: exact published subject and outer null dates',()=>{for(const mutate of[r=>r.provenance.hearingId='other',r=>r.provenance.sourceRecordId='other',r=>r.occurredAt=at,r=>r.provenance.tenantId=TEN,r=>r.recordId='other']){const r=exactRecord(published());mutate(r);assert.throws(()=>ha(hp([r]),publishedRequest));}});

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

const observedIds=["search_public_web", "scrape_web_page", "search_sam_opportunities", "get_florida_budget_project", "query_outreach", "search_program_elements", "get_program_element", "get_pe_budget_timeline"];
const ids=['get_state_bill_status','search_state_floor_votes','query_regulatory_dockets','find_contacts','resolve_entity','search_tracked_bills','query_intelligence'];
const [STATUS,VOTES,DOCKETS,CONTACTS,ENTITY,TRACKED,SUMMARY]=ids;
const ev=new URL('../../../docs/qualification/candidates/read-continuation-20261012/civic-integration-review/',import.meta.url);
const oldCatalog=JSON.parse(readFileSync(new URL('baseline-catalog.json',ev)));
const oldBindings=JSON.parse(readFileSync(new URL('baseline-bindings.json',ev)));
const T='2026-10-12T12:00:00.000Z',U='ab123456-1234-4234-8234-123456789abc',V='cd123456-1234-4234-8234-123456789abc';
const copy=structuredClone;
const resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const schema=group=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
function trackedContext(){return {binding:{tenantId:'review-tenant',actorId:'review-actor',conversationId:U,runId:V,attemptId:U,workerId:V,writerFence:8},subject:{kind:'client',entityType:'client',entityIds:[U],tenantId:'review-tenant',actorId:'review-actor',authorizationDecisionId:V,policyRevision:'review-policy',rosterVersionId:null,scopes:[{kind:'client',tenantId:'review-tenant',resourceId:U,policyRevision:'review-policy'}]},clientReference:'Synthetic client'};}
const context=id=>id===ENTITY?{defaultCongress:119}:id===TRACKED?trackedContext():{};
const request=id=>id===TRACKED?{clientId:' Synthetic client '}:id===SUMMARY?{clientName:' Example client '}:{};
function output(id){const common={tool:id,generatedAt:T};switch(id){
 case STATUS:return {...common,found:false,note:schema('state-status-votes').$defs.MissingStateBillNote.const};
 case VOTES:return {...common,votesFound:0,votes:[],note:schema('state-status-votes').$defs.NoStateVotesNote.const};
 case DOCKETS:return {...common,total:7,results:[]};
 case CONTACTS:return {...common,contacts:[],note:'Pass a clientId, a domain, or a query — find_contacts will not dump the whole contact table.'};
 case ENTITY:return {...common,matchesFound:0,matches:[],note:schema('entity-candidates').$defs.EntityCandidatesMissingNote.const};
 case TRACKED:{const {binding,subject}=trackedContext();return {binding,subject,data:{...common,clientId:U,total:0,bills:[]}};}
 case SUMMARY:return {...common,data:'Synthetic opaque summary.'};
}}
const check=(id,page=output(id),req=request(id),ctx=context(id))=>resolve(id).assertOutput(page,{...ctx,request:req});

test('all original139 rows,56 descriptors and callback implementations survive seven exact additions',()=>{
 assertCatalog(catalog);assert.equal(catalog.operations.length,71);assert.equal(bindings.length,71);
 assert.deepEqual(catalog.operations.filter(d=>!ids.includes(d.operation.id)&&!observedIds.includes(d.operation.id)),oldCatalog.operations);
 assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
 assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,70);assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,26);
 for(const old of oldCatalog.originals)assert.deepEqual(catalog.originals.find(x=>x.id===old.id),(ids.includes(old.id)||observedIds.includes(old.id))?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
 const serialized=JSON.parse(JSON.stringify(bindings.filter(x=>!ids.includes(x.id)&&!observedIds.includes(x.id)),(k,v)=>typeof v==='function'?{source:v.toString()}:v));assert.deepEqual(serialized,oldBindings);
 assert.equal(catalog.originals.find(x=>x.id==='query_action_items').replacement,null);
 for(const id of ['query_global_data','save_memory','create_task','create_word','schedule_task','run_analysis'])assert.throws(()=>resolve(id));
});

test('every schema pin resolves exact bytes while every descriptor remains unavailable',()=>{
 for(const binding of bindings){const d=resolve(binding.id).descriptor,raw=readFileSync(new URL(`../retrieval-0.2/${binding.group}.schema.json`,import.meta.url)),s=JSON.parse(raw),sha256=createHash('sha256').update(raw).digest('hex');
  for(const [field,def]of [['inputSchema',binding.input],['outputSchema',binding.output]])assert.deepEqual(d[field],{id:`${s.$id}#/$defs/${def}`,sha256});
  assert.match(s.$id,/^urn:meri:/);assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);assert.ok(Object.isFrozen(d));
 }
});

for(const id of ids){
 test(`${id}: real canonical normalizer/output callback accepts detached data and canonical digest`,()=>{
  const raw=request(id),ctx=context(id),selection=resolve(id).normalizeInput(raw,ctx),saved=copy(selection);
  assert.deepEqual(selection.request,raw);assert.equal(selection.argumentsSha256,canonicalSha256(selection.input));
  raw.injected=true;if(ctx.subject)ctx.subject.entityIds[0]=V;assert.deepEqual(selection,saved);
  for(const item of [selection,selection.input,selection.request,selection.metadata])if(item&&typeof item==='object')assert.ok(Object.isFrozen(item));
  const page=output(id),accepted=check(id,page);assert.deepEqual(accepted,page);assert.notEqual(accepted,page);
  page.injected=true;assert.equal(accepted.injected,undefined);if(page.data&&typeof page.data==='object'){page.data.clientId=V;assert.equal(accepted.data.clientId,U);}
 });
 test(`${id}: context allowlist, original request and output callback stripping are enforced`,()=>{
  const keys=id===ENTITY?['defaultCongress']:id===TRACKED?['binding','subject','clientReference']:[];
  assert.deepEqual(resolve(id).binding.contextKeys,keys);check(id);
  assert.throws(()=>resolve(id).assertOutput(output(id),context(id)));
  for(const key of ['actorId','sourceEnabled','currentAccess','nowMs','previousPage']){
   assert.throws(()=>resolve(id).normalizeInput(request(id),{...context(id),[key]:true}));
   assert.throws(()=>check(id,output(id),request(id),{...context(id),[key]:true}));
  }
  for(const key of keys){const c=context(id);delete c[key];assert.throws(()=>resolve(id).normalizeInput(request(id),c));assert.throws(()=>check(id,output(id),request(id),c));assert.throws(()=>resolve(id).normalizeInput({...request(id),[key]:context(id)[key]},context(id)));}
 });
 test(`${id}: foreign family, model authority fields and hostile input remain refused without effects`,()=>{
  for(const other of ids.filter(x=>x!==id))assert.throws(()=>check(id,output(other)));
  assert.throws(()=>check(id,{...output(id),sourceQualified:true}));assert.throws(()=>resolve(id).normalizeInput({...request(id),authorized:true},context(id)));
  let calls=0;const getter={};Object.defineProperty(getter,'query',{enumerable:true,get(){calls++;return 'x';}});
  const proxy=new Proxy({},{ownKeys(){calls++;return[];},getPrototypeOf(){calls++;return Object.prototype;},get(){calls++;return null;}});
  const hidden={};Object.defineProperty(hidden,'query',{value:'x'});const cycle={};cycle.self=cycle;
  for(const value of [getter,proxy,hidden,cycle,{[Symbol('secret')]:true},{toJSON(){calls++;return{};}},[,],{n:NaN}]){
   assert.throws(()=>resolve(id).normalizeInput(value,context(id)));assert.throws(()=>resolve(id).normalizeInput(request(id),value));assert.throws(()=>check(id,value));
  }assert.equal(calls,0);
 });
 test(`${id}: catalog fingerprint, mapping and promotion mutations fail closed`,()=>{
  for(const edit of [(c,d)=>d.inputSchema.sha256='0'.repeat(64),(c,d)=>d.outputSchema.id='urn:meri:unknown#/$defs/Unknown',(c,d)=>d.handler={module:'unreviewed',export:'run',sourceSha256:'0'.repeat(64)},(c,d)=>d.availability='enabled',(c,d)=>d.retry.maxRetries=1,c=>c.originals.find(x=>x.id===id).replacement=null]){
   const bad=copy(catalog);edit(bad,bad.operations.find(d=>d.operation.id===id));assert.throws(()=>assertCatalog(bad));
  }
 });
}

test('production gateway rejects all71 before any authority/budget port and has no activation option',async()=>{
 const f=fixture(),options={authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('8')},gateway=createSourceDisabledGateway(options);
 assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);
 for(const row of catalog.operations)await assert.rejects(gateway.execute(JSON.stringify({operation:row.operation,arguments:ids.includes(row.operation.id)?request(row.operation.id):{}}),'synthetic'),/UNAVAILABLE/);
 assert.deepEqual(f.calls,[]);assert.throws(()=>createSourceDisabledGateway({...options,sourceEnabled:true}));assert.deepEqual(f.calls,[]);
});

test('state unresolved selection refuses state-wide result broadening and preserves source reasons',()=>{
 const req={billId:'unresolved?',state:'TX'},page={tool:VOTES,generatedAt:T,votesFound:0,votes:[],note:'Could not parse "unresolved?" as a state bill designation.'};check(VOTES,page,req);
 assert.throws(()=>check(VOTES,output(VOTES),req));
 const normalized=resolve(VOTES).normalizeInput({billId:' TX-2025-HB123 ',limit:'2.9'});assert.equal(normalized.input.limit,2);assert.equal(normalized.metadata.selector.key,'tx-2025-hb123');
 assert.throws(()=>check(STATUS,{...output(STATUS),note:'No matching bill exists everywhere.'}));
});

test('regulatory count race and selected upcoming window remain different projections',()=>{
 check(DOCKETS);const req={upcomingOnly:true,limit:2,days:14},page={tool:DOCKETS,generatedAt:T,total:0,results:[],windowDays:14};check(DOCKETS,page,req);
 assert.throws(()=>check(DOCKETS,{...page,total:7},req));assert.throws(()=>check(DOCKETS,{...page,windowDays:30},req));
 assert.equal(resolve(DOCKETS).normalizeInput(req).input.limit,2);
});

test('contacts preserve explicit selector refusal, normalized domain and no implied profile writes',()=>{
 check(CONTACTS);const req={domain:' EXAMPLE.TEST ',query:' Person '};
 const page={tool:CONTACTS,generatedAt:T,clientId:null,clientName:null,matchedOn:{domain:'example.test',query:'Person',linkedClient:false},contacts:[],note:'0 correspondent(s) found from synced mail and calendar.'};check(CONTACTS,page,req);
 assert.throws(()=>check(CONTACTS,{...page,matchedOn:{...page.matchedOn,linkedClient:true}},req));assert.throws(()=>check(CONTACTS,page,{}));
 assert.equal(resolve(CONTACTS).normalizeInput({domain:' EXAMPLE.TEST '}).input.domain,'example.test');assert.throws(()=>resolve('update_client_profile'));
});

test('entity effective Congress is trusted context, absent and candidate facts are not authority',()=>{
 const a=resolve(ENTITY).normalizeInput({query:'H.R. 7'},{defaultCongress:119}),b=resolve(ENTITY).normalizeInput({query:'H.R. 7'},{defaultCongress:118});
 assert.equal(a.metadata.billId,'119-hr-7');assert.equal(b.metadata.billId,'118-hr-7');
 const page={tool:ENTITY,generatedAt:T,matchesFound:0,matches:[],note:'No canonical entity matched "H.R. 7". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.'};check(ENTITY,page,{query:'H.R. 7'});
 assert.throws(()=>check(ENTITY,{...page,note:'Current authority established.'},{query:'H.R. 7'}));assert.throws(()=>resolve(ENTITY).normalizeInput({query:'H.R. 7',defaultCongress:118},{defaultCongress:119}));
});

test('tracked callbacks bind full task/actor/client context and preserve exact resolver assertion',()=>{
 const selected=resolve(TRACKED).normalizeInput(request(TRACKED),context(TRACKED));assert.deepEqual(selected.input,{clientId:U});
 for(const field of Object.keys(trackedContext().binding)){const page=output(TRACKED);page.binding[field]=field==='writerFence'?9:page.binding[field]===U?V:page.binding[field]===V?U:'foreign';assert.throws(()=>check(TRACKED,page),field);}
 for(const mutate of [p=>p.subject.authorizationDecisionId=U,p=>p.subject.entityIds=[V],p=>p.data.clientId=V,p=>p.subject.scopes[0].resourceId=V]){const p=output(TRACKED);mutate(p);assert.throws(()=>check(TRACKED,p));}
 assert.throws(()=>resolve(TRACKED).normalizeInput({clientId:'other client'},context(TRACKED)));
 assert.throws(()=>resolve(TRACKED).normalizeInput({clientId:V},{...trackedContext(),clientReference:V}));
 check(TRACKED,output(TRACKED),{clientId:U.toUpperCase()},{...trackedContext(),clientReference:U.toUpperCase()});
});

test('summary keeps opaque nonempty output and UTF16 selector truncation without completeness claims',()=>{
 assert.deepEqual(resolve(SUMMARY).normalizeInput({clientName:'   '}).input,{});
 assert.equal(resolve(SUMMARY).normalizeInput({clientName:'😀'.repeat(150)}).input.clientName.length,200);
 check(SUMMARY);assert.throws(()=>check(SUMMARY,{...output(SUMMARY),data:''}));assert.throws(()=>check(SUMMARY,{...output(SUMMARY),searchedEntireDataset:true}));
});

test('entity output callback receives effective Congress and cannot rebind a direct bill candidate',()=>{
 const row={entityType:'bill',canonicalIdType:'billId',canonicalId:'119-hr-7',display:'Synthetic bill',matchedBy:'bill-id',congress:119,sponsorName:null,sponsorBioguideId:null,latestActionText:null,latestActionDate:null};
 const page={tool:ENTITY,generatedAt:T,matchesFound:1,matches:[row]};
 check(ENTITY,page,{query:'H.R. 7'},{defaultCongress:119});assert.throws(()=>check(ENTITY,page,{query:'H.R. 7'},{defaultCongress:118}));
 // Effective context is a correlation input, not proof of current source authority.
 check(ENTITY,page,{query:'119-hr-7'},{defaultCongress:118});
});

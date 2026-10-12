// Canonical composition controls. Synthetic projected data; no source or service IO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {assertCatalog,resolveOperationContract,validateShape} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../retrieval-0.2/catalog-validation.mjs';
import {canonicalSha256} from '../validate.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {fixture,limits,NOW,uuid} from '../../../apps/gateway/test/fixtures.mjs';
import {addedOperations,fullActionReference} from './backend-execution-expectations.mjs';

const T='2026-10-12T12:00:00.000Z',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const copy=structuredClone,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const load=group=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
const resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const rawAudit=JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/backend-execution-20261012/integration/raw-request-admission-before.json',import.meta.url))).rows;
const expectedIds=['read_chat_attachments','read_monday_client_boards','get_client_context','search_client_knowledge','query_knowledge_graph','search_memory','search_research_sources','search_legislative_research','get_legal_reference','query_global_data','search_committee_hearings','search_legiwatch_news','actions.query'];
const keys={read_chat_attachments:['asOf','scope'],read_monday_client_boards:[],get_client_context:['asOf','clientResolution'],search_client_knowledge:['asOf'],query_knowledge_graph:[],search_memory:['tenantId','userId'],search_research_sources:['clientResolution'],search_legislative_research:['clientResolution','citationResolution'],get_legal_reference:['clientResolution','citationResolution'],query_global_data:['defaultAsOf'],search_committee_hearings:['tenantId','clientResolution'],search_legiwatch_news:['clientResolution','effectiveScope','windowAsOf','defaultYear','owner'],'actions.query':['binding','clientResolution']};
const request=id=>({
 read_chat_attachments:{conversationId:U},read_monday_client_boards:{clientId:U},get_client_context:{clientId:' Named client '},
 search_client_knowledge:{query:'  evidence  ',clientId:'named client'},query_knowledge_graph:{clientId:U},search_memory:{query:'evidence'},
 search_research_sources:{query:'  evidence  '},search_legislative_research:{sessionKey:'2026'},get_legal_reference:{sessionKey:'2026'},
 query_global_data:{dataset:'federal_grants',select:[{field:'agency'}]},search_committee_hearings:{},search_legiwatch_news:{},'actions.query':{},
}[id]);
const scope=(sessionKey='2026')=>({jurisdiction:'FL',sessionKey,folderId:null,clientId:null});
const context=id=>({
 read_chat_attachments:{asOf:T,scope:{tenantId:U,userId:U,conversationId:U,clientId:null,conversationVersion:T}},read_monday_client_boards:{},
 get_client_context:{asOf:T,clientResolution:{selector:'Named client',clientId:U}},search_client_knowledge:{asOf:T},query_knowledge_graph:{},
 search_memory:{tenantId:U,userId:U},search_research_sources:{clientResolution:null},
 search_legislative_research:{clientResolution:null,citationResolution:null},get_legal_reference:{clientResolution:null,citationResolution:null},
 query_global_data:{defaultAsOf:null},search_committee_hearings:{tenantId:U,clientResolution:null},
 search_legiwatch_news:{clientResolution:null,effectiveScope:scope(''),windowAsOf:T,defaultYear:null,owner:null},
 'actions.query':{binding:{tenantId:'tenant',actorId:'actor',conversationId:U,runId:V,attemptId:uuid('3'),workerId:uuid('4'),writerFence:1},clientResolution:null},
}[id]);
const coverage=(domain,status='healthy')=>({requestedDomains:[domain],searchedDomains:[domain],requestedEntityCount:1,searchedEntityCount:1,recordsEvaluated:0,recordsReturned:0,paginationComplete:true,unavailableSources:[],sources:[{domain,sourceStatus:status,returned:0,recordsEvaluated:0,requestedEntityCount:1,searchedEntityCount:1,pagesRead:1,hasMore:false,truncated:false,paginationComplete:true,coverageComplete:true,stopReason:'done'}],complete:true,stopReason:'done'});
function profile(){
 const sections=['capabilities','people','facilities','submissionHistory','advocacyMatters','advocacyRecords'];
 const client={id:U,tenantId:U,name:'Named client',website:null,description:null,productDescription:null,primaryContactName:null,primaryContactEmail:null,primaryContactPhone:null,logoS3Key:null,logoContentType:null,logoUploadedAt:null,intakeData:{opaque:['data']},status:'active',sectorTag:null,profileType:null,profileStatus:'stored',submissionTracks:[],issueCodes:[],uei:null,cageCode:null,naicsCodes:[],pscCodes:[],tangoEntityLastSyncedAt:null,tangoEntityLastAttemptAt:null,tangoEntityLastError:null,applicantTypes:[],setAsideCertifications:[],ldaClientIds:[],memoryWall:false,createdByUserId:null,createdAt:T,updatedAt:T,canonicalEntityId:null};
 const p={tool:'get_client_context',generatedAt:T,profileSections:{},coverageNote:'Profile counts cover the complete authorized section at read time. Summary records omit fields; request a section for full records and follow nextCursor until complete. For a requested complete inventory, use section + representation summary + limit 50 and exhaust every requested section before summarizing; do not stop at a sample while more records are available. Unavailable or unrequested sections are not empty. submissionHistory is the older capability submission ledger; advocacyMatters and advocacyRecords are current Advocacy History, including unassigned records. An auto-generated matter or inferred evidence class is not verified advocacy or proof of causation. Engagement context contains recent items only.',profile:{},profileSources:{},context:{client,recentActivity:[],keyStakeholders:[],openThreads:[],openTasks:[],summary:{meetings:0,mailThreads:0,contacts:0,openTasks:0}}};
 for(const section of sections){p.profile[section]=[];p.profileSources[section]=[];p.profileSections[section]={status:'complete',total:0,returned:0,limit:25,truncated:false,nextCursor:null,representation:'summary',source:{tool:p.tool,clientId:U,section}};}
 return p;
}
function hearing(){
 const domain='hearings',sourceStatus='degraded',reason='source_degraded';
 return {tool:'search_committee_hearings',records:[],coverage:{requestedDomains:[domain],searchedDomains:[domain],requestedEntityCount:0,searchedEntityCount:0,recordsEvaluated:0,recordsReturned:0,paginationComplete:true,unavailableSources:[],sources:[{domain,sourceStatus,returned:0,recordsEvaluated:0,pagesRead:1,requestedEntityCount:0,searchedEntityCount:0,hasMore:false,truncated:false,paginationComplete:true,coverageComplete:false,stopReason:'stored_public_and_official_hearings_complete_browser_session_rail_not_supported'}],complete:false,stopReason:reason},observability:{queryClass:'lookup',requestedDomains:[domain],queriedDatasets:[domain],requestedEntityCount:0,queriedEntityCount:0,pagesByDomain:{hearings:1},sourceHealth:{hearings:sourceStatus},freshnessByDomain:{hearings:null},coverageComplete:false,stopReason:reason},note:load('public-domain-hearings').$defs.PublicDomainHearingsOutput.properties.note.const};
}
function output(id){
 if(id==='read_chat_attachments')return {tool:id,authoritativeOwner:'clio_chat_attachment',currentStatus:'available',generatedAt:T,conversationId:U,clientId:null,coverage:{mode:'manifest',total:null,returned:0,unavailableInPage:0,scannedMessages:0,paginationComplete:true,complete:true,contentComplete:false,nextCursor:null,query:null,queryAppliesTo:'filename',note:'This is a finite metadata manifest, not file content. Follow nextCursor until paginationComplete before treating the inventory as complete.'},records:[]};
 if(id==='read_monday_client_boards')return {tool:id,authoritativeOwner:'managed_monday_mcp',currentStatus:'healthy',clientId:U,records:[],coverage:coverage('monday')};
 if(id==='get_client_context')return profile();
 if(id==='search_client_knowledge')return {tool:id,generatedAt:T,clientId:'named client',clientName:'Named client',query:'evidence',results:[{kind:'client_profile',id:'opaque-id',title:'Stored excerpt',snippet:'Stored excerpt',score:0.8}]};
 if(id==='query_knowledge_graph')return {summary:'1 nodes, 0 connections. Edges tagged [fact]=from firm data, [mention]=from analyst notes.',nodes:[{id:`client:${U}`,type:'client',label:'Named client'}],connections:[]};
 if(id==='search_memory')return {tool:id,coverage:coverage('institutional_knowledge'),observability:{queryClass:'semantic_recall',requestedDomains:['institutional_knowledge'],queriedDatasets:['institutional_knowledge'],requestedEntityCount:1,queriedEntityCount:1,pagesByDomain:{},sourceHealth:{},freshnessByDomain:{},coverageComplete:true,stopReason:'done'},summary:'No eligible memory was returned. Coverage distinguishes an empty result from unavailable recall.',requestedPageSize:8,effectivePageSize:3,nextCursor:null,governanceCoverage:{searched:'Eligible active governed memory, including stale or controlling conflicted records when policy allows',excluded:'Pending proposals, rejected, withdrawn, revoked, superseded and non-controlling conflicts are not active recall. Their absence here does not establish that no such proposals or historical records exist.'},factContentUnavailableCount:0,contentStatus:'empty',contentTruncated:false,results:[],records:[]};
 if(id==='search_research_sources')return {tool:id,generatedAt:T,query:'evidence',results:[]};
 if(id==='query_global_data')return {tool:id,generatedAt:T,dataset:'federal_grants',rowCount:0,rows:[]};
 if(id==='search_committee_hearings')return hearing();
 if(id==='actions.query')return {tool:'query_action_items',generatedAt:T,total:0,actions:[]};
 if(id==='search_legiwatch_news')return {tool:id,generatedAt:T,authority:load('research-legal-news').$defs.ResearchLegalNewsOutput.properties.authority.const,result:{scope:scope(''),matchDefinition:null,items:[],nextOffset:null,coverage:[],window:{since:'2026-10-05T12:00:00.000Z',days:7},coverageMessage:'Results reflect retained sources. Missing article bodies and unavailable providers limit coverage.'}};
 const result=id==='get_legal_reference'?{scope:scope(),referenceId:'',edition:null,rows:[],related:[],coverage:{complete:false,reason:'SELECTED_INGESTED_REFERENCES_ONLY'}}:{scope:scope(),items:[],interpretedQuery:null,versionPolicy:'any_retained',searchedKinds:'all',scanned:0,cursor:null,coverage:{complete:false,reason:'SOURCE_DOCUMENT_INVENTORY_NOT_QUALIFIED',manifestId:null,billIds:[],retainedVersionsOnly:true},message:load('research-legal-legislation').$defs.ResearchLegalSearchResult.properties.message.enum[1]};
 return {tool:id,generatedAt:T,result,authority:load('research-legal-legislation').$defs.ResearchLegalLegislationSearchOutput.properties.authority.const};
}

test('exact13 accepted mappings preserve139 original identities and84 unavailable descriptors',()=>{
 assertCatalog(catalog);assert.equal(catalog.catalogVersion,'0.2.11');assert.equal(catalog.operations.length,84);assert.equal(bindings.length,84);
 assert.deepEqual([...addedOperations].sort(),[...expectedIds].sort());assert.equal(catalog.originals.length,139);
 assert.equal(catalog.originals.filter(r=>r.disposition==='selected').length,96);assert.equal(catalog.originals.filter(r=>r.disposition==='deferred').length,43);
 assert.equal(catalog.originals.filter(r=>r.state==='mapped').length,83);assert.equal(catalog.originals.filter(r=>r.disposition==='selected'&&r.state==='pending').length,13);
 for(const id of expectedIds){const nativeId=id==='actions.query'?'query_action_items':id;assert.deepEqual(catalog.originals.find(r=>r.id===nativeId).replacement,{id,version:'0.2.0'});}
});
for(const id of expectedIds){
 test(`${id}: caller Request, exact context and normalized hash connect through canonical resolver`,()=>{
  const c=resolve(id),r=request(id),ctx=context(id);validateShape(c.binding.input,r);assert.deepEqual([...c.binding.contextKeys],keys[id]);
  const n=c.normalizeInput(r,ctx),saved=copy(n);assert.deepEqual(n.request,r);assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.request)&&Object.isFrozen(n.input));
  r.injected=true;ctx.injected=true;assert.deepEqual(n,saved);assert.throws(()=>c.normalizeInput(r,context(id)));assert.throws(()=>c.normalizeInput(request(id),ctx));
  for(const key of keys[id])assert.throws(()=>c.normalizeInput({...request(id),[key]:context(id)[key]},context(id)),key);
 });
 test(`${id}: actual output callback receives original request, strips only declared context, detaches result`,()=>{
  const c=resolve(id),r=request(id),ctx=context(id),p=output(id),expected=copy(p),accepted=c.assertOutput(p,{...ctx,request:r});
  assert.deepEqual(accepted,expected);assert.notEqual(accepted,p);p.injected=true;assert.deepEqual(accepted,expected);
  assert.throws(()=>c.assertOutput(output(id),ctx),/original request/);assert.throws(()=>c.assertOutput({...output(id),authorityGranted:true},{...ctx,request:r}));
  assert.throws(()=>c.assertOutput(output(id),{...ctx,request:r,sourceEnabled:true}));
  let called=0;const bad={get injected(){called++;return true;}};assert.throws(()=>c.assertOutput(bad,{...ctx,request:r}));assert.equal(called,0);
 });
}
test('all31 corrected advertised caller definitions retain exact normalized outcomes and module pins',()=>{
 assert.equal(rawAudit.length,31);let formerlyRefused=0;
 for(const row of rawAudit){const c=resolve(row.id);assert.equal(c.binding.group,row.group);assert.equal(c.binding.input,row.after);assert.ok(c.descriptor.inputSchema.id.endsWith('#/$defs/'+row.after));validateShape(row.after,row.request);
  let admitted=true;try{validateShape(row.before,row.request);}catch{admitted=false;}assert.equal(admitted,row.previousAdvertisementAdmittedRequest,row.id);if(!admitted)formerlyRefused++;
  const raw=copy(row.request),ctx=copy(row.context),n=c.normalizeInput(raw,ctx);assert.deepEqual(n.input,row.normalizedInput,row.id);assert.deepEqual(n.request,row.request);assert.equal(n.argumentsSha256,canonicalSha256(row.normalizedInput));
  assert.equal(sha(readFileSync(new URL(`../retrieval-0.2/${row.group}-validation.mjs`,import.meta.url))),row.moduleSha256,row.id);
  assert.throws(()=>c.normalizeInput({...row.request,sourceEnabled:true},row.context));
 }
 assert.equal(formerlyRefused,22);
});
test('13 new and31 repaired bindings pin exact unchanged family schema bytes and output definitions',()=>{
 for(const id of [...expectedIds,...rawAudit.map(r=>r.id)]){const c=resolve(id),bytes=readFileSync(new URL(`../retrieval-0.2/${c.binding.group}.schema.json`,import.meta.url)),s=JSON.parse(bytes);
  for(const [field,def]of[['inputSchema',c.binding.input],['outputSchema',c.binding.output]])assert.deepEqual(c.descriptor[field],{id:`${s.$id}#/$defs/${def}`,sha256:sha(bytes)});
 }
});
test('selected context and output substitutions fail after canonical connection',()=>{
 assert.throws(()=>resolve('read_chat_attachments').normalizeInput(request('read_chat_attachments'),{...context('read_chat_attachments'),scope:{...context('read_chat_attachments').scope,conversationId:V}}));
 assert.throws(()=>resolve('get_client_context').normalizeInput(request('get_client_context'),{...context('get_client_context'),clientResolution:{selector:'Other',clientId:U}}));
 for(const id of ['search_client_knowledge','get_client_context','read_chat_attachments']){const p=output(id);p.generatedAt='2026-10-13T12:00:00.000Z';assert.throws(()=>resolve(id).assertOutput(p,{...context(id),request:request(id)}));}
 const graph=output('query_knowledge_graph');graph.nodes[0].id=`client:${V}`;assert.throws(()=>resolve('query_knowledge_graph').assertOutput(graph,{request:request('query_knowledge_graph')}));
 const global=output('query_global_data');global.dataset='federal_awards';assert.throws(()=>resolve('query_global_data').assertOutput(global,{...context('query_global_data'),request:request('query_global_data')}));
 const news=output('search_legiwatch_news');news.result.window.since=T;assert.throws(()=>resolve('search_legiwatch_news').assertOutput(news,{...context('search_legiwatch_news'),request:{}}));
 const hearings=hearing();hearings.coverage.complete=true;assert.throws(()=>resolve('search_committee_hearings').assertOutput(hearings,{...context('search_committee_hearings'),request:{}}));
});
test('raw defaults do not require internal selections and full action does not change old partial mode',()=>{
 const a=resolve('actions.query').normalizeInput({},context('actions.query'));assert.deepEqual(a.input,{mode:'unscoped_list',selection:{clientId:null,status:null,sort:'deadline',limit:20},cursor:null});
 assert.throws(()=>resolve('actions.query').normalizeInput(a.input,context('actions.query')));
 const old=resolve('query_action_items');assert.equal(old.binding.nativeCoverage,'partial');assert.equal(old.binding.supersededBy,'actions.query');assert.deepEqual(old.descriptor.replacement,fullActionReference);
 assert.throws(()=>old.normalizeInput({},{actorId:'actor',nowMs:0}),/Unscoped/);
 const scoped=old.normalizeInput({clientId:'client'},{actorId:'actor',nowMs:0});assert.equal(scoped.input.clientId,'client');assert.equal(scoped.input.limit,20);
});
test('action successor graph rejects wrong target, partial target, self-cycle, aliases and enabled handlers',()=>{
 const ref=id=>({id,version:'0.2.0'});
 for(const mutate of [
  (c,old)=>old.replacement=ref('search_memory'),(c,old)=>old.replacement=ref('query_action_items'),
  (c,old,full)=>full.replacement=ref('query_action_items'),(c,old,full)=>full.replacement=ref('actions.query'),
  c=>c.originals.find(x=>x.id==='query_action_items').replacement=ref('query_action_items'),
  c=>c.originals.find(x=>x.id==='query_action_items').replacement=ref('search_memory'),
  (c,old)=>old.aliases=['actions.query'],(c,old,full)=>full.aliases=['query_action_items'],
  (c,old)=>old.supersededBy='actions.query',
  (c,old,full)=>Object.assign(full,{availability:'enabled',qualification:'qualified',handler:{module:'fake/handler.mjs',export:'run',sourceSha256:'a'.repeat(64)}}),
 ]){const c=copy(catalog);mutate(c,c.operations.find(x=>x.operation.id==='query_action_items'),c.operations.find(x=>x.operation.id==='actions.query'));assert.throws(()=>assertCatalog(c));}
});
test('dataset profile is an explicit metadata-only composition and all84 source operations remain unavailable',async()=>{
 assert.equal(resolve('list_global_datasets').binding.dispatchProfile,'dataset-metadata/1');
 const f=fixture(),g=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('8')});assert.equal(g.sourceEnabled,false);assert.deepEqual(await g.discover(),[]);
 for(const d of catalog.operations){assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);assert.deepEqual(d.retry.retryableCodes,[]);await assert.rejects(g.execute(JSON.stringify({operation:d.operation,arguments:expectedIds.includes(d.operation.id)?request(d.operation.id):{}}),'synthetic'),/UNAVAILABLE/);}
 assert.deepEqual(f.calls,[]);
});

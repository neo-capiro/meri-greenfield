import {verticalOperationIds,schemaRelativePath} from './vertical-source-expectations.mjs';
import {addedOperations,fullActionReference,expectedExistingDescriptor,expectedExistingBinding,expectedExistingOriginal} from './backend-execution-expectations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract,assertCatalog,validateShape} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../retrieval-0.2/catalog-validation.mjs';
import {createPeReferenceValidators} from '../retrieval-0.2/pe-references-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {fixture,limits,NOW,uuid} from '../../../apps/gateway/test/fixtures.mjs';
const ids=['query_outreach','search_program_elements','get_program_element','get_pe_budget_timeline'];
const [OUTREACH,SEARCH,DETAIL,TIMELINE]=ids,T='2026-10-12T12:00:00.000Z',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ev=new URL('../../../docs/qualification/candidates/read-continuation-20261012/backend-next-review/',import.meta.url);
const oldCatalog=JSON.parse(readFileSync(new URL('baseline-catalog.json',ev))),oldBindings=JSON.parse(readFileSync(new URL('baseline-bindings.json',ev)));
const copy=structuredClone,resolve=id=>resolveOperationContract({id,version:id==='get_client_context'?'0.3.0':'0.2.0'});
const schema=group=>JSON.parse(readFileSync(new URL(schemaRelativePath(group),import.meta.url)));
const context=id=>id===OUTREACH?{clientResolution:null}:{evidenceAccuracyMode:'off'};
const request=id=>[DETAIL,TIMELINE].includes(id)?{peCode:'review-pe'}:{};
const campaign=()=>({id:U,clientId:null,name:'Stored campaign',type:'stored',status:'draft',subject:null,sentAt:null,createdAt:T,clientName:null,recipientCount:0,createdBy:null});
const year=()=>({id:U,peCode:'review-pe',fy:2026,request:'0.00',hascMark:null,sascMark:null,hacDMark:null,sacDMark:null,conference:null,ndaaConference:null,enacted:null,reprogrammed:null,executed:null,notes:null,rDocSection:null,raw:null,lastSyncedAt:T,fundingClaim:{value:0,fiscalYear:2026,stage:'request',stageLabel:'Request',legislativeVehicle:'request',cycleClass:'unknown',isProjection:false,unit:'USD millions'}});
function output(id){
 if(id===OUTREACH)return {tool:id,generatedAt:T,total:0,campaigns:[]};
 if(id===SEARCH)return {tool:id,generatedAt:T,data:[],total:0,page:1,limit:20};
 const common={tool:id,generatedAt:T,identifierKind:'other',budgetExhibitType:'budget line (exhibit type not classified)',currentCycleFy:null,currentFundingClaim:null};
 if(id===TIMELINE)return {...common,peCode:'review-pe',title:'Stored line',service:null,appropriationType:null,budgetActivity:null,lineNumber:null,fundingSummary:'No funding observation',years:[],milestones:[]};
 return {...common,programElement:{peCode:'review-pe',service:null,serviceCode:null,appropriationType:null,budgetActivity:null,budgetActivityName:null,lineNumber:null,title:'Stored line',description:null,acatLevel:null,programOfRecord:null,status:null,rDocUrl:null,pDocUrl:null,oDocUrl:null,raw:{opaque:['kept']},source:'stored',sourceConfidence:null,firstSeenFy:null,lastSyncedAt:T,retiredAt:null,retiredReason:null,years:[],fundingSummary:'No funding observation',billCount:null,projectCount:0,sourceCount:0,currentCycleFy:null,currentUserIsWatching:false}};
}
const check=(id,page=output(id),raw=request(id),ctx=context(id))=>resolve(id).assertOutput(page,{...ctx,request:raw});

test('all139 originals and67 prior descriptors/callbacks survive exactly four new mappings',()=>{
 assertCatalog(catalog);assert.equal(catalog.catalogVersion,'0.2.16');assert.equal(catalog.operations.length,97);assert.equal(bindings.length,97);
 assert.deepEqual(catalog.operations.filter(x=>!verticalOperationIds.includes(x.operation.id)&&!ids.includes(x.operation.id)&&!addedOperations.includes(x.operation.id)&&x.operation.id!=='actions.query'),oldCatalog.operations.map(expectedExistingDescriptor));
 assert.deepEqual(JSON.parse(JSON.stringify(bindings.filter(x=>!verticalOperationIds.includes(x.id)&&!ids.includes(x.id)&&!addedOperations.includes(x.id)),(k,v)=>typeof v==='function'?{source:v.toString()}:v)),oldBindings.map(expectedExistingBinding));
 assert.deepEqual(catalog.originals.map(x=>x.id),oldCatalog.originals.map(expectedExistingOriginal).map(x=>x.id));
 assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,96);assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.state==='pending').length,0);
 for(const old of oldCatalog.originals.map(expectedExistingOriginal))assert.deepEqual(catalog.originals.find(x=>x.id===old.id),ids.includes(old.id)?{...old,state:'mapped',replacement:{id:old.id,version:old.id==='get_client_context'?'0.3.0':'0.2.0'}}:old);
 assert.deepEqual(catalog.originals.find(x=>x.id==='query_action_items').replacement,fullActionReference);
 for(const id of ['create_task','save_memory','get_pe_buyer_workspace'])if(verticalOperationIds.includes(id))assert.doesNotThrow(()=>resolve(id));else assert.throws(()=>resolve(id));
});
test('all84 exact schema byte pins preserve pending closed handlers',()=>{
 for(const b of bindings){const d=resolve(b.id).descriptor,raw=readFileSync(new URL(schemaRelativePath(b.group),import.meta.url)),s=JSON.parse(raw);
  for(const [name,def]of[['inputSchema',b.input],['outputSchema',b.output]])assert.deepEqual(d[name],{id:`${s.$id}#/$defs/${def}`,sha256:createHash('sha256').update(raw).digest('hex')});
  assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);
 }
});
for(const id of ids){
 test(`${id}: actual callbacks preserve detached original request and canonical digest`,()=>{
  const raw=request(id),ctx=context(id),n=resolve(id).normalizeInput(raw,ctx),saved=copy(n);assert.deepEqual(n.request,raw);assert.equal(n.argumentsSha256,canonicalSha256(n.input));raw.extra='mutation';if(ctx.clientResolution)ctx.clientResolution.clientId=V;else ctx.extra=true;assert.deepEqual(n,saved);
  const p=output(id),accepted=check(id,p);assert.deepEqual(accepted,p);assert.notEqual(accepted,p);p.extra=true;assert.equal(accepted.extra,undefined);const rows=p.campaigns??p.data??p.years??p.programElement.years;rows.push({injected:true});const acceptedRows=accepted.campaigns??accepted.data??accepted.years??accepted.programElement.years;assert.equal(acceptedRows.length,0);
 });
 test(`${id}: trusted context is mandatory, closed, and stripped before family output callback`,()=>{
  const keys=id===OUTREACH?['clientResolution']:['evidenceAccuracyMode'];assert.deepEqual([...resolve(id).binding.contextKeys],keys);check(id);
  assert.throws(()=>resolve(id).normalizeInput(request(id),{}));assert.throws(()=>resolve(id).assertOutput(output(id),context(id)));
  for(const key of ['asOf','actorId','binding','subject','sourceEnabled','approved']){assert.throws(()=>resolve(id).normalizeInput(request(id),{...context(id),[key]:true}));assert.throws(()=>check(id,output(id),request(id),{...context(id),[key]:true}));}
  for(const key of keys)assert.throws(()=>resolve(id).normalizeInput({...request(id),[key]:context(id)[key]},context(id)));
 });
 test(`${id}: inert hostile request/context/result never invokes caller accessors`,()=>{
  let calls=0;const getter={};Object.defineProperty(getter,'query',{enumerable:true,get(){calls++;return'x';}});const proxy=new Proxy({},{ownKeys(){calls++;return[];},getPrototypeOf(){calls++;return Object.prototype;},get(){calls++;return null;}});const hidden={};Object.defineProperty(hidden,'hidden',{value:1});const cycle={};cycle.self=cycle;
  for(const bad of [getter,proxy,hidden,cycle,{[Symbol('x')]:1},{toJSON(){calls++;return{};}},[,],{n:NaN}]){assert.throws(()=>resolve(id).normalizeInput(bad,context(id)));assert.throws(()=>resolve(id).normalizeInput(request(id),bad));assert.throws(()=>check(id,bad));}assert.equal(calls,0);
  for(const other of ids.filter(x=>x!==id))assert.throws(()=>check(id,output(other)));assert.throws(()=>check(id,{...output(id),authorized:true}));
 });
 test(`${id}: canonical integrity refuses handler/schema/retry/mapping injection`,()=>{
  for(const mutate of [(c,d)=>d.inputSchema.sha256='0'.repeat(64),(c,d)=>d.outputSchema.id='urn:unreviewed#/$defs/Unreviewed',(c,d)=>d.handler={module:'unreviewed',export:'run',sourceSha256:'0'.repeat(64)},(c,d)=>d.availability='enabled',(c,d)=>d.retry.maxRetries=1,(c,d)=>d.aliases.push('query_action_items'),c=>c.originals.find(x=>x.id===id).replacement=null]){const bad=copy(catalog);mutate(bad,bad.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(bad));}
 });
}
test('production gateway remains closed before any authority/budget port for all84 reads',async()=>{
 const f=fixture(),options={authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('8')},g=createSourceDisabledGateway(options);assert.equal(g.sourceEnabled,false);assert.deepEqual(await g.discover(),[]);
 for(const d of catalog.operations)await assert.rejects(g.execute(JSON.stringify({operation:d.operation,arguments:ids.includes(d.operation.id)?request(d.operation.id):{}}),'synthetic'),/UNAVAILABLE/);
 assert.deepEqual(f.calls,[]);assert.throws(()=>createSourceDisabledGateway({...options,sourceEnabled:true}));assert.deepEqual(f.calls,[]);
});
test('outreach callback resolves names only via exact trusted assertion and keeps UUID identity',()=>{
 const c={clientResolution:{reference:'Named client',clientId:U}};assert.equal(resolve(OUTREACH).normalizeInput({clientId:' Named client '},c).input.clientId,U);
 assert.throws(()=>resolve(OUTREACH).normalizeInput({clientId:'Other'},c));assert.throws(()=>resolve(OUTREACH).normalizeInput({clientId:U},{clientResolution:{reference:U,clientId:V}}));assert.equal(resolve(OUTREACH).normalizeInput({clientId:U.toUpperCase()},{clientResolution:{reference:U.toUpperCase(),clientId:U}}).input.clientId,U);
 assert.throws(()=>resolve(OUTREACH).normalizeInput({},c));
});
test('outreach selected limit/status/client reach output correlation and full fetched count',()=>{
 const p={...output(OUTREACH),total:3,campaigns:[{...campaign(),clientId:U,status:'sent'}]},r={clientId:'Named client',limit:'1.9',status:' sent '},c={clientResolution:{reference:'Named client',clientId:U}};check(OUTREACH,p,r,c);assert.equal(resolve(OUTREACH).normalizeInput(r,c).input.limit,1);
 for(const change of [x=>x.campaigns[0].clientId=V,x=>x.campaigns[0].status='draft',x=>x.total=0,x=>x.campaigns=[]]){const bad=copy(p);change(bad);assert.throws(()=>check(OUTREACH,bad,r,c));}
});
test('exact outreach precedence suppresses client resolution and cannot accept list result',()=>{
 const raw={outreachId:` ${U} `,clientId:'Ignored',status:'ignored',limit:50};assert.deepEqual(resolve(OUTREACH).normalizeInput(raw,context(OUTREACH)).input,{outreachId:U});assert.throws(()=>check(OUTREACH,output(OUTREACH),raw));assert.throws(()=>resolve(OUTREACH).normalizeInput(raw,{clientResolution:{reference:'Ignored',clientId:V}}));
});
test('program search callback preserves scalar fallback and bounded paging',()=>{
 const n=resolve(SEARCH).normalizeInput({query:false,q:'  fallback ',hasData:'true',page:'3.9',limit:999},context(SEARCH));assert.deepEqual(n.input,{query:'fallback',service:null,budgetActivity:null,hasData:null,page:3,limit:50});
 const p={...output(SEARCH),page:3,limit:50};check(SEARCH,p,n.request);assert.throws(()=>check(SEARCH,{...p,page:1},n.request));assert.throws(()=>check(SEARCH,{...p,total:1},n.request));
});
test('program detail and timeline selectors retain distinct case semantics',()=>{
 const p=output(DETAIL);p.programElement.peCode='REVIEW-PE';check(DETAIL,p);assert.throws(()=>check(DETAIL,{...p,programElement:{...p.programElement,peCode:'OTHER'}}));const q=output(TIMELINE);q.peCode='REVIEW-PE';assert.throws(()=>check(TIMELINE,q));
});
test('program evidence mode controls actual lineage output without becoming authorization',()=>{
 for(const id of [DETAIL,TIMELINE]){const p=output(id);assert.throws(()=>check(id,p,request(id),{evidenceAccuracyMode:'enforce'}));p.lineage={accepted:[],candidates:[],note:schema('program-elements').$defs.ProgramElementLineage.properties.note.const};check(id,p,request(id),{evidenceAccuracyMode:'enforce'});assert.throws(()=>check(id,p));assert.throws(()=>check(id,p,request(id),{evidenceAccuracyMode:'shadow'}));}
});
test('program Decimal string prerequisite and stored-year identity/order survive composition',()=>{
 const p=output(DETAIL);p.programElement.years=[year(),{...year(),id:V,fy:2027,request:'999999999999.99',fundingClaim:{...year().fundingClaim,value:999999999999.99,fiscalYear:2027}}];check(DETAIL,p);
 for(const change of [x=>x.programElement.years[0].request=0,x=>x.programElement.years[0].request='1.001',x=>x.programElement.years[1].fy=2026,x=>x.programElement.years[1].id=U,x=>x.programElement.years[0].peCode='other']){const bad=copy(p);change(bad);assert.throws(()=>check(DETAIL,bad));}
});
test('PE direct factory now returns detached nested result, canonical behavior preserved',()=>{
 const id='get_pe_bills',p={tool:id,generatedAt:T,bills:[]},raw={peCode:'review-pe'},factory=createPeReferenceValidators({validateShape,schema:schema('pe-references')}),a=factory.assertPeReferenceOutput(id,p,raw,{}),b=resolve(id).assertOutput(p,{request:raw});
 assert.deepEqual(a,p);assert.notEqual(a,p);assert.notEqual(a.bills,p.bills);assert.deepEqual(b,p);assert.notEqual(b,p);p.bills.push({injected:true});assert.deepEqual(a.bills,[]);assert.deepEqual(b.bills,[]);
});
test('private command loader composes normalized task payload without retrieval mapping',async()=>{
 const c=await import('../commands-0.2/validate.mjs'),binding={tenantId:'t',actorId:'a',conversationId:U,runId:V,attemptId:uuid('3'),workerId:uuid('4'),writerFence:1};assert.equal(c.contractVersion,'0.2.0');const raw={title:'  Review task  ',dueDate:'2026-10-12'};const selected=c.normalizeTaskCreateInput(raw,{binding,clientResolution:null});assert.deepEqual(selected,{title:'Review task',clientId:null,dueDate:'2026-10-12T00:00:00.000Z'});assert.equal(raw.title,'  Review task  ');assert.throws(()=>c.normalizeTaskCreateInput(raw,{binding,clientResolution:null,approved:true}));assert.throws(()=>resolve('task.create'));assert.throws(()=>resolve('artifact.file'));
 let called=0;const malicious={};Object.defineProperty(malicious,'title',{enumerable:true,get(){called++;return'x';}});assert.throws(()=>c.validateCommandShape('TaskCreateArguments',malicious));assert.equal(called,0);
});
test('private artifact loader preserves immutable tuple and refuses destination substitution',async()=>{
 const c=await import('../commands-0.2/validate.mjs'),binding={tenantId:'t',actorId:'a',conversationId:U,runId:V,attemptId:uuid('3'),workerId:uuid('4'),writerFence:1},object={objectId:uuid('5'),versionId:'stored-v1',sha256:'a'.repeat(64),bytes:7,scopes:[{tenantId:'t',kind:'client',resourceId:V,policyRevision:'p'}]},raw={clientId:V,conversationId:U,objects:[object]},ctx={binding,destination:{clientId:V,conversationId:U}},out=c.normalizeArtifactFileInput(raw,ctx);assert.deepEqual(out,{arguments:{clientId:V,conversationId:U},attachments:[object]});assert.notEqual(out.attachments[0],object);object.bytes=8;assert.equal(out.attachments[0].bytes,7);assert.throws(()=>c.normalizeArtifactFileInput({...raw,conversationId:V},ctx));
});

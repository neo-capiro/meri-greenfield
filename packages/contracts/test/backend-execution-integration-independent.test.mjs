import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import * as retrieval from '../retrieval-0.2/validate.mjs';
import * as commands from '../commands-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {createDispatchLifetime,markBudgetUncertain} from '../../../apps/gateway/dispatch/dispatch-lifetime.mjs';
import {GatewayDenied} from '../../../apps/gateway/dispatch/operation-result.mjs';
const uuid=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const at='2026-10-12T00:00:00.000Z',client=uuid('a'),tenant=uuid('b'),actor=uuid('c'),conversation=uuid('d');
const binding={tenantId:tenant,actorId:actor,conversationId:conversation,runId:uuid('1'),attemptId:uuid('2'),workerId:uuid('3'),writerFence:1};
const legal={clientResolution:null,citationResolution:null};
const cases=[
 ['read_chat_attachments',{conversationId:conversation},{asOf:at,scope:{tenantId:tenant,userId:actor,conversationId:conversation,clientId:null,conversationVersion:at}},x=>{assert.equal(x.limit,10);assert.equal(x.conversationId,conversation);assert.equal(x.attachmentId,null);}],
 ['read_monday_client_boards',{clientId:' Client reference ',pageSize:'7'},{},x=>{assert.equal(x.clientId,'Client reference');assert.equal(x.pageSize,7);assert.equal(x.requireComplete,false);}],
 ['get_client_context',{clientId:'Example client'},{asOf:at,clientResolution:{selector:'Example client',clientId:client}},x=>{assert.equal(x.clientId,client);assert.equal(x.limit,25);assert.equal(x.representation,'summary');}],
 ['search_client_knowledge',{query:' topic '},{asOf:at},x=>{assert.equal(x.query,'topic');assert.equal(x.clientId,null);assert.equal(x.limit,8);}],
 ['query_knowledge_graph',{depth:'3tail'},{},x=>{assert.equal(x.depth,3);assert.equal(x.seed,null);}],
 ['search_memory',{k:'4.8'},{tenantId:tenant,userId:actor},x=>{assert.equal(x.k,4);assert.equal(x.query,null);}],
 ['search_research_sources',{query:' topic ',limit:'3'},{clientResolution:null},x=>{assert.equal(x.query,'topic');assert.equal(x.limit,3);assert.equal(x.clientId,null);}],
 ['search_legislative_research',{sessionKey:'2026'},legal,x=>{assert.equal(x.scope.sessionKey,'2026');assert.equal(x.scope.jurisdiction,'FL');assert.equal(x.query,'');}],
 ['get_legal_reference',{},legal,x=>{assert.equal(x.view,'references');assert.equal(x.scope.clientId,null);}],
 ['query_global_data',{dataset:'lda_registrations',select:[{agg:'count'}],limit:'3'},{defaultAsOf:at},x=>{assert.equal(x.limit,3);assert.equal(x.asOfDate,at);assert.match(x.snapshotSha256,/^[a-f0-9]{64}$/);}],
 ['search_committee_hearings',{committee:' Senate ',query:' hearing '},{tenantId:tenant,clientResolution:null},x=>{assert.equal(x.committeeName,'Senate');assert.equal(x.query,'hearing');assert.equal(x.recordsView,null);}],
 ['search_legiwatch_news',{view:'monitors'},{clientResolution:null,effectiveScope:null,windowAsOf:null,defaultYear:null,owner:{tenantId:tenant,clerkUserId:actor}},x=>{assert.equal(x.view,'monitors');assert.equal(x.scope,null);}],
 ['actions.query',{}, {binding,clientResolution:null},x=>{assert.equal(x.mode,'unscoped_list');assert.equal(x.selection.clientId,null);}],
];
const resolve=id=>retrieval.resolveOperationContract({id,version:'0.2.0'});
for(const [id,raw,context,check] of cases){
 test(`actual ${id} raw admission normalizer digest and closed context`,()=>{
  const c=resolve(id),normalized=c.normalizeInput(raw,context);check(normalized.input);
  assert.deepEqual(normalized.request,raw);assert.equal(normalized.argumentsSha256,canonicalSha256(normalized.input));
  assert.equal(Object.isFrozen(normalized),true);assert.equal(Object.isFrozen(normalized.input),true);
  const definition=c.descriptor.inputSchema.id.split('/').at(-1);retrieval.validateShape(definition,raw);
  assert.throws(()=>c.normalizeInput(raw,{...context,request:raw}));
  assert.throws(()=>c.normalizeInput({...raw,__trusted_context:context},context));
  for(const key of ['authoritative','sourceConnected','authorizationEstablished','producerQualified','absenceEvidence'])if(Object.hasOwn(normalized.metadata??{},key))assert.notEqual(normalized.metadata[key],true);
  assert.throws(()=>c.assertOutput({tool:'wrong'}, {request:raw,...context}));
 });
}
const pageCases=[
 ['search_client_knowledge',{query:' topic '},{asOf:at},{tool:'search_client_knowledge',generatedAt:at,results:[],note:'No client is linked to this conversation. Ask the user which client, or pass clientId.'}],
 ['query_knowledge_graph',{clientId:'not-a-uuid'},{},{error:'clientId must be a client UUID — pass the exact id, or omit it.'}],
 ['search_memory',{}, {tenantId:tenant,userId:actor},{error:'Provide a search query.'}],
 ['search_research_sources',{query:'topic'},{clientResolution:null},{tool:'search_research_sources',generatedAt:at,query:'topic',results:[]}],
 ['query_global_data',{dataset:'lda_registrations',select:[{agg:'count'}]},{defaultAsOf:at},{tool:'query_global_data',generatedAt:at,dataset:'lda_registrations',rowCount:0,rows:[]}],
 ['actions.query',{}, {binding,clientResolution:null},{tool:'query_action_items',generatedAt:at,total:0,actions:[]}],
];
for(const [id,raw,ctx,page] of pageCases)test(`actual ${id} output callback strips only request carrier`,()=>{
 const c=resolve(id);const result=c.assertOutput(page,{request:raw,...ctx});assert.deepEqual(result,page);assert.notEqual(result,page);
 assert.throws(()=>c.assertOutput({...page,grant:true},{request:raw,...ctx}));
 assert.throws(()=>c.assertOutput(page,{request:raw,...ctx,callerAuthority:true}));
});
test('client request references cannot substitute current trusted resolution or scope',()=>{
 assert.throws(()=>resolve('get_client_context').normalizeInput({clientId:client},{asOf:at,clientResolution:{selector:client,clientId:uuid('9')}}));
 assert.throws(()=>resolve('read_chat_attachments').normalizeInput({conversationId:uuid('9')},cases[0][2]));
 assert.throws(()=>resolve('search_research_sources').normalizeInput({query:'x',clientId:client},{clientResolution:{reference:client,clientId:uuid('9')}}));
 assert.throws(()=>resolve('actions.query').normalizeInput({clientId:client},{binding,clientResolution:{reference:client,clientId:uuid('9')}}));
});
test('partial action descriptor remains disabled while one full same-native successor owns mapping',()=>{
 const old=resolve('query_action_items'),next=resolve('actions.query'),original=catalog.originals.find(x=>x.id==='query_action_items');
 assert.equal(old.binding.nativeCoverage,'partial');assert.equal(old.binding.supersededBy,'actions.query');assert.equal(next.binding.nativeId,'query_action_items');assert.notEqual(next.binding.nativeCoverage,'partial');
 assert.deepEqual(old.descriptor.replacement,next.descriptor.operation);assert.deepEqual(original.replacement,next.descriptor.operation);assert.equal(original.state,'mapped');assert.deepEqual(old.descriptor.aliases,[]);
 assert.equal(old.descriptor.handler,null);assert.equal(old.descriptor.availability,'unimplemented');assert.throws(()=>old.normalizeInput({}, {actorId:actor}));
});
test('supersession mutations cannot broaden the concrete same-native replacement exception',()=>{
 const change=[
  c=>c.operations.find(x=>x.operation.id==='query_action_items').replacement=null,
  c=>c.operations.find(x=>x.operation.id==='query_action_items').replacement={id:'search_memory',version:'0.2.0'},
  c=>c.operations.find(x=>x.operation.id==='query_action_items').replacement={id:'actions.query',version:'0.1.0'},
  c=>c.operations.find(x=>x.operation.id==='query_action_items').aliases=['invented-alias'],
  c=>c.originals.find(x=>x.id==='query_action_items').replacement={id:'query_action_items',version:'0.2.0'},
  c=>{const o=c.originals.find(x=>x.id==='query_action_items');o.state='pending';o.replacement=null;},
  c=>c.operations.find(x=>x.operation.id==='actions.query').replacement={id:'query_action_items',version:'0.2.0'},
  c=>{c.operations=c.operations.filter(x=>x.operation.id!=='actions.query');},
 ];
 for(const mutate of change){const bad=structuredClone(catalog);mutate(bad);assert.throws(()=>retrieval.assertCatalog(bad));}
});
test('all original139/96selected/43deferred remain tracked with84typed/83mapped/13pending',()=>{
 const originals=catalog.originals;assert.equal(originals.length,139);assert.equal(new Set(originals.map(x=>x.id)).size,139);
 assert.equal(originals.filter(x=>x.state==='deferred').length,43);assert.equal(originals.filter(x=>x.state==='mapped').length,83);assert.equal(originals.filter(x=>x.state==='pending').length,13);assert.equal(catalog.operations.length,84);
 assert.equal(CATALOG_OPERATION_BINDINGS.length,84);retrieval.assertCatalog(catalog);
 for(const d of catalog.operations){assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);assert.deepEqual(d.retry.retryableCodes,[]);}
});
test('all84 actual production operations reject before authority source or budget ports',async()=>{
 let effects=0;const unexpected=async()=>{effects++;throw Error('unexpected port');};const limits={maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:100,maxCleanupMs:20};
 const gateway=createSourceDisabledGateway({authorityPorts:{verifyCapability:unexpected,currentRun:unexpected,authorizeBusiness:unexpected,authorizeSources:unexpected},budget:{reserve:unexpected,settle:unexpected,markUncertain:unexpected},limits,now:()=>Date.parse(at),newId:()=>uuid('9')});
 for(const d of catalog.operations)await assert.rejects(gateway.execute(JSON.stringify({operation:d.operation,arguments:{}}),'synthetic'),/UNAVAILABLE/);
 assert.equal(effects,0);assert.deepEqual(await gateway.discover(),[]);assert.equal(gateway.sourceEnabled,false);
});
test('private loader composes pending-only memory proposal through whole public command',()=>{
 const context={binding,conversationClientId:client};const argumentsData=commands.normalizeMemoryProposeInput({content:' remember ',scope:'client',ttlDays:0.5},context);
 assert.deepEqual(argumentsData,{content:'remember',key:null,scope:'client',clientId:client,ttlDays:0.5});
 const command={contractVersion:'0.1.0',commandId:uuid('5'),binding,action:'memory.propose',arguments:argumentsData,attachments:[],scopes:[{tenantId:tenant,kind:'client',resourceId:client,policyRevision:'p1'}],idempotencyKey:'synthetic'};
 commands.assertMemoryProposeCommand(command,context);const result={candidateId:uuid('6'),commandSha256:canonicalSha256(command),status:'pending'};
 assert.deepEqual(commands.assertMemoryProposeResult(result,command,context),result);
 assert.throws(()=>commands.assertMemoryProposeResult({...result,status:'committed'},command,context));
 assert.throws(()=>commands.assertMemoryProposeResult({...result,commandSha256:'f'.repeat(64)},command,context));
 assert.throws(()=>commands.assertMemoryProposeCommand({...command,binding:{...binding,writerFence:2}},context));
 assert.equal(typeof commands.normalizeTaskCreateInput,'function');assert.equal(typeof commands.normalizeArtifactFileInput,'function');
});
test('gateway lifetime extraction preserves shrink-only deadline error identity and exact uncertainty behavior',async()=>{
 let now=10,sequence=0;const scheduled=new Map(),cleared=[];const schedule=(fn,ms)=>{const id=++sequence;scheduled.set(id,{fn,ms});return id;},unschedule=id=>{cleared.push(id);scheduled.delete(id);};
 const life=createDispatchLifetime({deadlineMs:100,now:()=>now,schedule,unschedule,errorFactory:()=>Error('caller factory must not override gateway')});
 assert.equal(scheduled.get(1).ms,90);life.limitDeadline(50);assert.equal(scheduled.get(2).ms,40);life.limitDeadline(90);assert.equal(sequence,2);
 let release;const pending=life.run(()=>new Promise(resolve=>release=resolve));await Promise.resolve();assert.equal(life.pendingOperations(),1);scheduled.get(2).fn();
 await assert.rejects(pending,e=>e instanceof GatewayDenied&&e.message==='DEADLINE');assert.deepEqual(life.close(),{unsettledOperations:1,physicalStopProven:false});release('late');await Promise.resolve();await Promise.resolve();assert.equal(life.pendingOperations(),0);assert.equal(scheduled.size,0);
 let writes=0;await markBudgetUncertain({markUncertain:async id=>{assert.equal(id,'reservation');writes++;}},'reservation',20);assert.equal(writes,1);
 await assert.rejects(markBudgetUncertain({markUncertain:async()=>{throw Error('private');}},'reservation',20),e=>e instanceof GatewayDenied&&e.message==='BUDGET_UNCERTAIN');
});
test('lifetime cancellation suppresses not-yet-started work and removes owned timer',async()=>{
 const controller=new AbortController();let effects=0,clear=0;const life=createDispatchLifetime({deadlineMs:100,now:()=>1,signal:controller.signal,schedule:()=>1,unschedule:()=>clear++});
 const pending=life.run(()=>{effects++;return 'late';});controller.abort();await assert.rejects(pending,/CANCELLED/);assert.equal(effects,0);assert.equal(life.close().physicalStopProven,false);assert.equal(clear,1);
});

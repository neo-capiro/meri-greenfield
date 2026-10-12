/** Actual private resolver/authority/dispatcher, with synthetic source ports only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import * as contracts from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { createCurrentToolAuthority } from '../authorization/current-tool-authority.mjs';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { createRuntimeCatalog } from '../catalog/runtime-catalog.mjs';
import { createSourceDisabledGateway } from '../index.mjs';
import { fixture as baseFixture,NOW,uuid,limits } from './fixtures.mjs';

const operation={id:'query_action_items',version:'0.2.0'},clientId='synthetic-client',actionId=uuid('8');
const request=args=>JSON.stringify({operation,arguments:args});
function row(){
 const content={id:actionId,districtKey:null,clientId,clientName:'Synthetic Client',peCode:null,programId:null,deltaId:null,
  actionType:'protect_funding',issueTitle:'Synthetic issue',whatChanged:'Synthetic change',whyItMatters:'Synthetic relevance',
  recommendedAction:'Synthetic action',targetAudience:[],suggestedArtifactType:null,deadline:null,deadlineSource:null,
  ownerUserId:'synthetic-actor',priority:1,confidence:{},uncertainty:null,evidence:[],status:'new',dismissalReason:null,outcome:null,
  createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T12:00:00.000Z',title:'Synthetic issue',body:'Synthetic action'};
 return {...content,recordKind:'action_recommendation',recommendation:true,acceptedAsTask:false,
  nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'A recommendation is not an accepted task or delivery.'},
  sourceProof:{version:1,owner:'action_recommendation',sourceRecordId:actionId,currentClientId:clientId,
   sourceVersion:content.updatedAt,contentSha256:createHash('sha256').update(JSON.stringify(content)).digest('hex'),linkedSources:[]}};
}
function page(call){
 const selection=call.input,resumed=selection.cursorApplied,actions=[row()],page=resumed?2:1,total=resumed?50:1;
 const hasMore=page*selection.limit<total,complete=!resumed&&!hasMore;
 return {kind:'action-item-client-scoped-page',contractVersion:'0.2.0',operation,requestId:uuid('9'),traceId:uuid('a'),
  binding:structuredClone(call.authority.binding),subject:structuredClone(call.authority.subject),window:{basis:'unbounded'},argumentsSha256:call.argumentsSha256,
  appliedFilters:[],generatedAt:new Date(NOW).toISOString(),sources:[{sourceId:'action_recommendation',authority:'authoritative',
   snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:new Date(NOW).toISOString(),freshness:'unknown'}],
  coverage:{sourcesRequested:['action_recommendation'],sourcesChecked:['action_recommendation'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,
   returnedCount:1,truncated:!complete,historySupport:'bounded',limitations:['Synthetic pending source contract; no live source qualification.']},
  selection,order:selection.sort==='priority'?'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed':'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',
  snapshotVersionId:null,clientId,scope:{actionItemId:selection.actionItemId,status:selection.status,sort:selection.sort,page,limit:selection.limit,cursorApplied:resumed},
  total,returned:1,actions,pageCoverage:{sourceStatus:'healthy',sourceReason:null,complete,partial:!complete,paginationComplete:!hasMore,hasMore,
   nextCursor:hasMore?'synthetic-next':null,totalIsExactForScope:true,absenceSupported:false,note:'Bounded synthetic recommendations.'},
  continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
}
function fixture(){
 const f=baseFixture(),contract=contracts.resolveOperationContract(operation),descriptor=contract.descriptor;
 const scope={tenantId:f.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:f.claims.policyRevision};
 f.claims.scopes=[scope];f.state.grants=['tool.read'];
 const subject={...f.subject,kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]};
 f.state.policyInputs=[];
 f.ports.authorizeBusiness=async call=>{f.calls.push('policy');f.state.policyInputs.push(structuredClone(call.input));
  return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},
   operation:`${operation.id}@${operation.version}`,scopes:[scope],policyRevision:f.claims.policyRevision,evaluatedAt:new Date(f.state.now).toISOString(),
   decision:call.input.clientId===clientId&&!f.state.denied?'allowed':'denied',reasonCode:'SYNTHETIC_ONLY'},subject,grants:f.state.grants});};
 f.ports.authorizeSources=async()=>{f.calls.push('source-policy');return JSON.stringify({sourceIds:['action_recommendation'],enabled:f.state.sourceEnabled,
  policyRevision:f.claims.policyRevision,checkedAtMs:f.state.now});};
 const authority=createCurrentToolAuthority({ports:f.ports,now:()=>f.state.now,maxFactBytes:65536});
 const entry={descriptor,contract,async execute(call){f.calls.push('handler');f.state.handlerCall=call;
  const value=page(call);if(f.state.mutate)f.state.mutate(value);if(f.state.afterHandler)await f.state.afterHandler();return JSON.stringify(value);}};
 const dispatcher=()=>createToolDispatch({catalog:{entry:ref=>canonicalSha256(ref)===canonicalSha256(operation)?entry:null,discoverable:()=>[]},
  authority,budget:f.budget,limits,now:()=>f.state.now,newId:()=>uuid('7'),sourceEnabled:true});
 return {...f,subject,entry,run:(args={clientId},signal)=>dispatcher().execute(request(args),'synthetic',signal)};
}

test('actual resolver and authority deliver normalized client filters then validate proof-bound recommendation',async()=>{
 const f=fixture(),output=JSON.parse(await f.run({clientId:' synthetic-client ',actionItemId:actionId}));
 assert.equal(output.actions[0].id,actionId);assert.equal(output.actions[0].acceptedAsTask,false);assert.equal(output.evidenceReady,false);
 assert.equal(f.state.handlerCall.input.clientId,clientId);assert.equal(f.state.handlerCall.input.limit,20);
 assert.equal(f.state.handlerCall.argumentsSha256,canonicalSha256(f.state.handlerCall.input));
 assert.equal(f.state.handlerCall.authority.binding.actorId,f.binding.actorId);assert.equal(f.state.policyInputs.length,4);
 assert.ok(f.state.policyInputs.every(input=>input.clientId===clientId&&input.limit===20));
 assert.equal(f.calls.filter(x=>x==='handler').length,1);assert.equal(f.calls.filter(x=>x==='settle').length,1);
});
test('existing opaque cursor mode crosses actual normalization with honest partial coverage',async()=>{
 const f=fixture(),result=JSON.parse(await f.run({clientId,cursor:' opaque ',sort:'priority'}));
 assert.equal(f.state.handlerCall.input.page,null);assert.equal(f.state.handlerCall.input.cursorApplied,true);
 assert.equal(f.state.handlerCall.request.cursor,' opaque ');assert.equal(result.scope.page,2);
 assert.equal(result.coverage.enumeration,'unknown');assert.equal(result.coverage.truncated,true);assert.equal(result.evidenceReady,false);
});
for(const args of [{},{clientId:null},{actionItemId:actionId},{clientId,limit:51},{clientId,actorId:'other'}])test(`unsupported model request refuses before reservation or handler: ${JSON.stringify(args)}`,async()=>{
 const f=fixture();await assert.rejects(f.run(args));assert.equal(f.calls.includes('reserve'),false);assert.equal(f.calls.includes('handler'),false);
});
for(const mutate of [f=>f.state.denied=true,f=>f.state.sourceEnabled=false,f=>f.state.grants=[],f=>f.state.revoked=true,f=>f.state.fence=2])test('current policy/source/grant/revocation/fence refusal precedes source handler',async()=>{
 const f=fixture();mutate(f);await assert.rejects(f.run(),/ACCESS_DENIED/);assert.equal(f.calls.includes('handler'),false);assert.equal(f.calls.includes('reserve'),false);
});
test('foreign requested client is a request, not an authorization grant',async()=>{
 const f=fixture();await assert.rejects(f.run({clientId:'other-client'}),/ACCESS_DENIED/);assert.equal(f.calls.includes('handler'),false);
});
for(const [name,mutate]of Object.entries({
 actor:p=>p.binding.actorId='foreign',tenant:p=>p.subject.tenantId='foreign',fence:p=>p.binding.writerFence++,
 client:p=>p.clientId='foreign',subject:p=>p.subject.authorizationDecisionId=uuid('b'),
 content:p=>p.actions[0].title='tampered',proof:p=>p.actions[0].sourceProof.contentSha256='a'.repeat(64),
 acceptedTask:p=>p.actions[0].acceptedAsTask=true,completed:p=>p.actions[0].nativeCompletion.completed=true,
 delivery:p=>p.actions[0].nativeCompletion.establishesDeliveryOrAcceptance=true,evidence:p=>p.evidenceReady=true,
 absence:p=>p.negativeAssertion={kind:'absence'},enumeration:p=>p.coverage.enumeration='complete',fresh:p=>p.sources[0].freshness='fresh',
}))test(`actual action result validation rejects ${name} substitution`,async()=>{
 const f=fixture();f.state.mutate=mutate;await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);assert.ok(f.calls.includes('uncertain'));
});
test('post-handler revocation prevents settlement/result release and retains uncertain budget',async()=>{
 const f=fixture();f.state.afterHandler=()=>{f.state.revoked=true;};await assert.rejects(f.run(),/ACCESS_DENIED/);
 assert.equal(f.calls.includes('settle'),false);assert.ok(f.calls.includes('uncertain'));
});
test('cancellation after source work prevents result release',async()=>{
 const f=fixture(),controller=new AbortController();f.state.afterHandler=()=>controller.abort();await assert.rejects(f.run({clientId},controller.signal),/CANCELLED/);
 assert.equal(f.calls.includes('settle'),false);assert.ok(f.calls.includes('uncertain'));
});
test('unknown settlement never releases a validated action result',async()=>{
 const f=fixture();f.budget.settle=async()=>{f.calls.push('settle');throw Error('synthetic lost ACK');};
 await assert.rejects(f.run());assert.ok(f.calls.includes('uncertain'));
});
test('production catalog and gateway remain unavailable despite the new private contract',async()=>{
 const f=fixture(),view=createRuntimeCatalog({catalogJson:JSON.stringify(catalog),contracts});
 assert.equal(view.entry(operation),null);assert.deepEqual(view.discoverable(),[]);
 const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')});
 await assert.rejects(gateway.execute(request({clientId}),'synthetic'),/UNAVAILABLE/);
 assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);assert.deepEqual(f.calls,[]);
});

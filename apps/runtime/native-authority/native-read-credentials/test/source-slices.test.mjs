/** Actual CONTROL/gateway owners over synthetic HTTP JSON and scripted SQL; no live source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {nativeFamilyCase,SOURCE_SLICE_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {prepareNativeReadContext} from '../../../../gateway/dispatch/native-read-context.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {ownerFixture,uuid} from './fixture.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';

const clientId='99999999-9999-4999-8999-999999999999',foreign=uuid('a');
const read=async f=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof())).context;
const make=scene=>ownerFixture(scene.operation.id,{scene});
async function mounted(scene,{missingNameReader=false}={}){
 const f=await make(scene),{getCredentials,authorizeResultForCall,...transport}=f.transport;
 if(missingNameReader){const {readClientReference,...coreAuthority}=f.configuration.coreAuthority;f.owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority});}
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const mount=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 return {...f,invoke:()=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'source-slice'})};
}
function scoped(scene,id=clientId){
 const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'client',resourceId:id,policyRevision:a.policyRevision};
 Object.assign(a.subject,{kind:'client',entityType:'client',entityIds:[id],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];scene.visibleClientIds=[id];return scene;
}
function beforeSource(f){
 assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);
 for(const invocation of f.state.produced.values()){assert.equal(invocation.reservation_id,null);assert.equal(invocation.arguments_sha256,null);assert.equal(invocation.completion,null);}
}

test('source slice fixtures enumerate twelve native operations across nine families',()=>{
 assert.equal(SOURCE_SLICE_CASES.length,12);assert.equal(new Set(SOURCE_SLICE_CASES.map(([family])=>family)).size,9);
 assert.equal(new Set(SOURCE_SLICE_CASES.map(([,id])=>id)).size,12);
});

for(const [family,id,selectors] of [
 ['tracked-bills','search_tracked_bills',[{clientId:'Synthetic client'}]],
 ['public-domain-hearings','search_committee_hearings',[{clientId:'Synthetic client'}]],
 ['research-legal-legislation','search_legislative_research',[{clientId:'Synthetic client'}]],
 ['research-legal-legislation','get_legal_reference',[{folderId:'synthetic-folder'},{clientId:'Synthetic client'},{citation:'Fla. Stat. 1.10'}]],
 ['research-legal-news','search_legiwatch_news',[{view:'source',kind:'news',id:'synthetic-source',clientId:'Synthetic client'},{view:'source',kind:'news',id:'synthetic-source',folderId:' '},{view:'news'},{view:'monitors'},{},{view:'personnel'},{view:'personnel',year:null}]],
])test(`${id}: unsupported source selectors refuse before native credentials, reservation and HTTP`,async()=>{
 for(const selector of selectors){
  const scene=nativeFamilyCase(family,id);scene.arguments={...selector};
  const f=await mounted(scene,{missingNameReader:['tracked-bills','public-domain-hearings'].includes(family)||id==='search_legislative_research'});
  try{
   await assert.rejects(read(f),{message:'UNAVAILABLE'});
   // The current business-authority fixture rejects a name under an already selected UUID before CONTROL is called.
   await assert.rejects(f.invoke(),{message:family==='tracked-bills'?'ACCESS_DENIED':'UNAVAILABLE'});
   beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);
  }
  finally{f.scope.abort();}
 }
});

for(const [label,request,visible] of [
 ['UUID client',{clientId},[clientId]],['client seed',{seed:`client:${clientId}`},[clientId]],
 ['UUID client and seed',{clientId,seed:`client:${clientId}`},[clientId]],
])test(`graph ${label}: exact current visible selector reaches fixed native route and settles`,async()=>{
 const scene=nativeFamilyCase('client-knowledge-search','query_knowledge_graph',{request});scene.visibleClientIds=visible;
 const f=await mounted(scene);
 try{const raw=await f.invoke(),out=JSON.parse(raw);assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,request);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}
 finally{f.scope.abort();}
});

for(const request of [{clientId},{seed:`client:${clientId}`}])test(`graph ${Object.hasOwn(request,'clientId')?'UUID selector':'client seed'}: absent current visibility refuses before reservation`,async()=>{
 const f=await mounted(nativeFamilyCase('client-knowledge-search','query_knowledge_graph',{request}));f.core.state.clientIds=[];
 try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});beforeSource(f);}
 finally{f.scope.abort();}
});

for(const [family,id,request] of [
 ['client-knowledge-search','query_knowledge_graph',{clientId}],
 ['client-knowledge-search','query_knowledge_graph',{clientId,seed:`client:${clientId}`}],
 ['public-domain-hearings','search_committee_hearings',{clientId}],
 ['tracked-bills','search_tracked_bills',null],
 ['outreach-query','query_outreach',null],
])test(`${id}: current visibility cannot repair an incoherent client subject or scope`,async()=>{
 for(const mode of ['foreign-client','multiple-clients','private-scope']){
  const scene=nativeFamilyCase(family,id,request?{request}:{}),selected=scene.authority.subject.entityIds[0];
  scene.visibleClientIds=[selected,clientId,foreign].filter((value,index,all)=>all.indexOf(value)===index);
  if(mode==='foreign-client')scene.authority.subject.entityIds=[foreign];
  if(mode==='multiple-clients')scene.authority.subject.entityIds=[selected,foreign];
  if(mode==='private-scope'){
   const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};
   a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];
  }
  const f=await make(scene);
  try{await assert.rejects(read(f),{message:mode==='multiple-clients'?'UNAVAILABLE':'ACCESS_DENIED'});beforeSource(f);}
  finally{f.scope.abort();}
 }
});

for(const [family,id] of [['client-knowledge-search','query_knowledge_graph'],['public-domain-hearings','search_committee_hearings'],['research-legal-legislation','search_legislative_research'],['research-legal-legislation','get_legal_reference'],['research-legal-news','search_legiwatch_news']])test(`${id}: a client subject cannot open the global or unscoped source branch`,async()=>{
 const f=await mounted(scoped(nativeFamilyCase(family,id)));
 try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});beforeSource(f);}
 finally{f.scope.abort();}
});

for(const request of [
 {view:'source',kind:'news',id:'synthetic-source'},
 {view:'source',kind:'budget',id:'synthetic-budget'},
 {view:'source',kind:'personnel',id:'synthetic-personnel'},
 {view:'source',kind:'research',id:'synthetic-research'},
 {view:'personnel',year:2026},
])test(`legal news ${request.view}/${request.kind??request.year}: request-determined five-field context preserves typed native source`,async()=>{
 const f=await mounted(nativeFamilyCase('research-legal-news','search_legiwatch_news',{request}));
 try{
  const out=JSON.parse(await f.invoke());assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{clientResolution:null,effectiveScope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},windowAsOf:null,defaultYear:null,owner:null});
  assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{f.scope.abort();}
});

test('hearing UUID context is current tenant/client selection and remains the exact receiving proof',async()=>{
 const f=await mounted(nativeFamilyCase('public-domain-hearings','search_committee_hearings',{request:{clientId}}));
 try{const out=JSON.parse(await f.invoke());assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{tenantId:f.binding.tenantId,clientResolution:{reference:clientId,clientId}});assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,{clientId});}
 finally{f.scope.abort();}
});

test('outreach explicit UUID list preserves raw filters and exact current client resolution without a detail/global fallback',async()=>{
 const scene=nativeFamilyCase('outreach-query','query_outreach'),selected=scene.arguments.clientId;
 const request={clientId:` ${selected} `,status:' draft ',limit:'2.8'},f=await mounted(nativeFamilyCase('outreach-query','query_outreach',{request}));
 try{
  const out=JSON.parse(await f.invoke());assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{clientResolution:{reference:selected,clientId:selected}});
  assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));assert.equal(Object.hasOwn(out.result,'record'),false);
  assert.ok(out.result.campaigns.every(row=>row.clientId===selected));assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{f.scope.abort();}
});

test('outreach any own detail key and absent, blank, named or malformed client refuse before native credentials and reservation',async()=>{
 const valid=nativeFamilyCase('outreach-query','query_outreach').arguments;
 const requests=[...['synthetic-outreach',null,'',' '].map(outreachId=>({...valid,outreachId})),{},
  {clientId:null},{clientId:''},{clientId:' '},{clientId:'Synthetic client'},{clientId:'not-a-client-uuid'}];
 for(const request of requests){
  const scene=nativeFamilyCase('outreach-query','query_outreach');scene.arguments=request;const f=await mounted(scene);
  try{
   await assert.rejects(read(f),{message:'UNAVAILABLE'});
   // Current business authority refuses any supplied string that differs from its selected UUID before CONTROL.
   const mismatch=typeof request.clientId==='string'&&request.clientId.trim()!==valid.clientId;
   await assert.rejects(f.invoke(),{message:mismatch?'ACCESS_DENIED':'UNAVAILABLE'});
   beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);
  }finally{f.scope.abort();}
 }
});

for(const mode of ['no-current-visibility','foreign-client-scope','personal-subject','portfolio-subject'])test(`outreach ${mode}: an explicit UUID grants no campaign access`,async()=>{
 const scene=nativeFamilyCase('outreach-query','query_outreach'),a=scene.authority,selected=scene.arguments.clientId;
 scene.visibleClientIds=[selected,foreign];
 if(mode==='foreign-client-scope'){
  const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];
 }
 if(mode==='personal-subject')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
 if(mode==='portfolio-subject')Object.assign(a.subject,{kind:'portfolio',entityType:'client',entityIds:[selected,foreign],rosterVersionId:uuid('d')});
 const f=await mounted(scene);if(mode==='no-current-visibility')f.core.state.clientIds=[];
 try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});beforeSource(f);}
 finally{f.scope.abort();}
});

test('outreach client visibility revocation after native source withholds the result and leaves its hold UNKNOWN',async()=>{
 const f=await mounted(nativeFamilyCase('outreach-query','query_outreach'));f.state.afterSource=()=>f.core.state.clientIds=[];
 try{
  await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);
  const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');assert.equal(reservation.hold_micro_usd,1);assert.equal(reservation.output_bytes,null);assert.equal(reservation.charged_micro_usd,null);
  assert.equal([...f.state.produced.values()][0].completion,null);assert.equal(f.state.budget.consumed_micro_usd,0);
 }finally{f.scope.abort();}
});

test('outreach receiving rejects foreign-client campaign rows without emitting completion bytes',async()=>{
 const f=await mounted(nativeFamilyCase('outreach-query','query_outreach'));f.state.resultMutator=page=>page.campaigns[0].clientId=foreign;
 try{
  await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');assert.equal(reservation.output_bytes,null);assert.equal(reservation.charged_micro_usd,null);assert.equal([...f.state.produced.values()][0].completion,null);
 }finally{f.scope.abort();}
});

test('tracked context retains exactly three fresh lineage fields across decision rotation and rejects stale or extra context',async()=>{
 const f=await make(nativeFamilyCase('tracked-bills','search_tracked_bills')),life=createOperationLifetime({now:f.now,deadlineMs:f.deadlineMs,signal:f.scope.signal,errorFactory:code=>Error(code)});
 try{
  const config={entry:{contract:f.contract,descriptor:f.contract.descriptor},request:f.request,authority:f.authority,ports:f.owner.nativeReadContextPorts,lifetime:life,readDeadline:()=>f.deadlineMs,now:f.now,maxBytes:1048576};
  const context=await prepareNativeReadContext(config),first=context.options();assert.deepEqual(Object.keys(first).sort(),['binding','subject','clientReference'].sort());
  assert.equal(first.clientReference,f.request.clientId.trim().slice(0,80));
  const next={...f.authority,subject:{...f.authority.subject,authorizationDecisionId:uuid('a')}};
  await context.observeAuthority(next);assert.deepEqual(context.options(next),{binding:f.binding,subject:next.subject,clientReference:first.clientReference});
  for(const mode of ['stale-decision','extra-key','different-reference']){
   const ports={async readCurrent(call){const r=JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(call));if(mode==='stale-decision')r.context.subject.authorizationDecisionId=uuid('d');else if(mode==='extra-key')r.context.defaultCongress=119;else r.context.clientReference='Synthetic client';return JSON.stringify(r);}};
   await assert.rejects(prepareNativeReadContext({...config,ports}),{message:'ACCESS_DENIED'});
  }
  assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);
 }finally{life.close();f.scope.abort();}
});

/** Offline current-membership/SQL protocol checks. No native database, provider or source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNativeToolAuthority} from '../core-client.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {prepareNativeReadContext} from '../../../../gateway/dispatch/native-read-context.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {storedCase as facilityCase,clientId} from '../../../../gateway/sources/facility-representation/test/fixture.mjs';
import {storedCase as districtCase} from '../../../../gateway/sources/district-nexus/test/fixture.mjs';
import {storedCase as marketCase,ids as marketIds} from '../../../../gateway/sources/federal-market/test/fixture.mjs';
import {storedCase as queryCase} from '../../../../gateway/sources/public-domain-query/test/fixture.mjs';
import {storedCase as dataSearchCase} from '../../../../gateway/sources/data-search/test/fixture.mjs';
import {storedCase as graphCase} from '../../../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {coreFixture,ownerFixture,uuid} from './fixture.mjs';

const read=async(f,proof=f.proof(),owner=f.owner)=>JSON.parse(await owner.nativeReadContextPorts.readCurrent(proof));
const make=scene=>ownerFixture(scene.operation.id,{scene});

test('real native client carries an immutable current visible roster; old private fake-port shape remains admitted',async()=>{
 const f=coreFixture();f.state.clientIds=[clientId];const current=await f.client.readCurrent(f.request());
 assert.deepEqual(current.clientIds,[clientId]);f.state.clientIds.push(uuid('d'));assert.deepEqual(current.clientIds,[clientId]);assert.ok(Object.isFrozen(current.clientIds));
 const {clientIds,...old}=current;assert.doesNotThrow(()=>assertNativeToolAuthority(old,{started:f.now(),now:f.now}));
 for(const clientIds of [[clientId,clientId],['invalid'],[uuid('a').toUpperCase()],null]){
  assert.throws(()=>assertNativeToolAuthority({...old,clientIds},{started:f.now(),now:f.now}));
 }
});

for(const scene of [()=>facilityCase(),()=>districtCase(),()=>districtCase('get_district_nexus_changes')])test(`${scene().operation.id}: current native client visibility joins original client subject without leaking roster`,async()=>{
 const f=await make(scene()),r=await read(f);assert.deepEqual(r.context,{binding:f.binding,subject:f.authority.subject});assert.equal(Object.hasOwn(r,'clientIds'),false);
 const credentials=await f.owner.getCredentials(f.credentials(r.context));assert.equal(Object.hasOwn(credentials,'clientIds'),false);assert.equal(Object.hasOwn(credentials,'native'),false);
 assert.deepEqual(credentials.normalizationContext,r.context);assert.ok(f.stateOwner.secrets>0);
});

test('facility missing-selector note remains possible without injecting a client',async()=>{
 const f=await make(facilityCase(undefined,{request:{}})),r=await read(f);
 const credentials=await f.owner.getCredentials(f.credentials(r.context));assert.deepEqual(f.request,{});assert.equal(f.contract.normalizeInput(f.request,r.context).input.clientId,null);assert.equal(credentials.normalizationContext.subject.entityIds[0],clientId);
});

for(const [label,changes] of [['absent visibility',f=>f.core.state.clientIds=[]],['foreign subject',f=>f.authority.subject.entityIds=[uuid('a')]]])test(`facility ${label} refuses before credentials or source`,async()=>{
 const f=await make(facilityCase());changes(f);await assert.rejects(read(f));assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
});

test('a legacy fake port without client proof cannot admit a scoped family',async()=>{
 const f=await make(facilityCase()),original=f.configuration.coreAuthority;
 const owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority:{available:true,origin:original.origin,async readCurrent(call){const {clientIds,...rest}=await original.readCurrent(call);return rest;}}});
 await assert.rejects(read(f,f.proof(),owner),{message:'UNAVAILABLE'});assert.equal(f.stateOwner.secrets,0);
});

test('lineage decision IDs refresh while stable current client identity remains pinned',async()=>{
 const f=await make(facilityCase()),first=await read(f),next=structuredClone(f.authority.subject);next.authorizationDecisionId=uuid('a');
 const second=await read(f,{...f.proof(),subject:next});assert.notEqual(second.context.subject.authorizationDecisionId,first.context.subject.authorizationDecisionId);assert.deepEqual(second.context.subject,next);
 const old=f.authority.subject;f.authority.subject=next;f.authority.decision.decisionId=next.authorizationDecisionId;
 try{const credentials=await f.owner.getCredentials(f.credentials(second.context));assert.deepEqual(credentials.subject,next);assert.deepEqual(credentials.normalizationContext.subject,next);}finally{f.authority.subject=old;}
});

test('gateway lineage refresh rejects stale context decisions but accepts fresh same-selection decisions',async()=>{
 const f=await make(facilityCase()),life=createOperationLifetime({now:f.now,deadlineMs:f.deadlineMs,signal:f.scope.signal,errorFactory:code=>Error(code)});
 try{
  const config={entry:{contract:f.contract,descriptor:f.contract.descriptor},request:f.request,authority:f.authority,ports:f.owner.nativeReadContextPorts,lifetime:life,readDeadline:()=>f.deadlineMs,now:f.now,maxBytes:1048576};
  const context=await prepareNativeReadContext(config),next={...f.authority,subject:{...f.authority.subject,authorizationDecisionId:uuid('a')}};
  await context.observeAuthority(next);assert.deepEqual(context.options(next),{binding:f.binding,subject:next.subject});
  const stale={async readCurrent(call){const r=JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(call));r.context.subject={...r.context.subject,authorizationDecisionId:uuid('d')};return JSON.stringify(r);}};
  await assert.rejects(prepareNativeReadContext({...config,ports:stale}),{message:'ACCESS_DENIED'});
 }finally{life.close();}
});

for(const change of [f=>f.core.state.clientIds=[],f=>f.core.state.clientIds=[clientId,uuid('a')],f=>f.core.state.membershipRevision='d'.repeat(64)])test('client set or membership revision drift cannot renew scoped credentials',async()=>{
 const f=await make(facilityCase()),first=await read(f);change(f);await assert.rejects(f.owner.getCredentials(f.credentials(first.context)));assert.equal(f.stateOwner.secrets,0);
});

for(const id of marketIds)test(`${id}: explicit market client is a current resource selector, never a visibility grant`,async()=>{
 const request={clientId,...(id==='get_district_federal_market'?{state:'NY',district:'AL'}:{})},f=await make(marketCase(id,{request}));
 const r=await read(f);assert.deepEqual(r.context,{});
 const foreign=uuid('a');f.authority.subject.entityIds=[foreign];f.core.state.clientIds=[clientId,foreign];await assert.rejects(read(f));assert.equal(f.stateOwner.secrets,0);
});

test('forecast rows remain global while any supplied client selector still requires current visibility',async()=>{
 const f=await make(marketCase('search_procurement_forecasts'));f.core.state.clientIds=[];assert.deepEqual((await read(f)).context,{});
 const selected=await make(marketCase('search_procurement_forecasts',{request:{clientId}}));selected.core.state.clientIds=[];
 await assert.rejects(read(selected));assert.equal(selected.contract.normalizeInput(selected.request,{}).metadata.queryScope,'global_public');
});

for(const id of marketIds)test(`${id}: omitted client selector keeps the canonical global branch under a current client subject`,async()=>{
 const scene=marketCase(id,{request:{clientId,...(id==='get_district_federal_market'?{state:'NY',district:'AL'}:{})}});delete scene.arguments.clientId;
 const f=await make(scene);f.core.state.clientIds=[];assert.deepEqual((await read(f)).context,{});
 assert.equal(Object.hasOwn(f.contract.normalizeInput(f.request,{}).input,'clientId'),false);
});

for(const subject of [s=>({...s,kind:'portfolio'}),s=>({...s,entityIds:[clientId,uuid('a')]})])test('market selector cannot borrow an alternate or multiple client subject',async()=>{
 const f=await make(marketCase('search_procurement_forecasts',{request:{clientId}}));f.authority.subject=subject(f.authority.subject);
 await assert.rejects(read(f));assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);
});

test('data-search canonical raw selector is admitted without substituting a normalized request',async()=>{
 const f=await make(dataSearchCase()),r=await read(f),credentials=await f.owner.getCredentials(f.credentials(r.context));
 assert.deepEqual(r.context,{});assert.deepEqual(f.request,{query:'synthetic work',domains:['strategies_work','mail'],pageSize:2});
 assert.equal(credentials.requestSha256,f.proof().requestSha256);assert.equal(f.stateOwner.secretProof.requestSha256,f.proof().requestSha256);
});

test('implicit global-query as-of is captured once; rechecks and credentials cannot advance it',async()=>{
 const request={dataset:'lda_registrations',select:[{field:'client_name'}]},f=await make(queryCase(undefined,{request})),first=await read(f);
 assert.equal(first.context.defaultAsOf,new Date(f.now()).toISOString());f.state.now+=27;
 const second=await read(f);assert.deepEqual(second.context,first.context);const credentials=await f.owner.getCredentials(f.credentials(second.context));assert.deepEqual(credentials.normalizationContext,first.context);
 const fresh=await read(f,{...f.proof(),signal:new AbortController().signal});assert.equal(fresh.context.defaultAsOf,new Date(f.now()).toISOString());assert.notEqual(fresh.context.defaultAsOf,first.context.defaultAsOf);
});

for(const request of [{dataset:'federal_grants',select:[{field:'agency'}]},{dataset:'lda_registrations',select:[{field:'client_name'}],asOfDate:'2026-01-01T00:00:00Z'}])test('explicit or unsupported global-query default remains null',async()=>{
 const f=await make(queryCase(undefined,{request}));assert.deepEqual((await read(f)).context,{defaultAsOf:null});
});

test('graph retains its empty context without acquiring the semantic observation clock',async()=>{
 const f=await make(graphCase(undefined,{request:{clientId}}));
 try{const first=await read(f);assert.deepEqual(first.context,{});f.state.now+=37;assert.deepEqual((await read(f)).context,{});const credentials=await f.owner.getCredentials(f.credentials({}));assert.deepEqual(credentials.normalizationContext,{});}
 finally{f.scope.abort();}
});

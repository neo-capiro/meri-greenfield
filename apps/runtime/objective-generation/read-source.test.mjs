/** Actual control read dispatcher and existing source handlers; Core owner replies are synthetic, not a live acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {runStartFixture,NOW,id} from '../objective-source/test/run-start-fixture.mjs';
import {storedCase,storedPage,ids as fundingIds} from '../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {createObjectiveReadSource} from './read-source.mjs';
import {createRunCapabilityPolicy,PROPOSED_PREVIEW_CAPABILITY_PLATFORM,projectCapabilityRole} from '../product-ports/capability-policy.mjs';

async function fixture(operationId=fundingIds[0],{routine=false,general=false}={}){
 const funding=fundingIds.includes(operationId),scene=funding?storedCase(operationId):billTextCase(operationId),f=runStartFixture({clientId:funding?scene.arguments.clientId:id(3)});
 scene.state.now=NOW;
 const binding=f.binding,policyRevision='policy1',scopes=[{tenantId:f.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:f.clientId,policyRevision}],operation=scene.operation;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:NOW+10000,runtimeSessionId:'synthetic-objective-session-000000001'});
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const state={calls:[],currentReads:0,revoked:false,sourceDenied:false,role:'user_admin',tenantPolicy:{},roleExpiry:f.record.effectExpiresAtMs};
 const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);platform.roleCeilings.standard_user.generalReads=false;
 for(const policy of [platform.maximum,platform.defaults,...Object.values(platform.roleCeilings)])policy.activeReadOperations=[operation];
 const composer=await createControlReadsComposer({coreOrigin:'https://core.synthetic.invalid',familyIds:[scene.family],defaultCongress:119,
  nativeCredentials:{nativeCredentialFor(){throw Error('BACKGROUND_MUST_NOT_BORROW_INTERACTIVE_CREDENTIAL');}},
  readSecret:async()=>Buffer.from('synthetic-control-service-secret'),serviceSecretFile:'synthetic',now:()=>scene.state.now,newId:()=>id(99),
  capabilityPolicy:createRunCapabilityPolicy({platform,readTenantSettings:async()=>state.tenantPolicy}),
  fetchImpl:async(url,options)=>{
   const body=JSON.parse(options.body);state.calls.push(body);
   assert.equal(url,'https://core.synthetic.invalid/api/internal/'+(routine?'routines':'objective-generation')+'/reads');assert.equal(options.headers.authorization,undefined);
   assert.equal(options.headers['x-internal-service-secret'],'synthetic-control-service-secret');if(routine){assert.equal(body.scheduleId,id(90));assert.equal(body.occurrenceKey,'a'.repeat(64));}else assert.equal(body.generationJobId,f.generationJobId);
   assert.deepEqual(body.context.binding,binding);assert.deepEqual(body.context.subject.entityIds,[general?binding.actorId:f.clientId]);assert.equal(body.context.policyRevision,policyRevision);
   if(state.sourceDenied)return Response.json({error:'denied'},{status:403});
   assert.equal(body.operation,operation.id);
   if(funding){const context=body.context.normalizationContext;scene.state.page=storedPage(operationId,scene.contract.normalizeInput(body.input,context).input,context.asOf,new Date(NOW-60000).toISOString());}
   return scene.transport.fetchImpl('https://source.synthetic.invalid/api/clio/tools/'+body.operation,{method:'POST',body:JSON.stringify(body.input)});
  }});
 const objectiveCore={async forBinding({binding:requested}){assert.deepEqual(requested,binding);state.currentReads++;if(state.revoked)throw Error('REVOKED');return {record:f.record,current:{role:state.role,clientId:f.clientId,checkedAtMs:scene.state.now,effectExpiresAtMs:state.roleExpiry}};}};
 const routineCore={origin:'https://core.synthetic.invalid',getServiceSecret:async()=> 'synthetic-control-service-secret',async forBinding({binding:requested}){assert.deepEqual(requested,binding);state.currentReads++;if(state.revoked)throw Error('REVOKED');return {
  record:{binding,scopes,selectedClientId:general?null:f.clientId,policyRevision,scheduleId:id(90),occurrenceKey:'a'.repeat(64),generation:1,maxCostMicroUSD:1000,expiresAtMs:identity.expiresAtMs},current:{role:state.role,clientIds:[f.clientId],checkedAtMs:scene.state.now,effectExpiresAtMs:state.roleExpiry},
 };}};
 const execution={async authenticate(){if(state.revoked)throw Error('REVOKED');return {execution:identity,state:'running',scopes,selectedClientId:general?null:f.clientId,policyRevision};}};
 const readCapabilityRole=async call=>{const started=scene.state.now,job=await (routine?routineCore:objectiveCore).forBinding(call);
  return projectCapabilityRole({role:job.current.role,checkedAtMs:job.current.checkedAtMs,expiresAtMs:Math.min(job.current.effectExpiresAtMs,routine?job.record.expiresAtMs:job.record.effectExpiresAtMs)},{started,now:scene.state.now});};
 const app=composer.createReadsRuntime({execution,binding,approvedReads,readCapabilityRole,...(routine?{routineCore}:{objectiveCore})});
 const request=(kind,body)=>new Request('https://control.synthetic.invalid/v1/runner/reads/'+kind,{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify(body)});
 async function execute(args=scene.arguments){
  const availability=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(availability.status,200,await availability.clone().text());const a=await availability.json();
  return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:args,deliveryId:'synthetic',installationId:a.installation.installationId,executionCatalogSha256:a.installation.executionCatalogSha256}));
 }
 return {scene,f,state,execute};
}

for(const operation of [...fundingIds,'read_bill_text','search_congress_bills'])test('routine '+operation+' reuses typed normalization and source adapter without bearer',async()=>{
 const x=await fixture(operation,{routine:true}),r=await x.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(x.state.calls.length,1);
 const denied=await fixture(operation,{routine:true});denied.state.sourceDenied=true;assert.notEqual((await denied.execute()).status,200);
});
test('General routine public-data normalization uses actor scope with no synthetic client',async()=>{
 const x=await fixture('search_congress_bills',{routine:true,general:true}),r=await x.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(x.state.calls[0].context.subject.kind,'personal');
});

for(const operation of [...fundingIds,'read_bill_text','search_congress_bills']){
 test(operation+': accepted job uses existing typed handler and actual job transport, without chat credentials',async()=>{
  const x=await fixture(operation),r=await x.execute();assert.equal(r.status,200,await r.clone().text());
  assert.equal(x.state.calls.length,1);assert.equal(x.state.currentReads,4,'two snapshots per request reuse the first forBinding observation, without a redundant third read');
  const result=JSON.parse((await r.json()).resultJson);assert(result&&typeof result==='object');
  if(fundingIds.includes(operation))assert.equal(x.state.calls[0].context.normalizationContext.asOf,new Date(NOW).toISOString());
 });
 test(operation+': Core denial and execution revocation never release source bytes',async()=>{
  const denied=await fixture(operation);denied.state.sourceDenied=true;const d=await denied.execute();assert.equal(d.status,403,await d.clone().text());
  const revoked=await fixture(operation);revoked.scene.state.afterSource=()=>{revoked.state.revoked=true;};const r=await revoked.execute();assert.equal(r.status,403,await r.clone().text());
 });
}
test('foreign selected client and malformed native output cannot become a background success',async()=>{
 const x=await fixture(),r=await x.execute({...x.scene.arguments,clientId:id(88)});assert.notEqual(r.status,200);assert.equal(x.state.calls.length,0);
 const y=await fixture();y.scene.state.responseFactory=()=>Response.json({unexpected:'synthetic'});const bad=await y.execute();assert.notEqual(bad.status,200);
});
test('job source boundary refuses foreign binding/subject, expiry, compression, redirects and oversized replies',async()=>{
 const f=runStartFixture(),subject={kind:'client',entityType:'client',entityIds:[f.clientId],tenantId:f.tenantId,actorId:f.actorId,policyRevision:'policy1',scopes:[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}],rosterVersionId:null};
 const base={record:f.record,policyRevision:'policy1',origin:'https://core.synthetic.invalid',getServiceSecret:async()=> 'synthetic-objective-service-secret',now:()=>NOW,maxRequestMs:50};
 const call={operation:'search_funding_opportunities',input:{},context:{binding:f.binding,subject,policyRevision:'policy1',normalizationContext:null},deadlineMs:NOW+1000};
 let calls=0;const read=createObjectiveReadSource({...base,fetchImpl:async()=>{calls++;return Response.json({ok:true});}});
 for(const operation of ['search_funding_opportunities','mail.read_thread','memory.list_own_proposals','search_memory_eligibility','get_client_context'])assert.deepEqual(await read({...call,operation}),{ok:true});
 assert.equal(calls,5);calls=0;
 await assert.rejects(read({...call,operation:'unknown.operation'}));
 await assert.rejects(read({...call,context:{...call.context,binding:{...f.binding,actorId:id(88)}}}));
 await assert.rejects(read({...call,context:{...call.context,subject:{...subject,entityIds:[id(88)]}}}));
 await assert.rejects(read({...call,deadlineMs:NOW}));assert.equal(calls,0);
 for(const response of [()=>Response.json({ok:true},{headers:{'content-encoding':'gzip'}}),()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}}),()=>Response.json({large:'x'.repeat(200)})]){
  await assert.rejects(createObjectiveReadSource({...base,maxResponseBytes:64,fetchImpl:async()=>response()})(call));
 }
 const controller=new AbortController();controller.abort();await assert.rejects(read({...call,signal:controller.signal}));assert.equal(calls,0);
});

for(const routine of [false,true])for(const [label,change] of [
 ['role downgrade',state=>{state.role='standard_user';}],['tenant narrowing',state=>{state.tenantPolicy={capabilities:{generalReads:false}};}],
 ['missing role',state=>{state.role=undefined;}],['expired observation',state=>{state.roleExpiry=NOW;}],
])test(`${routine?'routine':'Objective'} ${label} after source dispatch withholds results`,async()=>{
 const x=await fixture('read_bill_text',{routine});x.scene.state.afterSource=()=>change(x.state);
 const result=await x.execute();assert.notEqual(result.status,200);assert.equal(x.state.calls.length,1);assert.doesNotMatch(await result.text(),/resultJson/);
 assert.equal(x.state.currentReads,4,'initial job authority is reused; post-source policy is reobserved');
});

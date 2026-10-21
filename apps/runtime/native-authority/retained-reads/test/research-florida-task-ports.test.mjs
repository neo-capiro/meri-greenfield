/** Synthetic HTTP/SQL fixtures exercise real gateway, context and delegation owners.
 * These tests do not qualify a Core deployment, installation or native database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createExecutionBinding} from '../../../../control/conversations/execution-boundary.mjs';
import {storeFixture,versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createGeneralReadInstallationOwner} from '../../../../gateway/general-reads/installation.mjs';
import {setup as evidenceFixture,operation as evidenceOperation,portfolioId} from '../../../../gateway/test/research-evidence-fixtures.mjs';
import {NOW,uuid} from '../../../../gateway/test/fixtures.mjs';
import {createResearchPortfolioEvidenceHttpAdapter} from '../../../../gateway/sources/research-portfolio-evidence/http-adapter.mjs';
import {retainedRoutes} from '../../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createResearchFloridaTaskPorts} from '../research-florida-task-ports.mjs';
import {retainedControlFixture,testJwk,issuerId,keyId} from './fixture.mjs';

function taskFor(x){
 const sf=storeFixture();for(const key of ['conversations','runs','events'])sf.state[key]=x.conversationState[key];
 return {pool:sf.pool,binding:x.binding,
  original:createExecutionBinding({binding:x.binding,versions,plan:{synthetic:'research-florida'},expiresAtMs:x.deadlineMs}),
  taskVerifier:x.taskVerifier,taskCapability:x.configuration.taskCapability,scopes:x.scopes,
  approvedReads:x.approvedReads,sourceEnabled:true,grant:x.grant};
}
function producerFor(x,changes={}){
 return createResearchFloridaTaskPorts({familyIds:[x.family],coreOrigin:'https://core.synthetic.invalid',
  retainedAuthority:{issuerId,keyId,publicKeyJwk:testJwk,recipients:x.recipients},
  fetchImpl:x.fetchImpl,now:x.now,enabled:true,...changes});
}
function credentialsFor(x){return async request=>({credential:await x.configuration.getNativeCredential(request),expiresAtMs:x.deadlineMs});}
async function gatewayFor(x,changes={},taskChanges={}){
 const ports=producerFor(x,changes)({task:{...taskFor(x),...taskChanges},getNativeCredentialWithExpiry:credentialsFor(x),
  getServiceSecret(){throw Error('NO_SERVICE_SECRET_FALLBACK');},getToolCredential(){throw Error('NO_TOOL_HANDLE_BEARER');}});
 const handlers=await createGeneralReadFamilyHandlers({families:ports.families,now:x.now,newId:randomUUID});
 const installationOwner=createGeneralReadInstallationOwner({binding:x.binding,scopes:x.scopes,handlers,
  catalogJson:x.gatewayConfiguration.catalogJson,now:x.now,
  readCurrentInstallation:({signal})=>x.installationOwner.readCurrent({signal})});
 return {ports,gateway:x.mount({installationOwner,...ports.contextPorts})};
}

for(const id of ['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'])
 test(`selected ${id} composes only its family and executes signed Core data route`,async()=>{
  const x=await retainedControlFixture(id),{ports,gateway}=await gatewayFor(x);
  assert.deepEqual(Object.keys(ports.families),[x.family]);
  assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.reads.length,0);
  const available=await gateway.readAvailability();assert.deepEqual(available.installation.operations,[x.operation]);
  const result=JSON.parse(await gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:`selected:${id}`}));
  assert.deepEqual(result.binding,x.binding);assert.deepEqual(result.subject,x.authority.subject);
  assert.equal(x.stateCore.dataCalls[0].path,retainedRoutes[id].data);
  assert.equal(x.stateCore.dataCalls.length,1);assert.equal(x.stateCore.issuances.length,1);
  assert.equal(x.state.budget.consumed_micro_usd,1);
  assert.equal([...x.state.reservations.values()][0].state,'SETTLED');
  if(id==='get_florida_budget_project'){
   assert.equal(result.result.result.projects.length,0);
   assert.equal(result.result.result.nextOffset,null);
   assert.equal(result.result.generatedAt,new Date(x.now()).toISOString());
  }
 });

test('research changes preserves a bounded cursor page and completes only after a distinct empty page',async()=>{
 const x=await retainedControlFixture('get_research_portfolio_changes');
 Object.assign(x.arguments,{cursor:'event-previous',limit:1});x.page.nextCursor='event-z';
 const {gateway}=await gatewayFor(x);
 const first=JSON.parse(await gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'cursor:one'}));
 assert.equal(first.data.nextCursor,'event-z');assert.equal(first.data.items.length,1);
 assert.equal(x.stateCore.dataCalls[0].body.request.cursor,'event-previous');
 assert.equal(x.stateCore.dataCalls[0].body.request.limit,1);
 x.arguments.cursor=first.data.nextCursor;x.page.items=[];x.page.nextCursor=null;
 const second=JSON.parse(await gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'cursor:two'}));
 assert.equal(second.data.nextCursor,null);assert.deepEqual(second.data.items,[]);
 assert.equal(x.stateCore.dataCalls[1].body.request.cursor,'event-z');
});

test('research evidence-only selection reuses existing GET adapter without signer configuration',async()=>{
 const f=evidenceFixture('review'),scope={tenantId:f.binding.tenantId,kind:'client',resourceId:uuid('d'),policyRevision:f.claims.policyRevision};
 f.subject.scopes=[scope];f.claims.scopes=[scope];
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:[scope],
  taskCapability:'SYNTHETIC_TASK',sourceEnabled:true,grant:{binding:f.binding,qualificationBinding:{policyRevision:f.claims.policyRevision}},
  approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[evidenceOperation],maxExecuteMs:2000,maxRequestBytes:65536,maxResponseBytes:65536}};
 const ports=createResearchFloridaTaskPorts({familyIds:['research-portfolio-evidence'],coreOrigin:'https://core.synthetic.invalid',
  fetchImpl:f.config.fetchImpl,now:()=>f.state.now,enabled:true})({task,getNativeCredentialWithExpiry:async request=>{
   assert.equal(request.portfolioId,portfolioId);assert.equal(request.selectedClientId,scope.resourceId);
   return {credential:'SYNTHETIC_CURRENT_USER',expiresAtMs:NOW+2000};}});
 assert.deepEqual(Object.keys(ports.families),['research-portfolio-evidence']);assert.equal(ports.contextPorts,undefined);
 const adapter=createResearchPortfolioEvidenceHttpAdapter(ports.families['research-portfolio-evidence']);
 const {input}=f.entry.contract.normalizeInput(f.raw,{binding:f.binding,subject:f.subject});
 const result=await adapter.read({input,authority:{binding:f.binding,subject:f.subject,claims:f.claims,policyRevision:f.claims.policyRevision,deadlineMs:NOW+1000}});
 assert.equal(result.data.coverage.corpusComplete,false);
 assert.equal(result.data.portfolioId,portfolioId);assert.equal(f.wire.length,4);
 assert.ok(f.wire.every(({options})=>options.method==='GET'&&options.headers.authorization==='Bearer SYNTHETIC_CURRENT_USER'));
});

test('source-disabled, unapproved and unknown families refuse before credential/SQL/HTTP effects',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),input={task,getNativeCredentialWithExpiry:credentialsFor(x)};
 assert.throws(()=>createResearchFloridaTaskPorts()(input),{message:'UNAVAILABLE'});
 for(const familyIds of [[],['mail'],['research-portfolio','research-portfolio']])
  assert.throws(()=>producerFor(x,{familyIds}));
 assert.throws(()=>producerFor(x,{retainedAuthority:undefined}));
 assert.throws(()=>producerFor(x)({...input,task:{...task,sourceEnabled:false}}),{message:'UNAVAILABLE'});
 assert.throws(()=>producerFor(x)({...input,task:{...task,approvedReads:{...task.approvedReads,operations:[evidenceOperation]}}}),{message:'UNAVAILABLE'});
 assert.throws(()=>producerFor(x)({...input,getNativeCredentialWithExpiry:undefined}));
 assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.reads.length,0);assert.equal(x.stateCore.dataCalls.length,0);
});

test('all three selected families share existing context without widening the returned family set',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),familyIds=['florida-budget','research-portfolio-evidence','research-portfolio'];
 task.scopes=[{tenantId:x.binding.tenantId,kind:'client',resourceId:uuid('9'),policyRevision:x.policyRevision}];
 task.approvedReads={...task.approvedReads,operations:[x.operation,evidenceOperation,{id:'get_florida_budget_project',version:'0.2.0'}]};
 const ports=producerFor(x,{familyIds})({task,getNativeCredentialWithExpiry:credentialsFor(x)});
 assert.deepEqual(Object.keys(ports.families),familyIds);
 assert.equal(typeof ports.contextPorts.retainedContextPorts.readCurrent,'function');
 assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.reads.length,0);
});

test('delegated request/response limits retain the narrower configured and task-approved bounds',async()=>{
 for(const taskLimited of [false,true]){
  const x=await retainedControlFixture(),seen=[];
  const changes={maxRequestMs:2000,maxResponseBytes:taskLimited?1048576:128,fetchImpl:async(url,init)=>{
   if(new URL(url).pathname===retainedRoutes.get_research_portfolio.data)seen.push(init);
   return x.fetchImpl(url,init);
  }};
  const taskChanges=taskLimited?{approvedReads:{...x.approvedReads,maxExecuteMs:1000,maxResponseBytes:128}}:{};
  const {gateway}=await gatewayFor(x,changes,taskChanges);
  await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'bounded:source'}));
  assert.equal(seen.length,1);
  assert.equal(Number(seen[0].headers['x-meri-deadline-at']),x.now()+(taskLimited?1000:2000));
  assert.equal([...x.state.reservations.values()][0].state,'UNKNOWN');
 }
});

for(const id of ['get_research_portfolio','get_florida_budget_project'])
 test(`${id} refuses expired and revoked grants before native authorization`,async()=>{
  for(const revoke of [x=>{x.state.grant.state='REVOKED';},x=>{x.state.grant.expires_at=new Date(x.now());},x=>{x.stateCore.entryRevoked=true;}]){
   const x=await retainedControlFixture(id),{gateway}=await gatewayFor(x);revoke(x);
   await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'grant:refused'}));
   assert.equal(x.stateCore.dataCalls.length,0);assert.equal(x.state.reservations.size,0);
  }
 });

test('Florida trusted resolution cannot switch the selected client',async()=>{
 const selected=uuid('9'),foreign=uuid('8'),x=await retainedControlFixture('get_florida_budget_project',{floridaSelectedClientId:selected});
 x.arguments.folderId=uuid('7');
 x.stateCore.resourceMutator=receipt=>{receipt.effectiveScope.clientId=foreign;};
 const {gateway}=await gatewayFor(x);
 await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'foreign:folder'}));
 assert.equal(x.stateCore.dataCalls.length,0);assert.equal(x.state.reservations.size,0);
});

test('unavailable delegated source stays unavailable and never falls back to retained GET',async()=>{
 const x=await retainedControlFixture(),wire=[];
 const {gateway}=await gatewayFor(x,{fetchImpl:async(url,init)=>{
  wire.push(new URL(url).pathname);
  if(new URL(url).pathname===retainedRoutes.get_research_portfolio.data)return Response.json({error:'synthetic unavailable'},{status:503});
  return x.fetchImpl(url,init);
 }});
 await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'unavailable'}));
 assert.ok(wire.includes(retainedRoutes.get_research_portfolio.data));
 assert.ok(wire.every(path=>!path.startsWith('/api/research-portfolios/')));
 assert.equal([...x.state.reservations.values()][0].state,'UNKNOWN');
});

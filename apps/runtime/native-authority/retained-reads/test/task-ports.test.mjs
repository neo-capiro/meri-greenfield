/** The per-task Core slice uses only synthetic HTTP and PostgreSQL protocol fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createExecutionBinding} from '../../../../control/conversations/execution-boundary.mjs';
import {storeFixture,versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createGeneralReadInstallationOwner} from '../../../../gateway/general-reads/installation.mjs';
import {retainedRoutes} from '../../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createCoreRetainedTaskPorts} from '../task-ports.mjs';
import {retainedControlFixture,testJwk,issuerId,keyId} from './fixture.mjs';

const ids=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
function taskFor(x){
 const sf=storeFixture();for(const key of ['conversations','runs','events'])sf.state[key]=x.conversationState[key];
 const original=createExecutionBinding({binding:x.binding,versions,plan:{synthetic:'retained-task-port'},expiresAtMs:x.deadlineMs});
 return {pool:sf.pool,binding:x.binding,original,taskVerifier:x.taskVerifier,taskCapability:x.configuration.taskCapability};
}
function producerFor(x,changes={}){
 return createCoreRetainedTaskPorts({coreOrigin:'https://core.synthetic.invalid',recipients:x.recipients,
  issuerId,keyId,publicKeyJwk:testJwk,fetchImpl:x.fetchImpl,now:x.now,enabled:true,...changes});
}
const bearerFor=(x,expiresAtMs=x.now()+2000)=>async request=>({credential:await x.configuration.getNativeCredential(request),expiresAtMs});
function installationFor(x,handlers){
 return createGeneralReadInstallationOwner({binding:x.binding,scopes:x.scopes,handlers,
  catalogJson:x.gatewayConfiguration.catalogJson,now:x.now,
  readCurrentInstallation:({signal})=>x.installationOwner.readCurrent({signal})});
}
for(const id of ids)test(`task producer: ${id} executes the exact delegated Core route through the canonical gateway`,async()=>{
 const x=await retainedControlFixture(id),task=taskFor(x),producer=producerFor(x);
 const ports=producer({task,getNativeCredentialWithExpiry:bearerFor(x),
  getNativeCredential(){throw Error('STRING_CALLBACK_MUST_NOT_BE_USED');},
  getServiceSecret(){throw Error('SERVICE_SECRET_MUST_NOT_BE_USED');}});
 assert.deepEqual(Object.keys(ports.families),['research-portfolio','florida-budget']);
 assert.equal(ports.families['research-portfolio'].origin,x.recipients.get_research_portfolio);
 assert.equal(ports.families['florida-budget'].origin,x.recipients.get_florida_budget_project);
 assert.equal(typeof ports.contextPorts.retainedContextPorts.readCurrent,'function');
 assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.stateCore.coreCalls.length,0);
 assert.equal(x.reads.length,0);assert.equal(x.stateCore.dataCalls.length,0);
 const handlers=await createGeneralReadFamilyHandlers({families:ports.families,now:x.now,newId:randomUUID});
 const gateway=x.mount({installationOwner:installationFor(x,handlers),...ports.contextPorts});
 const available=await gateway.readAvailability();assert.deepEqual(available.installation.operations,[x.operation]);
 const raw=await gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:`task-port:${id}`});
 assert.deepEqual(JSON.parse(raw).binding,x.binding);
 assert.equal(x.stateCore.dataCalls.length,1);assert.equal(x.stateCore.dataCalls[0].path,retainedRoutes[id].data);
 assert.equal(x.stateCore.issuances.length,1);assert.equal(x.state.budget.consumed_micro_usd,1);
 assert.ok(x.stateCore.issuances[0].originalExpiresAtMs<=x.now()+2000);
 assert.equal([...x.state.reservations.values()][0].state,'SETTLED');
 assert.ok(x.stateCore.nativeCredentials>=3);
});

test('task producer refuses missing pins, divided research recipients and disabled activation without source effects',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),input={task,getNativeCredentialWithExpiry:bearerFor(x)};
 assert.throws(()=>createCoreRetainedTaskPorts()(input),{message:'UNAVAILABLE'});
 for(const key of ['coreOrigin','recipients','issuerId','keyId','publicKeyJwk','fetchImpl','now'])
  assert.throws(()=>producerFor(x,{[key]:undefined})(input));
 assert.throws(()=>producerFor(x,{recipients:{...x.recipients,get_research_portfolio_changes:'https://foreign.synthetic.invalid'}}));
 assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.stateCore.coreCalls.length,0);assert.equal(x.reads.length,0);
});

test('task producer keeps original binding and expiry and reads the current accepted request',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),produce=producerFor(x);
 assert.throws(()=>produce({task:{...task,original:{...task.original,binding:{...task.binding,actorId:'foreign'}}},getNativeCredentialWithExpiry:bearerFor(x)}),{message:'UNAVAILABLE'});
 assert.throws(()=>produce({task:{...task,original:{...task.original,expiresAtMs:x.now()}},getNativeCredentialWithExpiry:bearerFor(x)}),{message:'UNAVAILABLE'});
 const ports=produce({task,getNativeCredentialWithExpiry:bearerFor(x)});
 const handlers=await createGeneralReadFamilyHandlers({families:ports.families,now:x.now,newId:randomUUID});
 const gateway=x.mount({installationOwner:installationFor(x,handlers),...ports.contextPorts});
 const row=[...x.conversationState.runs.values()][0];row.request.prompt='forged saved request';
 await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'task-port:forged'}));
 assert.equal(x.stateCore.nativeCredentials,0);assert.equal(x.stateCore.dataCalls.length,0);
 assert.equal(x.state.reservations.size,0);
});

test('string-only bearer is refused before Core, even if the older callback is supplied',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),produce=producerFor(x);
 assert.throws(()=>produce({task,getNativeCredential:x.configuration.getNativeCredential}));
 const ports=produce({task,getNativeCredentialWithExpiry:x.configuration.getNativeCredential,
  getNativeCredential:bearerFor(x)});
 await assert.rejects(ports.contextPorts.retainedContextPorts.readCurrent(x.proof(new AbortController().signal)),{message:'UNAVAILABLE'});
 assert.equal(x.stateCore.coreCalls.length,0);assert.equal(x.stateCore.dataCalls.length,0);
});

test('bearer expiry during Core issuer response withholds the signed data call',async()=>{
 const x=await retainedControlFixture(),task=taskFor(x),expiresAtMs=x.now()+1000;
 const fetchImpl=async(url,init)=>{
  const response=await x.fetchImpl(url,init);
  if(new URL(url).pathname===retainedRoutes.get_research_portfolio.issuer)x.state.now=expiresAtMs;
  return response;
 };
 const ports=producerFor(x,{fetchImpl})({task,getNativeCredentialWithExpiry:bearerFor(x,expiresAtMs)});
 const handlers=await createGeneralReadFamilyHandlers({families:ports.families,now:x.now,newId:randomUUID});
 const gateway=x.mount({installationOwner:installationFor(x,handlers),...ports.contextPorts});
 await assert.rejects(gateway.execute({operation:x.operation,arguments:x.arguments,deliveryId:'task-port:expired-issuer'}));
 assert.equal(x.stateCore.issuances.length,1);assert.equal(x.stateCore.dataCalls.length,0);
 assert.equal([...x.state.reservations.values()][0].state,'UNKNOWN');
});

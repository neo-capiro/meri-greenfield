import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {composeOperatorCallbackMaterial} from '../../../infra/product-preview/first-chat/operator-callback-material.mjs';
import {operatorCaseFixture,cleanupOperatorFixture} from './browser-operator-fixture.mjs';
import {assertOperatorCallbackWorker,assertOperatorCallbackCredential} from '../operator-callback-configuration.mjs';
import {createOperatorCallbackTransport} from '../operator-callback-transport.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createAgentCoreControlApplication} from '../agentcore-control-http.mjs';
import {createAgentCoreExecutionOwner} from '../agentcore-execution.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {digest,credential,origin,tlsServer,localRequest} from './operator-callback.fixture.mjs';
after(cleanupOperatorFixture);
const production='synthetic-production-control-'.repeat(3);
const compose=c=>composeOperatorCallbackMaterial({material:c.material,controlCapability:Buffer.from(credential),productionControlCapabilitySha256:digest(production)});
test('descriptor derives from real case material and binds the actual worker declaration and distinct Control secret',async()=>{
 const c=await operatorCaseFixture({binding}),callback=compose(c);
 assert.deepEqual(callback.endpoint,c.material.configuration.endpoint);assert.equal(callback.caCertificate,c.material.callback.caCertificate);
 assert.notEqual(callback.endpoint.address,c.material.native.worker.browserDeployment.bootstrapSpec.control.endpoint.address);
 assert.notEqual(callback.caCertificate,c.material.native.worker.browserDeployment.bootstrapSpec.control.caCertificate);
 assert.equal(callback.retainUntilMs,c.material.retainUntilMs);
 const config={native:{origin,loopback:false,preparedKickoff:true},nativeProvisioning:c.material.native.worker};
 assert.doesNotThrow(()=>assertOperatorCallbackWorker(callback,config));assert.doesNotThrow(()=>assertOperatorCallbackCredential(callback,credential));
 assert.throws(()=>assertOperatorCallbackCredential(callback,production));
 assert.throws(()=>assertOperatorCallbackWorker(callback,{...config,nativeProvisioning:{enabled:false}}));
 assert.throws(()=>assertOperatorCallbackWorker(callback,{...config,native:{...config.native,origin:'https://production.invalid'}}));
 assert.throws(()=>composeOperatorCallbackMaterial({material:c.material,controlCapability:Buffer.from(production),productionControlCapabilitySha256:digest(production)}));
 for(const change of [m=>m.configuration.endpoint.address='10.0.0.9',m=>m.configuration.caSha256='0'.repeat(64),m=>m.native.control.host.observer.keyId='foreign',m=>m.retainUntilMs=Date.now(),
  m=>delete m.callback,m=>m.callback.endpoint.address=m.native.worker.browserDeployment.bootstrapSpec.control.endpoint.address]){
  const material=structuredClone(c.material);change(material);assert.throws(()=>composeOperatorCallbackMaterial({material,controlCapability:Buffer.from(credential),productionControlCapabilitySha256:digest(production)}));
 }
});
function executionFixture(secret){
 const run={binding,versions,scopes:[],policyRevision:'policy-v1',state:'queued'},pending=Promise.withResolvers(),entered=Promise.withResolvers();let record,input;
 const store={executions:{read:async()=>({run,record}),claim:async value=>{record={...value,phase:'launching',native:null};return {run,record,dispatch:true};},record:async value=>{record={...record,phase:value.phase,native:value.native};return {run,record};}},nextRuns:{readTarget:async()=>null}};
 const owner=createAgentCoreExecutionOwner({store,versions,plan:{runtimeVersion:'qualified-v1'},credentialSecret:secret,now:()=>1000,newId:()=> 'c'.repeat(64),
  contextFor:async()=>({selectedClientId:null}),admit:async()=>({run,expiresAtMs:61000}),provider:{invoke:async value=>{input=value;entered.resolve();return pending.promise;},stop:async()=>assert.fail('No stop')}});
 return {owner,run,entered:entered.promise,input:()=>input,async close(){run.state='completed';const result=await owner.settle({...input,state:'completed'});pending.resolve(result);await owner.close();}};
}
test('real execution credential owner rejects production/cross-case credentials with identical execution identities',async()=>{
 const a=executionFixture(credential),b=executionFixture(production);
 try{
  await a.owner.kickoff({binding,executionKey:hash(binding)});await b.owner.kickoff({binding,executionKey:hash(binding)});await Promise.all([a.entered,b.entered]);
  assert.deepEqual(a.input().execution,b.input().execution);assert.notEqual(a.input().credential,b.input().credential);
  await a.owner.authenticate({binding,credential:a.input().credential});await b.owner.authenticate({binding,credential:b.input().credential});
  await assert.rejects(a.owner.authenticate({binding,credential:b.input().credential}),{code:'EXECUTION_AUTHORITY_REFUSED'});
  await assert.rejects(b.owner.authenticate({binding,credential:a.input().credential}),{code:'EXECUTION_AUTHORITY_REFUSED'});
 }finally{await Promise.all([a.close(),b.close()]);}
});
test('real Control capability auth rejects production while original callback cleanup remains usable after admission revocation',async t=>{
 const c=await operatorCaseFixture({binding});c.bind();const callback=compose(c);let stops=0;
 const owner={readiness:async()=>({service:'meri-native-capability-provider/1',ready:true}),kickoff:async()=>assert.fail('No kickoff'),status:async()=>assert.fail('No status'),
  stop:async input=>{stops++;return {binding:input.binding,executionId:input.executionId,stopped:true};},admitted:async()=>assert.fail('No execution'),settle:async()=>assert.fail('No settlement')};
 const app=createAgentCoreControlApplication({owner,controlCredential:credential});
 const server=await tlsServer(t,c.callbackTls,async(req,res)=>{const parts=[];for await(const part of req)parts.push(part);
  const response=await app.handle(new Request(origin+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(parts)}));
  res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));});
 const transport=createOperatorCallbackTransport(callback,{request:localRequest(server,[],callback.endpoint.address)});t.after(()=>transport.close());
 const native=key=>createNativeCapabilityClient({configuration:{origin,maxResponseBytes:1048576},credential:key,fetch:transport.fetch});
 await native(credential).readiness();await assert.rejects(native(production).readiness());
 c.capability.revoke();const result=await native(credential).call('execution/kickoff/stop',{binding,executionId:hash(binding)});
 assert.equal(result.stopped,true);assert.equal(stops,1);await assert.rejects(native(production).call('execution/kickoff/stop',{binding,executionId:hash(binding)}));assert.equal(stops,1);
});

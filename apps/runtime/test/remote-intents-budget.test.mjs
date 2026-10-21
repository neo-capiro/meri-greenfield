/** Synthetic remote startup using the real governed-intent transport. No SDK, provider, or control server. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {testBudgetTable as budgets} from '../../../packages/runtime/test/budget-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import * as configurationModule from '../config.mjs';
import * as preparationModule from '../native-authority/preparation-intent.mjs';
const f=candidateFixture();
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(){return Buffer.from(f.secret.task);}}});
mock.module('../native-authority/preparation-intent.mjs',{namedExports:{...preparationModule,compileNativePreparationIntent(value){return value;}}});
mock.module('../conversation-runner.mjs',{namedExports:{runConversation(){assert.fail('No SDK execution');}}});
const {runRemoteConversation}=await import('../remote-conversation-runner.mjs');

test('remote startup supplies preserved intent limits and enables the real task-bound port only for an enabled source',async()=>{
 for(const [sourceEnabled,intentsEnabled] of [[true,true],[false,true],[true,false]]){
  const configuration={...f.configuration,binding:f.binding,workspace:f.configuration.nativeCandidate.preparationIntent.workspace,sourceEnabled,
   limits:{...f.configuration.limits,requestMs:25000},
   remoteTask:{original:createExecutionBinding({binding:f.binding,versions:f.configuration.versions,plan:{synthetic:true},expiresAtMs:Date.now()+900000}),
    preparationIntent:f.configuration.nativeCandidate.preparationIntent,taskArn:'synthetic',controlCapabilitySha256:'a'.repeat(64),
    processOrigin:'https://process.synthetic.invalid',http:f.configuration.http,intents:{enabled:intentsEnabled}}};
  const paths=[];let closes=0;
  const result=await runRemoteConversation(configuration,{budgets,
   async fetchImpl(url,init){
    const path=new URL(url).pathname;paths.push(path);
    assert.equal(init.headers.authorization,'Bearer '+f.secret.task);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
    const body=JSON.parse(init.body);assert.deepEqual(body.binding,f.binding);
    if(path.endsWith('/availability'))return Response.json({binding:f.binding,operations:[{id:'task_create',version:'0.2.0'}],checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000});
    assert.equal(path,'/v1/runner/intents/prepare');assert.deepEqual(body.operation,{id:'task_create',version:'0.2.0'});assert.equal(body.arguments.title,'Synthetic task');
    return Response.json({state:'prepared'});
   },
   sessionFactory(){assert.fail('No session initialization');},
   createWorker(){return {query(){assert.fail('No SDK');},application:{async handle(){return null;}},async close(){closes++;}};},
   async listen(){return {async close(){closes++;}};},
   async execute(_configuration,options){
    assert.equal(Object.hasOwn(options,'governedIntents'),sourceEnabled&&intentsEnabled);
    if(options.governedIntents){
     const availability=await options.governedIntents.readAvailability();assert.deepEqual(availability.operations,[{id:'task_create',version:'0.2.0'}]);
     assert.deepEqual(await options.governedIntents.prepare({operation:availability.operations[0],arguments:{title:'Synthetic task'},deliveryId:'sdk:'+'a'.repeat(64)}),{state:'prepared'});
    }
    return 'executed';
   }});
  assert.equal(result,'executed');assert.equal(closes,2);
  assert.deepEqual(paths,sourceEnabled&&intentsEnabled?['/v1/runner/intents/availability','/v1/runner/intents/prepare']:[]);
 }
});

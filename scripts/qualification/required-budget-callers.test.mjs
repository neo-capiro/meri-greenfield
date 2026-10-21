/** Constructor smoke only: local fixture facts, no PostgreSQL, SDK process, provider or Temporal connection.
 * Evaluate the actual call-site expressions because importing the full rehearsals would register their live-process tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hotPathBudgets,budget} from '../../packages/runtime/hot-path-budgets.mjs';
import {createNativeCapabilityClient} from '../../apps/runtime/native-client.mjs';
import {createRuntimeSdkSessionFactory} from '../../apps/runtime/sdk-session-runtime.mjs';
import {createRemoteSdkProcessClient} from '../../apps/runtime/native-authority/remote-task-client.mjs';
import {assembleConversationRunner} from '../../apps/runtime/conversation-runner.mjs';
import {workerOptions} from '../../apps/runtime/temporal-worker.mjs';
import {createAdmittedEcsTaskFactory} from '../../apps/runtime/native-authority/ecs-task-factory.mjs';
import {createExecutionBinding} from '../../apps/control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../apps/control/conversations/test/store-fixture.mjs';
import {admittedSet} from '../../apps/runtime/native-authority/test/execution-capability-fixture.mjs';
import {createScriptedConversationApplication,syntheticPrincipal} from '../../evals/offline-targets/conversation-application.mjs';
const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const evaluate=(expression,scope)=>Function(...Object.keys(scope),'return ('+expression+');')(...Object.values(scope));
const declaration=(text,name)=>{
 const lines=text.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('const '+name+'='));
 assert.equal(lines.length,1,'one '+name+' declaration');
 return lines[0].slice(('const '+name+'=').length,-1);
};
const callSites=(text,name)=>[...text.matchAll(new RegExp(name+'\\((\\{.+?\\})\\)','g'))].map(match=>name+'('+match[1]+')');
const productionBudgets=()=>hotPathBudgets({limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000});
const rehearsals=['composed-rehearsal.mjs','composed-next-turn-rehearsal.mjs'];

test('both composed rehearsals construct their actual native and SDK-session clients without effects',()=>{
 let effects=0;const deny=()=>{effects++;throw Error('SMOKE_EFFECT_REFUSED');};
 for(const [index,name] of rehearsals.entries()){
  const text=source('scripts/qualification/first-chat-rehearsal/'+name),budgets=evaluate(declaration(text,'budgets'),{hotPathBudgets});
  const scope={budgets,budget,binding,control:'synthetic-control',credential:'synthetic-task',f:{f:{credential:'synthetic-task'}},supervisorFetch:deny,controlFetch:deny,createNativeCapabilityClient,createRuntimeSdkSessionFactory};
  const nativeCalls=callSites(text,'createNativeCapabilityClient');assert.equal(nativeCalls.length,index===0?1:2);
  for(const expression of nativeCalls)assert.equal(typeof evaluate(expression,scope).call,'function');
  const sessionCalls=callSites(text,'createRuntimeSdkSessionFactory');assert.equal(sessionCalls.length,1);
  assert.equal(typeof evaluate(sessionCalls[0],scope),'function');
 }
 assert.equal(effects,0);
});

test('both composed rehearsals assemble the actual runner with their admitted original and consistent root limits',()=>{
 let effects=0;const deny=()=>{effects++;throw Error('SMOKE_EFFECT_REFUSED');};
 const original=createExecutionBinding({binding,versions,plan:{model:'synthetic'},expiresAtMs:Date.now()+900000});
 for(const name of rehearsals){
  const text=source('scripts/qualification/first-chat-rehearsal/'+name),budgets=evaluate(declaration(text,'budgets'),{hotPathBudgets});
  const runtime={versions,proxyUrl:'https://synthetic-proxy.invalid'},workspace='/synthetic-qualification-workspace';
  const configuration=evaluate(declaration(text,'configuration'),{budgets,budget,binding,runtime,workspace,f:{workspace},original,preparationIntent:{}});
  const native=createNativeCapabilityClient({configuration:{origin:'https://synthetic-controller.invalid',maxResponseBytes:2097152},credential:'synthetic-task',fetch:deny,maxRequestMs:3000,loadMaxRequestMs:3000});
  const sessionFactory=createRuntimeSdkSessionFactory({origin:'https://synthetic-controller.invalid',credential:'synthetic-task',binding,fetchImpl:deny,sessionTimeoutMs:30000});
  const expressions=callSites(text,'assembleConversationRunner');assert.equal(expressions.length,1);
  const execute=evaluate(expressions[0],{assembleConversationRunner,budgets,configuration,native,taskNative:native,query:deny,credential:'synthetic-task',sessionFactory,mirror:{factory:sessionFactory}});
  assert.equal(typeof execute,'function');assert.deepEqual(execute.cleanupStatus(),{pendingInitializations:0,closed:false,failures:[],physicalStopProven:false});
  assert.deepEqual(configuration.limits,{startupMs:30000,requestMs:25000,shutdownMs:10000});assert.equal(configuration.remoteTask.original,original);
  const processOptions=text.match(/processTransport:(\{.*?\}),(?:session|enabled):/u)?.[1];assert.ok(processOptions);
  const transport=evaluate(processOptions,{budgets,budget,original,credential:'synthetic-task',f:{f:{credential:'synthetic-task'}},taskFetch:deny});
  const processClient=createRemoteSdkProcessClient(transport);assert.equal(transport.limits.maxRequestMs,8000);assert.deepEqual(processClient.status(),{requested:false,started:false,closed:false});
 }
 assert.equal(effects,0);
});

test('offline conversation target constructs the actual service and HTTP mount and refuses unauthenticated requests',async t=>{
 const principal=syntheticPrincipal({tenantId:'synthetic-budget',actorId:'synthetic-actor',tag:'b001'});
 const app=await createScriptedConversationApplication({principals:[principal]});t.after(()=>app.close());
 assert.match(await app.issue(principal),/^action_session_/u);
 const history=await app.app.handle(app.request({route:'history',body:{}}));assert.equal(history.status,401);
 assert.equal((await history.json()).error.code,'SESSION_REFUSED');assert.equal(app.state.starts.length,0);
});

test('runnable runtime adapter constructs the strict admitted ECS owner from broker budget arguments',()=>{
 const product=admittedSet(),facts=product.facts[0],NOW=Date.parse('2026-10-18T14:30:00Z'),prefix='arn:aws:ecs:us-east-1:967807252336:';
 const metadata={clusterArn:prefix+'cluster/meri',taskDefinitionArn:prefix+'task-definition/meri:1',taskArn:prefix+'task/meri/'+'1'.repeat(32),containerName:'worker',createdAtMs:NOW-100};
 facts.qualificationBinding.workerArn=metadata.taskArn;
 let effects=0;const deny=()=>{effects++;throw Error('SMOKE_EFFECT_REFUSED');};
 const native={launch:deny,inspect:deny,readiness:deny,registration:{read:deny}},budgets=productionBudgets();
 const original=createExecutionBinding({binding:facts.binding,versions,plan:{model:'synthetic'},expiresAtMs:NOW+1000}),launchConfiguration={synthetic:true};
 const tasksFactory=createAdmittedEcsTaskFactory({client:{send:deny},native,metadata,allocationJson:JSON.stringify(product.allocation),grantFactsJsons:[JSON.stringify(facts)],grantId:facts.grantId,maxRequestMs:3000,enabled:true,now:()=>NOW});
 const scope={c:{budgets},supervisor:{},compiled:{runtime:{},launchConfiguration},ownerPlan:{},tasksFactory,enabled:true,now:()=>NOW,limits:{maxRequestMs:3000},objects:undefined,
  createNativeBrokerStack(value){return value.tasksFactory({original,launchConfiguration,maxRequestMs:budget(budgets,'native.independent.request'),startupMaxRequestMs:budget(budgets,'native.independent.request')});}};
 const owner=evaluate(declaration(source('apps/runtime/native-authority/runnable-runtime.mjs'),'stack'),scope);
 assert.equal(typeof owner.inspect,'function');assert.equal(typeof owner.retire,'function');assert.equal(effects,0);
 // The adapter must not relax the admitted factory's own exact input contract.
 assert.throws(()=>tasksFactory({original,launchConfiguration,maxRequestMs:3000}));
});

test('assembled image probe and bundler test construct their actual workerOptions with a production-shaped table',()=>{
 for(const name of ['image_probe.mjs','temporal-bundle.test.mjs']){
  const text=source('scripts/qualification/assembled-image/'+name),budgets=evaluate(declaration(text,'budgets'),{hotPathBudgets});
  const options=evaluate(declaration(text,'options'),{budgets,workerOptions});
  assert.equal(options.namespace,'synthetic-image-only');assert.equal(options.taskQueue,'synthetic-image-only');
  assert.equal(typeof options.activities.executeConversation,'function');assert.match(options.workflowsPath,/apps\/control\/conversations\/workflow\.ts$/u);
 }
});

test('assembled image probe source still matches its build pin',()=>{
 const expected=source('scripts/qualification/assembled-image/meri_image_build.py').match(/'image_probe\.mjs': '([a-f0-9]{64})'/u)?.[1];
 assert.match(expected,/^[a-f0-9]{64}$/u);
 assert.equal(createHash('sha256').update(source('scripts/qualification/assembled-image/image_probe.mjs')).digest('hex'),expected);
});

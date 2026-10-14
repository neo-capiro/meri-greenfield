import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';import {createHash} from 'node:crypto';
import {compileNativeBrokerPlan,createNativeBrokerStack} from '../broker-stack.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {continuationFixture,NOW} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';import {capabilityDigest} from '../task-verifier.mjs';
function fixture(){
 const f=continuationFixture(),{binding,versions}=f.target,workspace='/tmp/meri-stack-workspace',configDirectory='/tmp/meri-stack-config',command=realpathSync(process.execPath),expiresAtMs=NOW+10000;
 const runtime={binding,versions,proxyUrl:'https://synthetic-proxy.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',deadlineMs:expiresAtMs,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:10};
 const launchConfiguration={binding,workspace,configDirectory,versions:{sdk:versions.sdk,cli:versions.cli},expiresAtMs,executableSha256:createHash('sha256').update(readFileSync(command)).digest('hex'),launch:{command,args:['--version'],env:{CLAUDE_CONFIG_DIR:configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDirectory}},enabled:true,shutdownMs:500,now:()=>NOW},plan={purpose:'synthetic-stack-composition'};
 let allocations=0,queries=0,authority=0,witnesses=0,fallbacks=0,closes=0;
 const pool={async connect(){queries++;throw Error('unexpected-borrowed-db-read');}},supervisor={admission:{async currentAllocation(){throw Error('synthetic-authority-refused');},async withCurrentAllocation(){throw Error('synthetic-authority-refused');}},taskVerifier:{async verify(){authority++;throw Error('synthetic-authority-refused');}},identityContext:{},application:{async handle(){fallbacks++;return Response.json({fallback:true},{status:404});}},async close(){closes++;}},tasks={async launch(){throw Error('unexpected-native-launch');},async inspect(){throw Error('unexpected-native-inspection');},async retire(){throw Error('unexpected-native-retirement');},async readiness(){throw Error('synthetic-not-qualified');},async close(){closes++;},registration:{async read(){witnesses++;throw Error('unobserved-native-key');}},workspace:{async restore(){throw Error('unexpected-task-restore');},async verify(){throw Error('unexpected-task-readback');}}};
 const config={runtime,launchConfiguration,plan,pool,supervisor,taskCapability:'synthetic-task',controlCapabilitySha256:capabilityDigest('synthetic-control'),enabled:true,now:()=>NOW,tasksFactory(input){allocations++;assert.equal(input.original.expiresAtMs,expiresAtMs);return tasks;}};
 return {f,config,tasks,state:()=>({allocations,queries,authority,witnesses,fallbacks,closes})};
}
test('shared inert compiler preserves exact original plan/runtime/launch hashing and binding',()=>{
 const x=fixture(),compiled=compileNativeBrokerPlan({runtime:x.config.runtime,plan:x.config.plan,launchConfiguration:x.config.launchConfiguration}),expected={ownerPlan:x.config.plan,runtimeSha256:hash(x.config.runtime),launchSha256:hash(compiled.launchConfiguration)};
 assert.deepEqual(compiled.plan,expected);assert.deepEqual(compiled.original,createExecutionBinding({binding:x.f.target.binding,versions:x.f.target.versions,plan:expected,expiresAtMs:x.config.runtime.deadlineMs}));assert.equal(x.state().allocations,0);assert.equal(x.state().queries,0);
 const changed=compileNativeBrokerPlan({runtime:{...x.config.runtime,proxyCredential:'changed-original-proxy'},plan:x.config.plan,launchConfiguration:x.config.launchConfiguration});assert.notEqual(changed.original.planSha256,compiled.original.planSha256);assert.equal(changed.original.executionId,compiled.original.executionId);
});
test('concrete stack constructs native restorer with canonical journal and original plan before any IO',async()=>{
 const x=fixture(),stack=createNativeBrokerStack({...x.config,continuationObjects:{async get(){throw Error('unexpected-object-read');}}});
 assert.equal(stack.productPorts.sdkSessionSnapshot,stack.continuation);assert.ok(stack.store.restorations);assert.equal(typeof stack.restorer.restore,'function');assert.equal(typeof stack.restorer.snapshot,'function');assert.deepEqual(stack.original,compileNativeBrokerPlan({runtime:x.config.runtime,plan:x.config.plan,launchConfiguration:x.config.launchConfiguration}).original);assert.equal(x.state().queries,0);assert.equal(x.state().witnesses,0);await stack.close();assert.equal(x.state().closes,2);
});
test('invalid immutable original or object accessor refuses before task factory effects',()=>{
 const x=fixture();assert.throws(()=>createNativeBrokerStack({...x.config,runtime:{...x.config.runtime,deadlineMs:NOW+9000}}));let getters=0;assert.throws(()=>createNativeBrokerStack({...x.config,continuationObjects:{get get(){getters++;return ()=>{};}}}));assert.equal(getters,0);assert.equal(x.state().allocations,0);assert.equal(x.state().queries,0);
});
test('canonical runtime validation refuses proxy, budgets, model and hostile data before allocation',()=>{
 const x=fixture();for(const change of [{proxyUrl:'http://synthetic-proxy.invalid'},{maxTurns:101},{model:''},{versions:{...x.config.runtime.versions,sdk:'unsupported'}}])assert.throws(()=>createNativeBrokerStack({...x.config,runtime:{...x.config.runtime,...change}}));let getters=0;const runtime={...x.config.runtime};Object.defineProperty(runtime,'model',{enumerable:true,get(){getters++;return 'private';}});assert.throws(()=>compileNativeBrokerPlan({runtime,plan:x.config.plan,launchConfiguration:x.config.launchConfiguration}));assert.equal(getters,0);assert.equal(x.state().allocations,0);assert.equal(x.state().queries,0);
});
test('session snapshot and all session paths are owned by canonical receiver, never supervisor fallback',async()=>{
 const x=fixture(),stack=createNativeBrokerStack(x.config),request=(path,credential='foreign-task',input={binding:x.f.target.binding})=>new Request('https://synthetic-native.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(input)});
 const refused=await stack.application.handle(request('/v1/runner/session/snapshot'));assert.equal(refused.status,503);assert.equal(x.state().queries,0);assert.equal(x.state().authority,0);assert.equal(x.state().witnesses,0);assert.equal(x.state().fallbacks,0);
 const unknown=await stack.application.handle(request('/v1/runner/session/unrestricted-object'));assert.equal(unknown.status,404);assert.equal(x.state().fallbacks,0);
 const fresh=await stack.application.handle(request('/v1/runner/session/register','synthetic-task',{binding:x.f.target.binding,key:{projectKey:'-workspace-conversation',sessionId:x.f.continuation.checkpoint.sessionId}}));assert.equal(fresh.status,503);assert.equal(x.state().authority,1);assert.equal(x.state().witnesses,0);assert.equal(x.state().queries,0);
 const outside=await stack.application.handle(request('/outside'));assert.equal(outside.status,404);assert.equal(x.state().fallbacks,1);await stack.close();
});

test('continuation refuses a missing task workspace port without falling back to control filesystem',()=>{const x=fixture();delete x.tasks.workspace;assert.throws(()=>createNativeBrokerStack({...x.config,continuationObjects:{async get(){throw Error('unexpected-object-read');}}}));assert.equal(x.state().queries,0);assert.equal(x.state().witnesses,0);});

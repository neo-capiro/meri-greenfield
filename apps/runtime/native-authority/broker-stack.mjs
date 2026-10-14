/** One source composition over canonical admitted task and conversation/session owners. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {createNativeExecutionBroker,executionFault} from './execution-broker.mjs';
import {createNativeRuntimeProvider,compileNativeRuntimePlan} from './runtime-provider.mjs';
import {createNativeExecutionApplication} from './execution-http.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
import {capabilityDigest} from './task-verifier.mjs';
import {compileNativeLaunch} from './launch-configuration.mjs';
import {createNativeContinuationRuntime} from './continuation-runtime.mjs';
import {createNativeCheckpointRestorer} from './native-restorer.mjs';
import {createNativeSdkSessionApplication} from './session-http.mjs';
const requestUrl=Object.getOwnPropertyDescriptor(Request.prototype,'url').get;
/** Inert shared original-plan compiler; allocator and broker must use the same identity. */
export function compileNativeBrokerPlan(configuration){
 const c=own(configuration,['runtime','plan','launchConfiguration']),runtime=compileNativeRuntimePlan(c.runtime),p=compileNativeLaunch(c.launchConfiguration);
 const launchConfiguration={binding:p.binding,workspace:p.workspace,configDirectory:p.configDirectory,versions:p.versions,expiresAtMs:p.expiresAtMs,executableSha256:p.executableSha256,launch:p.launch,enabled:p.enabled,shutdownMs:p.shutdownMs,...(p.limits?{limits:p.limits}:{})};
 const plan=data({ownerPlan:data(c.plan),runtimeSha256:hash(runtime),launchSha256:hash(launchConfiguration)});
 if(hash(p.binding)!==hash(runtime.binding)||p.expiresAtMs!==runtime.deadlineMs)throw executionFault('STACK_CONFIGURATION');
 const original=createExecutionBinding({binding:runtime.binding,versions:runtime.versions,plan,expiresAtMs:runtime.deadlineMs});
 return Object.freeze({runtime,launchConfiguration:data(launchConfiguration),plan,original});
}
export function createNativeBrokerStack(configuration){
 const c=own(configuration,['pool','supervisor','runtime','plan','launchConfiguration','taskCapability','controlCapabilitySha256','tasksFactory'],['enabled','now','maxRequestMs','continuationObjects']);
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,{runtime,launchConfiguration,plan,original}=compileNativeBrokerPlan({runtime:c.runtime,plan:c.plan,launchConfiguration:c.launchConfiguration});
 if(typeof c.tasksFactory!=='function')throw executionFault('STACK_CONFIGURATION');
 const store=createPostgresConversationStore({pool:c.pool}),restorer=c.continuationObjects?createNativeCheckpointRestorer({journal:store.restorations,objects:c.continuationObjects,workspace:launchConfiguration.workspace,expiresAtMs:original.expiresAtMs,now}):undefined;
 const tasks=c.tasksFactory({original,launchConfiguration}),closeTasks=storageMethod(tasks,'close'),readyTasks=storageMethod(tasks,'readiness'),taskDigest=capabilityDigest(c.taskCapability);
 const broker=createNativeExecutionBroker({binding:runtime.binding,versions:runtime.versions,plan,expiresAtMs:runtime.deadlineMs,journal:store.executions,tasks,verifier:c.supervisor.taskVerifier,taskCapability:c.taskCapability,enabled,now,maxRequestMs});
 const continuation=createNativeContinuationRuntime({store,verifier:c.supervisor.taskVerifier,taskCapability:c.taskCapability,restorer,now});
 const provider=createNativeRuntimeProvider({broker,runtime,admission:c.supervisor.admission,taskCapabilitySha256:taskDigest,continuation,enabled});
 const readiness={async check({signal}){await readyTasks({signal});const result=await c.pool.query("SELECT to_regclass('meri_conversations.native_executions') AS executions,to_regclass('meri_conversations.sdk_sessions') AS sessions,to_regclass('meri_product_budget.tool_run_allocations') AS allocations");if(!result.rows[0]||Object.values(result.rows[0]).some(v=>v===null))throw executionFault('SCHEMA_UNAVAILABLE');await c.supervisor.taskVerifier.verify({capability:c.taskCapability,binding:runtime.binding,operation:'load',inputSha256:hash({binding:runtime.binding}),signal});return {service:'meri-native-capability-provider/1',ready:true};}};
 const execution=createNativeExecutionApplication({broker,runtime:provider,controlCapabilitySha256:c.controlCapabilitySha256,taskCapabilitySha256:taskDigest,readiness,enabled,now,maxRequestMs});
 const taskRegistration=storageMethod(tasks.registration,'read');
 const registration={read:taskRegistration};
 const sdkSessionOwner=createDurableSdkSessionOwner({admission:c.supervisor.admission,authority:c.supervisor.taskVerifier,registration,enabled,now,maxRequestMs});
 const sessions=createNativeSdkSessionApplication({owner:sdkSessionOwner,snapshot:continuation,now,maxRequestMs:Math.min(maxRequestMs,30000)});
 return Object.freeze({store,broker,tasks,plan,original,continuation,restorer,runtime:provider,productPorts:Object.freeze({identityContext:c.supervisor.identityContext,sdkSessionOwner}),
  application:Object.freeze({async handle(request){const reply=await execution.handle(request);if(reply!==null)return reply;if(new URL(requestUrl.call(request)).pathname.startsWith('/v1/runner/session/'))return sessions.handle(request);return c.supervisor.application.handle(request);}}),
  async close(){try{await broker.stop();}catch{}await closeTasks();await c.supervisor.close();}});
}

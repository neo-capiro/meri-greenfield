/** One source composition over canonical admitted task and conversation/session owners. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {createNativeExecutionBroker,executionFault} from './execution-broker.mjs';
import {createNativeRuntimeProvider} from './runtime-provider.mjs';
import {createNativeExecutionApplication} from './execution-http.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
import {capabilityDigest} from './task-verifier.mjs';
import {compileNativeLaunch} from './launch-configuration.mjs';
export function createNativeBrokerStack(configuration){
 const c=own(configuration,['pool','supervisor','runtime','plan','launchConfiguration','taskCapability','controlCapabilitySha256','tasksFactory'],['enabled','now','maxRequestMs']);
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,runtime=data(c.runtime),p=compileNativeLaunch(c.launchConfiguration);
 const launchConfiguration={binding:p.binding,workspace:p.workspace,configDirectory:p.configDirectory,versions:p.versions,expiresAtMs:p.expiresAtMs,executableSha256:p.executableSha256,launch:p.launch,enabled:p.enabled,shutdownMs:p.shutdownMs,...(p.limits?{limits:p.limits}:{})};
 const plan=data({ownerPlan:data(c.plan),runtimeSha256:hash(runtime),launchSha256:hash(launchConfiguration)});
 if(typeof c.tasksFactory!=='function'||hash(p.binding)!==hash(runtime.binding)||p.expiresAtMs!==runtime.deadlineMs)throw executionFault('STACK_CONFIGURATION');
 const original=createExecutionBinding({binding:runtime.binding,versions:runtime.versions,plan,expiresAtMs:runtime.deadlineMs}),tasks=c.tasksFactory({original,launchConfiguration});
 const closeTasks=storageMethod(tasks,'close'),store=createPostgresConversationStore({pool:c.pool}),taskDigest=capabilityDigest(c.taskCapability);
 const broker=createNativeExecutionBroker({binding:runtime.binding,versions:runtime.versions,plan,expiresAtMs:runtime.deadlineMs,journal:store.executions,tasks,verifier:c.supervisor.taskVerifier,taskCapability:c.taskCapability,enabled,now,maxRequestMs});
 const provider=createNativeRuntimeProvider({broker,runtime,admission:c.supervisor.admission,taskCapabilitySha256:taskDigest,enabled});
 const execution=createNativeExecutionApplication({broker,runtime:provider,controlCapabilitySha256:c.controlCapabilitySha256,taskCapabilitySha256:taskDigest,enabled,now,maxRequestMs});
 const sdkSessionOwner=createDurableSdkSessionOwner({admission:c.supervisor.admission,authority:c.supervisor.taskVerifier,registration:tasks.registration,enabled,now,maxRequestMs});
 return Object.freeze({store,broker,tasks,plan,runtime:provider,productPorts:Object.freeze({identityContext:c.supervisor.identityContext,sdkSessionOwner}),
  application:Object.freeze({handle(request){const reply=execution.handle(request);return Promise.resolve(reply).then(value=>value??c.supervisor.application.handle(request));}}),
  async close(){try{await broker.stop();}catch{}await closeTasks();await c.supervisor.close();}});
}

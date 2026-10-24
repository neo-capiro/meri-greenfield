/** Bind a private invocation to existing control/activity/SessionStore owners. No second model loop. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {isExecutionOutcome} from '../control/conversations/execution-boundary.mjs';
import {assembleConversationRunner,assertRunnerEnvironment,assertRunnerWorkspace} from './conversation-runner.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {createRuntimeSdkSessionFactory} from './sdk-session-runtime.mjs';
import {createNativeReadsClient} from './reads-client.mjs';
import {createRunnerIntentsClient} from './native-authority/intents-client.mjs';
import {invocationInput,settlementResult,agentcoreFault} from './agentcore-contract.mjs';

export function createAgentCoreQuery({origin,fetchImpl,workspace,query,providerCredentials,assemble=assembleConversationRunner,sessionFactory=createRuntimeSdkSessionFactory,environment=process.env,now=Date.now}){
 return async function execute(raw,{signal}){
  const input=invocationInput(raw),{execution,versions,credential}=input,binding=execution.binding;
  assertRunnerEnvironment(environment);if(execution.expiresAtMs-now()<=23000)throw agentcoreFault('RUNNER_DEADLINE');
  const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:35651584},credential,fetch:fetchImpl,now,loadMaxRequestMs:23000});
  const call=(operation,value)=>native.call(operation,value,{signal,deadlineMs:execution.expiresAtMs,maxRequestMs:23000});
  async function admission(){const value=data(await call('runner/execution',{execution,versions}));own(value,['execution','versions','state','scopes','selectedClientId','policyRevision']);if(hash(value.execution)!==hash(execution)||hash(value.versions)!==hash(versions))throw agentcoreFault('RUNNER_BINDING_REFUSED');return value;}
  const admitted=await admission();if(admitted.state!=='queued')throw agentcoreFault('RUN_NOT_QUEUED');
  const directories=await workspace.prepare(execution),configuration={binding,versions,execution,...directories,sourceEnabled:input.sourceEnabled??false,limits:{requestMs:25000,shutdownMs:15000}};
  await assertRunnerWorkspace(configuration);
  const sessions=sessionFactory({origin,credential,binding,fetchImpl,now,startupMaxRequestMs:23000,startupExpiresAtMs:execution.expiresAtMs-23000});
  const reads=input.sourceEnabled===true&&input.approvedReads?.enabled===true?createNativeReadsClient({origin,credential,binding,approvedReads:input.approvedReads,fetchImpl,now}):undefined;
  const intents=input.sourceEnabled===true&&input.intents?.enabled===true?createRunnerIntentsClient({origin,credential,binding,fetchImpl,enabled:true}):undefined;
  const run=assemble({configuration,native,credentialForBinding:async()=>credential,sessionFactory:sessions,now,...(providerCredentials?{providerCredentials}:{}),...(query?{query}:{}),...(reads?{generalReads:reads}:{}),...(intents?{governedIntents:intents}:{})});
  let result,failure;try{result=await run({binding,signal});}catch(error){failure=error;}
  const cleanup=run.cleanupStatus();if(cleanup.pendingInitializations!==0||cleanup.closed!==true||cleanup.failures.length||failure?.code==='SDK_CLEANUP_UNKNOWN')throw agentcoreFault('RUNNER_CLEANUP_UNKNOWN');
  // An activity error does not prove its final event committed. Read the same canonical owner before acknowledging a failed turn.
  const state=result?.state??(await admission()).state;if(!isExecutionOutcome(state))throw failure??agentcoreFault('RUNNER_SETTLEMENT_UNKNOWN');
  return settlementResult(await call('runner/execution/settle',{execution,state}),execution);
 };
}

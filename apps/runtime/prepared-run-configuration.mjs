/** Pure original workload identity shared by issuance and read-only placement composition. No material owner is constructed. */
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {allocation} from '../gateway/budget/tool-budget-binding.mjs';

export function compilePreparedRunConfigurationSha256(configuration){
 const source=data(configuration),config=compilePreparedCandidateConfiguration(source.nativeCandidate,source.versions),a=allocation(config.allocationJson);
 // Deployment credentials and render-time deadlines are not workload identity: a redeploy re-mints grant ids, capability
 // digests and the schedule/grant expiries, and conversations admitted under the previous render must stay admitted.
 const {run:_,schedule,...allocationRest}=a,allocationSemantics={...allocationRest,schedule:{revision:schedule.revision,operations:schedule.operations}},{binding:__,deadlineMs:___,...runtimeSemantics}=config.runtime;
 const {workspace,authoritySha256:____,...preparationSemantics}=config.preparationIntent;
 const dynamic=config.multiRun?.dynamicInitialRuns===true,workspaceMatch=/^(.*[\\/])([0-9a-f-]{36})$/u.exec(workspace);
 if(dynamic&&(!workspaceMatch||workspaceMatch[2]!==config.runtime.binding.conversationId))throw Error('PREPARED_RUN_BINDINGS_WORKSPACE');
 const workspaceParent=workspaceMatch?.[1];
 return hash({schemaVersion:1,multiRun:config.multiRun,identity:{origin:config.identity.origin,clientResolution:config.identity.commandContext.clientResolution},runtime:runtimeSemantics,allocation:allocationSemantics,plan:config.plan,preparationIntent:dynamic?{...preparationSemantics,workspaceParent}:config.preparationIntent,qualification:config.qualification,operations:config.operations,approvedReads:config.approvedReads??null,taskRequest:config.taskRequest,containerName:config.containerName,taskOrigin:config.taskOrigin,taskHttp:config.taskHttp,objects:config.objects});
}

/** Correlate a freshly resolved trusted task-update session; no browser-supplied scope or execution authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {fail} from '../action-application/http.mjs';
export function taskSession(value,intent,started,now,limitDeadline){
 const s=own(value,['binding','commandOptions','authorizeExecution','checkedAtMs','expiresAtMs']);
 const fact=data({binding:s.binding,checkedAtMs:s.checkedAtMs,expiresAtMs:s.expiresAtMs}),at=now();
 if(!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<started||fact.checkedAtMs>at||!Number.isSafeInteger(fact.expiresAtMs)||fact.expiresAtMs<=at||typeof s.authorizeExecution!=='function')fail('UNAUTHENTICATED',401);
 const o=own(s.commandOptions,['operation','action','outputShape','commandContext','validators','assertProposal','approvalMetadataOwner','executor','now','limits']);
 const selected=data({operation:o.operation,action:o.action,outputShape:o.outputShape,commandContext:o.commandContext,limits:o.limits});
 validateCommandShape('TaskUpdateContext',selected.commandContext);validateShape('RunBinding',fact.binding);
 const original=selected.commandContext.binding;
 if(selected.operation.id!=='update_task'||selected.operation.version!=='0.2.0'||selected.action!=='task.update'||selected.outputShape!=='TaskUpdateToolResult'||
  ['tenantId','actorId','conversationId','runId'].some(k=>original[k]!==fact.binding[k])||
  intent!=='execute'&&canonicalSha256(original)!==canonicalSha256(fact.binding))fail('SESSION_SCOPE_REFUSED',403);
 const commandOptions={...o,...selected};createCommandToolInterface(commandOptions);limitDeadline(fact.expiresAtMs);
 return {...fact,commandOptions,authorizeExecution:s.authorizeExecution};
}

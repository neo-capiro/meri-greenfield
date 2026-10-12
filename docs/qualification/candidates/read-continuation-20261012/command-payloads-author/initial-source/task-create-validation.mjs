// Private payload projection only. Trusted resolution is not current task access.
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function instant(value) {
  const time=Date.parse(value);
  if(!Number.isFinite(time)||new Date(time).toISOString()!==value) fail('Task date is not a finite canonical UTC instant');
  return value;
}
export function createTaskCreateValidators({validateShape,validatePublicShape,canonicalSha256}) {
  function contextData(options) {
    const context=snapshotOperationData(options);validateShape('TaskCreateContext',context);
    if(context.clientResolution && (context.clientResolution.reference.trim()!==context.clientResolution.reference || context.clientResolution.reference.length>80)) fail('Invalid trusted client reference');
    return context;
  }
  function normalizeTaskCreateInput(request,options) {
    const raw=snapshotOperationData(request),context=contextData(options);validateShape('TaskCreateRaw',raw);
    const title=raw.title.trim();if(!title||title.length>240)fail('Task title exceeds admitted bounds');
    const reference=raw.clientId===undefined||raw.clientId===null?null:raw.clientId.trim();
    let clientId=null;
    if(reference!==null){
      if(!reference||reference.length>80||!context.clientResolution||reference!==context.clientResolution.reference)fail('Task client resolution mismatch');
      clientId=context.clientResolution.clientId.toLowerCase();
      if(UUID.test(reference)&&reference.toLowerCase()!==clientId)fail('Task UUID selector substitution');
    } else if(context.clientResolution!==null)fail('Unexpected client resolution');
    const dueDate=raw.dueDate===undefined||raw.dueDate===null?null:instant(raw.dueDate.length===10?`${raw.dueDate}T00:00:00.000Z`:raw.dueDate);
    const input={title,clientId,dueDate};validateShape('TaskCreateArguments',input);return input;
  }
  function assertTaskCreateCommand(value,options) {
    const command=snapshotOperationData(value),context=contextData(options);validatePublicShape('Command',command);
    validateShape('TaskCreateArguments',command.arguments);
    if(command.action!=='task.create'||command.attachments.length!==0||canonicalSha256(command.binding)!==canonicalSha256(context.binding))fail('Task command provenance mismatch');
    const {title,clientId,dueDate}=command.arguments;
    if(title.trim()!==title||title.length>240)fail('Task command title is not normalized');
    if(clientId!==(context.clientResolution?.clientId.toLowerCase()??null))fail('Task command client mismatch');
    if(dueDate!==null)instant(dueDate);
    if(command.scopes.some(scope=>scope.tenantId!==command.binding.tenantId))fail('Cross-tenant task scope');
    return command;
  }
  function assertTaskCreateResult(value,commandValue,options) {
    const command=assertTaskCreateCommand(commandValue,options),result=snapshotOperationData(value);validateShape('TaskCreateResult',result);
    instant(result.createdAt);if(result.dueDate!==null)instant(result.dueDate);
    for(const key of ['title','clientId','dueDate'])if(result[key]!==command.arguments[key])fail('Task source result differs from immutable arguments');
    // No owner assignment, approval, current visibility or durable effect is inferred.
    return result;
  }
  return Object.freeze({normalizeTaskCreateInput,assertTaskCreateCommand,assertTaskCreateResult});
}

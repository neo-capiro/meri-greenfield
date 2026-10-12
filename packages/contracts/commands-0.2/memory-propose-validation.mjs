// Pending-only private command intent. No legacy save endpoint is invoked here.
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const optionalText=value=>value===undefined||value===null?null:(value.trim()||null);

export function createMemoryProposeValidators({validateShape,validatePublicShape,canonicalSha256}) {
  function contextData(value) {
    const context=snapshotOperationData(value);
    validateShape('MemoryProposeContext',context);
    return context;
  }
  function assertArguments(input,context) {
    validateShape('MemoryProposeArguments',input);
    if(input.content.trim()!==input.content||input.content.length>4000)fail('Memory content is not normalized');
    if(input.key!==null&&(input.key.trim()!==input.key||input.key.length>120))fail('Memory key intent is not normalized');
    const clientId=input.scope==='client'?context.conversationClientId?.toLowerCase():null;
    if(input.scope==='client'&&!clientId)fail('Client proposal requires selected conversation client');
    if(input.clientId!==clientId)fail('Memory proposal selected client mismatch');
    return input;
  }
  function normalizeMemoryProposeInput(value,options) {
    const raw=snapshotOperationData(value),context=contextData(options);
    validateShape('MemoryProposeRaw',raw);
    const content=raw.content.trim(),key=optionalText(raw.key);
    if(!content||content.length>4000||(key!==null&&key.length>120))fail('Memory intent exceeds admitted text bounds');
    const requestedScope=(optionalText(raw.scope)??'personal').toLowerCase();
    const scope=requestedScope==='user_private'?'personal':requestedScope;
    if(!['personal','client','firm'].includes(scope))fail('Unknown memory proposal scope');
    const requestedClient=optionalText(raw.clientId);
    if(requestedClient!==null&&(!UUID.test(requestedClient)||requestedClient.toLowerCase()!==context.conversationClientId?.toLowerCase()))fail('Memory client selector differs from selected conversation');
    const clientId=scope==='client'?(context.conversationClientId?.toLowerCase()??null):null;
    const ttlDays=raw.ttlDays===undefined||raw.ttlDays===null||raw.ttlDays<=0?null:Math.min(raw.ttlDays,365);
    return assertArguments({content,key,scope,clientId,ttlDays},context);
  }
  function assertMemoryProposeCommand(value,options) {
    const command=snapshotOperationData(value),context=contextData(options);
    validatePublicShape('Command',command);
    if(command.action!=='memory.propose'||command.attachments.length!==0||canonicalSha256(command.binding)!==canonicalSha256(context.binding))fail('Memory proposal original provenance mismatch');
    assertArguments(command.arguments,context);
    if(command.scopes.some(scope=>scope.tenantId!==command.binding.tenantId))fail('Cross-tenant memory proposal scope');
    return command;
  }
  function assertMemoryProposeResult(value,commandValue,options) {
    const command=assertMemoryProposeCommand(commandValue,options),result=snapshotOperationData(value);
    validateShape('MemoryProposeResult',result);
    if(result.commandSha256!==canonicalSha256(command))fail('Pending candidate differs from immutable command');
    // This describes a correlated candidate only, never approval or persistence proof.
    return result;
  }
  return Object.freeze({normalizeMemoryProposeInput,assertMemoryProposeCommand,assertMemoryProposeResult});
}

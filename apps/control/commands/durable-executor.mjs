/** Concrete control owner over the single canonical durable budget producer. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createPostgresBudgetExecution} from '../../gateway/index.mjs';
import {createCommandExecutor} from './executor.mjs';
import {data,deny,own} from './protocol.mjs';

export function createPostgresCommandExecutor(options){
 const {pool,allocationJson,producerContext,...configured}=own(options,
  ['pool','allocationJson','producerContext','journal','authority','approvalStore','source','contracts','descriptor','context','now','newId','limits'],['sourceEnabled']);
 const trusted=data({producerContext,context:configured.context,descriptor:configured.descriptor});
 own(trusted.producerContext,['context','producer']);
 function input(raw){const value=data(typeof raw==='string'?JSON.parse(raw):raw);own(value,['proposal','execution']);return configured.contracts.inspect(value.proposal,value.execution,trusted.context);}
 function requestIdentity(raw){const call=input(raw);if(trusted.descriptor.action!==call.proposal.command.action)deny('COMMAND_CONFIGURATION');
  return JSON.stringify({operation:trusted.descriptor.operation,arguments:{commandSha256:call.proposal.commandSha256,proposalSha256:canonicalSha256(call.proposal),contextSha256:canonicalSha256(trusted.context)}});}
 const common={...configured,context:trusted.context,descriptor:trusted.descriptor};
 const durable=createPostgresBudgetExecution({pool,allocationJson,authority:configured.authority,limits:configured.limits,now:configured.now,requestIdentity,
  createExecutor:ports=>{const executor=createCommandExecutor({...common,...ports});return Object.freeze({execute:(raw,credential,signal)=>executor.execute(JSON.parse(raw),credential,signal)});}});
 const noEffect=()=>deny('COMMAND_BUDGET_UNAVAILABLE');
 const observer=createCommandExecutor({...common,budget:{reserve:noEffect,settle:noEffect,markUncertain:noEffect}});
 function admitted(value){if(!configured.sourceEnabled)deny('UNAVAILABLE');const call=input(value);
  // Personal memory is admitted only to a source that produces pending candidates (the governed memory producer), never to the
  // legacy auto-committing route.
  if(call.proposal.command.action==='memory.propose'&&call.proposal.command.arguments.scope==='personal'&&configured.source.personalPending!==true)deny('PENDING_PRODUCER_UNAVAILABLE');
  return {raw:JSON.stringify({proposal:call.proposal,execution:call.execution}),delivery:JSON.stringify({...trusted.producerContext,deliveryId:call.proposal.command.commandId})};}
 return Object.freeze({sourceEnabled:configured.sourceEnabled===true,
  bindTrustedGrant:durable.bindTrustedGrant,
  prepareInvocation(value,signal){const call=admitted(value);return durable.prepareInvocation(call.delivery,call.raw,signal);},
  execute(value,credential,signal){const call=admitted(value);return durable.executeOwned(call.raw,credential,call.delivery,signal);},
  readOutcome:observer.readOutcome,
  reconcileInvocation(value){const call=input(value);return durable.reconcileInvocation(JSON.stringify({...trusted.producerContext,deliveryId:call.proposal.command.commandId}),JSON.stringify({proposal:call.proposal,execution:call.execution}));},
 });
}

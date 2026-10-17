/** Prepares a command intent through the existing command tool interface (`commands/tool-interface.mjs` `prepare`)
 * and its approval-metadata owner. It never calls `executeApproved`: the result is the owner's immutable
 * `approval_required` proposal, executable later only through the existing approval route with fresh authority.
 *
 * Task creation and task updates use their action-specific approval-metadata owners. Other command actions stay
 * unavailable until their proposal owner exists.
 *
 * Effect classification for the replay journal: a refusal before the metadata owner was called, or the owner's own
 * NOT_STORED, is `none`; anything after the owner was called (UNKNOWN, STORED_NOT_RELEASED, a refused release) is
 * `unknown`, because a stored proposal may exist. */
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {intentFault} from './faults.mjs';
export const COMMAND_INTENT_OPERATIONS=Object.freeze({create_task:'task.create',update_task:'task.update'});
/** @param {{commandOptions:object}} configuration the exact `createCommandToolInterface` options of the trusted composition */
export function createCommandIntentPreparer(configuration){
 const {commandOptions}=own(configuration,['commandOptions']),options=own(commandOptions,['operation','action','outputShape','commandContext','validators','assertProposal','approvalMetadataOwner','executor','now','limits']);
 const operation=data(options.operation);own(operation,['id','version']);
 if(COMMAND_INTENT_OPERATIONS[operation.id]!==options.action||operation.version!=='0.2.0')throw intentFault('INTENT_CONFIGURATION');
 const metadata=own(options.approvalMetadataOwner,['prepare','read']);if(typeof metadata.prepare!=='function')throw intentFault('INTENT_CONFIGURATION');
 const refuse=()=>{throw intentFault('INTENT_EXECUTION_REFUSED');};
 // One prepare-only interface per call: its metadata wrapper records whether the owner was reached, and its executor
 // and metadata read refuse, so no execution is reachable from this path.
 const prepareOnly=state=>createCommandToolInterface({...options,executor:{execute:refuse},
  approvalMetadataOwner:{prepare:value=>{state.called=true;return metadata.prepare.call(options.approvalMetadataOwner,value);},read:refuse}});
 const binding=data(options.commandContext).binding;prepareOnly({}); // configuration is validated now, not at the first call
 return Object.freeze({operation:Object.freeze({...operation}),owner:'command',binding,
  async prepare({arguments:request,signal}){
   const state={called:false};
   try{
    const commands=prepareOnly(state);
    const value=data(await commands.prepare(request,{signal}));own(value,['status','proposal']);
    if(value.status!=='approval_required'||value.proposal.command.action!==options.action||canonicalSha256(value.proposal.command.binding)!==canonicalSha256(binding))throw intentFault('INVALID_RESULT','unknown');
    return value;
   }catch(error){
    if(error?.effect)throw error;
    const code=typeof error?.message==='string'?error.message:'',outcome=error?.outcome;
    if(!state.called)throw intentFault(code==='DEADLINE'||code==='CANCELLED'?code:'INVALID_ARGUMENTS','none');
    if(outcome==='NOT_STORED')throw intentFault(code==='DEADLINE'||code==='CANCELLED'?code:'REFUSED','none');
    throw intentFault('UNKNOWN','unknown');
   }
  }});
}

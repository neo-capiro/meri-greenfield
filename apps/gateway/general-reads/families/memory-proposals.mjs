/** memory-proposals: retain the existing typed projection and subject checks. */
import {createMemoryProposalHttpAdapter} from '../../sources/memory-proposals/http-adapter.mjs';
import {createMemoryProposalReadHandler} from '../../sources/memory-proposals/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='memory-proposals',sourceDirectory='memory-proposals';
export function createHandlers(configuration){
 const adapter=createMemoryProposalHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createMemoryProposalReadHandler({adapter,now:configuration.now})}));
}

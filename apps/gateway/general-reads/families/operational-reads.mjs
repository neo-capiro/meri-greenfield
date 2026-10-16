/** Actor-bound tasks and client-required historical actions retain their original source owners. */
import {createOriginalTrackingSourceMount} from '../../sources/original-tracking/mount.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {familyOperations} from '../registration.mjs';
export const id='operational-reads',sourceDirectory='original-tracking';
export function createHandlers(configuration){
 return familyOperations(id).map(operation=>({operation,execute:createOriginalTrackingSourceMount({...configuration,operation,
  sourceIdentity:resolveOperationContract(operation).descriptor.sourceRequirements[0]}).execute}));
}

/** Memory-specific binding of the one approval-metadata owner; no parallel policy, storage, retry or execution path. */
import {createCommandApprovalMetadataOwner} from './owner.mjs';

export function createMemoryProposeApprovalMetadataOwner(configuration){
 return createCommandApprovalMetadataOwner(configuration,'memory.propose');
}

/** Canonical read references for family composition, with no registry of duplicate operation definitions. */
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
export function familyOperations(family){
 return catalog.operations.filter(d=>d.sideEffect==='none'&&d.approvalBoundary==='none'&&
  resolveOperationContract(d.operation).binding?.group===family).map(d=>Object.freeze({...d.operation}));
}

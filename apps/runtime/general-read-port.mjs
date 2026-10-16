/** Trusted gateway mount borrowed by both runner compositions. No allocation, receipts or policy are manufactured here. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
export function captureGeneralReadPort(value,sourceEnabled){
 if(value===undefined)return undefined;
 own(value,['readAvailability','execute']);
 const captured=Object.freeze({readAvailability:storageMethod(value,'readAvailability'),execute:storageMethod(value,'execute')});
 return sourceEnabled===true?captured:undefined;
}

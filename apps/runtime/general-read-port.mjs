/** Trusted gateway mount borrowed by the SDK conversation runner. No allocation, receipts or policy are manufactured here. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
export function captureGeneralReadPort(value,sourceEnabled){
 if(value===undefined)return undefined;
 own(value,['readAvailability','execute'],['externalUsage']);
 const captured=Object.freeze({readAvailability:storageMethod(value,'readAvailability'),execute:storageMethod(value,'execute'),
  ...(value.externalUsage===undefined?{}:{externalUsage:storageMethod(value,'externalUsage')})});
 return sourceEnabled===true?captured:undefined;
}

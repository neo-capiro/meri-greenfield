/** Passive acquisition composition. Missing genuine current Core context remains unavailable. */
import {createAcquisitionPersonnelHandlers} from '../../sources/acquisition-personnel/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='acquisition-personnel',sourceDirectory='acquisition-personnel';
export function createHandlers(configuration){
 return createAcquisitionPersonnelHandlers(configuration,familyOperations(id));
}

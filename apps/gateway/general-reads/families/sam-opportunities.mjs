/** Existing Core producer with its exact calculation context. */
import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='sam-opportunities',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{family:id,routes:{search_sam_opportunities:'/api/clio/tools/search_sam_opportunities'},observation:'producer-context'});

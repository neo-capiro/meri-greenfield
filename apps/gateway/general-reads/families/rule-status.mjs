/** Existing Core producer with its exact calculation context. */
import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='rule-status',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{family:id,routes:{get_state_rule_status:'/api/clio/tools/get_state_rule_status'},observation:'producer-context'});

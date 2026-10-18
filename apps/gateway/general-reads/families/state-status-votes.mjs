import {createStateStatusVotesHandlers} from '../../sources/state-status-votes/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='state-status-votes',sourceDirectory='state-status-votes';
export const createHandlers=configuration=>createStateStatusVotesHandlers(configuration,familyOperations(id));

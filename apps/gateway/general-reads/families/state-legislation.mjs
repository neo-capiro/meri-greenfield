/** Compose only the two admitted stored state producers; construction grants no availability. */
import {createStateLegislationHandlers} from '../../sources/state-legislation/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='state-legislation',sourceDirectory='state-legislation';
export const createHandlers=configuration=>createStateLegislationHandlers(configuration,familyOperations(id));

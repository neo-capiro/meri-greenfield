/** Additive public data family; no installation or current authority is inferred here. */
import {createCapiroDataHandlers} from '../../sources/capiro-data/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='capiro-data',sourceDirectory='capiro-data';
export const createHandlers=configuration=>createCapiroDataHandlers(configuration,familyOperations(id));

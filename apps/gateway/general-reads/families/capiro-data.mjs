/** Additive public data family; no installation or current authority is inferred here. */
import {createCapiroDataHandlers,createCapiroData3Handlers,createCapiroData4Handlers,createCapiroData5Handlers} from '../../sources/capiro-data/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='capiro-data',sourceDirectory='capiro-data';
export const createHandlers=configuration=>createCapiroDataHandlers(configuration,familyOperations(id));
export const successor=Object.freeze({id:'capiro-data-v3',sourceDirectory,
 createHandlers:configuration=>createCapiroData3Handlers(configuration,familyOperations('capiro-data-v3'))});

export const privateSuccessor=Object.freeze({id:'capiro-data-v4',sourceDirectory,
 createHandlers:configuration=>createCapiroData4Handlers(configuration,familyOperations('capiro-data-v4'))});

export const domainSuccessor=Object.freeze({id:'capiro-data-v5',sourceDirectory,createHandlers:configuration=>createCapiroData5Handlers(configuration,familyOperations('capiro-data-v5'))});

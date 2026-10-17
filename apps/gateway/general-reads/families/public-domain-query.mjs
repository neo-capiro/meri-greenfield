/** Finite typed global dataset query; native analytics audit writes remain part of its source behavior. */
import {createPublicDomainQueryHandlers} from '../../sources/public-domain-query/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-domain-query',sourceDirectory='public-domain-query';
export const createHandlers=configuration=>createPublicDomainQueryHandlers(configuration,familyOperations(id));

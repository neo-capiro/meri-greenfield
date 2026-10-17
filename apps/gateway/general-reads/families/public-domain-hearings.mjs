import {createPublicDomainHearingsHandlers} from '../../sources/public-domain-hearings/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-domain-hearings',sourceDirectory='public-domain-hearings';
export const createHandlers=configuration=>createPublicDomainHearingsHandlers(configuration,familyOperations(id));

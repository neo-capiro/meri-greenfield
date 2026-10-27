import {createLegiwatchReviewHandlers} from '../../sources/legiwatch-review/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='legiwatch-review',sourceDirectory='legiwatch-review';
export const createHandlers=configuration=>createLegiwatchReviewHandlers(configuration,familyOperations(id));

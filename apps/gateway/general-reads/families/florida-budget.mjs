/** Retained Florida evidence read; construction is not installation. */
import {createFloridaBudgetHandlers} from '../../sources/florida-budget/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='florida-budget',sourceDirectory='florida-budget';
export const createHandlers=configuration=>createFloridaBudgetHandlers(configuration,familyOperations(id));

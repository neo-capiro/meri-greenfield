/** The data-access read route for `createProductApplication`: membership-gated, read-only, no effect.
 *  POST /api/data-access/read {clientId: uuid|null} → {schemaVersion, checkedAt, clientId, generalReads, families, relations} */
import {DATA_ACCESS_PATH,DATA_ACCESS_ERRORS} from './protocol.mjs';
export function createDataAccessRoutes({reader}){
 if(typeof reader?.read!=='function')throw new TypeError('DATA_ACCESS_CONFIGURATION');
 return Object.freeze({[DATA_ACCESS_PATH]:Object.freeze({errors:DATA_ACCESS_ERRORS,effect:false,handle:({principal,body,signal})=>reader.read({principal,request:body,signal})})});
}

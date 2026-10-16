/** entity-candidates: compose the canonical passive adapter; registration confers no availability. */
import {createIdentityContactsHttpAdapter} from '../../sources/identity-contacts/http-adapter.mjs';
import {createIdentityContactsReadHandler} from '../../sources/identity-contacts/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='entity-candidates',sourceDirectory='identity-contacts';
export function createHandlers(configuration){
 const adapter=createIdentityContactsHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createIdentityContactsReadHandler({operation,adapter,now:configuration.now})}));
}

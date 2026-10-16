/** Complete actions are client-scoped only; other canonical modes remain UNAVAILABLE. */
import {createActionItemsHttpAdapter} from '../../sources/action-items/http-adapter.mjs';
import {createActionItemsReadHandler} from '../../sources/action-items/handler.mjs';
import {ownFields} from '../../sources/source-admission.mjs';
import {familyOperations} from '../registration.mjs';
export const id='action-items-complete',sourceDirectory='action-items';
export function createHandlers(configuration){
 const {newId,...transport}=ownFields(configuration,['origin','getCredentials','now','newId'],['fetchImpl','maxRequestMs','maxResponseBytes']);
 const adapter=createActionItemsHttpAdapter(transport);
 return familyOperations(id).map(operation=>({operation,execute:createActionItemsReadHandler({adapter,now:transport.now,newId})}));
}

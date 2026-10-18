/** client-knowledge-monday: compose the canonical passive adapter; registration confers no availability. */
import {createMondaySignedHttpAdapter} from '../../sources/client-knowledge/monday-signed-adapter.mjs';
import {createMondaySignedReadHandler} from '../../sources/client-knowledge/monday-signed-handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-monday',sourceDirectory='client-knowledge';
export function createHandlers(configuration){
 const adapter=createMondaySignedHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createMondaySignedReadHandler({operation,adapter,now:configuration.now})}));
}

/** client-knowledge-monday: compose the canonical passive adapter; registration confers no availability. */
import {createClientKnowledgeHttpAdapter} from '../../sources/client-knowledge/http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../../sources/client-knowledge/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-monday',sourceDirectory='client-knowledge';
export function createHandlers(configuration){
 const adapter=createClientKnowledgeHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createClientKnowledgeReadHandler({operation,adapter,now:configuration.now})}));
}

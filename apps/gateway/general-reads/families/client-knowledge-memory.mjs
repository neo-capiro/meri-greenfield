/** Client memory uses only its task-bound Core page and distinct eligibility helper. */
import {createSignedMemoryHttpAdapter} from '../../sources/client-knowledge/memory-signed-http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../../sources/client-knowledge/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-memory',sourceDirectory='client-knowledge';
export function createHandlers(configuration){
 const adapter=createSignedMemoryHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createClientKnowledgeReadHandler({operation,adapter,now:configuration.now})}));
}

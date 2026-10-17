/** The finite graph projection only; embedding search has no correlated native clock yet. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({query_knowledge_graph:'/api/clio/tools/query_knowledge_graph'});
export function createKnowledgeGraphHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'client-knowledge-search',routes});
}

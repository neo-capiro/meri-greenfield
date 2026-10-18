/** Complete semantic/graph family. Semantic clocks travel privately; graph retains its independent wire. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {captureClientKnowledgeSearchSelection,assertClientKnowledgeSearchSubject} from './request-context.mjs';
const routes=Object.freeze({query_knowledge_graph:'/api/clio/tools/query_knowledge_graph'});
export function createKnowledgeGraphHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'client-knowledge-search',routes});
}

export function createClientKnowledgeSearchHandlers(configuration,operations){
 let selected;try{selected=frozenData(operations);if(!Array.isArray(selected)||!selected.length||selected.some(op=>!['search_client_knowledge','query_knowledge_graph'].includes(ownFields(op,['id','version']).id)))deny('GATEWAY_CONFIGURATION');}catch{deny('GATEWAY_CONFIGURATION');}
 const graph=selected.filter(op=>op.id==='query_knowledge_graph'),search=selected.filter(op=>op.id==='search_client_knowledge');
 const handlers=graph.length?createKnowledgeGraphHandlers(configuration,graph):[];
 if(search.length){
  const semantic=createStoredNativeReadHandlers(configuration,search,{family:'client-knowledge-search',routes:{search_client_knowledge:'/api/clio/tools/search_client_knowledge'},observation:'client-knowledge-asof'});
  handlers.push(...semantic.map(handler=>({operation:handler.operation,async execute(call){try{
   const {signal:ignored,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']),data=frozenData(fields);
   assertClientKnowledgeSearchSubject(data.authority.subject,captureClientKnowledgeSearchSelection(handler.operation,data.request));
   return await handler.execute(call);
  }catch(error){throw safeFailure(error);}}})));
 }
 return selected.map(reference=>handlers.find(handler=>handler.operation.id===reference.id));
}

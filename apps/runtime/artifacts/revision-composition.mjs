/** Current run selection comes only from its immutable stored request. The original
 * action session is borrowed for the existing artifact/Core read owner; no grant is minted. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertDocumentRevisionSelection,supportsSelectedDocumentRevision} from '../../../packages/contracts/document-revision.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../../control/action-host/session/owner.mjs';
import {admitDocumentRevisionSource} from '../../control/intents/document-revision.mjs';
import {createRuntimeDocumentRevisionSource} from './revision-source.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createDocumentRevisionRunOwner({bound,optionsOwner,now,limits}){
 async function selectionFor({binding,signal},selected=false){
  const current=bound();if(!current?.store)fail('UNAVAILABLE');
  const saved=await current.store.read(binding,{after:0,limit:1},()=>signal?.throwIfAborted());signal?.throwIfAborted();
  if(hash(saved.run.binding)!==hash(binding))fail('ACCESS_DENIED');
  if(saved.request.documentRevision===undefined)return null;
  if(saved.request.skill!==null&&!(selected&&supportsSelectedDocumentRevision(saved.request.skill)))fail('ACCESS_DENIED');
  return assertDocumentRevisionSelection(saved.request.documentRevision);
 }
 async function sourceFor(value,selected=false){
  const q=own(value,['binding','selection','deadlineMs'],['signal']),selection=assertDocumentRevisionSelection(q.selection),savedSelection=await selectionFor(q,selected);
  if(hash(savedSelection)!==hash(selection))fail('ACCESS_DENIED');
  const current=bound(),borrow=borrowedRunSession(current.sessions);if(!borrow)fail('UNAVAILABLE');
  const saved=await current.store.read(q.binding,{after:0,limit:1},()=>q.signal?.throwIfAborted());
  const scopes=saved.run.scopes,clients=scopes.filter(s=>s.kind==='client');
  const selectedClientId=clients.length===1&&!scopes.some(s=>s.kind==='private-user')?clients[0].resourceId:scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===q.binding.actorId?null:undefined;
  if(selectedClientId===undefined)fail('ACCESS_DENIED');
  try{assertNativeConversationScope({binding:q.binding,scopes,selectedClientId});}catch{fail('ACCESS_DENIED');}
  const session=assertActionSessionReceipt(await borrow({binding:q.binding,selectedClientId,signal:q.signal}),now());
  const reader=createRuntimeDocumentRevisionSource({sessions:current.sessions,optionsOwner,now,limits,...(current.retention?{retention:current.retention}:{})});
  const source=await reader.read({credential:session.credential,selection,deadlineMs:Math.min(q.deadlineMs,session.expiresAtMs),signal:q.signal});
  const admitted=admitDocumentRevisionSource(source,{selection,binding:q.binding,request:source.request,preservation:({retained})=>{
   // The private read has just verified these exact immutable parent citations. Asset objects need their durable source owner.
   if(retained.assetIds.length)fail('UNAVAILABLE');return {evidence:source.version.evidence,assets:[]};
  }});
  return {selection,source,admitted};
 }
 return Object.freeze({selectionFor,async read(value){
  const {selection,admitted}=await sourceFor(value,true);return data({selection,request:admitted.request,specSha256:admitted.specSha256});
 },async readForSelected(value){
  const {source,admitted}=await sourceFor(value,true);return data({...source,request:admitted.request});
 }});
}

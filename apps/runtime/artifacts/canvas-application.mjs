/** Native canvas read/save over the existing source, authorization and revision
 * owners. No draft store, renderer, model loop or browser authority is added. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {receiveCanvasRequest,receiveCanvasResponse,DOCUMENT_CANVAS_PATHS} from '../../../packages/contracts/document-canvas.mjs';
import {createRuntimeDocumentRevisionSource} from './revision-source.mjs';
import {admitDocumentRevisionSource,referencedAssetIds} from '../../control/intents/document-revision.mjs';
import {requestInfo,jsonBody,response,errorResponse,fail} from '../../control/document-application/http.mjs';
import {documentLimits,method} from '../../control/document-application/current.mjs';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
const get=name=>Object.getOwnPropertyDescriptor(Request.prototype,name).get;
function canvasRequest(request){
 let url;try{url=new URL(get('url').call(request));}catch{fail('INVALID_REQUEST');}
 const name=Object.keys(DOCUMENT_CANVAS_PATHS).find(key=>DOCUMENT_CANVAS_PATHS[key]===url.pathname);
 if(!name||url.search||url.hash)fail('NOT_FOUND',404);
 // Apply the unchanged document HTTP boundary to a fixed internal route.
 const fields=Object.fromEntries(['method','headers','body','signal'].map(key=>[key,get(key).call(request)]));
 const target=new URL('/api/documents/'+(name==='canvas-read'?'inspect':'revise'),url);
 return {name,info:requestInfo(new Request(target,{...fields,...(fields.body?{duplex:'half'}:{})}))};
}
function editable(source){
 if(source.request?.operation!=='create_word'||!['docx','txt'].includes(source.request.format)||Object.hasOwn(source.request,'sourceKind'))fail('UNSUPPORTED_DOCUMENT_FORMAT',422);
}
function retainedRevision(source,selection,request){
 if(source.assets===undefined&&referencedAssetIds(source.request).length)fail('UNAVAILABLE',503);
 const admitted=admitDocumentRevisionSource(source,{selection,binding:source.version.binding,request,
  preservation:()=>({evidence:source.version.evidence,assets:source.assets??[]})});
 return admitted.preserved===null?{}:{retained:{baseVersionId:selection.versionId,evidence:admitted.preserved.evidence,
  assets:admitted.preserved.assets,evidenceSha256:hash(admitted.preserved.evidence)}};
}
export function createDocumentCanvasApplication({application,optionsOwner,sessions,now,limits:rawLimits,retention}){
 const handle=method(application,'handle'),limits=documentLimits(rawLimits);
 const source=optionsOwner===undefined?null:createRuntimeDocumentRevisionSource({optionsOwner,sessions,now,limits,...(retention===undefined?{}:{retention})});
 return Object.freeze({async handle(request){
  let life;const state={};
  try{
   const {name,info}=canvasRequest(request);if(!source)fail('UNAVAILABLE',503);
   life=createOperationLifetime({now,signal:info.signal,deadlineMs:now()+limits.maxRequestMs,errorFactory:code=>Object.assign(Error(code),{code})});
   const body=await jsonBody(info,name==='canvas-read'?Math.min(limits.maxRequestBytes,8192):limits.maxRequestBytes,life,life.check);
   let call;try{call=receiveCanvasRequest(name,encode(body));}catch{fail('INVALID_REQUEST');}
   state.readStarted=name==='canvas-read';
   const selected=await source.read({credential:info.credential,selection:call.selection,deadlineMs:life.deadline(),signal:life.signal});
   editable(selected);
   if(name==='canvas-read'){
    const value={version:selected.version,inspection:selected.inspection,request:selected.request,headVersionId:selected.headVersionId};
    const bytes=encode(value);if(bytes.byteLength>limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
    const received=await receiveCanvasResponse(name,200,bytes,call);life.check();state.completed=true;return response(received);
   }
   const retained=retainedRevision(selected,call.selection,call.request);
   const bodyText=JSON.stringify({deliveryId:call.deliveryId,baseVersionId:call.selection.versionId,request:call.request});
   const revision=new Request('https://meri-control.internal/api/documents/revise',{method:'POST',headers:{authorization:'Bearer '+info.credential,
    'content-type':'application/json','content-length':String(Buffer.byteLength(bodyText))},body:bodyText,signal:life.signal});
   state.writeStarted=true;
   const saved=await life.run(()=>handle(revision,{deadlineMs:life.deadline(),...retained}));state.completed=saved.status===200;
   const bytes=new Uint8Array(await life.run(()=>saved.arrayBuffer()));
   if(bytes.byteLength>limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
   const received=await receiveCanvasResponse(name,saved.status,bytes,call);life.check();return response(received,saved.status);
  }catch(error){return errorResponse(error,state);}finally{life?.close();}
 }});
}

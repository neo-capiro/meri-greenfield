/** Existing session/lifecycle authority resolves the browser's current custody.
 * Transport routing metadata remains private. No additional hold/session ledger. */
import {createHash} from 'node:crypto';
import {BROWSER_VIEWER_SCHEMA as schema,receiveBrowserViewerRequest,receiveBrowserViewerResponse} from '../../../packages/contracts/browser-viewer/receive.mjs';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
const fail=code=>{throw Object.assign(Error(code),{code});};
const contextOf=value=>Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,value.sourceBinding[k]]).concat([['selectedClientId',value.selectedClientId]]));
export function createBrowserViewerApplication({lifecycle,transport,now=Date.now}){
 if(!['readTakeover','control'].every(name=>typeof lifecycle?.[name]==='function')||typeof transport?.execute!=='function')fail('BROWSER_VIEWER_CONFIGURATION');
 return Object.freeze({async execute(route,input,{credential,signal}={}){
  const request=receiveBrowserViewerRequest(route,encode(input));
  let current=await lifecycle.readTakeover({credential,signal});signal?.throwIfAborted();
  if(route==='ticket'&&current.state==='available'){
   await lifecycle.control({credential,input:{controlId:request.requestId,intent:'takeover.begin'},signal});
   current=await lifecycle.readTakeover({credential,signal});signal?.throwIfAborted();
  }
  if(!current||current.expiresAtMs<=now())fail('EXPIRED');
  const context=contextOf(current);
  if(!current.custody||current.state==='unavailable'){
   if(route!=='read')fail(current.state==='pending'?'CONFLICT':'UNAVAILABLE');
   return receiveBrowserViewerResponse(route,200,encode({schema,context,binding:current.sourceBinding,checkpoint:null,ownerId:current.ownerInstanceId??null,
    state:current.state==='available'?'agent':current.state==='pending'?'taking':'unavailable',lease:null,pages:[]}),request,context);
  }
  if(route!=='read'&&request.ownerId!==undefined&&request.ownerId!==current.ownerInstanceId)fail('CONFLICT');
  const checkpoint=current.checkpointId?{checkpointId:current.checkpointId,checkpointSha256:current.checkpointSha256}:null;
  const grant={context,checkpoint,sessionKey:createHash('sha256').update(credential).digest('hex'),expiresAtMs:current.expiresAtMs,custody:current.custody};
  const answer=await transport.execute({route,request,grant,signal});signal?.throwIfAborted();
  // Re-read after the host request. Late pixels and replies cannot cross a revoke,
  // successor, changed owner or client selection.
  const after=await lifecycle.readTakeover({credential,signal});signal?.throwIfAborted();
  if(after.expiresAtMs<=now()||after.ownerInstanceId!==current.ownerInstanceId||
    JSON.stringify(contextOf(after))!==JSON.stringify(context)||!after.custody||
    after.custody.hostId!==current.custody.hostId||after.custody.generation!==current.custody.generation)fail('ACCESS_DENIED');
  return receiveBrowserViewerResponse(route,200,encode(answer),request,context);
 }});
}

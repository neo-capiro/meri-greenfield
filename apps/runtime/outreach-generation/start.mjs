/** Launch one Core-owned recipient unit through ordinary session/input/Temporal owners. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response} from '../../control/action-application/http.mjs';
import {outreachGenerationStartMetadata as wire,requireOutreachGenerationStartRequest} from '../../../packages/contracts/outreach-generation.mjs';
import {outreachSelection,outreachFailure} from '../../../packages/runtime/outreach-generation.mjs';
export function createOutreachStartApplication({core,sessions,service,now=Date.now,maxRequestMs=3000}){
 return Object.freeze({async handle(request){
  const url=new URL(request.url);if(url.pathname!==wire.path)return null;let life,dispatched=false;
  const failed=(code,status=503)=>response({error:{code}},status);
  try{
   const auth=request.headers.get('authorization');if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(auth??''))return failed('SESSION_REFUSED',401);
   if(request.method!=='POST'||url.search||url.hash||request.headers.get('content-encoding')||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??''))return failed('OUTREACH_GENERATION_REFUSED',400);
   const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/u.test(length)||Number(length)>wire.requestBytes))return failed('OUTREACH_GENERATION_REFUSED',400);
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:outreachFailure});let input;
   try{input=requireOutreachGenerationStartRequest(await jsonBody({body:request.body,length:length===null?null:Number(length)},wire.requestBytes,life,life.check));}catch{return failed('OUTREACH_GENERATION_REFUSED',400);}
   const credential=auth.slice(7),selection=outreachSelection(await life.run(signal=>core.claim(input,{credential,signal,deadlineMs:life.deadline()})));
   if(selection.generationJobId!==input.generationJobId||selection.itemId!==input.itemId)throw outreachFailure();
   const session=await life.run(signal=>sessions.issue({identityCredential:credential,hints:{conversationId:selection.conversationId,clientId:selection.clientId},signal,deadlineMs:life.deadline()}));
   if(session.context.conversationId!==selection.conversationId||session.context.selectedClientId!==selection.clientId)throw outreachFailure();
   const accepted={requestId:selection.requestId,prompt:selection.prompt};
   await life.run(signal=>service.allocateInput({credential:session.credential,input:accepted,signal}));
   dispatched=true;await life.run(signal=>service.submit({credential:session.credential,input:accepted,signal}));life.check();
   return response({state:'requested',...input,conversationId:selection.conversationId,requestId:selection.requestId,session},202);
  }catch{return failed(dispatched?'OUTREACH_GENERATION_UNKNOWN':'OUTREACH_GENERATION_UNAVAILABLE');}finally{life?.close();}
 }});
}

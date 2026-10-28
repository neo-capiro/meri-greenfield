/** One purpose-isolated AgentCore V1 invocation. Never creates an SDK run, reads control credentials or fetches object URLs. */
import {jsonBody} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {AGENTCORE_SESSION_HEADER} from '../agentcore-contract.mjs';
import {rendererInput,rendererSessionId,rendererFault,rendererSha,RENDERER_WIRE_BYTES} from './renderer-contract.mjs';
import {qualifyRuntimeRenderer} from './renderer-sandbox.mjs';
export function createRuntimeRendererApplication({imageDigest,qualify=qualifyRuntimeRenderer,now=Date.now,signal}={}){
 let used=false,active=false,poisoned=false,pending;const stop=new AbortController();
 const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 return Object.freeze({async close({deadlineMs}){stop.abort();const life=createOperationLifetime({now,deadlineMs,errorFactory:rendererFault});try{if(pending)await life.run(()=>pending);return {settled:!active};}finally{life.close();}},
  async handle(request){const url=new URL(request.url);
   if(url.pathname==='/ping'&&!url.search)return request.method!=='GET'?json({error:{code:'METHOD_NOT_ALLOWED'}},405):json({status:poisoned||stop.signal.aborted?'Unhealthy':active?'HealthyBusy':'Healthy'},poisoned||stop.signal.aborted?503:200);
   if(url.pathname!=='/invocations'||url.search||request.method!=='POST')return json({error:{code:'RENDERER_REQUEST_REFUSED'}},400);
   if(used||active||stop.signal.aborted||signal?.aborted)return json({error:{code:'RENDERER_SESSION_USED'}},409);
   const joined=AbortSignal.any([request.signal,stop.signal,...(signal?[signal]:[])]),readLife=createOperationLifetime({now,deadlineMs:now()+10000,signal:joined,errorFactory:rendererFault});let input;
   try{if(request.headers.get('content-type')!=='application/json'||request.headers.get('content-encoding'))throw Error();
    const rawLength=request.headers.get('content-length');if(rawLength!==null&&!/^(0|[1-9][0-9]*)$/u.test(rawLength))throw Error();
    input=rendererInput(await jsonBody({body:request.body,length:rawLength===null?null:Number(rawLength)},RENDERER_WIRE_BYTES,readLife,readLife.check));
    if(input.imageDigest!==imageDigest||request.headers.get(AGENTCORE_SESSION_HEADER)!==rendererSessionId(input.requestId)||input.deadlineMs<=now()||input.deadlineMs>now()+60000)throw Error();
   }catch{return json({error:{code:'RENDERER_REQUEST_REFUSED'}},400);}finally{readLife.close();}
   // Body reads yield: a second invocation may have claimed this one-use environment meanwhile.
   if(used||active||stop.signal.aborted||signal?.aborted)return json({error:{code:'RENDERER_SESSION_USED'}},409);
   used=true;active=true;const life=createOperationLifetime({now,deadlineMs:input.deadlineMs,signal:joined,errorFactory:rendererFault});
   pending=(async()=>{try{
    const qualification=await life.run(signal=>qualify({imageDigest,deadlineMs:input.deadlineMs,signal}));
    if(qualification.port.state!=='available'||qualification.admission?.imageDigest!==imageDigest)return json({error:{code:'ARTIFACT_RENDERER_UNAVAILABLE'}},503);
    const base={kind:'artifact-renderer-result',requestId:input.requestId,admission:qualification.admission,qualification:qualification.receipt};
    if(input.action==='qualify')return json(base);
    const result=await life.run(signal=>qualification.port.transform({bytes:Buffer.from(input.bytesBase64,'base64'),format:input.format,target:input.target,deadlineMs:input.deadlineMs,maxBytes:input.maxBytes,signal}));
    if(!Buffer.isBuffer(result.bytes)||result.bytes.length<1||result.bytes.length>input.maxBytes||!result.bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||result.receipt.inputSha256!==input.inputSha256||result.receipt.outputSha256!==rendererSha(result.bytes))throw Error();
    life.check();return json({...base,bytesBase64:result.bytes.toString('base64'),receipt:result.receipt});
   }catch{poisoned=true;return json({error:{code:'ARTIFACT_RENDERER_UNAVAILABLE'}},503);}finally{active=false;life.close();}})();
   return pending;
  }});
}

/** Standard IAM AgentCore V1 transport to the fixed no-model renderer. A call is never retried; its own one-use session is
 * stopped even on malformed/unknown output. The preview owner, not this transport, owns durable publication uncertainty. */
import {randomBytes} from 'node:crypto';
import {BedrockAgentCoreClient,InvokeAgentRuntimeCommand,StopRuntimeSessionCommand} from '@aws-sdk/client-bedrock-agentcore';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createRendererPort} from '../../artifacts/renderer.mjs';
import {rendererInput,rendererSessionId,rendererFault,rendererSha,RENDERER_WIRE_BYTES} from './renderer-contract.mjs';
export async function createAgentCoreRenderer({region,agentRuntimeArn,qualifier,imageDigest,now=Date.now,client}={}){
 if(typeof region!=='string'||!/^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/u.test(agentRuntimeArn??'')||agentRuntimeArn.split(':')[3]!==region||! /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u.test(qualifier??'')||!/^sha256:[a-f0-9]{64}$/u.test(imageDigest??''))throw rendererFault('RENDERER_CONFIGURATION');
 async function invoke(action,call={}){
  const {signal,...fields}=call,requestId=randomBytes(32).toString('hex'),input=rendererInput({kind:'artifact-renderer',action,requestId,imageDigest,...fields,deadlineMs:Math.min(fields.deadlineMs??now()+30000,now()+60000)});
  const session=rendererSessionId(requestId),sdk=client??new BedrockAgentCoreClient({region,maxAttempts:1}),life=createOperationLifetime({now,deadlineMs:input.deadlineMs,signal,errorFactory:rendererFault});let response,dispatched=false,stopFailure;
  try{
   response=await life.run(abortSignal=>{dispatched=true;return sdk.send(new InvokeAgentRuntimeCommand({agentRuntimeArn,qualifier,runtimeSessionId:session,contentType:'application/json',accept:'application/json',payload:Buffer.from(JSON.stringify(input))}),{abortSignal});});
   if(response.statusCode!==200||response.$metadata?.httpStatusCode!==200||response.runtimeSessionId!==session||response.contentType!=='application/json'||typeof response.response?.[Symbol.asyncIterator]!=='function')throw rendererFault('ARTIFACT_RENDERER_UNAVAILABLE');
   let size=0;const chunks=[],iterator=response.response[Symbol.asyncIterator]();
   while(true){const next=await life.run(()=>iterator.next());if(next.done)break;if(!(next.value instanceof Uint8Array)||(size+=next.value.length)>RENDERER_WIRE_BYTES)throw rendererFault('RENDERER_RESULT_REFUSED');chunks.push(Buffer.from(next.value));}
   const result=data(own(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),['kind','requestId','admission','qualification'],action==='transform'?['bytesBase64','receipt']:[]));
   if(result.kind!=='artifact-renderer-result'||result.requestId!==requestId||result.admission?.imageDigest!==imageDigest||result.qualification?.imageDigest!==imageDigest||result.qualification?.state!=='available')throw rendererFault('RENDERER_RESULT_REFUSED');
   if(action==='transform'){
    if(typeof result.bytesBase64!=='string')throw rendererFault('RENDERER_RESULT_REFUSED');const bytes=Buffer.from(result.bytesBase64,'base64');
    if(bytes.length<1||bytes.length>input.maxBytes||bytes.toString('base64')!==result.bytesBase64||result.receipt?.inputSha256!==input.inputSha256||result.receipt?.outputSha256!==rendererSha(bytes)||result.receipt?.imageDigest!==imageDigest||result.receipt?.qualificationId!==result.admission.qualificationId)throw rendererFault('RENDERER_RESULT_REFUSED');
    life.check();return {...result,bytes};
   }
   life.check();return result;
  }finally{
   response?.response?.destroy?.();life.close();
   if(dispatched){const cleanup=createOperationLifetime({now,deadlineMs:now()+5000,errorFactory:rendererFault});try{
    const stopped=await cleanup.run(abortSignal=>sdk.send(new StopRuntimeSessionCommand({agentRuntimeArn,qualifier,runtimeSessionId:session,clientToken:requestId}),{abortSignal}));
    if(stopped.statusCode!==200||stopped.$metadata?.httpStatusCode!==200||stopped.runtimeSessionId!==session)throw Error();
   }catch{stopFailure=rendererFault('ARTIFACT_RENDERER_CLEANUP_UNKNOWN');}finally{cleanup.close();}}
   if(client===undefined)sdk.destroy();if(stopFailure)throw stopFailure;
  }
 }
 let qualified;try{qualified=await invoke('qualify');}catch{return createRendererPort({admission:null});}
 const admission=qualified.admission;
 return createRendererPort({admission,transformer:{async transform({bytes,format,target,deadlineMs,maxBytes,signal}){
  const result=await invoke('transform',{bytesBase64:bytes.toString('base64'),inputSha256:rendererSha(bytes),format,target,deadlineMs,maxBytes,signal});
  if(JSON.stringify(result.admission)!==JSON.stringify(admission))throw rendererFault('RENDERER_RESULT_REFUSED');return {bytes:result.bytes,receipt:result.receipt};
 }}});
}

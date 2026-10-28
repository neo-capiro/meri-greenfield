/** Outer CONTROL-side transport: custody-mediated fixed native inspection over the ordinary IAM AgentCore JSON call.
 *
 * The port this returns has the SAME shape as the existing in-process owner
 * (`createUploadInspection({scanner,extractor,now}).inspect(declaration,bytes,{deadlineMs,signal})`), so the upload
 * owner's existing inspect operation -- with its current-authority recheck before dispatch and its retention gate
 * after the result -- drives it unchanged and the existing `validateUploadInspection` receipt gate accepts what it
 * returns. Nothing here is an authority: no owner, tenant, actor, scope or object reference is accepted from the
 * caller, and the bytes are the exact original bytes the custody owner materialized for the immutable S3 VersionId
 * and checksum it verified. A hash, byte-length, session, image or declaration mismatch refuses the inspection.
 *
 * A call is NEVER retried. The standard SDK adapter is created with `maxAttempts:1` and there is no loop, so a
 * dispatch whose outcome is unknown raises UPLOAD_INSPECTION_OUTCOME_UNKNOWN instead of replaying it. The
 * server-selected one-use session is always stopped in `finally` -- including after a malformed, refused or
 * ambiguous result -- and a stop that cannot be confirmed surfaces UPLOAD_INSPECTION_CLEANUP_UNKNOWN rather than
 * leaving the session silently running. An ambiguous result is never reported as clean or extracted.
 *
 * The AWS SDK package is imported LAZILY, only when no narrow transport was injected: on a host without the SDK this
 * is an honest transport fault the caller can see, not a module-load failure that would disable unrelated products.
 * The ONE port a call resolved is the port that dispatches AND the port that stops -- never a pending promise, never
 * a second client -- so an owned one-use session cannot be left running because cleanup addressed a different object.
 * The default adapter is exercised by `test/agentcore-adapter.test.mjs`, which mocks the SDK module itself, so no
 * focused check reads the host credential chain or reaches the network for a real (or synthetic) endpoint.
 */
import {randomBytes} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {inspectUploadOriginal,uploadHash} from '../../control/uploads/policy.mjs';
import {uploadInspectionFault,uploadInspectionRequest,uploadInspectionResult,uploadInspectionSessionId,
 UPLOAD_INSPECTION_RESULT_BYTES,UPLOAD_INSPECTION_MAX_DEADLINE_MS,UPLOAD_INSPECTION_CLOCK_SKEW_MS} from './agentcore-contract.mjs';

const REGION=/^[a-z]{2}(?:-[a-z]+)+-\d$/u,RUNTIME=/^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime\/[A-Za-z0-9_-]+$/u,
 QUALIFIER=/^[A-Za-z][A-Za-z0-9_-]{0,47}$/u,DIGEST=/^sha256:[a-f0-9]{64}$/u;
/** A refusal or a cancellation is not an unknown outcome; anything else after dispatch is. */
const KNOWN=new Set(['DEADLINE','CANCELLED']);
const uncertain=error=>typeof error?.code==='string'&&(KNOWN.has(error.code)||error.code.startsWith('UPLOAD_INSPECTION_'));

/** The standard transport adapter: one ordinary `InvokeAgentRuntime` JSON call and one `StopRuntimeSession` cleanup.
 * An ABSENT or INCOMPLETE SDK is the same honest transport fault, not a TypeError from calling an undefined class:
 * the caller sees UPLOAD_INSPECTION_TRANSPORT_UNAVAILABLE either way, so a host without the package can be told
 * apart from a host whose inspect really failed. */
export function requireUploadInspectionSdk(module){
 if(module===null||typeof module!=='object'||typeof module.BedrockAgentCoreClient!=='function'||
  typeof module.InvokeAgentRuntimeCommand!=='function'||typeof module.StopRuntimeSessionCommand!=='function')
  throw uploadInspectionFault('UPLOAD_INSPECTION_TRANSPORT_UNAVAILABLE');
 return module;
}
async function sdkTransport(region){
 const module=requireUploadInspectionSdk(await import('@aws-sdk/client-bedrock-agentcore'));
 const client=new module.BedrockAgentCoreClient({region,maxAttempts:1});
 return Object.freeze({invoke:(input,{abortSignal})=>client.send(new module.InvokeAgentRuntimeCommand(input),{abortSignal}),
  stop:(input,{abortSignal})=>client.send(new module.StopRuntimeSessionCommand(input),{abortSignal}),
  destroy:()=>client.destroy()});
}
function narrow(transport){
 if(transport===null||typeof transport!=='object'||typeof transport.invoke!=='function'||typeof transport.stop!=='function')
  throw uploadInspectionFault('UPLOAD_INSPECTION_CONFIGURATION');
 return transport;
}
export function createUploadInspectionClient({region,agentRuntimeArn,qualifier,imageDigest,transport,now=Date.now}={}){
 if(!REGION.test(region??'')||!RUNTIME.test(agentRuntimeArn??'')||agentRuntimeArn.split(':')[3]!==region||
  !QUALIFIER.test(qualifier??'')||!DIGEST.test(imageDigest??'')||typeof now!=='function')throw uploadInspectionFault('UPLOAD_INSPECTION_CONFIGURATION');
 // An injected transport is checked HERE, not on first use: a malformed transport is a configuration fault of the
 // caller, never a per-call outcome that could be mistaken for an unknown dispatch.
 if(transport!==undefined)narrow(transport);
 // `resolved` is a pending import, `owned` is the port it actually produced: only the resolved port can be invoked
 // or stopped, and a build that never resolved is not an object this module can call `stop` on.
 let resolved=null,owned=null,created=false;
 const opened=async()=>{
  if(transport!==undefined)return narrow(transport);
  if(owned!==null)return owned;
  if(resolved===null)resolved=sdkTransport(region).then(value=>{created=true;return value;},
   ()=>{resolved=null;throw uploadInspectionFault('UPLOAD_INSPECTION_TRANSPORT_UNAVAILABLE');});
  owned=await resolved;
  return owned;
 };
 return Object.freeze({
  /** Inspect one already-materialized exact original. The declaration/byte gate runs BEFORE anything is dispatched. */
  async inspect(declaration,bytes,{deadlineMs,signal}={}){
   const file=inspectUploadOriginal(declaration,Buffer.isBuffer(bytes)?bytes:Buffer.alloc(0));
   const began=now(),until=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:began+UPLOAD_INSPECTION_MAX_DEADLINE_MS,began+UPLOAD_INSPECTION_MAX_DEADLINE_MS);
   const requestId=randomBytes(32).toString('hex'),session=uploadInspectionSessionId(requestId);
   const request=uploadInspectionRequest({kind:'upload-inspection',requestId,imageDigest,declaration,
    bytesBase64:bytes.toString('base64'),inputSha256:uploadHash(bytes),deadlineMs:until}).request;
   const life=createOperationLifetime({now,deadlineMs:until,signal,errorFactory:uploadInspectionFault});
   let dispatched=false,dispatchedPort=null,response,stopFailure;
   try{
    dispatchedPort=await opened();
    life.check();
    response=await life.run(abortSignal=>{dispatched=true;return dispatchedPort.invoke({agentRuntimeArn,qualifier,runtimeSessionId:session,
     contentType:'application/json',accept:'application/json',payload:Buffer.from(JSON.stringify(request))},{abortSignal});});
    if(response?.statusCode!==200||response.$metadata?.httpStatusCode!==200||response.runtimeSessionId!==session||
     response.contentType!=='application/json'||typeof response.response?.[Symbol.asyncIterator]!=='function')
     throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');
    let size=0;const chunks=[],iterator=response.response[Symbol.asyncIterator]();
    while(true){const next=await life.run(()=>iterator.next());if(next.done)break;
     if(!(next.value instanceof Uint8Array)||(size+=next.value.byteLength)>UPLOAD_INSPECTION_RESULT_BYTES)throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');
     chunks.push(Buffer.from(next.value));}
    life.check();
    const value=uploadInspectionResult(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),
     {requestId,declaration,imageDigest,fromMs:began-UPLOAD_INSPECTION_CLOCK_SKEW_MS,toMs:now()+UPLOAD_INSPECTION_CLOCK_SKEW_MS});
    life.check();
    if(value.file.sha256!==declaration.sha256||value.file.bytes!==declaration.bytes)throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');
    return Object.freeze({file:value.file,scan:value.scan,extraction:value.extraction});
   }catch(error){
    // Never replay: an outcome that is not one of our closed refusals or an explicit cancellation is UNKNOWN, and the
    // caller must treat it as unresolved rather than as a clean or extracted original.
    if(dispatched&&!uncertain(error))throw uploadInspectionFault('UPLOAD_INSPECTION_OUTCOME_UNKNOWN');
    throw error;
   }finally{
    response?.response?.destroy?.();life.close();
    if(dispatched){const cleanup=createOperationLifetime({now,deadlineMs:now()+5000,errorFactory:uploadInspectionFault});
     try{
      // The port that dispatched is the port that stops this owned session; it is always a resolved, validated
      // transport, so an unresolved import can never be mistaken for a client and a failed stop is always surfaced.
      const stopped=await cleanup.run(abortSignal=>
       dispatchedPort.stop({agentRuntimeArn,qualifier,runtimeSessionId:session,clientToken:requestId},{abortSignal}));
      if(stopped?.statusCode!==200||stopped.$metadata?.httpStatusCode!==200||stopped.runtimeSessionId!==session)throw Error();
     }catch{stopFailure=uploadInspectionFault('UPLOAD_INSPECTION_CLEANUP_UNKNOWN');}finally{cleanup.close();}}
    if(stopFailure)throw stopFailure;
   }
  },
  /** Destroy only a client this module created. */
  close(){const pending=resolved,mine=created;resolved=null;owned=null;created=false;
   if(mine&&pending!==null)pending.then(value=>value.destroy?.(),()=>{});},
 });
}

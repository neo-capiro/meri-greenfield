/** Actual AWS SSM transport for the native bootstrap, bound to the accepted public108 wire contract.
 *
 *  The production path imports the real `@aws-sdk/client-ssm` root symbols and constructs ONE dedicated client with
 *  `maxAttempts: 1` and no custom retryStrategy. Tests inject only that low-level SDK client. A lost ACK, unknown COMMIT, null
 *  CommandId or an early InvocationDoesNotExist is UNKNOWN/reconcile-only and NEVER triggers a second send.
 */
import {createNativeBootstrapRequest,decodeNativeBootstrapObservation} from '@capiro/meri-contracts/native-bootstrap';
import {canonicalSha256} from '@capiro/meri-contracts/node';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const UNKNOWN='NATIVE_BOOTSTRAP_UNKNOWN';
const REQUEST_KEYS=Object.freeze(['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds',
 'Parameters','TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']);

/** The canonical SendCommand input: delegated entirely to the shared public builder, which owns operation identity, document
 *  identity, payload encoding and the exact ten keys. No local DTO, codec or operation-id duplicate. */
export function createNativeBootstrapSendRequest({payload}){
 return createNativeBootstrapRequest(payload);
}

/** Bounded SDK client construction. The real package is imported lazily so source tests can inject a low-level client. */
export async function createNativeBootstrapSsmClient(){
 const sdk=await import('@aws-sdk/client-ssm');
 return Object.freeze({client:new sdk.SSMClient({maxAttempts:1}),sdk});
}

function guard({signal,deadlineMs,now}){
 if(signal?.aborted===true)fault('NATIVE_BOOTSTRAP_CANCELLED');
 if(deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||now()>=deadlineMs))fault('NATIVE_BOOTSTRAP_CANCELLED');
}

/** @param {{client:object, sdk?:object}} input low-level SDK seam for source tests only */
export async function createNativeBootstrapSsmTransport({client,sdk}={}){
 let actual=client,actualSdk=sdk;
 if(actual===undefined){const created=await createNativeBootstrapSsmClient();actual=created.client;actualSdk=created.sdk;}
 if(typeof actual?.send!=='function')fault('NATIVE_BOOTSTRAP_TRANSPORT_REFUSED');
 const SendCommand=actualSdk?.SendCommandCommand,GetCommandInvocation=actualSdk?.GetCommandInvocationCommand;
 const owned=client===undefined;
 // The SDK call carries the caller's abort signal; a borrowed client is never disposed.
 const sendRaw=(command,signal)=>actual.send(command,signal===undefined?undefined:{abortSignal:signal});
 return Object.freeze({
  requestSha256:request=>canonicalSha256(request),
  async sendOnce(request,{now=Date.now,signal,deadlineMs}={}){
   guard({signal,deadlineMs,now});
   if(request===null||typeof request!=='object')fault('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
   const keys=Object.keys(request);
   if(keys.length!==10||REQUEST_KEYS.some(key=>!keys.includes(key)))fault('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
   let response;
   try{
    // Exactly one SDK send: no loop, no retry, no resend on ambiguity.
    response=await sendRaw(SendCommand===undefined?{input:request}:new SendCommand(request),signal);
   }catch{fault(UNKNOWN);}                                  // lost ACK / transient: unknown, never resent
   const commandId=response?.Command?.CommandId;
   if(typeof commandId!=='string'||!/^[0-9a-fA-F-]{36}$/u.test(commandId))fault(UNKNOWN);   // null CommandId is unknown
   if(signal?.aborted===true){                               // custody is retained, but the disposition is unknown
    throw Object.assign(new Error(UNKNOWN),{code:UNKNOWN,commandId});
   }
   return Object.freeze({commandId,requestSha256:canonicalSha256(request)});
  },
  /** Owned SDK disposal only; a borrowed client belongs to its caller. */
  async close(){if(owned&&typeof actual.destroy==='function')await actual.destroy();},
  async observe({commandId,instanceId,request,prepareObservation,signal,deadlineMs,now=Date.now}){
   guard({signal,deadlineMs,now});
   if(typeof commandId!=='string'||typeof instanceId!=='string'||request?.InstanceIds?.[0]!==instanceId)
    fault('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
   const params={CommandId:commandId,InstanceId:instanceId,PluginName:'nativeBootstrap'};
   let invocation;
   try{invocation=await sendRaw(GetCommandInvocation===undefined?{input:params}:new GetCommandInvocation(params),signal);}
   catch(error){
    if(error?.name==='InvocationDoesNotExist')fault(UNKNOWN);  // early/absent: reconcile-only
    fault(UNKNOWN);
   }
   guard({signal,deadlineMs,now});
   // Exact identity: the document name and version are REQUIRED, not optional comparisons.
   if(invocation?.CommandId!==commandId||invocation?.InstanceId!==instanceId||
    invocation?.DocumentName!==request.DocumentName||invocation?.DocumentVersion!==request.DocumentVersion||
    invocation?.PluginName!=='nativeBootstrap')fault('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
   if(invocation?.Status!=='Success'||invocation?.StatusDetails!=='Success'||
    invocation?.ResponseCode!==0||String(invocation?.StandardErrorContent??'')!=='')
    fault(UNKNOWN);
   if(typeof invocation?.StandardOutputContent!=='string'||
    (invocation?.StandardOutputUrl!==undefined&&String(invocation.StandardOutputUrl)!=='')||
    (invocation?.StandardErrorUrl!==undefined&&String(invocation.StandardErrorUrl)!==''))fault(UNKNOWN);
   // Canonical observation validation: schema/scope/boot/CSR/proof/hash rules live in the shared public contract, and the
   // stdout final LF is preserved for the decoder.
   // The canonical public decoder owns framing (one final LF, size, UTF-8), canonical byte equality, duplicate-key
   // rejection and the observation semantics. There is no local codec.
   let observation;
   try{observation=decodeNativeBootstrapObservation(invocation.StandardOutputContent,{request,prepareObservation});}
   catch{fault('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');}
   return Object.freeze({observation,commandId});
  },
 });
}

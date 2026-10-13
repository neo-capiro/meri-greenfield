/** Fixed native provider boundary. Receipts never replace current native policy. */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {data,own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fault} from './config.mjs';
export function createNativeCapabilityClient({configuration,credential,fetch:transport=fetch,now=Date.now}){
 if(typeof credential!=='string'||!/^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(credential))throw fault('NATIVE_CONFIGURATION');
 const c=configuration;
 async function call(operation,input,{signal,deadlineMs}={}){
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs??now()+3000,now()+3000),now,signal,errorFactory:fault});let response;
  try{const body=JSON.stringify(data(input));if(Buffer.byteLength(body)>2097152)throw fault('NATIVE_REQUEST_LIMIT');
   response=await life.run(signal=>transport(c.origin+'/v1/'+operation,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,signal}));
   if(response.status!==200||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??'')||response.headers.get('content-encoding'))throw fault('NATIVE_UNAVAILABLE');
   const reader=response.body?.getReader();if(!reader)throw fault('NATIVE_UNAVAILABLE');const parts=[];let size=0;try{while(true){const next=await life.run(()=>reader.read());if(next.done)break;size+=next.value.length;if(size>c.maxResponseBytes)throw fault('NATIVE_RESPONSE_LIMIT');parts.push(next.value);}}finally{
    // Fetch cancellation is signalled immediately. A transport's unresolved
    // cleanup promise must not extend the owned read deadline.
    void reader.cancel().catch(()=>{});reader.releaseLock();
   }
   let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}catch{throw fault('NATIVE_RESPONSE_INVALID');}life.check();return data(value);
  }catch(error){throw fault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'NATIVE_UNAVAILABLE');}finally{life.close();}
 }
 return Object.freeze({call,
  verifyIdentity:({credential,signal,deadlineMs})=>call('identity/verify',{credential},{signal,deadlineMs}),
  resolveContext:({identityCredential,identity,identitySha256,hints,signal,deadlineMs})=>call('context/resolve',{identityCredential,identity,identitySha256,hints},{signal,deadlineMs}),
  async readiness({signal}={}){const value=await call('readiness',{}, {signal});own(value,['service','ready']);if(value.service!=='meri-native-capability-provider/1'||value.ready!==true)throw fault('NATIVE_UNAVAILABLE');},
 });
}

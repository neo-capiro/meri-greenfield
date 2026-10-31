/** Synchronous version-pinned Lambda source adapter. Fixed private origin/CA; no SDK/DB/EC2 permissions used here. */
import {request as httpsRequest} from 'node:https';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeObserverInput,NATIVE_OBSERVER_ROUTE,NATIVE_OBSERVER_PROTOCOL} from '../../packages/contracts/native-observer.mjs';
import {signObserverRequest,NATIVE_OBSERVER_ORIGIN,OBSERVER_BODY_BYTES} from './native-observer-http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const fail=()=>{throw Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN');};
export function postNativeObserver({body,headers,ca,signal}){
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(new URL(NATIVE_OBSERVER_ROUTE,NATIVE_OBSERVER_ORIGIN),{method:'POST',ca,rejectUnauthorized:true,
   agent:false,signal,headers:{...headers,'content-length':String(body.length)}},res=>{
   const chunks=[];let count=0;
   res.on('data',chunk=>{count+=chunk.length;if(count>OBSERVER_BODY_BYTES){res.destroy(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));return;}chunks.push(chunk);});
   res.on('error',reject);res.on('end',()=>{
    if(res.statusCode!==200||res.headers['content-type']!=='application/json'){reject(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));return;}
    try{resolve(JSON.parse(Buffer.concat(chunks,count).toString('utf8')));}catch{reject(Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN'));}
   });
  });req.on('error',reject);req.end(body);
 });
}
export function createNativeObserverBridge({functionVersionArn,stateMachineArn,keyId,readKey,readCa,post=postNativeObserver,now=Date.now}={}){
 // Only the base machine identity participates in the execution ARN. Immutable graph/version admission
 // remains owned by the worker and retained Control provenance; it is not established by Lambda context.
 const graph=/^arn:aws:states:us-east-1:([0-9]{12}):stateMachine:([A-Za-z0-9_-]{1,80})$/u.exec(stateMachineArn??'');
 if(!graph||!new RegExp(`^arn:aws:lambda:us-east-1:${graph[1]}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`,'u').test(functionVersionArn??'')||
  !/^[A-Za-z0-9_-]{1,64}$/u.test(keyId??'')||[readKey,readCa,post].some(fn=>typeof fn!=='function'))fail();
 return async function handler(raw,context){
  const input=own(data(raw),['schema','mode','originalInput','executionArn']);
  if(input.schema!=='meri-native-observer-invocation/1'||!['prepare','observe','read-result'].includes(input.mode)||
   context?.invokedFunctionArn!==functionVersionArn||typeof context.getRemainingTimeInMillis!=='function')fail();
  const original=assertNativeObserverInput(input.originalInput),time=now();
  if(original.physicalObserver.bridgeFunctionVersionArn!==functionVersionArn||
   input.executionArn!==`arn:aws:states:us-east-1:${graph[1]}:execution:${graph[2]}:${original.executionName}`)fail();
  const remaining=context.getRemainingTimeInMillis();if(!Number.isSafeInteger(remaining)||remaining<=0)fail();
  const expiresAtMs=Math.min(time+remaining,original.cleanupCeilingMs,
   input.mode==='prepare'?Math.min(time+3000,time<original.leaseDeadlineMs?original.leaseDeadlineMs:original.cleanupCeilingMs-1000):time+25000);
  if(!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=time)fail();
  const life=createOperationLifetime({now,deadlineMs:expiresAtMs,errorFactory:()=>Error('NATIVE_OBSERVER_BRIDGE_UNKNOWN')});
  const buffers=[];let finished=false;
  const material=async fn=>{const value=await fn();if(!Buffer.isBuffer(value)||!value.length)fail();const copy=Buffer.from(value);
   if(finished){copy.fill(0);fail();}buffers.push(copy);return copy;};
  try{
   const key=await life.run(()=>material(()=>readKey(keyId))),ca=await life.run(()=>material(readCa));life.check();
   const signed=signObserverRequest({keyId,key,body:{schema:'meri-native-watchdog-request/1',hostId:original.hostId,generation:original.generation,
    allocationSha256:original.allocationSha256,provisionToken:original.provisionToken,executionArn:input.executionArn,
    originalInputSha256:hash(original),bridgeProtocol:NATIVE_OBSERVER_PROTOCOL,bridgeFunctionVersionArn:functionVersionArn,
    mode:input.mode,requestId:randomUUID(),issuedAtMs:now(),expiresAtMs}});
   // No redirects, retries, arbitrary target or async Event invocation. A transport reply is not physical proof.
   const result=await life.run(signal=>post({...signed,ca,signal}));life.check();return result;
  }finally{finished=true;life.close();for(const bytes of buffers)bytes.fill(0);}
 };
}

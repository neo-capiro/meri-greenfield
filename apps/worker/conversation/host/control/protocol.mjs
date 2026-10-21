/** Fixed wire identity for one D005 currentness read. Shape checks never establish authority. */
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,assertHostCurrent} from '../binding.mjs';

export const HOST_CONTROL_REQUEST_SCHEMA='meri-host-currentness-request/1';
export const HOST_CONTROL_RESPONSE_SCHEMA='meri-host-currentness-response/1';
export const HOST_CONTROL_PATH='/meri/host/currentness/v1';
export const HOST_CONTROL_MAX_BYTES=32768;
export const HOST_CONTROL_PURPOSES=Object.freeze(['sdk','browser','bash']);
const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_REFUSED'),{code:'HOST_CONTROL_REFUSED'});};

export function hostClientDnsName(allocation){
 const a=assertHostAllocation(allocation);
 return `h-${a.hostId.replaceAll('-','')}-g${a.generation}.host.meri.internal`;
}

export function hostControlRequest(value){
 let v,a,b,i;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','purpose','policySha256','nonce']);
  a=assertHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
 }catch{fail();}
 if(v.schema!==HOST_CONTROL_REQUEST_SCHEMA||!HOST_CONTROL_PURPOSES.includes(v.purpose)||
  typeof v.policySha256!=='string'||!HEX.test(v.policySha256)||
  typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,purpose:v.purpose,
  policySha256:v.policySha256,nonce:v.nonce});
}

export function hostControlResponse(value,request,{nowMs,maxFreshMs}={}){
 const q=hostControlRequest(request);let v,receipt;
 try{v=own(data(value),['schema','nonce','purpose','receipt']);
  if(v.schema!==HOST_CONTROL_RESPONSE_SCHEMA||v.nonce!==q.nonce||v.purpose!==q.purpose)fail();
  receipt=own(v.receipt,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs']);
  assertHostCurrent({allocation:q.allocation,binding:q.binding,policySha256:q.policySha256,
   current:receipt,nowMs,maxFreshMs});
 }catch{fail();}
 return Object.freeze(receipt);
}

export function makeHostControlRequest({allocation,binding,hostIdentity,purpose,policySha256,nonce,signal}={}){
 try{nativeSignal(signal);}catch{fail();}
 if(signal?.aborted)fail();
 return hostControlRequest({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation,binding,hostIdentity,purpose,policySha256,nonce});
}

export function encodeHostControl(value){
 let bytes;try{bytes=Buffer.from(JSON.stringify(data(value)),'utf8');}catch{fail();}
 if(bytes.length<1||bytes.length>HOST_CONTROL_MAX_BYTES)fail();return bytes;
}
export function decodeHostControl(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>HOST_CONTROL_MAX_BYTES)fail();
 try{return data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{fail();}
}

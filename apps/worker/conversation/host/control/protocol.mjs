/** Fixed wire identity for one D005 currentness read. Shape checks never establish authority. */
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,assertHostCurrent,assertBrowserHostCurrent} from '../binding.mjs';

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
  receipt=own(v.receipt,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs'],q.purpose==='browser'?['browserHandoff']:[]);
  (q.purpose==='browser'?assertBrowserHostCurrent:assertHostCurrent)({allocation:q.allocation,binding:q.binding,policySha256:q.policySha256,
   current:receipt,nowMs,maxFreshMs});
 }catch{fail();}
 return Object.freeze(receipt);
}

export function makeHostControlRequest({allocation,binding,hostIdentity,purpose,policySha256,nonce,signal}={}){
 try{nativeSignal(signal);}catch{fail();}
 if(signal?.aborted)fail();
 return hostControlRequest({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation,binding,hostIdentity,purpose,policySha256,nonce});
}

export function encodeHostControl(value,max=HOST_CONTROL_MAX_BYTES){
 if(!Number.isSafeInteger(max)||max<1)fail();let bytes;
 try{bytes=Buffer.from(JSON.stringify(data(value)),'utf8');}catch{fail();}
 if(bytes.length<1||bytes.length>max)fail();return bytes;
}
export function decodeHostControl(bytes,max=HOST_CONTROL_MAX_BYTES){
 if(!Number.isSafeInteger(max)||max<1||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>max)fail();
 try{return data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{fail();}
}

// ---------------------------------------------------------------------------------------------------
// Three additional named operations on the SAME private mTLS channel. Each has its own closed request
// and answer envelope, its own finite bounds, and its own single-use nonce acknowledged inside the
// authenticated allocation transaction. None of them is a generic RPC or a callable port.
// ---------------------------------------------------------------------------------------------------
export const HOST_FACTS_PATH='/meri/host/facts/v1';
export const HOST_FACTS_REQUEST_SCHEMA='meri-host-facts-request/1';
export const HOST_FACTS_RESPONSE_SCHEMA='meri-host-facts-response/1';
/** The facts payload bound is separate from the currentness 32 KiB ceiling; the envelope overhead is
 * accounted explicitly so a valid 256-origin/64x256-selector payload is never silently truncated. */
export const HOST_FACTS_MAX_BYTES=262144;
export const HOST_FACTS_ENVELOPE_BYTES=4096;
export const HOST_FACTS_WIRE_MAX_BYTES=HOST_FACTS_MAX_BYTES+HOST_FACTS_ENVELOPE_BYTES;

export const HOST_WORKFLOW_PATH='/meri/host/workflow/v1';
export const HOST_WORKFLOW_REQUEST_SCHEMA='meri-host-workflow-request/1';
export const HOST_WORKFLOW_RESPONSE_SCHEMA='meri-host-workflow-response/1';
export const HOST_WORKFLOW_MAX_BYTES=131072;
export const HOST_WORKFLOW_ENVELOPE_BYTES=4096;
export const HOST_WORKFLOW_WIRE_MAX_BYTES=HOST_WORKFLOW_MAX_BYTES+HOST_WORKFLOW_ENVELOPE_BYTES;

export const HOST_HOLD_PATH='/meri/host/hold/v1';
export const HOST_HOLD_REQUEST_SCHEMA='meri-host-hold-request/1';
export const HOST_HOLD_RESPONSE_SCHEMA='meri-host-hold-response/1';
export const HOST_HOLD_MAX_BYTES=16384;
export const HOST_HOLD_ENVELOPE_BYTES=2048;
export const HOST_HOLD_WIRE_MAX_BYTES=HOST_HOLD_MAX_BYTES+HOST_HOLD_ENVELOPE_BYTES;
export const HOST_OPERATION_REQUEST_MAX_BYTES=HOST_CONTROL_MAX_BYTES;

/** Facts, workflow and hold share one closed request envelope: the host's pinned allocation identity,
 * the exact run binding, and a fresh single-use nonce. No policy digest is asserted by the host for
 * these reads, because the answer REPORTS current authority rather than claiming it. */
export function hostOperationRequest(value,schema){
 let v,a,b,i;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce']);
  a=assertHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
 }catch{fail();}
 if(v.schema!==schema||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema,allocation:a,binding:b,hostIdentity:i,nonce:v.nonce});
}
export const hostFactsRequest=value=>hostOperationRequest(value,HOST_FACTS_REQUEST_SCHEMA);
export const hostWorkflowRequest=value=>hostOperationRequest(value,HOST_WORKFLOW_REQUEST_SCHEMA);
export const hostHoldRequest=value=>hostOperationRequest(value,HOST_HOLD_REQUEST_SCHEMA);

const envelope=(value,request,schema,field)=>{let v;try{
  v=own(data(value),['schema','nonce',field,'checkedAtMs','currentUntilMs']);
  if(v.schema!==schema||v.nonce!==request.nonce||!Number.isSafeInteger(v.checkedAtMs)||
   !Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
 }catch{fail();}return v;};
export function hostFactsResponse(value,request){const v=envelope(value,request,HOST_FACTS_RESPONSE_SCHEMA,'facts');
 return Object.freeze({schema:HOST_FACTS_RESPONSE_SCHEMA,nonce:v.nonce,facts:v.facts,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}
export function hostWorkflowResponse(value,request){const v=envelope(value,request,HOST_WORKFLOW_RESPONSE_SCHEMA,'workflow');
 return Object.freeze({schema:HOST_WORKFLOW_RESPONSE_SCHEMA,nonce:v.nonce,workflow:v.workflow,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}
export function hostHoldResponse(value,request){let v;try{
  v=own(data(value),['schema','nonce','outcome','custody','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_HOLD_RESPONSE_SCHEMA||v.nonce!==request.nonce||v.outcome!=='APPLIED'||
   !Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_HOLD_RESPONSE_SCHEMA,nonce:v.nonce,outcome:'APPLIED',custody:v.custody,
  checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}

export function encodeHostOperation(value,max){return encodeHostControl(value,max);}
export function decodeHostOperation(bytes,max){return decodeHostControl(bytes,max);}

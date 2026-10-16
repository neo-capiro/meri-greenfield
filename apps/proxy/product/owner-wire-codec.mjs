/** Bounded positional values for the private HTTPS product-owner bridge.
 *
 * Python's boundary_codec emits arrays, never object maps. This parser grants
 * no authority: the owner must obtain fresh request/response captures through
 * its separately authenticated host channel before calling the canonical
 * reservation and settlement composition. It opens no socket or listener.
 */
import {TextDecoder} from 'node:util';

const MAX_WIRE=12*1024*1024;
const MAX_BODY=4*1024*1024;
const MAX_SAFE=Number.MAX_SAFE_INTEGER;
const SLOT=/^[A-Za-z0-9_-]{1,128}$/u;
const UUID=/^(?:urn:uuid:)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const SHA=/^[a-f0-9]{64}$/u;
const HEADER=/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/u;
const CREDENTIAL=/^[!-~]{32,256}$/u;
const utf8=new TextDecoder('utf-8',{fatal:true});
const deny=()=>{throw Error('PRODUCT_OWNER_WIRE_REFUSED');};
const array=(value,size)=>{
 if(!Array.isArray(value)||value.length!==size)deny();
 return value;
};
const integer=(value,low,high=MAX_SAFE)=>{
 if(!Number.isSafeInteger(value)||value<low||value>high)deny();
 return value;
};
function string(value,max,{min=1,pattern=null,ascii=false}={}){
 if(typeof value!=='string'||!value.isWellFormed()||value.length<min||value.length>max||
    Buffer.byteLength(value,'utf8')>max*4||ascii&&!/^[\x20-\x7e]*$/u.test(value)||
    pattern&&!pattern.test(value))deny();
 return value;
}
function identity(value){
 string(value,128);
 if(Buffer.byteLength(value,'utf8')>512)deny();
 return value;
}
function body(value){
 if(typeof value!=='string'||value.length<4||value.length>Math.ceil(MAX_BODY/3)*4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value))deny();
 const decoded=Buffer.from(value,'base64');
 if(decoded.length<1||decoded.length>MAX_BODY||decoded.toString('base64')!==value)deny();
 return decoded;
}
function binding(value){
 const v=array(value,7);
 return {tenantId:identity(v[0]),actorId:identity(v[1]),
  conversationId:string(v[2],45,{pattern:UUID}),runId:string(v[3],45,{pattern:UUID}),
  attemptId:string(v[4],45,{pattern:UUID}),workerId:string(v[5],45,{pattern:UUID}),
  writerFence:integer(v[6],1)};
}
function reservationValue(value){
 const v=array(value,3);
 return {requestId:string(v[0],128,{pattern:SLOT}),binding:binding(v[1]),
  deadlineMs:integer(v[2],1)};
}
function headers(value){
 if(!Array.isArray(value)||value.length<1||value.length>64)deny();
 const seen=new Set();
 return value.map(pair=>{
  const p=array(pair,2),name=string(p[0],128,{pattern:HEADER}),lower=name.toLowerCase();
  if(seen.has(lower))deny();seen.add(lower);
  return [name,string(p[1],8192,{min:0,ascii:true})];
 });
}
/** Parse one complete JSON-array frame from a bounded HTTP body. */
export function parseOwnerWire(raw){
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>MAX_WIRE)deny();
 let value;
 try{value=JSON.parse(utf8.decode(raw));}catch{deny();}
 const walk=(item,depth)=>{
  if(depth>10)deny();
  if(Array.isArray(item)){
   if(item.length>128)deny();
   for(const child of item)walk(child,depth+1);
  }else if(typeof item==='string'){
   if(!item.isWellFormed())deny();
  }else if(item===null||typeof item==='boolean'){
   // Only shape-specific decoders may admit these primitive values.
  }else if(!Number.isSafeInteger(item))deny();
 };
 if(!Array.isArray(value))deny();
 walk(value,0);
 return value;
}

/** Decode both the untrusted operation claim and independent host capture. */
export function decodeReservationFrame(value){
 const frame=array(value,3);
 if(frame[0]!=='meri.proxy.reservation/1')deny();
 const request=reservationValue(frame[1]);
 const o=array(frame[2],6),peer=array(o[1],4),native=array(o[4],6),count=array(o[5],4);
 const observation={requestId:string(o[0],128,{pattern:SLOT}),
  peer:{binding:binding(peer[0]),taskArn:string(peer[1],512,{ascii:true}),
   grantId:string(peer[2],128,{pattern:SLOT}),observedAtMs:integer(peer[3],1)},
  proxyCredential:string(o[2],256,{min:32,pattern:CREDENTIAL}),
  rawRequestBody:body(o[3]),
  nativeRequest:{method:string(native[0],16,{pattern:SLOT}),
   url:string(native[1],1024,{ascii:true}),host:string(native[2],256,{ascii:true}),
   contentType:string(native[3],256,{ascii:true}),body:body(native[4]),
   headers:headers(native[5])},
  count:{inputTokens:integer(count[0],1,8192),
   nativeBodySha256:string(count[1],64,{pattern:SHA}),
   modelId:string(count[2],128,{ascii:true}),origin:string(count[3],64,{pattern:SLOT})}};
 if(observation.requestId!==request.requestId||
    JSON.stringify(observation.peer.binding)!==JSON.stringify(request.binding))deny();
 return {request,observation};
}

function usage(value,id){
 const u=array(value,7),b=array(u[1],7),names=b[6];
 if(!Array.isArray(names)||names.length>8)deny();
 const checked=names.map(name=>string(name,128,{pattern:SLOT}));
 if(new Set(checked).size!==checked.length)deny();
 const result={status:u[0],binding:{request_id:string(b[0],128,{pattern:SLOT}),
  native_body_sha256:string(b[1],64,{pattern:SHA}),
  raw_request_sha256:string(b[2],64,{pattern:SHA}),
  pricing_revision:string(b[3],64,{pattern:SHA}),
  counted_input_tokens:integer(b[4],1,8192),max_output_tokens:integer(b[5],1,256),
  allowed_tool_names:checked},evidence_sha256:string(u[2],64,{pattern:SHA}),
  input_tokens:integer(u[3],1,8192),output_tokens:integer(u[4],0,256),
  reason:u[5],origin:u[6]};
 if(result.status!=='COMPLETE'||result.binding.request_id!==id||
    result.input_tokens!==result.binding.counted_input_tokens||
    result.output_tokens>result.binding.max_output_tokens||
    !['COMPLETE_NATIVE_MESSAGE','COMPLETE_NATIVE_STREAM'].includes(result.reason)||
    result.origin!=='native-usage-data')deny();
 return result;
}

export function decodeSettlementFrame(value){
 const frame=array(value,3);
 if(frame[0]!=='meri.proxy.settlement/1')deny();
 const requestId=string(frame[1],128,{pattern:SLOT});
 return {requestId,usageResult:usage(frame[2],requestId)};
}

/** Decode a fresh response from the separate host capture channel. */
export function decodeCompleteCaptureFrame(value){
 const frame=array(value,7);
 if(frame[0]!=='meri.proxy.complete-capture/1')deny();
 const requestId=string(frame[1],128,{pattern:SLOT}),receipt=array(frame[2],3),
  complete=array(frame[5],14),tokens=array(complete[13],2);
 const result={reservation:{requestId:string(receipt[0],128,{pattern:SLOT}),
   nativeBodySha256:string(receipt[1],64,{pattern:SHA}),state:receipt[2]},
  rawRequestBody:body(frame[3]),nativeRequestBody:body(frame[4]),
  completion:{requestId:string(complete[0],128,{pattern:SLOT}),binding:binding(complete[1]),
   taskArn:string(complete[2],512,{ascii:true}),capabilitySha256:string(complete[3],64,{pattern:SHA}),
   nativeBodySha256:string(complete[4],64,{pattern:SHA}),
   rawRequestSha256:string(complete[5],64,{pattern:SHA}),
   modelId:string(complete[6],128,{ascii:true}),profileId:string(complete[7],128,{ascii:true}),
   pricingRevision:string(complete[8],64,{pattern:SHA}),
   evidenceSha256:string(complete[9],64,{pattern:SHA}),httpStatus:integer(complete[10],200,200),
   complete:complete[11],eof:complete[12],
   usage:{inputTokens:integer(tokens[0],1,8192),outputTokens:integer(tokens[1],0,256)}},
  usageResult:usage(frame[6],requestId)};
 if(result.reservation.requestId!==requestId||result.reservation.state!=='UNKNOWN'||
    result.completion.requestId!==requestId||result.completion.complete!==true||
    result.completion.eof!==true)deny();
 return result;
}

function bindingTuple(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==7)deny();
 return [identity(value.tenantId),identity(value.actorId),
  ...['conversationId','runId','attemptId','workerId'].map(name=>string(value[name],45,{pattern:UUID})),
  integer(value.writerFence,1)];
}

/** Request fresh host evidence over a channel independent of operation claims. */
export function captureCallRequest(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||
    !['requestId','binding','deadlineMs'].every(key=>Object.hasOwn(value,key))||
    Object.keys(value).some(key=>!['requestId','binding','deadlineMs','signal'].includes(key)))deny();
 return ['meri.proxy.capture-call/1',string(value.requestId,128,{pattern:SLOT}),
  bindingTuple(value.binding),integer(value.deadlineMs,1)];
}
export function captureCompleteRequest(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==3||
    !['requestId','binding','grantId'].every(key=>Object.hasOwn(value,key)))deny();
 return ['meri.proxy.capture-complete/1',string(value.requestId,128,{pattern:SLOT}),
  bindingTuple(value.binding),string(value.grantId,128,{pattern:SLOT})];
}

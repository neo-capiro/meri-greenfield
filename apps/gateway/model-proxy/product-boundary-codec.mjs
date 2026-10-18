/** Inert, bounded Python-to-JavaScript values for the private proxy bridges.
 * The versioned wire trees contain only positional arrays and primitives. No
 * object keys can be duplicated or silently overwritten during JSON parsing.
 * Decoding grants no authority; both bridges still need independent host
 * capture and their canonical SQL owners.
 */
import {isDeepStrictEqual} from 'node:util';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from './product-envelope.mjs';

const WIRE_LIMIT=12*1024*1024;
const BODY_LIMIT=4*1024*1024;
const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const uuid=/^(?:urn:uuid:)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const header=/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/u;
const credential=/^[!-~]{32,256}$/u;
const hash=/^[a-f0-9]{64}$/u;
const deny=()=>{throw new Error('PRODUCT_PROXY_CODEC_REFUSED');};

function tuple(value,length){if(!Array.isArray(value)||value.length!==length)deny();return value;}
function integer(value,low,high){if(!Number.isSafeInteger(value)||value<low||value>high)deny();return value;}
function ascii(value,maximum,minimum=1,pattern=null){
 if(typeof value!=='string'||value.length<minimum||value.length>maximum||!/^[\x00-\x7f]*$/u.test(value)||pattern&&!pattern.test(value))deny();
 return value;
}
function printable(value,maximum,minimum=1){
 ascii(value,maximum,minimum);
 if(!/^[\x20-\x7e]*$/u.test(value))deny();
 return value;
}
function identity(value){
 if(typeof value!=='string'||Array.from(value).length<1||Array.from(value).length>128||
    [...value].some(char=>char.length===1&&/^[\uD800-\uDFFF]$/u.test(char))||
    Buffer.byteLength(value,'utf8')>512)deny();
 return value;
}
function body(value){
 ascii(value,Math.ceil(BODY_LIMIT/3)*4,4);
 if(!/^[A-Za-z0-9+/]+={0,2}$/u.test(value))deny();
 const bytes=Buffer.from(value,'base64');
 if(bytes.length<1||bytes.length>BODY_LIMIT||bytes.toString('base64')!==value)deny();
 return bytes;
}
function binding(value){
 const v=tuple(value,7);
 return {tenantId:identity(v[0]),actorId:identity(v[1]),
  conversationId:ascii(v[2],45,36,uuid),runId:ascii(v[3],45,36,uuid),
  attemptId:ascii(v[4],45,36,uuid),workerId:ascii(v[5],45,36,uuid),
  writerFence:integer(v[6],1,Number.MAX_SAFE_INTEGER)};
}
function parse(wire){
 if(!Buffer.isBuffer(wire)||wire.length<3||wire.length>WIRE_LIMIT)deny();
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(wire);}catch{deny();}
 // Even an unused nested object is refused before JSON.parse can collapse
 // duplicate keys. Scan quoted strings separately so braces in a value are inert.
 let quoted=false,escaped=false,depth=0;
 for(const c of source){
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;continue;}
  if(c==='{'||c==='}')deny();
  if(c==='['&&++depth>8)deny();
  if(c===']'&&--depth<0)deny();
 }
 if(quoted||depth!==0)deny();
 try{return JSON.parse(source);}catch{deny();}
}

/** Returns the exact two arguments expected by product-reservation-bridge.
 * The original body and final native body are distinct, copied Buffers.
 */
export function decodeReservationFrame(wire){
 const [version,request,claim]=tuple(parse(wire),3);
 if(version!=='meri.proxy.reservation/1')deny();
 const [requestId,originalBinding,deadlineMs]=tuple(request,3);
 ascii(requestId,128,1,slot);const selectedBinding=binding(originalBinding);
 integer(deadlineMs,1,Number.MAX_SAFE_INTEGER);
 const [claimId,peer,proxyCredential,rawRequestBody,native,count]=tuple(claim,6);
 if(claimId!==requestId)deny();
 const [peerBinding,taskArn,grantId,observedAtMs]=tuple(peer,4);
 const observedBinding=binding(peerBinding);
 if(!isDeepStrictEqual(selectedBinding,observedBinding))deny();
 printable(taskArn,512);ascii(grantId,128,1,slot);
 integer(observedAtMs,1,Number.MAX_SAFE_INTEGER);
 ascii(proxyCredential,256,32,credential);
 const [method,url,host,contentType,nativeBody,headers]=tuple(native,6);
 ascii(method,16,1,slot);printable(url,1024);printable(host,256);printable(contentType,256);
 if(!Array.isArray(headers)||headers.length<1||headers.length>64)deny();
 const seen=new Set(),pairs=headers.map(item=>{
  const [name,value]=tuple(item,2);
  ascii(name,128,1,header);printable(value,8192,0);
  const lower=name.toLowerCase();if(seen.has(lower))deny();seen.add(lower);
  return [name,value];
 });
 if(!seen.has('host')||!seen.has('content-type'))deny();
 const [inputTokens,nativeBodySha256,modelId,origin]=tuple(count,4);
 integer(inputTokens,1,PRODUCT_MAX_INPUT_TOKENS);ascii(nativeBodySha256,64,64,hash);
 printable(modelId,128);ascii(origin,64,1,slot);
 return {value:{requestId,binding:selectedBinding,deadlineMs},
  observation:{requestId:claimId,peer:{binding:observedBinding,taskArn,grantId,observedAtMs},
   proxyCredential,rawRequestBody:body(rawRequestBody),
   nativeRequest:{method,url,host,contentType,body:body(nativeBody),headers:pairs},
   count:{inputTokens,nativeBodySha256,modelId,origin}}};
}

/** Returns the two arguments expected by product-settlement-bridge. */
export function decodeSettlementFrame(wire){
 const [version,requestId,claim]=tuple(parse(wire),3);
 if(version!=='meri.proxy.settlement/1')deny();ascii(requestId,128,1,slot);
 const [status,bindingValue,evidenceSha,inputTokens,outputTokens,reason,origin]=tuple(claim,7);
 const [usageId,nativeSha,rawSha,pricingRevision,countedInput,maxOutput,names]=tuple(bindingValue,7);
 if(status!=='COMPLETE'||usageId!==requestId||origin!=='native-usage-data'||
    !['COMPLETE_NATIVE_MESSAGE','COMPLETE_NATIVE_STREAM'].includes(reason))deny();
 for(const value of [nativeSha,rawSha,pricingRevision,evidenceSha])ascii(value,64,64,hash);
 integer(countedInput,1,PRODUCT_MAX_INPUT_TOKENS);integer(maxOutput,1,PRODUCT_MAX_OUTPUT_TOKENS);
 if(integer(inputTokens,1,PRODUCT_MAX_INPUT_TOKENS)!==countedInput)deny();integer(outputTokens,0,maxOutput);
 if(!Array.isArray(names)||names.length>8)deny();
 const allowed_tool_names=names.map(name=>ascii(name,128,1,slot));
 if(new Set(allowed_tool_names).size!==allowed_tool_names.length||
    !isDeepStrictEqual(allowed_tool_names,[...allowed_tool_names].sort()))deny();
 return {requestId,usageResult:{status,binding:{request_id:usageId,
  native_body_sha256:nativeSha,raw_request_sha256:rawSha,pricing_revision:pricingRevision,
  counted_input_tokens:countedInput,max_output_tokens:maxOutput,allowed_tool_names},
  evidence_sha256:evidenceSha,input_tokens:inputTokens,output_tokens:outputTokens,reason,origin}};
}

/** Private, route-scoped observer transport. Authentication grants observation intent, never an EC2 effect. */
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {canonicalJson} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {NATIVE_OBSERVER_ROUTE,NATIVE_OBSERVER_PROTOCOL} from '../../packages/contracts/native-observer.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail=()=>{throw Error('NATIVE_OBSERVER_HTTP_REFUSED');};
export const NATIVE_OBSERVER_ORIGIN='https://control.meri-preview.internal';
export const OBSERVER_BODY_BYTES=16384;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const macBytes=(keyId,requestId,issuedAtMs,expiresAtMs,bodySha256)=>
 ['meri-native-watchdog-http/1','POST',NATIVE_OBSERVER_ROUTE,keyId,requestId,String(issuedAtMs),String(expiresAtMs),bodySha256].join('\n');
export function observerHttpBody(raw){
 const v=own(data(raw),['schema','hostId','generation','allocationSha256','provisionToken','executionArn','originalInputSha256',
  'bridgeProtocol','bridgeFunctionVersionArn','mode','requestId','issuedAtMs','expiresAtMs']);
 if(v.schema!=='meri-native-watchdog-request/1'||v.bridgeProtocol!==NATIVE_OBSERVER_PROTOCOL||
  !UUID.test(v.hostId)||!UUID.test(v.requestId)||!Number.isSafeInteger(v.generation)||v.generation<1||
  !['allocationSha256','provisionToken','originalInputSha256'].every(k=>/^[0-9a-f]{64}$/u.test(v[k]))||
  !/^arn:aws:states:us-east-1:[0-9]{12}:execution:[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$/u.test(v.executionArn)||
  !/^arn:aws:lambda:us-east-1:[0-9]{12}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$/u.test(v.bridgeFunctionVersionArn)||
  !['prepare','observe','read-result'].includes(v.mode)||!Number.isSafeInteger(v.issuedAtMs)||v.issuedAtMs<1||
  !Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=v.issuedAtMs)fail();
 if(Buffer.byteLength(canonicalJson(v))>OBSERVER_BODY_BYTES)fail();return v;
}
export function signObserverRequest({body,keyId,key}){
 const v=observerHttpBody(body);if(!/^[A-Za-z0-9_-]{1,64}$/u.test(keyId)||!Buffer.isBuffer(key)||key.length<32||key.length>128)fail();
 const bytes=Buffer.from(canonicalJson(v),'utf8'),bodySha256=sha(bytes);
 const mac=createHmac('sha256',key).update(macBytes(keyId,v.requestId,v.issuedAtMs,v.expiresAtMs,bodySha256)).digest('hex');
 return {body:bytes,headers:{'content-type':'application/json','x-meri-observer-key':keyId,'x-meri-observer-request':v.requestId,
  'x-meri-observer-issued':String(v.issuedAtMs),'x-meri-observer-expires':String(v.expiresAtMs),
  'x-meri-observer-body-sha256':bodySha256,'x-meri-observer-mac':mac}};
}
async function boundedBody(request,life){
 const length=request.headers.get('content-length');if(length!==null&&(!/^[0-9]{1,5}$/u.test(length)||Number(length)>OBSERVER_BODY_BYTES))fail();
 if(!request.body)fail();const reader=request.body.getReader(),chunks=[];let count=0,done=false;
 try{for(;;){const part=await life.run(()=>reader.read());if(part.done){done=true;break;}
  count+=part.value.byteLength;if(count>OBSERVER_BODY_BYTES)fail();chunks.push(Buffer.from(part.value));}
  if(length!==null&&Number(length)!==count)fail();return Buffer.concat(chunks,count);
 }finally{if(!done)try{await reader.cancel();}catch{}reader.releaseLock();}
}
export function createNativeObserverHttpApplication({readKey,observeIntent,now=Date.now}={}){
 if(typeof readKey!=='function'||typeof observeIntent!=='function')fail();
 return Object.freeze({async handle(request){
  const url=new URL(request.url);if(url.pathname!==NATIVE_OBSERVER_ROUTE)return null;
  let life,key,finished=false;
  try{
   if(request.method!=='POST'||url.search||url.hash||request.headers.has('authorization')||request.headers.has('content-encoding')||
    request.headers.get('content-type')!=='application/json')fail();
   const keyId=request.headers.get('x-meri-observer-key'),requestId=request.headers.get('x-meri-observer-request'),
    issued=request.headers.get('x-meri-observer-issued'),expires=request.headers.get('x-meri-observer-expires'),
    digest=request.headers.get('x-meri-observer-body-sha256'),mac=request.headers.get('x-meri-observer-mac');
   if(!/^[A-Za-z0-9_-]{1,64}$/u.test(keyId??'')||!UUID.test(requestId??'')||
    !/^[1-9][0-9]{0,15}$/u.test(issued??'')||!/^[1-9][0-9]{0,15}$/u.test(expires??'')||
    !/^[0-9a-f]{64}$/u.test(digest??'')||!/^[0-9a-f]{64}$/u.test(mac??''))fail();
   const issuedAtMs=Number(issued),expiresAtMs=Number(expires),time=now();
   if(!Number.isSafeInteger(issuedAtMs)||!Number.isSafeInteger(expiresAtMs)||Math.abs(time-issuedAtMs)>1000||
    time>=expiresAtMs||issuedAtMs>=expiresAtMs||expiresAtMs-issuedAtMs>25000)fail();
   life=createOperationLifetime({now,deadlineMs:expiresAtMs,signal:request.signal,errorFactory:()=>Error('NATIVE_OBSERVER_HTTP_REFUSED')});
   // readKey selects only an explicitly configured key version. Copy so this request never clears borrowed material.
   key=await life.run(async()=>{const material=await readKey(keyId);if(!Buffer.isBuffer(material)||material.length<32||material.length>128)fail();
    const copy=Buffer.from(material);if(finished){copy.fill(0);fail();}return copy;});
   const bytes=await boundedBody(request,life);life.check();
   if(sha(bytes)!==digest)fail();
   const expected=createHmac('sha256',key).update(macBytes(keyId,requestId,issuedAtMs,expiresAtMs,digest)).digest();
   if(!timingSafeEqual(expected,Buffer.from(mac,'hex')))fail();
   const body=observerHttpBody(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
   if(body.requestId!==requestId||body.issuedAtMs!==issuedAtMs||body.expiresAtMs!==expiresAtMs||canonicalJson(body)!==bytes.toString('utf8'))fail();
   const result=await life.run(signal=>observeIntent(body,{signal,deadlineMs:expiresAtMs}));life.check();
   const reply=canonicalJson(result);if(Buffer.byteLength(reply)>OBSERVER_BODY_BYTES)fail();
   return new Response(reply,{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch{return Response.json({error:{code:'NATIVE_OBSERVER_HTTP_REFUSED'}},{status:403,headers:{'cache-control':'no-store'}});}
  finally{finished=true;key?.fill(0);life?.close();}
 }});
}

import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import {sha,fail,privateRead} from './plan.mjs';
const directory=fileURLToPath(new URL('.',import.meta.url)),root=resolve(directory,'../../..');
export function verifyMethod(expected){
 const bytes=privateRead(resolve(directory,'METHOD-PINS.json'));if(sha(bytes)!==expected)fail('QUALIFICATION_METHOD');
 const pins=JSON.parse(bytes);for(const item of pins.files){if(typeof item.path!=='string'||item.path.includes('..')||item.path.startsWith('/')||!/^[a-f0-9]{64}$/.test(item.sha256)||sha(readFileSync(resolve(root,item.path)))!==item.sha256)fail('QUALIFICATION_SOURCE_PIN');}
 return pins;
}
export async function boundedJson(response,max=2097152){
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')??''))fail('QUALIFICATION_RESPONSE_TYPE');
 const reader=response.body?.getReader();if(!reader)fail('QUALIFICATION_RESPONSE');let count=0;const parts=[];
 try{for(;;){const r=await reader.read();if(r.done)break;count+=r.value.length;if(count>max)fail('QUALIFICATION_RESPONSE_LIMIT');parts.push(r.value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}
 finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function post(origin,path,token,body,{signal,fetchImpl=fetch}={}){
 const response=await fetchImpl(origin+path,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal});
 const value=await boundedJson(response);return {status:response.status,value,bytes:new TextEncoder().encode(JSON.stringify(value))};
}

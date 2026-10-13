// Browser-only byte/JSON boundary. No caller object property access for byte input.
const errors=new WeakSet();
export class DocumentResponseError extends Error {constructor(code){super(code);this.name='DocumentResponseError';this.code=code;errors.add(this);}}
export const isFailure=error=>errors.has(error);
export const fail=code=>{throw new DocumentResponseError(code);};
const typed=Object.getPrototypeOf(Uint8Array.prototype);
const get=name=>Object.getOwnPropertyDescriptor(typed,name).get;
const tag=Object.getOwnPropertyDescriptor(typed,Symbol.toStringTag).get;
const length=get('byteLength'),offset=get('byteOffset'),buffer=get('buffer');
const ordinaryBuffer=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
export function copyBytes(value,cap){
 try{if(tag.call(value)!=='Uint8Array')fail('INVALID_BYTES');const n=length.call(value),b=buffer.call(value),o=offset.call(value);ordinaryBuffer.call(b);if(n>cap)fail('BYTE_LIMIT');const copy=new Uint8Array(n);Uint8Array.prototype.set.call(copy,new Uint8Array(b,o,n));return copy;}catch(error){if(isFailure(error))throw error;fail('INVALID_BYTES');}
}
export function parseBytes(value,cap){
 const bytes=copyBytes(value,cap);let text,data;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);data=JSON.parse(text);}catch{fail('INVALID_JSON_UTF8');}
 const stack=[[data,0]],objects=[];let nodes=0;
 while(stack.length){const[v,depth]=stack.pop();if(++nodes>100000||depth>64)fail('JSON_LIMIT');if(typeof v==='number'&&!Number.isFinite(v))fail('INVALID_NUMBER');if(typeof v==='string'&&!v.isWellFormed())fail('INVALID_UNICODE');
  if(v&&typeof v==='object'){objects.push(v);for(const[k,x]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))fail('DANGEROUS_KEY');stack.push([x,depth+1]);}}
 }
 for(const v of objects)Object.freeze(v);return data;
}
export async function digest(bytes){const result=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');}
// Branding is local integrity provenance; it is never an access grant.
export const admittedRequests=new WeakMap(),admittedVersions=new WeakSet();

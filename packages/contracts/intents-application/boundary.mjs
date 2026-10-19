/** Text is converted through the existing bounded, inert browser JSON boundary. */
import {parseBytes} from '../document-application/boundary.mjs';
export class IntentsResponseError extends Error {constructor(code){super(code);this.name='IntentsResponseError';this.code=code;}}
export const fail=code=>{throw new IntentsResponseError(code);};
export function parseText(value,cap){
 if(typeof value!=='string')fail('INTENTS_JSON');
 if(value.length>cap)fail('INTENTS_LIMIT');
 if(!value.isWellFormed())fail('INTENTS_JSON');
 try{return parseBytes(new TextEncoder().encode(value),cap);}catch(error){fail(['BYTE_LIMIT','JSON_LIMIT'].includes(error.code)?'INTENTS_LIMIT':'INTENTS_JSON');}
}
/** The captured request is trusted caller context, but is still copied as own enumerable data; accessors are never invoked. */
export function expectedData(value,cap){
 let nodes=0;
 const visit=(v,depth)=>{
  if(++nodes>100000||depth>64)fail('INTENTS_EXPECTATION');
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(!v||typeof v!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))fail('INTENTS_EXPECTATION');
  const descriptors=Object.getOwnPropertyDescriptors(v),array=Array.isArray(v),out=array?[]:{};
  for(const key of Reflect.ownKeys(descriptors)){if(array&&key==='length')continue;const d=descriptors[key];if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))fail('INTENTS_EXPECTATION');out[key]=visit(d.value,depth+1);}return out;
 };
 try{return parseText(JSON.stringify(visit(value,0)),cap);}catch(error){if(error instanceof IntentsResponseError)throw error;fail('INTENTS_EXPECTATION');}
}

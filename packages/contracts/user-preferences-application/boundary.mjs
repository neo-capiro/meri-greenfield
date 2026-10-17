import {parseBytes} from '../document-application/boundary.mjs';
export class UserPreferencesResponseError extends Error {constructor(code){super(code);this.name='UserPreferencesResponseError';this.code=code;}}
export const fail=code=>{throw new UserPreferencesResponseError(code);};
export function parseText(value,cap){
 if(typeof value!=='string')fail('USER_PREFERENCES_JSON');if(value.length>cap)fail('USER_PREFERENCES_LIMIT');if(!value.isWellFormed())fail('USER_PREFERENCES_JSON');
 try{return parseBytes(new TextEncoder().encode(value),cap);}catch(error){fail(['BYTE_LIMIT','JSON_LIMIT'].includes(error.code)?'USER_PREFERENCES_LIMIT':'USER_PREFERENCES_JSON');}
}
/** Independent caller owner and captured request are copied as data; accessors are never invoked. */
export function expectedData(value,cap){
 let nodes=0;
 const visit=(v,depth)=>{
  if(++nodes>100000||depth>64)fail('USER_PREFERENCES_EXPECTATION');
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(!v||typeof v!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))fail('USER_PREFERENCES_EXPECTATION');
  const descriptors=Object.getOwnPropertyDescriptors(v),array=Array.isArray(v),out=array?[]:{};
  for(const key of Reflect.ownKeys(descriptors)){if(array&&key==='length')continue;const d=descriptors[key];if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))fail('USER_PREFERENCES_EXPECTATION');out[key]=visit(d.value,depth+1);}return out;
 };
 try{return parseText(JSON.stringify(visit(value,0)),cap);}catch(error){if(error instanceof UserPreferencesResponseError)throw error;fail('USER_PREFERENCES_EXPECTATION');}
}

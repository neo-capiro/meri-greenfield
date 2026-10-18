/** Text is converted through the existing bounded, inert browser JSON boundary. */
import {parseBytes} from '../document-application/boundary.mjs';
export class TaskCommandResponseError extends Error {constructor(code){super(code);this.name='TaskCommandResponseError';this.code=code;}}
export const fail=code=>{throw new TaskCommandResponseError(code);};
export function parseText(value,cap){
 if(typeof value!=='string')fail('TASK_COMMAND_JSON');
 if(value.length>cap)fail('TASK_COMMAND_LIMIT');
 if(!value.isWellFormed())fail('TASK_COMMAND_JSON');
 try{return parseBytes(new TextEncoder().encode(value),cap);}catch(error){fail(['BYTE_LIMIT','JSON_LIMIT'].includes(error.code)?'TASK_COMMAND_LIMIT':'TASK_COMMAND_JSON');}
}
/** Trusted caller context is still copied as own enumerable data; accessors are never read. */
export function snapshotExpected(value){
 const visit=(v,depth)=>{
  if(depth>64)fail('TASK_COMMAND_EXPECTATION');
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(!v||typeof v!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))fail('TASK_COMMAND_EXPECTATION');
  const d=Object.getOwnPropertyDescriptors(v),array=Array.isArray(v),out=array?[]:{};
  for(const key of Reflect.ownKeys(d)){
   if(array&&key==='length')continue;
   if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||!d[key].enumerable||!Object.hasOwn(d[key],'value'))fail('TASK_COMMAND_EXPECTATION');
   out[key]=visit(d[key].value,depth+1);
  }
  return out;
 };
 try{return parseText(JSON.stringify(visit(value,0)),16777216);}catch(error){if(error instanceof TaskCommandResponseError)throw error;fail('TASK_COMMAND_EXPECTATION');}
}

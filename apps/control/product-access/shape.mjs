/** Closed own-data admission for product-surface inputs and port receipts, reusing the canonical command boundary. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {refuse} from './errors.mjs';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const SHA256=/^[a-f0-9]{64}$/u;
/** Deep-frozen snapshot of a closed plain object; any other shape refuses with `code`. */
export function closed(value,required,optional,code){
 try{return data(own(data(value),required,optional));}catch{refuse(code);}
}
export const text=(value,min,max)=>typeof value==='string'&&value.length>=min&&value.length<=max;
/** Trimmed text in bounds; the caller's code reports any other value. */
export function trimmed(value,max,code){if(typeof value!=='string'||!value.trim()||value.trim().length>max)refuse(code);return value.trim();}
export const nullable=(value,check)=>value===null||check(value);
export function lowerUuid(value,code){if(typeof value!=='string'||!UUID.test(value.toLowerCase()))refuse(code);return value.toLowerCase();}
/** Strict integer bounds (no coercion). */
export const intIn=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;

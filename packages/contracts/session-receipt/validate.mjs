import Ajv from 'ajv/dist/2020.js';
import {sessionReceiptSchema} from './schema.mjs';
const ajv=new Ajv({strict:true,allErrors:false}),conversation=ajv.compile(sessionReceiptSchema({general:true})),client=ajv.compile(sessionReceiptSchema());
/** Callers snapshot untrusted objects first. Shape validation is never authorization. */
export function validSessionReceipt(value,at,{general=false}={}){return Number.isSafeInteger(at)&&at>=0&&(general?conversation:client)(value)&&value.expiresAtMs>at;}

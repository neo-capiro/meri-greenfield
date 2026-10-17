/** Finite private wire only. Current service/user authority and producer consumption remain separate owners. */
import Ajv from 'ajv/dist/2020.js';
import canonicalize from 'canonicalize';
import schema from './schema.json' with {type:'json'};
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../validate.mjs';
import {fundingInstant} from '../retrieval-0.2/funding-envelope-validation.mjs';
import {FUNDING_OPPORTUNITY_OPERATION_IDS as FUNDING_READ_OPERATIONS} from '../retrieval-0.2/funding-opportunities-validation.mjs';

export const NATIVE_READ_OBSERVATION_SCHEMA_VERSION='meri-native-read-observation/1';
export const NATIVE_READ_OBSERVATION_HEADER='x-meri-read-observation';
export const NATIVE_READ_OBSERVATION_MAX_BYTES=2048;
export {FUNDING_READ_OPERATIONS};
export const MODE_READ_OPERATIONS=Object.freeze(['search_federal_grants','search_federal_awards','search_program_elements','get_program_element','get_pe_budget_timeline']);
export const NATIVE_READ_OBSERVATION_OPERATIONS=Object.freeze([...FUNDING_READ_OPERATIONS,'search_client_knowledge',...MODE_READ_OPERATIONS]);
const ajv=new Ajv({strict:true,allErrors:false}),valid=ajv.compile(schema);
const refuse=()=>{throw Error('NATIVE_READ_OBSERVATION_REFUSED');};
const bytes=value=>Buffer.from(canonicalize(value),'utf8');

function expected(raw){
 const {operation,request}=data(own(raw,['operation','request']));
 own(operation,['id','version']);
 if(operation.version!=='0.2.0'||!NATIVE_READ_OBSERVATION_OPERATIONS.includes(operation.id)||!request||typeof request!=='object'||Array.isArray(request))refuse();
 // Original unwrapped tool JSON. No defaults, trimming, context merge or family normalization here.
 return {operation,requestSha256:canonicalSha256(request)};
}

export function assertNativeReadObservation(raw,correlation){
 try{
  const value=data(raw),binding=expected(correlation);
  if(!valid(value)||canonicalSha256(value.operation)!==canonicalSha256(binding.operation)||value.requestSha256!==binding.requestSha256)refuse();
  if(!MODE_READ_OPERATIONS.includes(value.operation.id))fundingInstant(value.context.asOf);
  if(bytes(value).byteLength>NATIVE_READ_OBSERVATION_MAX_BYTES)refuse();
  return value;
 }catch{refuse();}
}

export function createNativeReadObservation(raw){
 try{
  const {operation,request,context}=own(raw,['operation','request','context']),binding=expected({operation,request});
  return assertNativeReadObservation({schemaVersion:NATIVE_READ_OBSERVATION_SCHEMA_VERSION,...binding,context},{operation,request});
 }catch{refuse();}
}

export function encodeNativeReadObservation(raw,correlation){
 try{return bytes(assertNativeReadObservation(raw,correlation)).toString('base64url');}catch{refuse();}
}

export function decodeNativeReadObservation(carrier,correlation){
 try{
  if(typeof carrier!=='string'||carrier.length===0||carrier.length>Math.ceil(NATIVE_READ_OBSERVATION_MAX_BYTES*4/3)||!/^[A-Za-z0-9_-]+$/u.test(carrier))refuse();
  const decoded=Buffer.from(carrier,'base64url');
  if(decoded.byteLength>NATIVE_READ_OBSERVATION_MAX_BYTES||decoded.toString('base64url')!==carrier)refuse();
  const json=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(decoded),value=assertNativeReadObservation(JSON.parse(json),correlation);
  // Reject duplicate keys, whitespace, reordered keys, escapes and other alternate JSON representations.
  if(!bytes(value).equals(decoded))refuse();
  return value;
 }catch{refuse();}
}

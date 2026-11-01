/** Official source custody reuses Core's exact five-pin read. The stored marker
 * is only a format discriminator; every use must independently re-read Core. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {projectNativeFederalSource,projectRawFederalSource} from './native-source.mjs';
import {FEDERAL_RAW_REPRESENTATION,assertFederalRawSource} from '../../../packages/contracts/federal-workbench/raw-source.mjs';
export const FEDERAL_SOURCE_SCHEMA='meri.federal-source.v1';
export const FEDERAL_RAW_SOURCE_SCHEMA='meri.federal-source.v2';
const contract=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
const fault=code=>{throw Object.assign(Error(code),{code});};
export function federalSourceSelection(raw){return contract.normalizeInput(data(raw)).input;}
export async function readFederalSourceEnvelope(read,selection,{deadlineMs,signal,representation}){
 if(typeof read!=='function')fault('DRAFT_SOURCE_READER_UNAVAILABLE');
 if(representation!==undefined&&representation!==FEDERAL_RAW_REPRESENTATION)fault('DRAFT_SOURCE_FORMAT');
 const exact=federalSourceSelection(selection),result=await read({selection:exact,deadlineMs,signal,...(representation===undefined?{}:{representation})});
 if(representation===FEDERAL_RAW_REPRESENTATION){
  assertFederalRawSource(result,{...exact,representation});
  if(result.currentStatus!=='available')fault('DRAFT_SOURCE_STALE');
  return {schema:FEDERAL_RAW_SOURCE_SCHEMA,representation,capture:result.raw.capture,selection:exact,source:projectRawFederalSource(exact,result)};
 }
 contract.assertOutput(result,{request:exact});
 if(result.currentStatus!=='available')fault('DRAFT_SOURCE_STALE');
 // The workbench envelope admits a retained USLM extraction as a structured baseline; the frozen SDK tool stays flat.
 return {schema:FEDERAL_SOURCE_SCHEMA,selection:exact,source:projectNativeFederalSource(exact,result,{structured:true})};
}
export async function currentFederalSource(raw,read,options){
 if(![FEDERAL_SOURCE_SCHEMA,FEDERAL_RAW_SOURCE_SCHEMA].includes(raw?.schema))return raw;
 const qualified=raw.schema===FEDERAL_RAW_SOURCE_SCHEMA;
 let stored;try{stored=data(own(raw,['schema','selection','source',...(qualified?['representation','capture']:[])]));}catch{fault('DRAFT_SOURCE_FORMAT');}
 const current=await readFederalSourceEnvelope(read,stored.selection,{...options,...(qualified?{representation:stored.representation}:{})});
 if(hash(current)!==hash(stored))fault('DRAFT_SOURCE_STALE');
 return current.source;
}
export function federalSourceRequest(envelope){
 return {operation:'create_word',format:'txt',title:`Federal source [${hash(envelope)}]: ${envelope.selection.billId}`.slice(0,160),content:{text:JSON.stringify(envelope)}};
}

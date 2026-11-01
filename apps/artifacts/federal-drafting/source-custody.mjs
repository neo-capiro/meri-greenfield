/** Official source custody reuses Core's exact five-pin read. The stored marker
 * is only a format discriminator; every use must independently re-read Core. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {projectNativeFederalSource} from './native-source.mjs';
export const FEDERAL_SOURCE_SCHEMA='meri.federal-source.v1';
const contract=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
const fault=code=>{throw Object.assign(Error(code),{code});};
export function federalSourceSelection(raw){return contract.normalizeInput(data(raw)).input;}
export async function readFederalSourceEnvelope(read,selection,{deadlineMs,signal}){
 if(typeof read!=='function')fault('DRAFT_SOURCE_READER_UNAVAILABLE');
 const exact=federalSourceSelection(selection),result=await read({selection:exact,deadlineMs,signal});
 contract.assertOutput(result,{request:exact});
 if(result.currentStatus!=='available')fault('DRAFT_SOURCE_STALE');
 // The workbench envelope admits a retained USLM extraction as a structured baseline; the frozen SDK tool stays flat.
 return {schema:FEDERAL_SOURCE_SCHEMA,selection:exact,source:projectNativeFederalSource(exact,result,{structured:true})};
}
export async function currentFederalSource(raw,read,options){
 if(raw?.schema!==FEDERAL_SOURCE_SCHEMA)return raw;
 let stored;try{stored=data(own(raw,['schema','selection','source']));}catch{fault('DRAFT_SOURCE_FORMAT');}
 const current=await readFederalSourceEnvelope(read,stored.selection,options);
 if(hash(current)!==hash(stored))fault('DRAFT_SOURCE_STALE');
 return current.source;
}
export function federalSourceRequest(envelope){
 return {operation:'create_word',format:'txt',title:`Federal source [${hash(envelope)}]: ${envelope.selection.billId}`.slice(0,160),content:{text:JSON.stringify(envelope)}};
}

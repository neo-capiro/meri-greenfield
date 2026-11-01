/** Deterministic identity of the pinned, offline USLM schema closure. A receipt is bound to exact UTF-8 bytes;
 * checking its shape here does not run XSD validation. The server's configured validator owns that execution. */
import {FEDERAL_USLM_SCHEMA_PARSER} from './source-layout.mjs';
export const USLM_SCHEMA_PROFILE='uslm-2.1.0';
export const USLM_SCHEMA_SHA256='c68c058345f99689144c183c99d47552f3d56aa365ff1380127a9180fe18ce44';
const fault=()=>{throw Object.assign(Error('DRAFT_SCHEMA_RECEIPT_INVALID'),{code:'DRAFT_SCHEMA_RECEIPT_INVALID'});};
const bytes=text=>new TextEncoder().encode(text).length;
export function assertSchemaReceipt(receipt,sha256,length){
 if(!receipt||Object.keys(receipt).sort().join(',')!=='bytes,profile,schemaSha256,sourceSha256,valid'||
  receipt.profile!==USLM_SCHEMA_PROFILE||receipt.schemaSha256!==USLM_SCHEMA_SHA256||receipt.valid!==true||
  receipt.sourceSha256!==sha256||receipt.bytes!==length||!Number.isSafeInteger(length)||length<1||length>131072)fault();
 return receipt;
}
export function assertPreparedSchema(prepared){
 const {draft,schemaValidation}=prepared;
 if(draft.source.parserVersion!==FEDERAL_USLM_SCHEMA_PARSER){if(Object.hasOwn(prepared,'schemaValidation'))fault();return;}
 if(!schemaValidation||Object.keys(schemaValidation).sort().join(',')!=='consolidated,source')fault();
 assertSchemaReceipt(draft.source.validation,draft.source.sha256,bytes(draft.source.text));
 assertSchemaReceipt(schemaValidation.source,draft.source.sha256,bytes(draft.source.text));
 if(draft.resultKind==='source-text-removed'){if(schemaValidation.consolidated!==null)fault();}
 else assertSchemaReceipt(schemaValidation.consolidated,draft.outputHashes.consolidated,bytes(draft.outputs.consolidated));
}

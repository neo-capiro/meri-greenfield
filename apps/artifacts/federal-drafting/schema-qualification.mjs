/** Async XSD qualification uses only the fixed runtime validator. Pure compilation never grants this claim. */
import {FEDERAL_USLM_SCHEMA_PARSER,isFederalUslm} from '../../../packages/contracts/federal-workbench/source-layout.mjs';
import {assertSchemaReceipt} from '../../../packages/contracts/federal-workbench/schema-receipt.mjs';
import {deriveUslmScopes} from './uslm-source.mjs';
import {federalDraftSource,textSha256} from './engine.mjs';
const fault=code=>{throw Object.assign(Error(code),{code});};
async function validate(text,validator,options){
 if(typeof validator?.validate!=='function')fault('DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE');
 const receipt=await validator.validate(text,options);
 assertSchemaReceipt(receipt,textSha256(text),Buffer.byteLength(text));
 return receipt;
}
export async function qualifyFederalSchemaSource(source,validator,options){
 if(!isFederalUslm(source.parserVersion))fault('DRAFT_SOURCE_FORMAT');
 const validation=await validate(source.text,validator,options);
 const scopes=deriveUslmScopes(source.text,FEDERAL_USLM_SCHEMA_PARSER).scopes;
 return federalDraftSource({...source,parserVersion:FEDERAL_USLM_SCHEMA_PARSER,validation,scopes,
  coverage:{...source.coverage,limitations:source.coverage.limitations.map(line=>line.startsWith('Raw USLM XML text;')?
   'Exact USLM XML text validated against the pinned USLM 2.1.0 schema; scopes use declared element identifiers or IDs. Numbering, cross-references, arithmetic, enactment and substantive law remain unresolved.':line)}});
}
export async function validateFederalDraftSchema(draft,validator,options){
 if(draft.source.parserVersion!==FEDERAL_USLM_SCHEMA_PARSER)return undefined;
 const source=await validate(draft.source.text,validator,options);
 assertSchemaReceipt(draft.source.validation,source.sourceSha256,source.bytes);
 const consolidated=draft.resultKind==='source-text-removed'?null:await validate(draft.outputs.consolidated,validator,options);
 return Object.freeze({source,consolidated});
}
/** Rechecks in one HTTP operation keep rereading Core and comparing the full envelope. Schema validation is a
 * deterministic byte property: reuse at most the source and result receipts for identical text within that one
 * operation. This cache never crosses requests, carries authority, or admits a changed source or failed result. */
export function federalValidatorForOperation(validator){
 if(typeof validator?.validate!=='function')return null;
 const validate=validator.validate.bind(validator),receipts=new Map();
 return Object.freeze({async validate(text,options){
  const check=()=>{if(!Number.isSafeInteger(options?.deadlineMs))fault('DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE');if(options.signal?.aborted)fault('ARTIFACT_CANCELLED');if(Date.now()>=options.deadlineMs)fault('ARTIFACT_DEADLINE');};
  check();
  if(receipts.has(text))return receipts.get(text);
  const receipt=await validate(text,options);check();
  assertSchemaReceipt(receipt,textSha256(text),Buffer.byteLength(text));
  if(receipts.size===2)receipts.delete(receipts.keys().next().value);
  const retained=Object.freeze({...receipt});receipts.set(text,retained);return retained;
 }});
}

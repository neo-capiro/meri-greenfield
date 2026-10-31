import {validateReceipt} from './generated-validator.mjs';
/** Shared CONTROL/browser shape check. Callers snapshot untrusted data first; this grants no authority. */
export function validSessionReceipt(value,at,{general=false,research=false}={}){
 return Number.isSafeInteger(at)&&at>=0&&validateReceipt(value)&&value.expiresAtMs>at
  &&(value.context.scopeKind==='research_portfolio'?research:general||value.context.selectedClientId!==null)
  // Preserve the existing CONTROL principal bound in UTF-16 code units.
  &&value.context.tenantId.length<=256&&value.context.actorId.length<=256;
}

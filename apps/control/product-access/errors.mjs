/** Content-free product-surface failures. Only errors constructed here are trusted by the HTTP mapping. */
const owned=new WeakMap();
const OUTCOMES=new Set(['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','STORED_NOT_RELEASED']);
const FIELD=/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u;
export class ProductError extends Error{
 /** `field` names the offending request field for validation refusals; it never carries a value. */
 constructor(code,outcome=null,field=null){super(code);this.name='ProductError';
  owned.set(this,{code,outcome:OUTCOMES.has(outcome)?outcome:null,field:typeof field==='string'&&FIELD.test(field)?field:null});}
}
export const refuse=(code,outcome,field)=>{throw new ProductError(code,outcome,field);};
/** {code,outcome,field} for an owned failure, otherwise null (foreign errors never choose a code). */
export const productFailure=error=>owned.get(error)??null;
/** Re-raise owned failures; replace anything else with `code` so foreign messages never reach a caller. */
export const asProductError=(error,code,outcome)=>owned.has(error)?error:new ProductError(code,outcome);

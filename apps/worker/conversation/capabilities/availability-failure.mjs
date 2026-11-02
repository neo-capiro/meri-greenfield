// @ts-check
/** The closed fact of a failed availability read (the general-read snapshot in `reads/runtime.mjs`, the governed-intent offer in
 * `intents/runtime.mjs`): an own string `code` (else UNAVAILABLE), the layer whose bound answered (the runner client marks its own
 * and control's answers; anything else was decided in this worker) and the elapsed time. Never a message or stack, and nothing
 * of it reaches the model: the run's diagnostics print it so a bound can be confirmed live.
 * @param {unknown} error @param {number} elapsedMs @returns {{code:string,layer:'worker'|'runner'|'control',elapsedMs:number}} */
export const availabilityFailure=(error,elapsedMs)=>{
 const ownValue=(/** @type {string} */name)=>error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,name)?.value:undefined,code=ownValue('code'),layer=ownValue('layer');
 return Object.freeze({code:typeof code==='string'?code:'UNAVAILABLE',layer:layer==='runner'||layer==='control'?layer:'worker',elapsedMs});
};

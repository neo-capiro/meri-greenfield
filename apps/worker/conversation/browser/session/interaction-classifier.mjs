/** Host-side classification of one interaction tool call against the live page, for the permission gate
 * (`../permissions.mjs`): `credential` (typing into a password or credential/payment field) is refused outright,
 * because sign-in happens only through user takeover (Q-A2); `submission` (submitting a form or confirming a dialog)
 * asks the user; everything else is `routine` and runs without a question, the way Claude's own browsing does.
 *
 * The element behind a Playwright MCP `ref` (or the focused element) is resolved by the locator and inspected by one
 * page function. Playwright's public `Locator.evaluate` runs in the page's main world, so a hostile page that patches DOM
 * prototypes can lie about structure; a page that does so is already outside what this classifier can see, and the
 * confidentiality filter and takeover-only sign-in still apply. Every refusal path (no match, several matches, an error)
 * asks instead of running.
 * Structural facts only are read: tag, type, autocomplete, the owning form (the `form` IDL attribute, so a control that
 * names a form through `form=` outside it still counts) and its credential fields. A `<button>` whose `type` is neither
 * `button` nor `reset` submits (an invalid value defaults to submit). Anything that cannot be inspected (no page,
 * unknown ref, several matches, an evaluation error) is `submission`, so the user is asked instead of the call running
 * unexamined. Nothing here executes a page effect. */
import {CREDENTIAL_AUTOCOMPLETE} from './confidentiality.mjs';
export const INTERACTION_CLASSES=Object.freeze(['routine','submission','credential']);
const REF=/^[a-z][a-z0-9]{0,31}$/u;
/** Keys that activate or submit: Enter in any chord (Control+Enter, Meta+Enter, Shift+Enter, NumpadEnter), Playwright's
 * Enter aliases "\n" and "\r", and Space in any chord, which activates a focused submit control. */
const SUBMIT_KEY=/(^|\+)((numpad)?enter|\n|\r|space| )$/u;
/** Typed text containing a line break presses Enter on the way (pressSequentially("abc\n") submits). */
const LINE_BREAK=/[\r\n]/u;
const SUBMISSION_TOOLS=Object.freeze({browser_handle_dialog:input=>input?.accept===true});
/** Runs in the page over one resolved element; returns plain facts, never page text. Playwright serializes it into the
 * page, so it may use only its own arguments: no module constant or import exists there. */
export function inspectTargets(node,{selectors,autocomplete}){
 return [node].map(node=>{
  // The IDL form owner honours `form="id"`; non-form-associated elements fall back to the enclosing form.
  const owner=node.form;
  const form=owner&&typeof owner==='object'?owner:typeof node.closest==='function'?node.closest('form'):null;
  const tag=node.tagName.toLowerCase(),type=(node.getAttribute('type')||'').toLowerCase();
  const attr=(el,name)=>(el.getAttribute(name)||'').toLowerCase();
  // One-time codes are often unlabelled: an OTP-like name/id, or a short numeric field whose name, id, label or
  // placeholder says "code", counts as a credential even without autocomplete="one-time-code".
  const oneTimeCode=el=>{const words=`${attr(el,'name')} ${attr(el,'id')} ${attr(el,'aria-label')} ${attr(el,'placeholder')}`;
   if(/\b(otp|totp|2fa|mfa|passcode)\b|one[-_ ]?time|verification[-_ ]?code|security[-_ ]?code|auth(entication)?[-_ ]?code/u.test(words))return true;
   const max=Number(attr(el,'maxlength'));
   return attr(el,'inputmode')==='numeric'&&Number.isSafeInteger(max)&&max>0&&max<=8&&/code/u.test(words);};
  const credential=(el)=>{const t=attr(el,'type'),a=attr(el,'autocomplete').split(/\s+/u);
   return t==='password'||a.some(x=>autocomplete.includes(x))||oneTimeCode(el)||selectors.some(s=>el.matches(s));};
  const submitControl=tag==='button'&&type!=='button'&&type!=='reset'&&form!==null||tag==='input'&&(type==='submit'||type==='image');
  return {tag,type,credential:credential(node),inForm:form!==null,submitControl,
   formHasCredential:form!==null&&Array.from(form.querySelectorAll('input,textarea,[autocomplete]')).some(credential)};
 })[0];
}
/** The one element a locator resolves to in one frame: none (null), one (its facts) or several (ambiguous, so asks). */
async function factsAt(locator,pageArgument){
 const n=await locator.count();
 if(n===0)return null;
 if(n!==1)throw Object.assign(Error('AMBIGUOUS'),{code:'AMBIGUOUS'});
 return await locator.evaluate(inspectTargets,pageArgument,{timeout:2000});
}
/** @param {{tool:string,input:any,pages:any[],sensitiveSelectors?:string[],signal?:AbortSignal}} request */
export async function classifyInteraction({tool,input,pages,sensitiveSelectors=[],signal}){
 signal?.throwIfAborted();
 const pageArgument={selectors:sensitiveSelectors,autocomplete:[...CREDENTIAL_AUTOCOMPLETE]};
 if(Object.hasOwn(SUBMISSION_TOOLS,tool))return SUBMISSION_TOOLS[tool](input)?'submission':'routine';
 if(tool==='browser_hover'||tool==='browser_select_option')return 'routine';
 if(tool==='browser_press_key'){
  // A key goes to whatever is focused: pressing keys one by one into a credential field is refused like typing into it.
  let focused=[];
  for(const page of Array.isArray(pages)?pages:[]){
   for(const frame of page.frames()){
    let fact;try{fact=await factsAt(frame.locator(':focus'),pageArgument);}catch{return 'submission';}
    signal?.throwIfAborted();if(fact)focused.push(fact);
   }
  }
  if(focused.some(f=>f.credential))return 'credential';
  return SUBMIT_KEY.test(String(input?.key??'').toLowerCase())?'submission':'routine';
 }
 const refs=tool==='browser_fill_form'?(Array.isArray(input?.fields)?input.fields.map(f=>f?.ref):[]):[input?.ref];
 if(!refs.length||refs.some(ref=>typeof ref!=='string'||!REF.test(ref)))return 'submission';
 const facts=[];
 for(const ref of refs){
  let found=[];
  for(const page of Array.isArray(pages)?pages:[]){
   for(const frame of page.frames()){
    let fact;try{fact=await factsAt(frame.locator(`aria-ref=${ref}`),pageArgument);}catch{return 'submission';}
    signal?.throwIfAborted();if(fact)found.push(fact);
   }
  }
  if(found.length!==1)return 'submission';
  facts.push(found[0]);
 }
 if(tool==='browser_type'||tool==='browser_fill_form'){
  if(facts.some(f=>f.credential))return 'credential';
  const typed=tool==='browser_type'?[input?.text]:(Array.isArray(input?.fields)?input.fields.map(f=>f?.value):[]);
  if(typed.some(value=>typeof value==='string'&&LINE_BREAK.test(value)))return 'submission';
  return tool==='browser_type'&&input?.submit===true?'submission':'routine';
 }
 if(tool==='browser_click')return facts[0].submitControl?'submission':'routine';
 return 'submission';
}

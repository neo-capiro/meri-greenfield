/** Host-side classification of one interaction tool call against the live page, for the permission gate
 * (`../permissions.mjs`): `credential` (typing into a password or credential/payment field) is refused outright,
 * because sign-in happens only through user takeover (Q-A2); `submission` (submitting a form or confirming a dialog)
 * asks the user; everything else is `routine` and runs without a question, the way Claude's own browsing does.
 *
 * The element behind a Playwright MCP `ref` is inspected in the pinned Playwright utility world, where DOM prototypes
 * are pristine (the same world `snapshot.mjs` uses), so a hostile page cannot relabel a password field or hide a form.
 * Structural facts only are read: tag, type, autocomplete, the enclosing form and its credential fields. Anything that
 * cannot be inspected (no page, unknown ref, several matches, an evaluation error) is `submission`, so the user is
 * asked instead of the call running unexamined. Nothing here executes a page effect. */
import {CREDENTIAL_AUTOCOMPLETE} from './confidentiality.mjs';
export const INTERACTION_CLASSES=Object.freeze(['routine','submission','credential']);
const REF=/^[a-z][a-z0-9]{0,31}$/u;
const SUBMISSION_TOOLS=Object.freeze({browser_press_key:input=>String(input?.key??'').toLowerCase()==='enter',browser_handle_dialog:input=>input?.accept===true});
/** Runs in the page's utility world over the elements a ref resolves to; returns plain facts, never page text. */
function inspectTargets(nodes,selectors){
 return nodes.map(node=>{
  const form=typeof node.closest==='function'?node.closest('form'):null;
  const tag=node.tagName.toLowerCase(),type=(node.getAttribute('type')||'').toLowerCase();
  const credential=(el)=>{const t=(el.getAttribute('type')||'').toLowerCase(),a=(el.getAttribute('autocomplete')||'').toLowerCase().split(/\s+/u);
   return t==='password'||a.some(x=>CREDENTIAL_AUTOCOMPLETE.includes(x))||selectors.some(s=>el.matches(s));};
  const submitControl=tag==='button'&&(type===''||type==='submit')&&form!==null||tag==='input'&&(type==='submit'||type==='image');
  return {tag,type,credential:credential(node),inForm:form!==null,submitControl,
   formHasCredential:form!==null&&Array.from(form.querySelectorAll('input,textarea,[autocomplete]')).some(credential)};
 });
}
/** @param {{tool:string,input:any,pages:any[],sensitiveSelectors?:string[],signal?:AbortSignal}} request */
export async function classifyInteraction({tool,input,pages,sensitiveSelectors=[],signal}){
 signal?.throwIfAborted();
 if(Object.hasOwn(SUBMISSION_TOOLS,tool))return SUBMISSION_TOOLS[tool](input)?'submission':'routine';
 if(tool==='browser_hover'||tool==='browser_select_option')return 'routine';
 const refs=tool==='browser_fill_form'?(Array.isArray(input?.fields)?input.fields.map(f=>f?.ref):[]):[input?.ref];
 if(!refs.length||refs.some(ref=>typeof ref!=='string'||!REF.test(ref)))return 'submission';
 const facts=[];
 for(const ref of refs){
  let found=[];
  for(const page of Array.isArray(pages)?pages:[]){
   for(const frame of page.frames()){
    let nodes;try{nodes=await frame.locator(`aria-ref=${ref}`).evaluateAll(inspectTargets,sensitiveSelectors,{world:'utility'});}catch{return 'submission';}
    signal?.throwIfAborted();if(Array.isArray(nodes))found.push(...nodes);
   }
  }
  if(found.length!==1)return 'submission';
  facts.push(found[0]);
 }
 if(tool==='browser_type'||tool==='browser_fill_form'){
  if(facts.some(f=>f.credential))return 'credential';
  return tool==='browser_type'&&input?.submit===true?'submission':'routine';
 }
 if(tool==='browser_click')return facts[0].submitControl?'submission':'routine';
 return 'submission';
}

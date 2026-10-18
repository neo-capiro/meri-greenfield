/** S2 model-bound confidentiality filter (design section 1.1 S2; owner answers Q-T2 and Q-A2 accepted 15 October 2026:
 * the model, transcripts, receipts and logs never receive credentials). One output boundary in the browser session
 * owner wraps EVERY Playwright MCP tool response before it leaves for the worker.
 *
 * PREPARATION ONLY, FAIL CLOSED. The rules are implemented here over a parsed page document. Parsing and re-rendering
 * the real Playwright MCP 0.0.83 response format is a version-pinned parser port that does not exist yet (it needs the
 * pinned package, which is not installed in this repository, and the S2 canary qualification). Without a parser for
 * exactly PLAYWRIGHT_MCP_VERSION, every response is BROWSER_OUTPUT_UNFILTERABLE; a parser or renderer error is the same
 * refusal. Nothing is ever passed through unfiltered.
 *
 * Parser port: `{version, parse(response) -> document, render(document) -> response}` where a document is
 * `{pageUrl:string|null, dialogText:string|null, image:boolean, blocks:[{kind:'text',text} | {kind:'field',label,type,
 * autocomplete,selectorMatch,value}]}`. `selectorMatch` is the parser's evaluation of the site manifest's
 * `sensitiveSelectors` for that field. */
import {PLAYWRIGHT_MCP_VERSION} from '../policy.mjs';
/** Rule 2: autocomplete tokens that mark credential or payment fields. */
export const CREDENTIAL_AUTOCOMPLETE=Object.freeze(['current-password','new-password','one-time-code','cc-number','cc-csc','cc-exp','cc-exp-month','cc-exp-year','cc-name','cc-type']);
export const REDACTED='[redacted]';
const fault=code=>Object.assign(new Error(code),{code});
const URL_IN_TEXT=/\bhttps?:\/\/[^\s"'<>()[\]{}`]+/giu;

/** Rule 5: origin plus path; query strings and fragments (tokens, codes) are dropped; non-web URLs become null. */
export function reduceUrl(value){
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?`${u.origin}${u.pathname}`:null;}catch{return null;}
}
export const reduceUrlsInText=text=>text.replace(URL_IN_TEXT,m=>reduceUrl(m)??'[url]');
/** Rule 2: password inputs, credential/payment autocomplete tokens, and manifest-listed sensitive selectors. */
export function isCredentialField(field){
 if(field?.selectorMatch===true||String(field?.type).toLowerCase()==='password')return true;
 const tokens=typeof field?.autocomplete==='string'?field.autocomplete.toLowerCase().split(/\s+/u):[];
 return tokens.some(t=>CREDENTIAL_AUTOCOMPLETE.includes(t));
}
const hasValue=f=>typeof f.value==='string'&&f.value.length>0;
/** Rule 4: the manifest sign-in URL (origin + path) or an identity-provider origin, or a credential field with a value. */
export function isSensitivePage(document,manifest){
 const reduced=document.pageUrl===null?null:reduceUrl(document.pageUrl);
 let origin=null;try{origin=reduced&&new URL(reduced).origin;}catch{}
 if(manifest){
  if(reduced&&typeof manifest.signInUrl==='string'&&reduced===reduceUrl(manifest.signInUrl))return true;
  if(origin&&Array.isArray(manifest.idpOrigins)&&manifest.idpOrigins.includes(origin))return true;
 }
 return document.blocks.some(b=>b.kind==='field'&&isCredentialField(b)&&hasValue(b));
}
function assertDocument(d){
 const ok=d&&typeof d==='object'&&(d.pageUrl===null||typeof d.pageUrl==='string')&&(d.dialogText===null||typeof d.dialogText==='string')&&typeof d.image==='boolean'&&Array.isArray(d.blocks)
  &&d.blocks.every(b=>b&&(b.kind==='text'&&typeof b.text==='string'||b.kind==='field'&&typeof b.label==='string'&&(b.value===null||typeof b.value==='string')));
 if(!ok)throw fault('BROWSER_OUTPUT_UNFILTERABLE');
 return d;
}

/** @param {{parser?:{version:string,parse:Function,render:Function}|null, manifest?:object|null}} options */
export function createModelBoundFilter({parser=null,manifest=null}={}){
 const usable=parser&&parser.version===PLAYWRIGHT_MCP_VERSION&&typeof parser.parse==='function'&&typeof parser.render==='function';
 return Object.freeze({
  /** Filters one tool response. `fenceState` comes from the S1 fence; `postLease` is true only for the first snapshot the
   * session owner captures after a lease (rule 3). Throws a refusal code; never returns the raw response. */
  filter({fenceState,tool,response,postLease=false}){
   if(fenceState!=='agent')throw fault('BROWSER_USER_IN_CONTROL');
   if(!usable)throw fault('BROWSER_OUTPUT_UNFILTERABLE');
   let document;try{document=assertDocument(parser.parse(response));}catch{throw fault('BROWSER_OUTPUT_UNFILTERABLE');}
   const pageUrl=document.pageUrl===null?null:reduceUrl(document.pageUrl);
   let filtered;
   if(isSensitivePage(document,manifest)){
    if(tool==='browser_take_screenshot'||document.image)throw fault('BROWSER_SENSITIVE_PAGE');
    const host=pageUrl?new URL(pageUrl).host:'unknown host';
    filtered={pageUrl,dialogText:null,image:false,blocks:[{kind:'text',text:`sign-in page; content withheld (${host})`}]};
   }else{
    filtered={pageUrl,dialogText:document.dialogText===null?null:reduceUrlsInText(document.dialogText),image:document.image,
     blocks:document.blocks.map(b=>b.kind==='text'?{kind:'text',text:reduceUrlsInText(b.text)}
      :{...b,label:reduceUrlsInText(b.label),value:b.value===null?null:postLease===true||isCredentialField(b)?REDACTED:reduceUrlsInText(b.value)})};
   }
   try{return parser.render(filtered);}catch{throw fault('BROWSER_OUTPUT_UNFILTERABLE');}
  },
 });
}

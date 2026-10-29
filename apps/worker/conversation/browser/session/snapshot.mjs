/** Pinned Playwright page inspection. Upstream MCP prose/errors/images are never model output. */
import {PLAYWRIGHT_MCP_VERSION} from '../policy.mjs';
import {createModelBoundFilter,REDACTED} from './confidentiality.mjs';
const fail=()=>{throw Object.assign(Error('BROWSER_OUTPUT_UNFILTERABLE'),{code:'BROWSER_OUTPUT_UNFILTERABLE'});};
function inspectFields(nodes,selectors){return nodes.map(node=>({
 kind:'field',label:node.getAttribute('aria-label')||node.getAttribute('name')||node.tagName.toLowerCase(),
 type:node.getAttribute('type')||node.tagName.toLowerCase(),autocomplete:node.getAttribute('autocomplete')||'',
 selectorMatch:selectors.some(selector=>node.matches(selector)),value:typeof node.value==='string'?node.value:node.textContent||null,
}));}
/** Browser context is host-owned; every page/frame is inspected, including redirects and popups.
 * Failure, uninspectable frames, DOM churn or unsupported API prevents release. */
export function createPinnedSnapshot({context,manifest=null,maxBytes=262144}){
 const secrets=new Set();let secretBytes=0;
 const remember=text=>{
  if(typeof text!=='string'||!text||secrets.has(text))return;
  const bytes=Buffer.byteLength(text);
  if(bytes>262144||secretBytes+bytes>1048576||secrets.size>=4096)fail();
  secrets.add(text);secretBytes+=bytes;
 };
 const parser={version:PLAYWRIGHT_MCP_VERSION,parse:document=>document,render:document=>({
  content:[{type:'text',text:['### Page','- Page URL: '+(document.pageUrl??'about:blank'),
   ...document.blocks.map(b=>b.kind==='text'?b.text:b.label+': '+(b.value??''))].join('\n')}],
 })};
 const filter=createModelBoundFilter({parser,manifest});
 async function capture({fenceState='agent',postLease=false,tool='browser_snapshot'}={}){
  const pages=context.pages();if(pages.length>16)fail();
  const fields=[],snapshots=[],observations=[];let pageUrl=null;
  for(const page of pages){
   const before=page.url(),frames=page.frames();if(frames.length>32)fail();pageUrl=before;
   for(const frame of frames){
    let found;
    // Pinned Playwright's utility world has pristine DOM prototypes. A hostile
    // page must not replace getAttribute/value/matches to hide credential fields.
    try{found=await frame.locator('input,textarea,select,[contenteditable],[autocomplete]').evaluateAll(inspectFields,manifest?.sensitiveSelectors??[],{world:'utility'});}catch{fail();}
    if(!Array.isArray(found)||found.length>2048)fail();fields.push(...found);observations.push({frame,found});
   }
   if(typeof page.ariaSnapshot!=='function')fail();
   // Pin 0.0.83's underlying Playwright API; refs come from the same owned page.
   let snapshot;try{snapshot=await page.ariaSnapshot({mode:'ai'});}catch{fail();}
   if(typeof snapshot!=='string'||page.url()!==before||page.frames().length!==frames.length)fail();
   snapshots.push(snapshot);
  }
  if(context.pages().length!==pages.length)fail();
  // A field value changing between inspection and ARIA capture invalidates the
  // entire result. Do not release a snapshot based on an earlier field sample.
  for(const {frame,found}of observations){
   const again=await frame.locator('input,textarea,select,[contenteditable],[autocomplete]').evaluateAll(inspectFields,manifest?.sensitiveSelectors??[],{world:'utility'});
   if(JSON.stringify(again)!==JSON.stringify(found))fail();
  }
  // Keep observed values only in this session's memory. They cannot reappear in
  // reflected page text after the corresponding input disappears.
  for(const f of fields)if(f.value&&(postLease||f.type?.toLowerCase()==='password'||f.selectorMatch||
    /password|one-time-code|cc-/iu.test(f.autocomplete)))remember(f.value);
  const clean=text=>{for(const secret of [...secrets].sort((a,b)=>b.length-a.length))text=text.split(secret).join(REDACTED);return text;};
  const document={pageUrl,dialogText:null,image:false,blocks:[...snapshots.map(text=>({kind:'text',text:clean(text)})),
   ...fields.map(f=>({...f,label:clean(f.label),value:f.value===null?null:clean(f.value)}))]};
  // Scan every page for sign-in/IdP state, not only the last page.
  for(const page of pages){const url=page.url();if(manifest&&(manifest.idpOrigins.includes(new URL(url).origin)||
   new URL(url).origin+new URL(url).pathname===new URL(manifest.signInUrl).origin+new URL(manifest.signInUrl).pathname))document.pageUrl=url;}
  if(document.pageUrl!==null)document.pageUrl=clean(document.pageUrl);
  let result;try{result=filter.filter({fenceState,postLease,tool,response:document});}catch{fail();}
  if(Buffer.byteLength(JSON.stringify(result))>maxBytes)fail();return result;
 }
 return Object.freeze({capture,rememberInput:remember,clear(){secrets.clear();secretBytes=0;}});
}

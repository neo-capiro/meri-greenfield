/** The page a consequential browser action acts on: the origin of the current page as last reported by Playwright MCP
 * tool responses (`- Page URL: …`), tracked per tool-use so an approval can bind the origin the call starts from.
 *
 * Each admitted call `begin`s and captures the origin it starts from: the last reported one when no other call is in
 * flight, otherwise unknown. `end` records the origin the call's response reports, or unknown when the call failed or
 * reported none, once no call is in flight; `cancel` (the call was refused before it ran) restores the captured
 * origin. While two calls overlap, every origin is unknown. Unknown always means "no approval can bind
 * a page", so the tracker can only refuse more, never authorize. It parses tool responses only for the page URL. */
import {classifyWebUrl} from './public-web.mjs';
const PAGE_URL=/^- Page URL: (\S+)$/mu;
const MAX_TOOL_USES=4096;
/** Text blocks of an SDK tool response (MCP content array, `{content}` or plain string). */
export const responseText=response=>{const blocks=Array.isArray(response)?response:Array.isArray(response?.content)?response.content:typeof response==='string'?[{type:'text',text:response}]:[];
 return blocks.filter(b=>b?.type==='text'&&typeof b.text==='string').map(b=>b.text).join('\n');};
/** The page URL a Playwright MCP response reports, or null. */
export const reportedPageUrl=text=>PAGE_URL.exec(text)?.[1]??null;
/** Public origin of a reported page URL, or null (about:blank, non-web, non-public or absent). */
const originOf=response=>{const url=reportedPageUrl(responseText(response));const c=url===null?null:classifyWebUrl(url);return c?.ok&&!c.blank?c.origin:null;};
export function createPageContext(){
 let current=null,generation=0;const inFlight=new Map(),used=new Set();
 const invalidate=()=>{current=null;generation++;for(const call of inFlight.values())call.abort.abort();};
 return Object.freeze({
  /** A call was admitted and may run. Reuse, overlap or exhausted tracking invalidates the active generation. */
  begin(id){
   if(typeof id!=='string'||used.has(id)||used.size>=MAX_TOOL_USES){invalidate();return false;}
   // Refuse the competing call as well: an already released tool may still be executing.
   if(inFlight.size){invalidate();return false;}
   const abort=new AbortController(),token=Object.freeze({generation,origin:current,signal:abort.signal});
   inFlight.set(id,{token,abort});used.add(id);return true;
  },
  /** The origin call `id` starts from, or null when unknown. */
  originFor:id=>{const call=inFlight.get(id);return call&&!call.abort.signal.aborted?call.token.origin:null;},
  capture:id=>{const call=inFlight.get(id);return call&&!call.abort.signal.aborted&&call.token.origin!==null?call.token:null;},
  isCurrent:(id,token)=>Boolean(token&&inFlight.size===1&&inFlight.get(id)?.token===token&&token.generation===generation&&!token.signal.aborted),
  /** Call `id` was refused before it ran: nothing changed on the page. */
  cancel(id){const call=inFlight.get(id);if(!call)return;inFlight.delete(id);current=!inFlight.size&&!call.abort.signal.aborted?call.token.origin:null;generation++;call.abort.abort();},
  /** Call `id` finished: `response` is its tool response, or null when it failed. */
  end(id,response){const call=inFlight.get(id);if(!call){invalidate();return;}inFlight.delete(id);current=!call.abort.signal.aborted&&!inFlight.size?originOf(response):null;generation++;call.abort.abort();},
  current:()=>current,
 });
}
/** PostToolUse and PostToolUseFailure hooks that close a call in the tracker. They never block or decide anything. */
export function createPageContextHooks(pages,prefix){
 const id=input=>typeof input?.tool_name==='string'&&input.tool_name.startsWith(prefix)&&typeof input.tool_use_id==='string'?input.tool_use_id:null;
 return Object.freeze({
  post:async input=>{const t=id(input);if(t!==null)pages.end(t,input?.hook_event_name==='PostToolUse'?input.tool_response:null);return {};},
  failure:async input=>{const t=id(input);if(t!==null)pages.end(t,null);return {};},
 });
}

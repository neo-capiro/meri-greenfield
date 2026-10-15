/** The page a consequential browser action acts on: the origin of the current page as last reported by Playwright MCP
 * tool responses (`- Page URL: …`), tracked per tool-use so an approval can bind the origin the call starts from.
 *
 * The origin is known only between calls. Each admitted call `begin`s (the origin it starts from is captured, then the
 * current origin becomes unknown until its result reports one); `end` records the reported origin from the call's
 * response, or unknown when the call failed or reported none; `cancel` (the call was refused before it ran) restores
 * the captured origin. While two calls overlap, every origin is unknown. Unknown always means "no approval can bind
 * a page", so the tracker can only refuse more, never authorize. It parses tool responses only for the page URL. */
import {classifyWebUrl} from './public-web.mjs';
const PAGE_URL=/^- Page URL: (\S+)$/mu;
const MAX_IN_FLIGHT=64;
/** Text blocks of an SDK tool response (MCP content array, `{content}` or plain string). */
export const responseText=response=>{const blocks=Array.isArray(response)?response:Array.isArray(response?.content)?response.content:typeof response==='string'?[{type:'text',text:response}]:[];
 return blocks.filter(b=>b?.type==='text'&&typeof b.text==='string').map(b=>b.text).join('\n');};
/** The page URL a Playwright MCP response reports, or null. */
export const reportedPageUrl=text=>PAGE_URL.exec(text)?.[1]??null;
/** Public origin of a reported page URL, or null (about:blank, non-web, non-public or absent). */
const originOf=response=>{const url=reportedPageUrl(responseText(response));const c=url===null?null:classifyWebUrl(url);return c?.ok&&!c.blank?c.origin:null;};
export function createPageContext(){
 let current=null;const inFlight=new Map();
 return Object.freeze({
  /** A call was admitted and may run. Returns false (and forgets the page) when the id is reused or too many overlap. */
  begin(id){
   if(typeof id!=='string'||inFlight.has(id)||inFlight.size>=MAX_IN_FLIGHT){current=null;return false;}
   inFlight.set(id,inFlight.size?null:current);current=null;return true;
  },
  /** The origin call `id` starts from, or null when unknown. */
  originFor:id=>inFlight.get(id)??null,
  /** Call `id` was refused before it ran: nothing changed on the page. */
  cancel(id){if(!inFlight.has(id))return;const before=inFlight.get(id);inFlight.delete(id);current=inFlight.size?null:before;},
  /** Call `id` finished: `response` is its tool response, or null when it failed. */
  end(id,response){const known=inFlight.delete(id);current=known&&!inFlight.size?originOf(response):null;},
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

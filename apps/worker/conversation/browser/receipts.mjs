/** PostToolUse receipts for browser actions: action, URL host, time and an output-file reference. Page contents are parsed only to find those facts and are never recorded. */
import {resolve,relative,sep} from 'node:path';
import {responseText,reportedPageUrl} from './page-context.mjs';
const TOOL_USE=/^[A-Za-z0-9_-]{1,128}$/u;
export function urlHost(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.hostname:null;}catch{return null;}}
const pageHost=text=>{const url=reportedPageUrl(text);return url===null?null:urlHost(url);};
/** First screenshot or trace file named in the response that resolves inside the conversation output directory, relative to the workspace. */
export function outputReference(text,{cwd,output}){
 for(const [token] of text.matchAll(/[A-Za-z0-9._/-]+\.(?:png|jpe?g|zip|trace)\b/gu)){const absolute=resolve(cwd,token);if(absolute.startsWith(output+sep))return relative(cwd,absolute);}
 return null;
}
export function createReceiptHook({binding,paths,cwd,server,tools,receipts,now}){
 const prefix=`mcp__${server}__`;
 return async(input,toolUseID,options)=>{
  try{
   if(options?.signal?.aborted||input?.hook_event_name!=='PostToolUse'||typeof input.tool_name!=='string'||!input.tool_name.startsWith(prefix)||!tools.includes(input.tool_name.slice(prefix.length))||typeof input.session_id!=='string'||!TOOL_USE.test(input.tool_use_id??'')||toolUseID!==undefined&&toolUseID!==input.tool_use_id)throw new Error('BROWSER_RECEIPT_INPUT');
   const text=responseText(input.tool_response),action=input.tool_name.slice(prefix.length);
   const receipt={schema:'meri-browser-receipt/1',kind:'browser.action',binding:structuredClone(binding),sessionId:input.session_id,toolUseId:input.tool_use_id,action,
    urlHost:pageHost(text)??(typeof input.tool_input?.url==='string'?urlHost(input.tool_input.url):null),atMs:now(),reference:outputReference(text,{cwd,output:paths.output}),outcome:input.tool_response?.isError===true?'error':'ok'};
   await receipts.record(receipt,{signal:options?.signal});
   return {};
  }catch{return {continue:false,stopReason:'Browser receipt unavailable; browser work stopped.'};}
 };
}

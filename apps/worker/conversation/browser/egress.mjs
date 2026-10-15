/** Executable reference for the mandatory `effective-origin-allowlist` egress requirement (activation.mjs): the
 * destination decision the browser host's egress control must reproduce for every connection of a conversation run.
 * It applies the platform security limits and then the run's effective allowlist (`checkBrowserUrl`) to each
 * connection kind; WebSocket URLs are compared by their http/https origin. Pure and synchronous: it does not resolve
 * DNS, so the resolved-address and rebinding requirements still apply at the host in addition. This is not a network
 * control and proves nothing about the real browser; it fixes the expected decisions for host qualification. */
import {checkBrowserUrl} from './policy.mjs';
export const EGRESS_CONNECTION_KINDS=Object.freeze(['navigation','redirect','subresource','fetch','websocket','download']);
const WEBSOCKET_ORIGIN_SCHEME=Object.freeze({'ws:':'http:','wss:':'https:'});
/** `{ok:true,origin}` when `policy` (a `validateBrowserPolicy` result) admits a connection of `kind` to `url`,
 * otherwise `{ok:false,code}`. */
export function egressDecision(policy,{kind,url}={}){
 if(!EGRESS_CONNECTION_KINDS.includes(kind))return {ok:false,code:'BROWSER_EGRESS_KIND'};
 if(policy?.enabled!==true)return {ok:false,code:'BROWSER_DISABLED'};
 let target=url;
 if(kind==='websocket'){
  let parsed;try{parsed=new URL(url);}catch{return {ok:false,code:'BROWSER_URL_MALFORMED'};}
  if(!Object.hasOwn(WEBSOCKET_ORIGIN_SCHEME,parsed.protocol))return {ok:false,code:'BROWSER_URL_SCHEME'};
  parsed.protocol=WEBSOCKET_ORIGIN_SCHEME[parsed.protocol];target=parsed.href;
 }
 const decision=checkBrowserUrl(policy,target);
 return decision.ok?{ok:true,origin:decision.origin}:{ok:false,code:decision.code};
}
/** A navigation followed by its redirect hops: every hop must be admitted. Returns `{ok:true}` or the first refusal
 * with its zero-based `hop`. */
export function egressRedirectChain(policy,urls){
 if(!Array.isArray(urls)||!urls.length)return {ok:false,code:'BROWSER_EGRESS_KIND',hop:0};
 for(const [hop,url] of urls.entries()){const d=egressDecision(policy,{kind:hop?'redirect':'navigation',url});if(!d.ok)return {...d,hop};}
 return {ok:true};
}

/** Browser capability policy. Recorded product direction (docs/coordination/reports/DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md,
 * "Subsequent explicit product direction — 18:39 UTC"): "the browser capability be enabled by default as the desired
 * product behavior ... This is separate from network destinations being denied by default and pre-execution controls
 * for consequential actions."
 *
 * - The capability is on in the platform default.
 * - Destinations are denied by default: navigation and downloads reach only origins on `allowedOrigins`. The source
 *   default list is empty; Capiro supplies its approved origins as trusted platform configuration (`resolution.mjs`)
 *   and tenant admins may narrow it or enable origins from that approved set, never widen beyond it. An empty
 *   effective list means the browser opens nothing external (`browserStatus` says so).
 * - The platform security limits (`public-web.mjs`) are unremovable denials on top of any list.
 * - Interaction tools need a per-call decision before execution (`permissions.mjs`).
 * - Activation is held separately (`activation.mjs`); infrastructure egress controls remain the security boundary.
 * The policy never carries paths, credentials or authority. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {classifyWebUrl,isPublicOrigin} from './public-web.mjs';
export const PLAYWRIGHT_MCP_VERSION='0.0.83';
/** Bounded public-browsing tools. Excluded: script evaluation, code execution, uploads, cookies/storage, network routing, devtools, PDF and coordinate tools. */
export const BROWSER_TOOLS=Object.freeze(['browser_navigate','browser_navigate_back','browser_snapshot','browser_click','browser_type','browser_fill_form','browser_select_option','browser_press_key','browser_hover','browser_wait_for','browser_take_screenshot','browser_tabs','browser_handle_dialog','browser_close']);
/** Tools that send input events to a page and so may cause remote side effects (submit, purchase, post, delete).
 * They are never pre-approved: each call needs an approval decision before it executes (`permissions.mjs`). */
export const INTERACTION_TOOLS=Object.freeze(['browser_click','browser_type','browser_fill_form','browser_select_option','browser_press_key','browser_hover','browser_handle_dialog']);
export const DOWNLOAD_FORMATS=Object.freeze(Object.keys(ARTIFACT_MIME_TYPES));
export const BROWSER_POLICY_KEYS=Object.freeze(['enabled','tools','allowedOrigins','timeouts','downloads']);
export const MAX_ALLOWED_ORIGINS=256;
export const BROWSER_LIMITS=Object.freeze({actionMs:Object.freeze([1000,60000]),navigationMs:Object.freeze([1000,120000]),maxBytes:Object.freeze([1,26214400]),maxFiles:Object.freeze([1,50])});
/** Platform default: capability on, every bounded tool (interactions still need per-call approval), no destinations
 * until trusted platform configuration supplies approved origins. */
export const DEFAULT_BROWSER_POLICY=Object.freeze({enabled:true,tools:BROWSER_TOOLS,allowedOrigins:Object.freeze([]),
 timeouts:Object.freeze({actionMs:5000,navigationMs:60000}),
 downloads:Object.freeze({enabled:true,formats:DOWNLOAD_FORMATS,maxBytes:BROWSER_LIMITS.maxBytes[1],maxFiles:20})});
export const DISABLED_BROWSER_POLICY=Object.freeze({enabled:false});
const fail=(code,field)=>{throw Object.assign(new Error(field?`${code}:${field}`:code),{code,...(field?{field}:{})});};
const shape=(fn,field)=>{try{return fn();}catch{fail('BROWSER_POLICY',field);}};
const int=(v,range)=>Number.isSafeInteger(v)&&v>=range[0]&&v<=range[1];
const list=(v,max)=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length;
/** One canonical public origin. A well-formed origin outside the platform limits is BROWSER_PLATFORM_LIMIT. */
function origin(value){
 if(isPublicOrigin(value))return value;
 const c=classifyWebUrl(value);
 fail(!c.ok&&c.code!=='BROWSER_URL_MALFORMED'?'BROWSER_PLATFORM_LIMIT':'BROWSER_POLICY','allowedOrigins');
}
/** Complete policy including a disabled one; omitted fields take the platform default. Empty `tools` or empty download
 * `formats` are representable only while what they scope is off; an empty `allowedOrigins` is valid and means no
 * destination. Idempotent: a returned policy validates to itself. */
export function assertFullBrowserPolicy(raw){
 const p=shape(()=>own(raw,['enabled'],BROWSER_POLICY_KEYS.slice(1)));
 if(typeof p.enabled!=='boolean')fail('BROWSER_POLICY','enabled');
 const tools=p.tools===undefined?DEFAULT_BROWSER_POLICY.tools:p.tools;
 if(!list(tools,BROWSER_TOOLS.length)||tools.some(t=>!BROWSER_TOOLS.includes(t)))fail('BROWSER_POLICY','tools');
 const allowedOrigins=p.allowedOrigins===undefined?DEFAULT_BROWSER_POLICY.allowedOrigins:p.allowedOrigins;
 if(!list(allowedOrigins,MAX_ALLOWED_ORIGINS))fail('BROWSER_POLICY','allowedOrigins');allowedOrigins.forEach(origin);
 const timeouts=p.timeouts===undefined?DEFAULT_BROWSER_POLICY.timeouts:shape(()=>own(p.timeouts,['actionMs','navigationMs']),'timeouts');
 if(!int(timeouts.actionMs,BROWSER_LIMITS.actionMs)||!int(timeouts.navigationMs,BROWSER_LIMITS.navigationMs))fail('BROWSER_POLICY','timeouts');
 const downloads=p.downloads===undefined?DEFAULT_BROWSER_POLICY.downloads:shape(()=>own(p.downloads,['enabled','formats','maxBytes','maxFiles']),'downloads');
 if(typeof downloads.enabled!=='boolean'||!list(downloads.formats,DOWNLOAD_FORMATS.length)||downloads.formats.some(f=>!DOWNLOAD_FORMATS.includes(f))||!int(downloads.maxBytes,BROWSER_LIMITS.maxBytes)||!int(downloads.maxFiles,BROWSER_LIMITS.maxFiles))fail('BROWSER_POLICY','downloads');
 if(p.enabled&&!tools.length)fail('BROWSER_POLICY','tools');
 if(downloads.enabled&&!downloads.formats.length)fail('BROWSER_POLICY','downloads');
 return Object.freeze({enabled:p.enabled,tools:Object.freeze([...tools]),allowedOrigins:Object.freeze([...allowedOrigins]),
  timeouts:Object.freeze({actionMs:timeouts.actionMs,navigationMs:timeouts.navigationMs}),
  downloads:Object.freeze({enabled:downloads.enabled,formats:Object.freeze([...downloads.formats]),maxBytes:downloads.maxBytes,maxFiles:downloads.maxFiles})});
}
/** Worker-facing validation. Absent policy means the platform default (capability on, no destinations). `{enabled:false}`
 * alone, or any complete policy whose `enabled` is false, is the disabled policy. Unknown keys, partial disabled shapes,
 * unbounded values and non-canonical origins refuse with BROWSER_POLICY; an origin outside the platform security limits
 * refuses with BROWSER_PLATFORM_LIMIT.
 * @param {any} [raw] */
export function validateBrowserPolicy(raw=DEFAULT_BROWSER_POLICY){
 if(raw&&typeof raw==='object'&&raw.enabled===false){
  if(Object.keys(raw).length===1)return DISABLED_BROWSER_POLICY;
  if(Object.keys(raw).length!==BROWSER_POLICY_KEYS.length)fail('BROWSER_POLICY','enabled');
 }
 const p=assertFullBrowserPolicy(raw);
 return p.enabled?p:DISABLED_BROWSER_POLICY;
}
/** Effective URL decision: the platform limits first, then the destination allowlist (deny by default).
 * Same result shape as `classifyWebUrl`. */
export function checkBrowserUrl(policy,value,{allowBlank=false}={}){
 const c=classifyWebUrl(value,{allowBlank});
 if(!c.ok||c.blank)return c;
 if(!policy.allowedOrigins.length)return {ok:false,code:'BROWSER_NO_ALLOWED_DESTINATIONS'};
 if(!policy.allowedOrigins.includes(c.origin))return {ok:false,code:'BROWSER_ORIGIN_NOT_ALLOWED'};
 return c;
}
/** UI-facing state of a validated policy: whether the capability is on and whether any destination can be opened. */
export function browserStatus(policy){
 if(!policy.enabled)return Object.freeze({capability:'disabled',destinations:'none',allowedOriginCount:0});
 const count=policy.allowedOrigins.length;
 return Object.freeze({capability:'enabled',destinations:count?'allowlisted':'none',allowedOriginCount:count,...(count?{}:{notice:'BROWSER_NO_ALLOWED_DESTINATIONS'})});
}

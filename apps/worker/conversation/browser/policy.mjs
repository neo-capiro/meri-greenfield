/** Browser policy: disabled by default; when enabled, every field is explicit and bounded. Infrastructure egress controls remain the security boundary. */
import {isAbsolute} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
export const PLAYWRIGHT_MCP_VERSION='0.0.83';
/** Bounded public-browsing tools. Excluded: script evaluation, code execution, uploads, cookies/storage, network routing, devtools, PDF and coordinate tools. */
export const BROWSER_TOOLS=Object.freeze(['browser_navigate','browser_navigate_back','browser_snapshot','browser_click','browser_type','browser_fill_form','browser_select_option','browser_press_key','browser_hover','browser_wait_for','browser_take_screenshot','browser_tabs','browser_handle_dialog','browser_close']);
export const DEFAULT_BROWSER_POLICY=Object.freeze({enabled:false});
const fail=()=>{throw Object.assign(new Error('BROWSER_POLICY'),{code:'BROWSER_POLICY'});};
const refuse=fn=>{try{return fn();}catch{fail();}};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const list=(v,max)=>Array.isArray(v)&&v.length>0&&v.length<=max&&new Set(v).size===v.length;
const path=v=>typeof v==='string'&&isAbsolute(v)&&!v.includes('/../')&&!v.includes('\0')&&v.length<=4096;
function origin(value){let url;try{url=new URL(value);}catch{fail();}if(url.protocol!=='https:'||url.username||url.password||url.origin!==value)fail();return value;}
/** Returns a frozen normalized policy; any unknown key, unbounded value or foreign-tenant scope refuses. */
export function validateBrowserPolicy(raw=DEFAULT_BROWSER_POLICY,binding){
 const top=refuse(()=>own(raw,['enabled'],['installation','tools','allowedOrigins','timeouts','downloads','sourceScopes']));
 if(top.enabled===false){if(Object.keys(top).length!==1)fail();return DEFAULT_BROWSER_POLICY;}
 if(top.enabled!==true)fail();
 const p=refuse(()=>own(raw,['enabled','installation','tools','allowedOrigins','timeouts','downloads','sourceScopes']));
 const installation=refuse(()=>own(p.installation,['nodePath','cliPath','browsersPath','version']));
 if(![installation.nodePath,installation.cliPath,installation.browsersPath].every(path)||installation.version!==PLAYWRIGHT_MCP_VERSION)fail();
 if(!list(p.tools,BROWSER_TOOLS.length)||p.tools.some(t=>!BROWSER_TOOLS.includes(t)))fail();
 if(!list(p.allowedOrigins,64))fail();p.allowedOrigins.forEach(origin);
 const timeouts=refuse(()=>own(p.timeouts,['actionMs','navigationMs']));if(!int(timeouts.actionMs,1000,60000)||!int(timeouts.navigationMs,1000,120000))fail();
 const downloads=refuse(()=>own(p.downloads,['enabled','formats','maxBytes','maxFiles']));
 if(typeof downloads.enabled!=='boolean'||!list(downloads.formats,6)||downloads.formats.some(f=>!Object.hasOwn(ARTIFACT_MIME_TYPES,f))||!int(downloads.maxBytes,1,26214400)||!int(downloads.maxFiles,1,50))fail();
 if(!list(p.sourceScopes,64))fail();refuse(()=>p.sourceScopes.forEach(s=>validateShape('Scope',s)));if(p.sourceScopes.some(s=>s.tenantId!==binding.tenantId))fail();
 return Object.freeze(structuredClone({enabled:true,installation,tools:p.tools,allowedOrigins:p.allowedOrigins,timeouts,downloads,sourceScopes:p.sourceScopes}));
}

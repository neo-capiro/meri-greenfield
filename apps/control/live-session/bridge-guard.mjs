/** Device/browser bridge relay guard (design section 2.4; owner answers 15 October 2026). The bridge follows the initial
 * live version. Accepted: Q-B1 user-device trust tier, Q-B4 enterprise force-install with a self-hosted update URL,
 * Q-B5 debugging banner kept, Q-B6 Chrome and Edge desktop only, Q-B7 relay and pairing in control as a bounded
 * transport, Q-B8 private-network and intranet destinations out. Still OPEN and awaiting Neo: the "access all" control
 * model (Q-B3), the Chrome-connector-style pairing, persistence and revocation model (Q-B9), which bridge interactions
 * need per-action approval now that the bridge fills forms (Q-B2), and the bridge MCP placement (Q-X2).
 *
 * PREPARATION ONLY: the decisions that hold whatever those answers are. Cookie, storage, browser-context, download and
 * interception CDP methods are always denied at the relay; every other method needs a qualified allowlist (derived from
 * Playwright 1.64 traffic, not yet measured), so with none supplied every method refuses. Navigation never reaches
 * non-public destinations; "access all" refuses until its model is decided. No relay, pairing or extension exists. */
import {classifyWebUrl} from '../../worker/conversation/browser/public-web.mjs';
import {checkBrowserUrl} from '../../worker/conversation/browser/policy.mjs';
export const BRIDGE_REQUIREMENTS=Object.freeze([
 'access-all: the owner specified who enables "access all", at which level, and how it relates to the platform maximum (Q-B3, awaiting Neo)',
 'pairing: the owner approved the pairing, persistence and revocation model replicating the Claude Chrome connector experience, including any persisted device credential with expiry, revocation and retention (Q-B9, awaiting Neo)',
 'approvals: the design names which bridge interactions need per-action approval through the canonical approval owner (Q-B2) and the owner accepted it',
 'placement: the owner approved the bridge MCP placement (Q-X2, awaiting Neo)',
 'extension: the Meri MV3 extension built from the Apache-2.0 Playwright Extension source is signed, force-installed from a self-hosted update URL (Q-B4) and recorded in docs/COMPONENTS.md (Q-X4)',
 'relay: the control-domain relay routes only current attachments, keyed by tenant and attachment, with the qualified CDP allowlist and tab scoping, and persists no payload',
 'withdrawal: S4 generations serve the bridge scopes with measured 30 s propagation; local disconnect works with the relay unreachable',
 'evidence: bridge acceptance tests (design 2.6) pass on Chrome and Edge stable with the pinned extension',
]);
export const BRIDGE_ACTIVATION=Object.freeze({state:'held',reason:'BRIDGE_UNDECIDED',evidence:null,requirements:BRIDGE_REQUIREMENTS});
export function bridgeActivationOpen(record=BRIDGE_ACTIVATION){
 return record?.state==='open'&&typeof record.evidence==='string'&&/^[A-Za-z0-9._/-]{1,200}$/u.test(record.evidence)&&record.requirements===BRIDGE_REQUIREMENTS;
}
/** Always denied, in every mode: the relay never reads or writes cookies or storage, creates or disposes browser
 * contexts, changes download behaviour, intercepts requests or drives the browser object (design 2.4 "CDP restriction"). */
export const ALWAYS_DENIED_CDP_METHODS=Object.freeze(['Storage.getCookies','Storage.setCookies','Storage.clearCookies','Storage.clearDataForOrigin','Storage.getStorageKeyForFrame',
 'Network.getCookies','Network.getAllCookies','Network.setCookie','Network.setCookies','Network.deleteCookies','Network.clearBrowserCookies','Network.setExtraHTTPHeaders',
 'Target.createBrowserContext','Target.disposeBrowserContext','Target.getBrowserContexts','Target.exposeDevToolsProtocol','Target.setRemoteLocations',
 'Page.setDownloadBehavior','IndexedDB.requestData','DOMStorage.getDOMStorageItems','CacheStorage.requestCachedResponse']);
export const ALWAYS_DENIED_CDP_DOMAINS=Object.freeze(['Fetch','Browser','SystemInfo','Tethering','Storage','IndexedDB','DOMStorage','CacheStorage','ServiceWorker','BackgroundService']);
export const ALLOWED_BROWSER_METHODS=Object.freeze(['Browser.getVersion']);
export const BRIDGE_ACCESS_MODES=Object.freeze(['approved-list','access-all']);
const METHOD=/^[A-Z][A-Za-z]{1,40}\.[a-z][A-Za-z]{1,60}$/u;
const fault=code=>Object.assign(new Error(code),{code});
const domain=m=>m.slice(0,m.indexOf('.'));
const alwaysDenied=m=>ALWAYS_DENIED_CDP_METHODS.includes(m)||ALWAYS_DENIED_CDP_DOMAINS.includes(domain(m))&&!ALLOWED_BROWSER_METHODS.includes(m);

/** Validates a qualified allowlist: well-formed methods, none always denied. */
export function validateCdpAllowlist(list){
 if(!Array.isArray(list)||!list.length||list.length>512||new Set(list).size!==list.length||list.some(m=>typeof m!=='string'||!METHOD.test(m)))throw fault('BRIDGE_CDP_ALLOWLIST_INVALID');
 const denied=list.find(alwaysDenied);if(denied)throw Object.assign(fault('BRIDGE_CDP_ALLOWLIST_DENIED_METHOD'),{method:denied});
 return Object.freeze([...list]);
}
/** Per-frame decision for a worker-to-device CDP request. Without a qualified allowlist, everything refuses. */
export function cdpMethodDecision(method,{allowlist=null}={}){
 if(typeof method!=='string'||!METHOD.test(method))return Object.freeze({allowed:false,code:'BRIDGE_CDP_MALFORMED'});
 if(alwaysDenied(method))return Object.freeze({allowed:false,code:'BRIDGE_CDP_DENIED'});
 if(allowlist===null)return Object.freeze({allowed:false,code:'BRIDGE_CDP_UNQUALIFIED'});
 return allowlist.includes(method)?Object.freeze({allowed:true}):Object.freeze({allowed:false,code:'BRIDGE_CDP_NOT_ALLOWED'});
}
/** Agent-initiated navigation or new tab on the bridge (hostname-level software filtering, not network enforcement:
 * the user's own network resolves names and follows redirects, Q-B1). Q-B8: non-public destinations are always refused.
 * Q-B3: the approved-list mode uses the effective destination policy; "access all" refuses until Neo decides its model. */
export function bridgeNavigationDecision({url,accessMode,policy}){
 if(!BRIDGE_ACCESS_MODES.includes(accessMode))throw fault('BRIDGE_CONFIGURATION');
 const c=classifyWebUrl(url);
 if(!c.ok)return Object.freeze({allowed:false,code:c.code==='BROWSER_URL_NOT_PUBLIC'?'BRIDGE_PRIVATE_NETWORK_REFUSED':c.code});
 if(accessMode==='access-all')return Object.freeze({allowed:false,code:'BRIDGE_ACCESS_ALL_UNDECIDED'});
 const d=checkBrowserUrl(policy,url);
 return d.ok?Object.freeze({allowed:true,origin:d.origin}):Object.freeze({allowed:false,code:d.code});
}

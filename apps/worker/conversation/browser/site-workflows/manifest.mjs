/** Authenticated third-party website workflows: site workflow manifest validation, enablement gate and per-run policy
 * narrowing (design section 5; owner answers accepted 15 October 2026: Q-A2 sign-in through takeover with no credential
 * custody beyond the per-conversation profile, Q-A4 per-site legal terms review before enabling, Q-A5 every interaction
 * on a signed-in site needs approval, Q-A6 manifests are platform configuration owned by Capiro's platform owner, Q-A8
 * sign-in kept across runs in a conversation until 8 hours of inactivity).
 *
 * PREPARATION ONLY. No site is approved: the first sites and tasks are awaiting Neo (Q-A1), so the approved registry is
 * empty and the activation gate is held. A manifest is credential-free by construction: any credential, cookie, token
 * or storage-state field anywhere in it is refused. There is no session vault (Q-A3: a later phase after the first live
 * shipment) and nothing here stores, reads or forwards website credentials. The manifest shape is a contract proposal
 * for dot (`packages/contracts` is not edited by this lane). */
import {own} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {BROWSER_TOOLS,INTERACTION_TOOLS,DOWNLOAD_FORMATS,BROWSER_LIMITS,validateBrowserPolicy,checkBrowserUrl} from '../policy.mjs';
import {isPublicOrigin,classifyWebUrl} from '../public-web.mjs';
import {takeoverActivationOpen} from '../session/activation.mjs';
export const SITE_WORKFLOW_MANIFEST_SCHEMA='meri-site-workflow-manifest/0';
/** Q-A8: a sign-in survives runs in the same conversation until this much inactivity; a manifest may only shorten it. */
export const SITE_SESSION_MAX_IDLE_MS=8*60*60*1000;
/** Q-A1 awaiting Neo: no site or task is approved. Entries are added only by a reviewed change citing the owner's list,
 * the legal review (Q-A4) and the per-site qualification evidence. */
export const APPROVED_SITE_WORKFLOWS=Object.freeze([]);
export const SITE_WORKFLOW_REQUIREMENTS=Object.freeze([
 'takeover: live browser takeover activation is open (sign-in happens only through takeover, Q-A2)',
 'sites: the owner named the first site and exact task combinations (Q-A1, awaiting Neo)',
 'terms: Capiro legal reviewed each named site\'s terms before enabling (Q-A4)',
 'contract: dot accepted the site workflow manifest contract and the platform configuration owner that stores it (Q-A6)',
 'confidentiality: the version-pinned S2 parser exists and the canary tests pass with a real IdP test tenant',
 'destruction: S3 server-side invalidation tests pass on the D005 host with a synthetic local-storage-token site',
 'withdrawal: S4 generation source serves the site-workflow scope with measured 30 s propagation (Q-X7)',
 'qualification: per-site acceptance tests (design 5.6) pass and their evidence reference is recorded in the manifest',
]);
export const SITE_WORKFLOW_ACTIVATION=Object.freeze({state:'held',reason:'SITE_WORKFLOWS_UNQUALIFIED',evidence:null,requirements:SITE_WORKFLOW_REQUIREMENTS});
const KEYS=['schema','siteId','workflowId','version','taskSummary','origins','idpOrigins','signInUrl','signedInProbe','sensitiveSelectors','tools','approvalRequired','downloads','sessionTtlMs','logoutUrl','tosReviewRef','qualificationEvidenceRef'];
const CREDENTIAL_KEY=/pass(word|wd|phrase)?|secret|token|cookie|credential|storage.?state|session.?(state|data|cookie)|user.?name|login.?name|otp|totp|mfa.?seed|api.?key|private.?key|vault/iu;
const SLUG=/^[a-z][a-z0-9-]{1,63}$/u,REF=/^[A-Za-z0-9._/:#-]{1,200}$/u;
const fault=(code,field)=>{throw Object.assign(new Error(field?`${code}:${field}`:code),{code,...(field?{field}:{})});};
const list=(v,max)=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length;

/** Refuses any key, at any depth, that names a credential, cookie, token or stored session. */
function assertCredentialFree(value,path='manifest'){
 if(Array.isArray(value)){value.forEach((v,i)=>assertCredentialFree(v,`${path}[${i}]`));return;}
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(CREDENTIAL_KEY.test(k))fault('SITE_WORKFLOW_CREDENTIAL_REFUSED',`${path}.${k}`);assertCredentialFree(v,`${path}.${k}`);}
}
function originsWithin(values,field,maximum,{allowEmpty}){
 if(!list(values,32)||!allowEmpty&&!values.length)fault('SITE_WORKFLOW_MANIFEST',field);
 for(const o of values){if(!isPublicOrigin(o))fault('SITE_WORKFLOW_MANIFEST',field);if(!maximum.includes(o))fault('SITE_WORKFLOW_OUTSIDE_PLATFORM_MAXIMUM',field);}
}
function urlWithin(value,field,origins){
 const c=classifyWebUrl(value);
 if(!c.ok||c.blank||!origins.includes(c.origin))fault('SITE_WORKFLOW_MANIFEST',field);
}

/** Validates one manifest against the platform maximum (`platform.maximum.allowedOrigins`). Every origin, including the
 * identity-provider redirects needed for sign-in, must already be platform-approved; a manifest never widens it. */
export function validateSiteWorkflowManifest(raw,{platformMaximumOrigins}){
 if(!Array.isArray(platformMaximumOrigins))fault('SITE_WORKFLOW_CONFIGURATION');
 assertCredentialFree(raw);
 let m;try{m=own(raw,KEYS);}catch{fault('SITE_WORKFLOW_MANIFEST','keys');}
 if(m.schema!==SITE_WORKFLOW_MANIFEST_SCHEMA)fault('SITE_WORKFLOW_MANIFEST','schema');
 if(!SLUG.test(m.siteId??''))fault('SITE_WORKFLOW_MANIFEST','siteId');if(!SLUG.test(m.workflowId??''))fault('SITE_WORKFLOW_MANIFEST','workflowId');
 if(!Number.isSafeInteger(m.version)||m.version<1)fault('SITE_WORKFLOW_MANIFEST','version');
 if(typeof m.taskSummary!=='string'||!m.taskSummary.trim()||m.taskSummary.length>500)fault('SITE_WORKFLOW_MANIFEST','taskSummary');
 originsWithin(m.origins,'origins',platformMaximumOrigins,{allowEmpty:false});
 originsWithin(m.idpOrigins,'idpOrigins',platformMaximumOrigins,{allowEmpty:true});
 const reachable=[...m.origins,...m.idpOrigins];
 urlWithin(m.signInUrl,'signInUrl',reachable);
 let probe;try{probe=own(m.signedInProbe,['kind','value']);}catch{fault('SITE_WORKFLOW_MANIFEST','signedInProbe');}
 if(!['url','selector'].includes(probe.kind)||typeof probe.value!=='string'||!probe.value||probe.value.length>512)fault('SITE_WORKFLOW_MANIFEST','signedInProbe');
 if(probe.kind==='url')urlWithin(probe.value,'signedInProbe',m.origins);
 if(!list(m.sensitiveSelectors,64)||m.sensitiveSelectors.some(s=>typeof s!=='string'||!s||s.length>256))fault('SITE_WORKFLOW_MANIFEST','sensitiveSelectors');
 if(!list(m.tools,BROWSER_TOOLS.length)||!m.tools.length||m.tools.some(t=>!BROWSER_TOOLS.includes(t)))fault('SITE_WORKFLOW_MANIFEST','tools');
 // Q-A5: every interaction tool the workflow may use is approval-required; a manifest cannot pre-approve any.
 const interactions=m.tools.filter(t=>INTERACTION_TOOLS.includes(t));
 if(!list(m.approvalRequired,INTERACTION_TOOLS.length)||m.approvalRequired.some(t=>!interactions.includes(t)))fault('SITE_WORKFLOW_MANIFEST','approvalRequired');
 if(interactions.some(t=>!m.approvalRequired.includes(t)))fault('SITE_WORKFLOW_PREAPPROVAL_REFUSED','approvalRequired');
 let d;try{d=own(m.downloads,['formats','maxBytes','maxFiles']);}catch{fault('SITE_WORKFLOW_MANIFEST','downloads');}
 if(!list(d.formats,DOWNLOAD_FORMATS.length)||d.formats.some(f=>!DOWNLOAD_FORMATS.includes(f))||!Number.isSafeInteger(d.maxBytes)||d.maxBytes<BROWSER_LIMITS.maxBytes[0]||d.maxBytes>BROWSER_LIMITS.maxBytes[1]||!Number.isSafeInteger(d.maxFiles)||d.maxFiles<0||d.maxFiles>BROWSER_LIMITS.maxFiles[1])fault('SITE_WORKFLOW_MANIFEST','downloads');
 if(!Number.isSafeInteger(m.sessionTtlMs)||m.sessionTtlMs<60000||m.sessionTtlMs>SITE_SESSION_MAX_IDLE_MS)fault('SITE_WORKFLOW_MANIFEST','sessionTtlMs');
 if(m.logoutUrl!==null)urlWithin(m.logoutUrl,'logoutUrl',reachable);
 for(const k of ['tosReviewRef','qualificationEvidenceRef'])if(m[k]!==null&&(typeof m[k]!=='string'||!REF.test(m[k])))fault('SITE_WORKFLOW_MANIFEST',k);
 const freeze=v=>Array.isArray(v)?Object.freeze([...v]):v;
 return Object.freeze(Object.fromEntries(KEYS.map(k=>[k,k==='signedInProbe'?Object.freeze({...probe}):k==='downloads'?Object.freeze({...d,formats:Object.freeze([...d.formats])}):freeze(m[k])])));
}

/** Whether a validated manifest may be enabled for a tenant now. Never throws; lists every unmet condition. The shipped
 * state refuses every manifest (held activation, empty registry). */
export function siteWorkflowEnablement(manifest,{registry=APPROVED_SITE_WORKFLOWS,activation=SITE_WORKFLOW_ACTIVATION,takeoverOpen=takeoverActivationOpen()}={}){
 const reasons=[];
 if(activation?.state!=='open'||activation.requirements!==SITE_WORKFLOW_REQUIREMENTS||typeof activation.evidence!=='string')reasons.push('SITE_WORKFLOWS_HELD');
 if(takeoverOpen!==true)reasons.push('SITE_WORKFLOW_TAKEOVER_UNAVAILABLE');
 if(!registry.some(e=>e.siteId===manifest.siteId&&e.workflowId===manifest.workflowId&&e.version===manifest.version))reasons.push('SITE_WORKFLOW_NOT_APPROVED');
 if(manifest.tosReviewRef===null)reasons.push('SITE_WORKFLOW_TERMS_REVIEW_MISSING');
 if(manifest.qualificationEvidenceRef===null)reasons.push('SITE_WORKFLOW_UNQUALIFIED');
 return Object.freeze({enabled:reasons.length===0,reasons:Object.freeze(reasons)});
}

/** The run's browser policy for one site workflow: the conversation's effective policy narrowed to the manifest's origins
 * (identity-provider origins included), tools and download limits. Never widens. If the tenant or role narrowed away the
 * sign-in origin, the workflow cannot run. */
export function siteWorkflowPolicy(effective,manifest){
 const p=validateBrowserPolicy(effective);
 if(!p.enabled)fault('SITE_WORKFLOW_BROWSER_DISABLED');
 if(!checkBrowserUrl(p,manifest.signInUrl).ok)fault('SITE_WORKFLOW_ORIGIN_NARROWED','signInUrl');
 const reachable=[...manifest.origins,...manifest.idpOrigins];
 const formats=p.downloads.formats.filter(f=>manifest.downloads.formats.includes(f));
 const downloadsOn=p.downloads.enabled&&formats.length>0&&manifest.downloads.maxFiles>0;
 return validateBrowserPolicy({enabled:true,tools:p.tools.filter(t=>manifest.tools.includes(t)),allowedOrigins:p.allowedOrigins.filter(o=>reachable.includes(o)),timeouts:p.timeouts,
  downloads:{enabled:downloadsOn,formats:downloadsOn?formats:p.downloads.formats,maxBytes:Math.min(p.downloads.maxBytes,manifest.downloads.maxBytes),maxFiles:Math.max(1,Math.min(p.downloads.maxFiles,manifest.downloads.maxFiles))}});
}

/** Q-A8: true once the conversation's sign-in has been idle for the manifest TTL (at most 8 hours); S3 destruction follows. */
export function siteSessionExpired({lastActivityMs,ttlMs,now}){
 if(!Number.isSafeInteger(lastActivityMs)||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>SITE_SESSION_MAX_IDLE_MS||typeof now!=='function')fault('SITE_WORKFLOW_CONFIGURATION');
 return now()-lastActivityMs>=ttlMs;
}

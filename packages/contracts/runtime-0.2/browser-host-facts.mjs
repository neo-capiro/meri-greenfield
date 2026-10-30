/** Control-owned browser host run facts. This is the part of a host `readRun` result that only the
 * canonical Control owners can produce; cwd, installation, egress, observers and the runtime port
 * stay host-local and are deliberately absent here so no static or model-supplied object can stand
 * in for them. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from './session.mjs';
export const BROWSER_HOST_FACTS_SCHEMA='meri-browser-host-facts/3';
/** Named bounds. The metadata answer never inherits the currentness ceiling. Artifact BYTES travel on
 * their own operation: 26214400 raw bytes encode to ceil(26214400/3)*4 = 34952536 base64 bytes, and the
 * envelope adds at most BROWSER_HOST_ARTIFACT_ENVELOPE_OVERHEAD_BYTES on top. */
export const BROWSER_HOST_FACTS_MAX_BYTES=262144;
export const BROWSER_HOST_ARTIFACT_ENCODING='base64';
export const BROWSER_HOST_ARTIFACT_MAX_BYTES=26214400;
export const BROWSER_HOST_ARTIFACT_MAX_ENCODED_BYTES=34952536;
export const BROWSER_HOST_ARTIFACT_ENVELOPE_OVERHEAD_BYTES=65536;
export const BROWSER_HOST_ARTIFACT_ENVELOPE_MAX_BYTES=35018072;
const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('BROWSER_HOST_FACTS_REFUSED'),{code:'BROWSER_HOST_FACTS_REFUSED'});};
const positive=value=>{if(!Number.isSafeInteger(value)||value<1)fail();return value;};
/** Validates and normalizes one facts document. `binding` pins the exact requested run when supplied. */
export function assertBrowserHostFacts(raw,{binding:expected}={}){
 const c=own(data(raw),['schema','binding','scopes','deadlineMs','currentUntilMs','phase','admitted','capabilityPolicy',
  'capabilityPolicySha256','browserPolicy','browserPolicySha256'],['siteWorkflow','browserHandoff']);
 if(c.schema!==BROWSER_HOST_FACTS_SCHEMA)fail();
 validateShape('RunBinding',c.binding);
 if(expected!==undefined&&canonicalSha256(data(expected))!==canonicalSha256(c.binding))fail();
 if(!Array.isArray(c.scopes)||c.scopes.length===0)fail();
 // The canonical scope validator, not an arbitrary object: one client scope keyed to this binding.
 const scopes=Object.freeze(c.scopes.map(scope=>Object.freeze(data(scope))));
 const selectedClientId=scopes.length===1&&scopes[0].kind==='client'?scopes[0].resourceId:null;
 assertNativeConversationScope({binding:data(c.binding),scopes,selectedClientId});
 if(c.phase!=='active')fail();
 const a=own(data(c.admitted),['sdk','bash','browser']);
 if(a.sdk!==true||a.browser!==true||typeof a.bash!=='boolean')fail();
 const deadlineMs=positive(c.deadlineMs),currentUntilMs=positive(c.currentUntilMs);
 if(currentUntilMs>deadlineMs)fail();
 const capabilityPolicy=Object.freeze(data(c.capabilityPolicy)),browserPolicy=Object.freeze(data(c.browserPolicy));
 // The digests are part of the wire and must describe exactly these values: a tampered or stale digest
 // is refused rather than propagated, and the emitted object validates identically on re-read.
 if(c.capabilityPolicySha256!==canonicalSha256(capabilityPolicy)||c.browserPolicySha256!==canonicalSha256(browserPolicy))fail();
 const facts=Object.freeze({schema:BROWSER_HOST_FACTS_SCHEMA,binding:Object.freeze(structuredClone(data(c.binding))),scopes,
  deadlineMs,currentUntilMs,phase:'active',admitted:Object.freeze({sdk:true,bash:a.bash,browser:true}),
  capabilityPolicy,capabilityPolicySha256:c.capabilityPolicySha256,
  browserPolicy,browserPolicySha256:c.browserPolicySha256,
  ...(c.siteWorkflow===undefined?{}:{siteWorkflow:Object.freeze(data(c.siteWorkflow))}),
  ...(c.browserHandoff===undefined?{}:{browserHandoff:Object.freeze(data(c.browserHandoff))})});
 if(Buffer.byteLength(JSON.stringify(facts),'utf8')>BROWSER_HOST_FACTS_MAX_BYTES)fail();
 return facts;
}
export function browserHostFactsDigest(facts){return canonicalSha256(assertBrowserHostFacts(facts));}

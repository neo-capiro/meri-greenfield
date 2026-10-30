/** Control-owned browser host run facts. This is the part of a host `readRun` result that only the
 * canonical Control owners can produce; cwd, installation, egress, observers and the runtime port
 * stay host-local and are deliberately absent here so no static or model-supplied object can stand
 * in for them. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const BROWSER_HOST_FACTS_SCHEMA='meri-browser-host-facts/3';
/** Named bounds. Policy values admit 256 origins with DNS names up to 255 characters and a workflow may
 * carry 64 selectors of up to 256 characters, so the metadata answer is bounded well above 32 KiB and
 * never inherits the currentness ceiling. Artifact BYTES travel on their own operation with their own
 * raw bound (downloads.mjs admits 26214400) plus explicit encoding overhead. */
export const BROWSER_HOST_FACTS_MAX_BYTES=262144;
export const BROWSER_HOST_ARTIFACT_MAX_BYTES=26214400;
export const BROWSER_HOST_WIRE_OVERHEAD_BYTES=65536;
const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('BROWSER_HOST_FACTS_REFUSED'),{code:'BROWSER_HOST_FACTS_REFUSED'});};
const positive=value=>{if(!Number.isSafeInteger(value)||value<1)fail();return value;};
/** Validates and normalizes one facts document. `binding` pins the exact requested run when supplied. */
export function assertBrowserHostFacts(raw,{binding:expected}={}){
 const c=own(data(raw),['schema','binding','scopes','deadlineMs','currentUntilMs','phase','admitted','capabilityPolicy','browserPolicy'],
  ['siteWorkflow','browserHandoff']);
 if(c.schema!==BROWSER_HOST_FACTS_SCHEMA)fail();
 validateShape('RunBinding',c.binding);
 if(expected!==undefined&&canonicalSha256(data(expected))!==canonicalSha256(c.binding))fail();
 if(!Array.isArray(c.scopes)||c.scopes.length===0)fail();
 const scopes=Object.freeze(c.scopes.map(scope=>Object.freeze(data(scope))));
 if(c.phase!=='active')fail();
 const a=own(data(c.admitted),['sdk','bash','browser']);
 if(a.sdk!==true||a.browser!==true||typeof a.bash!=='boolean')fail();
 const deadlineMs=positive(c.deadlineMs),currentUntilMs=positive(c.currentUntilMs);
 if(currentUntilMs>deadlineMs)fail();
 const capabilityPolicy=Object.freeze(data(c.capabilityPolicy)),browserPolicy=Object.freeze(data(c.browserPolicy));
 // `siteWorkflow` is the SAVED SiteWorkflowSelection (data). The live resolve({binding,signal}) port the
 // host is given is not this document: it re-resolves current Core state on every required call.
 const facts=Object.freeze({schema:BROWSER_HOST_FACTS_SCHEMA,binding:Object.freeze(structuredClone(data(c.binding))),scopes,
  deadlineMs,currentUntilMs,phase:'active',admitted:Object.freeze({sdk:true,bash:a.bash,browser:true}),
  capabilityPolicy,capabilityPolicySha256:canonicalSha256(capabilityPolicy),
  browserPolicy,browserPolicySha256:canonicalSha256(browserPolicy),
  ...(c.siteWorkflow===undefined?{}:{siteWorkflow:Object.freeze(data(c.siteWorkflow))}),
  ...(c.browserHandoff===undefined?{}:{browserHandoff:Object.freeze(data(c.browserHandoff))})});
 // The answer must fit its own named bound; a document that does not is refused, never truncated and
 // never allowed to widen the currentness ceiling.
 if(Buffer.byteLength(JSON.stringify(facts),'utf8')>BROWSER_HOST_FACTS_MAX_BYTES)fail();
 return facts;
}
export function browserHostFactsDigest(facts){return canonicalSha256(assertBrowserHostFacts(facts));}

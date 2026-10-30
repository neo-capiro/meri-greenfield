/** Control-owned browser host run facts. This is the part of a host `readRun` result that only the
 * canonical Control owners can produce; cwd, installation, egress, observers and the runtime port
 * stay host-local and are deliberately absent here so no static or model-supplied object can stand
 * in for them. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const BROWSER_HOST_FACTS_SCHEMA='meri-browser-host-facts/2';
const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('BROWSER_HOST_FACTS_REFUSED'),{code:'BROWSER_HOST_FACTS_REFUSED'});};
const hex=value=>{if(typeof value!=='string'||!HEX.test(value))fail();return value;};
const positive=value=>{if(!Number.isSafeInteger(value)||value<1)fail();return value;};
const workflow=value=>{
 const c=own(data(value),['manifest','manifestSha256','enabled']);
 if(c.enabled!==true)fail();return Object.freeze({manifest:c.manifest,manifestSha256:hex(c.manifestSha256),enabled:true});
};
/** Validates and normalizes one facts document. `binding` pins the exact requested run when supplied. */
export function assertBrowserHostFacts(raw,{binding:expected}={}){
 const c=own(data(raw),['schema','binding','scopes','deadlineMs','currentUntilMs','phase','admitted','capabilityPolicy','browserPolicy'],
  ['siteWorkflow','siteWorkflows','browserHandoff']);
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
 if(c.siteWorkflows!==undefined&&!Array.isArray(c.siteWorkflows))fail();
 return Object.freeze({schema:BROWSER_HOST_FACTS_SCHEMA,binding:Object.freeze(structuredClone(data(c.binding))),scopes,
  deadlineMs,currentUntilMs,phase:'active',admitted:Object.freeze({sdk:true,bash:a.bash,browser:true}),
  capabilityPolicy,capabilityPolicySha256:canonicalSha256(capabilityPolicy),
  browserPolicy,browserPolicySha256:canonicalSha256(browserPolicy),
  ...(c.siteWorkflow===undefined?{}:{siteWorkflow:workflow(c.siteWorkflow)}),
  ...(c.siteWorkflows===undefined?{}:{siteWorkflows:Object.freeze(c.siteWorkflows.map(workflow))}),
  ...(c.browserHandoff===undefined?{}:{browserHandoff:Object.freeze(data(c.browserHandoff))})});
}
export function browserHostFactsDigest(facts){return canonicalSha256(assertBrowserHostFacts(facts));}

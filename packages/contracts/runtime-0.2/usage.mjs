/** Private content-free run accounting input. This is not a browser event or a permission receipt. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Error('RUNTIME_USAGE_REFUSED');};
const count=n=>Number.isSafeInteger(n)&&n>=0;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER/1e6;
const identifier=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:\-./]{0,199}$/u.test(v);
export const MAX_TOOL_AUDIT_RECORDS=128;
export function assertSdkUsageSnapshot(value){
 const s=own(value,['sessionId','sdkEstimateUsd','models','basis']);
 if(typeof s.sessionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(s.sessionId)||!money(s.sdkEstimateUsd))fail();
 const b=own(s.basis,['sdk','cli','provider','cacheWriteTtl','priceRevision']);
 if(![b.sdk,b.cli].every(v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/u.test(v))||!['bedrock','claude-api'].includes(b.provider)||!['5m','1h'].includes(b.cacheWriteTtl)||!identifier(b.priceRevision))fail();
 if(!s.models||typeof s.models!=='object'||Array.isArray(s.models)||Object.keys(s.models).length<1||Object.keys(s.models).length>32)fail();
 for(const [key,model] of Object.entries(s.models)){
  if(!identifier(key))fail();const m=own(model,['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests','sdkEstimateUsd','provider','costBasis']);
  if(!['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests'].every(k=>count(m[k]))||!money(m.sdkEstimateUsd)||!['bedrock','firstParty','unknown'].includes(m.provider)||!['list','unknown'].includes(m.costBasis))fail();
 }
 return s;
}
const EXTERNAL_OUTCOMES=['completed','failed','unknown'];
/** One narrow validated external-provider accounting field. Estimates only: billed cost stays unknown. */
function assertExternalSearch(value){
 const e=own(value,['provider','attempts','estimateMicroUsd','billedMicroUsd','outcome','calls','truncated'],['incomplete','unobserved']);
 if(!count(e.attempts)||e.attempts>64||!count(e.estimateMicroUsd)||e.estimateMicroUsd>1000000||
  e.billedMicroUsd!==null||!EXTERNAL_OUTCOMES.includes(e.outcome)||typeof e.truncated!=='boolean'||
  !Array.isArray(e.calls)||e.calls.length>8)fail();
 if(e.provider!==null&&!identifier(e.provider))fail();
 if(e.provider===null&&(e.attempts!==0||e.estimateMicroUsd!==0||e.calls.length!==0||e.incomplete!==true))fail();
 if(e.provider!==null&&e.attempts===0)fail();
 if(e.incomplete!==undefined&&typeof e.incomplete!=='boolean')fail();
 if(e.unobserved!==undefined&&(!Array.isArray(e.unobserved)||e.unobserved.length>4||
  e.unobserved.some(id=>!identifier(id))))fail();
 for(const call of e.calls){const c=own(call,['provider','attempts','outcome','estimateMicroUsd','billedMicroUsd']);
  if(c.provider!==e.provider||e.provider===null||!count(c.attempts)||c.attempts<1||c.attempts>64||!EXTERNAL_OUTCOMES.includes(c.outcome)||
   !count(c.estimateMicroUsd)||c.estimateMicroUsd>1000000||c.billedMicroUsd!==null)fail();}
 return e;}
export function assertUsageInput(value){
 const v=data(own(value,['usage','toolsUsed'],['externalSearch']));if(v.externalSearch!==undefined)assertExternalSearch(v.externalSearch);if(v.usage!==null)assertSdkUsageSnapshot(v.usage);
 const a=own(v.toolsUsed,['tools','omitted']);if(!Array.isArray(a.tools)||a.tools.length>MAX_TOOL_AUDIT_RECORDS||!count(a.omitted))fail();
 for(const value of a.tools){const t=own(value,['tool','toolUseId','outcome','durationMs']);if(!identifier(t.tool)||!identifier(t.toolUseId)||!['completed','failed'].includes(t.outcome)||t.durationMs!==null&&!count(t.durationMs))fail();}
 if(Buffer.byteLength(JSON.stringify(v))>131072)fail();return v;
}

const COUNTERS=Object.freeze(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const dollars=money,invalid=fail;
/** Drop result text, thinking, errors, tool arguments and outputs before anything reaches persistence. */
export function projectSdkUsage(result,basis){
 if(!object(result)||result.type!=='result'||!uuid(result.session_id)||!dollars(result.total_cost_usd)||!object(result.modelUsage))invalid();
 const entries=Object.entries(result.modelUsage);if(entries.length<1||entries.length>32)invalid();
 const models={};
 for(const [name,value] of entries.sort(([a],[b])=>a.localeCompare(b))){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/u.test(name)||!object(value)||COUNTERS.some(key=>!count(value[key]))||!dollars(value.costUSD)||!count(value.webSearchRequests))invalid();
  // The pinned SDK permits an absent costBasis after resume and defines it as list.
  // Explicit unknown/managed pricing and unknown providers remain unavailable.
  models[name]={...Object.fromEntries(COUNTERS.map(key=>[key,value[key]])),webSearchRequests:value.webSearchRequests,
   sdkEstimateUsd:value.costUSD,provider:['bedrock','firstParty'].includes(value.provider)?value.provider:'unknown',costBasis:value.costBasis===undefined||value.costBasis==='list'?'list':'unknown'};
 }
 return assertSdkUsageSnapshot({sessionId:result.session_id,sdkEstimateUsd:result.total_cost_usd,models,basis:{...basis}});
}

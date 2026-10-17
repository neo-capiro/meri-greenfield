/** S3 authenticated-state destruction (design section 1.1 S3 and 5.3; owner answer Q-A2 accepted 15 October 2026: the user
 * signs in through takeover, no vault or service accounts, and the session is destroyed on disconnect, conversation end,
 * TTL expiry and revocation). The whole browser context, profile and process tree go, never only cookies.
 *
 * PREPARATION ONLY: an ordered teardown over trusted session-owner ports, not composed anywhere. Order:
 * 1. fence (S1) with the trigger's reason and wait for the bounded drain; unsettled calls are UNKNOWN, never completed;
 * 2. optional server-side logout when the site manifest defines `logoutUrl` (best effort; never blocks destruction);
 * 3. close the context and confirm the process tree has exited;
 * 4. remove profile, HOME and output and verify their absence (`disposeBrowserState` behind the `dispose` port);
 * 5. only then may a fresh, empty profile launch. An unconfirmed exit or disposal is BROWSER_DISPOSE_INCOMPLETE and the
 *    browser stays unavailable (never reused); per-conversation host destruction (D005) is the backstop.
 * After a session-owner crash (`crash-recovery`) steps 1-3 have nothing to act on: the surviving profile is destroyed
 * before anything launches. No port may export storage state: this module refuses a port set that offers one. */
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {BROWSER_CLEANUP_MS} from '../lifecycle.mjs';
export const DESTRUCTION_SCHEMA='meri-browser-state-destruction/1';
export const DESTRUCTION_TRIGGERS=Object.freeze(['disconnect','conversation-end','ttl-expiry','revocation','crash-recovery']);
export const LOGOUT_OUTCOMES=Object.freeze(['confirmed','failed','unknown','not-defined']);
const FENCE_REASON=Object.freeze({disconnect:'disconnect','conversation-end':'session-end','ttl-expiry':'session-end',revocation:'revocation'});
const EXPORTING_PORTS=['storageState','exportStorageState','exportCookies','saveSession','vault'];
const fault=(code,receipt)=>Object.assign(new Error(code),{code,...(receipt?{receipt}:{})});

/** Ports: `fence` (the S1 fence of this browser), `waitForDrain({signal})`, `logout({url},{signal})` resolving
 * `{outcome}`, `closeContext({signal})` resolving `{closed:true}`, `waitForExit({signal})` resolving `{exited:true}`,
 * `dispose({signal})` resolving `{disposed:true}`. */
export function createStateDestruction({fence,ports,manifest=null,now,boundMs=BROWSER_CLEANUP_MS.max}={}){
 if(ports&&EXPORTING_PORTS.some(k=>k in ports))throw fault('BROWSER_STATE_EXPORT_REFUSED');
 const need=['waitForDrain','closeContext','waitForExit','dispose'];
 if(typeof fence?.fence!=='function'||typeof fence.state!=='function'||typeof fence.end!=='function'||!ports||need.some(k=>typeof ports[k]!=='function')||manifest?.logoutUrl&&typeof ports.logout!=='function'
  ||typeof now!=='function'||!Number.isSafeInteger(boundMs)||boundMs<1||boundMs>BROWSER_CLEANUP_MS.max)throw fault('BROWSER_CONFIGURATION');
 let settled=null;
 async function run(trigger){
  const receipt={schema:DESTRUCTION_SCHEMA,trigger,atMs:now(),drain:'not-applicable',logout:'not-defined',process:'unknown',profile:'not-attempted',unknownCalls:0,relaunch:false};
  const life=createOperationLifetime({deadlineMs:now()+boundMs,now,errorFactory:code=>fault(code)});
  const step=async(operation,accept)=>{try{return accept(await life.run(operation));}catch{return false;}};
  try{
   if(trigger!=='crash-recovery'){
    fence.fence({reason:FENCE_REASON[trigger]});
    await step(signal=>ports.waitForDrain({signal}),()=>true);
    const s=fence.state();receipt.drain=s.state==='fencing'||s.state==='drain-unknown'?'unknown':'drained';
    if(manifest?.logoutUrl){
     let outcome='unknown';await step(signal=>ports.logout({url:manifest.logoutUrl},{signal}),r=>{outcome=LOGOUT_OUTCOMES.slice(0,3).includes(r?.outcome)?r.outcome:'unknown';return true;});
     receipt.logout=outcome;
    }
    await step(signal=>ports.closeContext({signal}),r=>r?.closed===true);
   }
   receipt.process=await step(signal=>ports.waitForExit({signal}),r=>r?.exited===true)?'exited':'unknown';
   if(receipt.process==='exited')receipt.profile=await step(signal=>ports.dispose({signal}),r=>r?.disposed===true)?'destroyed':'unknown';
  }finally{life.close();}
  const final=fence.end();receipt.unknownCalls=final.unknownCalls.length;
  receipt.relaunch=receipt.profile==='destroyed';
  const frozen=Object.freeze(receipt);
  if(!frozen.relaunch)throw fault('BROWSER_DISPOSE_INCOMPLETE',frozen);
  return frozen;
 }
 return Object.freeze({
  /** Idempotent: the first trigger is the one destroyed; later calls return the same settlement. */
  destroy({trigger}={}){
   if(!DESTRUCTION_TRIGGERS.includes(trigger))return Promise.reject(fault('BROWSER_CONFIGURATION'));
   settled??=run(trigger);return settled;
  },
 });
}

/** Shared by the pre-deploy rehearsals (first-turn-rehearsal, d3-rehearsal): Core latency profiles and the host clock. */
import {performance} from 'node:perf_hooks';

/** Legacy per-route ms from the10:26Z live Core log. `/current` has no independent measurement here:
 * equivalent = context +100% of the same profile's measured identity cost (335/600/900ms).
 * This conservatively assumes no identity overlap or Clerk-cache saving, and no separate membership HTTP hop:
 * current joins membership within the one RepeatableRead observation. Not tuned to a rehearsal outcome.
 * The historical runner publish cadence remains unchanged in D3. */
export const CORE_PROFILES=Object.freeze({
 quiet:{identity:85,membership:220,context:250,current:335},
 'live-median':{identity:100,membership:300,context:500,current:600},
 'live-tail':{identity:150,membership:450,context:750,current:900},
});

/** Authority freshness compares wall-clock facts with zero tolerance (checkedAtMs >= call start, context-adapter.mjs), and the
 * WSL test host steps its wall clock back by up to about 1.3 s under load, which fakes refusals. The rehearsals measure deadlines,
 * not clock robustness, so in their process Date.now never goes back: it holds through a backward step until the host clock
 * catches up. The host's steps are still recorded. */
const systemNow=Date.now.bind(Date);let last=0;
Date.now=()=>{const t=systemNow();if(t>last)last=t;return last;};

/** Records host wall-clock steps of 5 ms or more against the monotonic clock; `at` reports the rehearsal's own elapsed time. */
export function recordHostClockSteps(at){
 const steps=[];let origin=systemNow()-performance.now();
 const watch=setInterval(()=>{const offset=Math.round(systemNow()-performance.now()-origin);if(Math.abs(offset)>=5&&steps.length<10){steps.push({atMs:at(),offsetMs:offset});origin+=offset;}},20);
 return {steps,stop:()=>clearInterval(watch)};
}


/** One modelled Core snapshot; no positive cache or run/session authority lives in this fixture.
 * The product's real receipt owner, local run/fence checks and Stop barriers remain responsible for O208.
 * `before` injects the existing measured Clerk timeout before normal route latency; `state` supplies test faults.
 * Legacy TTL stays600s for the historical split-route first-turn baseline; current uses Core's120s wire expiry.
 */
export function createRehearsalCoreModel({principal,clientId,conversationId,latency,now=Date.now,delay,before=()=>undefined,state={}}){
 const revisions={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)};
 return async(url,init)=>{
  const path=new URL(url).pathname,kind=path.slice('/api/clio/application-authority/'.length);
  if(path!=='/api/clio/application-authority/'+kind||!['identity','membership','context','current'].includes(kind)||init.method!=='POST')throw Error('unknown local Core route '+path);
  const body=JSON.parse(init.body),injected=await before(kind,body,init);if(injected!==undefined)return injected;
  await delay(latency[kind],init.signal);
  const status=state.status??200;if(status!==200){if(![401,403,409,503].includes(status))throw Error('unsupported rehearsal status');return Response.json({message:'Application authority unavailable'},{status});}
  const checkedAtMs=now(),pins={...revisions,...state.revisions},identity={principal,identityRevision:pins.identityRevision,checkedAtMs,expiresAtMs:checkedAtMs+(kind==='current'?120000:600000)};
  const member={role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:pins.membershipRevision};
  if(kind==='identity')return Response.json(identity);
  if(kind==='membership')return Response.json({...principal,status:'active',...member,checkedAtMs,expiresAtMs:identity.expiresAtMs});
  if(body.conversationId!==conversationId||body.clientId!==clientId)return Response.json({message:'Application authority unavailable'},{status:403});
  if(kind==='context')return Response.json({...identity,identitySha256:body.identitySha256,conversationId,selectedClientId:clientId,contextRevision:pins.contextRevision});
  if(Object.keys(body).some(k=>!['conversationId','clientId','expect'].includes(k))||Object.hasOwn(body,'expect')&&(body.expect===null||typeof body.expect!=='object'||Array.isArray(body.expect)||Object.entries(body.expect).some(([k,v])=>!Object.hasOwn(revisions,k)||typeof v!=='string'||!/^[a-f0-9]{64}$/u.test(v))))return Response.json({message:'Invalid authority request'},{status:400});
  if(Object.entries(body.expect??{}).some(([k,v])=>pins[k]!==v))return Response.json({error:'CHANGED'},{status:409});
  return Response.json({...identity,...member,conversationId,selectedClientId:clientId,contextRevision:pins.contextRevision});
 };
}

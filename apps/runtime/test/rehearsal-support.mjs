/** Shared by the pre-deploy rehearsals (first-turn-rehearsal, d3-rehearsal): Core latency profiles and the host clock. */
import {performance} from 'node:perf_hooks';

/** Per-route Core latency in ms (identity / membership / context), from the 10:26Z live Core log. */
export const CORE_PROFILES=Object.freeze({
 quiet:{identity:85,membership:220,context:250},
 'live-median':{identity:100,membership:300,context:500},
 'live-tail':{identity:150,membership:450,context:750},
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

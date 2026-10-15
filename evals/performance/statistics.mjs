/** Nearest-rank percentiles over raw millisecond samples; no interpolation, no sample dropped. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function nearestRankPercentile(samples,percentile){
 if(!Array.isArray(samples)||!samples.length||samples.some(s=>typeof s!=='number'||!Number.isFinite(s)||s<0)||!Number.isFinite(percentile)||percentile<=0||percentile>100)fail('STATISTICS_INPUT');
 const sorted=[...samples].sort((a,b)=>a-b);return sorted[Math.ceil(percentile/100*sorted.length)-1];
}
export function summarize(samples){
 if(!Array.isArray(samples)||samples.some(s=>typeof s!=='number'||!Number.isFinite(s)||s<0))fail('STATISTICS_INPUT');
 if(!samples.length)return {count:0,p50Ms:null,p95Ms:null,maxMs:null};
 const round=n=>Math.round(n*1000)/1000;
 return {count:samples.length,p50Ms:round(nearestRankPercentile(samples,50)),p95Ms:round(nearestRankPercentile(samples,95)),maxMs:round(Math.max(...samples))};
}

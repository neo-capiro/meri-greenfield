import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {nearestRankPercentile,summarize} from '../statistics.mjs';
import {measureAcknowledgement} from '../acknowledgement.mjs';
import {measureReadiness,READINESS_UNRUN} from '../readiness.mjs';
import {buildReport,THRESHOLDS} from '../report.mjs';
import {runPerformanceHarness,principalsFor,main} from '../run.mjs';
import {createScriptedConversationApplication} from '../../offline-targets/conversation-application.mjs';
const streams=()=>{const out=[],err=[];return {out,err,stdout:{write:s=>out.push(s)},stderr:{write:s=>err.push(s)}};};
const generatedAt='2026-10-15T00:00:00.000Z';
const ack=(samples,extra={})=>({concurrency:10,rounds:1,requested:samples.length,accepted:samples.length,dispatched:samples.length,failures:[],samples,...extra});
test('nearest-rank percentiles use the ceiling rank without interpolation and reject invalid samples',()=>{
 const twenty=Array.from({length:20},(_,i)=>20-i);
 assert.equal(nearestRankPercentile(twenty,95),19);assert.equal(nearestRankPercentile(twenty,100),20);assert.equal(nearestRankPercentile([4,1,3,2],50),2);assert.equal(nearestRankPercentile([7],95),7);
 for(const bad of [[],[-1],[Number.NaN],['1']])assert.throws(()=>nearestRankPercentile(bad,95),/STATISTICS_INPUT/);
 assert.throws(()=>nearestRankPercentile([1],0),/STATISTICS_INPUT/);
 assert.deepEqual(summarize([]),{count:0,p50Ms:null,p95Ms:null,maxMs:null});
 assert.deepEqual(summarize([1.23456,2,3]),{count:3,p50Ms:2,p95Ms:3,maxMs:3});
});
test('acknowledgement keeps ten submissions in flight at once, each on a fresh conversation, and records every dispatched run',async()=>{
 const principals=principalsFor(20),target=await createScriptedConversationApplication({principals});
 try{const credentials=new Map();for(const p of principals)credentials.set(p,await target.issue(p));
  let inFlight=0,peak=0;const handle=target.app.handle;
  const observed={...target,app:{handle:async request=>{inFlight++;peak=Math.max(peak,inFlight);await new Promise(r=>setTimeout(r,5));try{return await handle(request);}finally{inFlight--;}}}};
  let tick=0;const result=await measureAcknowledgement({target:observed,principals,credentials,concurrency:10,rounds:2,clock:()=>tick++});
  assert.equal(peak,10);assert.equal(result.requested,20);assert.equal(result.accepted,20);assert.equal(result.dispatched,20);assert.deepEqual(result.failures,[]);
  assert.equal(new Set(target.state.starts).size,20);assert.ok(result.samples.every(s=>Number.isFinite(s)&&s>0));
  await assert.rejects(measureAcknowledgement({target,principals:principals.slice(0,19),credentials,concurrency:10,rounds:2}),/ACKNOWLEDGEMENT_CONFIGURATION/);
  const replay=await measureAcknowledgement({target,principals,credentials,concurrency:10,rounds:1});
  assert.equal(replay.accepted,0);assert.equal(replay.dispatched,0);assert.equal(replay.failures.length,10);assert.ok(replay.failures.every(f=>f.status==='REPLAYED'));
 }finally{target.close();}
});
test('readiness is UNRUN without a live probe and measures only valid samples from an injected probe',async()=>{
 assert.deepEqual(await measureReadiness(),{state:'UNRUN',reason:READINESS_UNRUN,requested:10,samples:[],failures:[]});
 const measured=await measureReadiness({samples:4,probe:async({index})=>{if(index===1)throw Object.assign(Error('x'),{code:'TASK_PLACEMENT_FAILED'});if(index===2)return -5;return 1000*(index+1);}});
 assert.equal(measured.state,'MEASURED');assert.deepEqual(measured.samples,[1000,4000]);assert.deepEqual(measured.failures,[{index:1,code:'TASK_PLACEMENT_FAILED'},{index:2,code:'PROBE_SAMPLE_INVALID'}]);
 await assert.rejects(measureReadiness({probe:'not a function'}),/READINESS_CONFIGURATION/);
});
test('the report compares p95 with the 2 s and 90 s thresholds and never passes an unrun or incomplete measurement',async()=>{
 assert.deepEqual(THRESHOLDS,{acknowledgementP95Ms:2000,readinessP95Ms:90000,concurrency:10});
 const unrun=await measureReadiness();
 const within=buildReport({acknowledgement:ack([...Array(19).fill(100),5000]),readiness:unrun,generatedAt});
 assert.equal(within.label,'LOCAL_FIXTURE');assert.equal(within.acknowledgement.p95Ms,100);assert.equal(within.gates.acknowledgement,'LOCAL_FIXTURE_WITHIN_THRESHOLD');assert.equal(within.gates.readiness,'UNRUN');assert.equal(within.readiness.withinThreshold,false);assert.equal(within.qualification.state,'UNQUALIFIED');
 assert.equal(buildReport({acknowledgement:ack([...Array(18).fill(100),2001,2001]),readiness:unrun,generatedAt}).gates.acknowledgement,'LOCAL_FIXTURE_EXCEEDED');
 assert.equal(buildReport({acknowledgement:ack([100],{failures:[{round:0,index:1,status:400}],requested:2}),readiness:unrun,generatedAt}).acknowledgement.withinThreshold,false);
 assert.equal(buildReport({acknowledgement:ack([100],{dispatched:0}),readiness:unrun,generatedAt}).acknowledgement.withinThreshold,false);
 assert.equal(buildReport({acknowledgement:ack([100],{concurrency:9}),readiness:unrun,generatedAt}).acknowledgement.withinThreshold,false);
 const ready=v=>({state:'MEASURED',reason:null,requested:v.length,samples:v,failures:[]});
 assert.equal(buildReport({acknowledgement:ack([100]),readiness:ready([90000,1000]),generatedAt}).gates.readiness,'MEASURED_WITHIN_THRESHOLD');
 assert.equal(buildReport({acknowledgement:ack([100]),readiness:ready([90001]),generatedAt}).gates.readiness,'MEASURED_EXCEEDED');
 assert.equal(buildReport({acknowledgement:ack([100]),readiness:{...ready([1000]),requested:2},generatedAt}).gates.readiness,'MEASURED_EXCEEDED');
});
test('the harness runs ten concurrent fresh conversations per round on the loopback application',async()=>{
 const report=await runPerformanceHarness({rounds:2});
 assert.equal(report.schema,'meri-performance-report/1');assert.equal(report.label,'LOCAL_FIXTURE');
 assert.equal(report.acknowledgement.concurrency,10);assert.equal(report.acknowledgement.requested,20);assert.equal(report.acknowledgement.accepted,20);assert.equal(report.acknowledgement.dispatched,20);assert.equal(report.acknowledgement.count,20);
 assert.ok(report.acknowledgement.p95Ms>0);assert.equal(report.readiness.state,'UNRUN');assert.equal(report.gates.readiness,'UNRUN');
 const probed=await runPerformanceHarness({rounds:1,readinessProbe:async()=>1500});assert.equal(probed.readiness.state,'MEASURED');assert.equal(probed.readiness.p95Ms,1500);
});
test('CLI documents exit codes, validates arguments, writes an exclusive report and exits 1 when the threshold is exceeded',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'meri-performance-'));try{
  const help=streams();assert.equal(await main(['--help'],help),0);assert.match(help.out.join(''),/Exit 0/);assert.match(help.out.join(''),/UNRUN/);
  for(const args of [[],['--bogus','x'],['output','x'],['--output',join(dir,'a.json'),'--rounds','0'],['--output',join(dir,'a.json'),'--rounds','51'],['--output',join(dir,'a.json'),'--output',join(dir,'b.json')]]){const s=streams();assert.equal(await main(args,s),2,JSON.stringify(args));assert.match(s.err.join(''),/PERFORMANCE_CLI_ARGUMENTS/);}
  const ok=streams(),output=join(dir,'report.json');assert.equal(await main(['--output',output,'--rounds','1'],ok),0);
  const written=JSON.parse(await readFile(output,'utf8'));assert.equal(written.label,'LOCAL_FIXTURE');assert.equal(written.acknowledgement.accepted,10);assert.match(ok.out.join(''),/"readiness":"UNRUN"/);
  assert.equal(await main(['--output',output],streams()),2);
  const slow=streams();assert.equal(await main(['--output',join(dir,'slow.json')],{...slow,run:async()=>buildReport({acknowledgement:ack([3000]),readiness:await measureReadiness(),generatedAt})}),1);assert.match(slow.out.join(''),/LOCAL_FIXTURE_EXCEEDED/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

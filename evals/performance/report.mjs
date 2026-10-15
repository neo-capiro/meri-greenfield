/** Report assembly: measured numbers beside the plan thresholds, labelled as a local fixture. */
import {summarize} from './statistics.mjs';
export const THRESHOLDS=Object.freeze({acknowledgementP95Ms:2000,readinessP95Ms:90000,concurrency:10});
export function buildReport({acknowledgement,readiness,generatedAt,thresholds=THRESHOLDS}){
 const ack=summarize(acknowledgement.samples),ready=summarize(readiness.samples);
 const ackWithin=acknowledgement.failures.length===0&&acknowledgement.accepted===acknowledgement.requested&&acknowledgement.dispatched===acknowledgement.requested&&ack.p95Ms!==null&&ack.p95Ms<=thresholds.acknowledgementP95Ms&&acknowledgement.concurrency>=thresholds.concurrency;
 const readyWithin=readiness.state==='MEASURED'&&readiness.failures.length===0&&ready.count===readiness.requested&&ready.p95Ms!==null&&ready.p95Ms<=thresholds.readinessP95Ms;
 return {schema:'meri-performance-report/1',label:'LOCAL_FIXTURE',generatedAt,thresholds,
  acknowledgement:{definition:'accepted-request response, not model completion',environment:'scripted loopback conversation application with a scripted runtime dispatcher; no Temporal, PostgreSQL, worker or model',concurrency:acknowledgement.concurrency,rounds:acknowledgement.rounds,requested:acknowledgement.requested,accepted:acknowledgement.accepted,dispatched:acknowledgement.dispatched,failures:acknowledgement.failures,...ack,samplesMs:acknowledgement.samples.map(s=>Math.round(s*1000)/1000),withinThreshold:ackWithin},
  readiness:{definition:'accepted request to a fresh isolated worker ready; includes new task placement',state:readiness.state,reason:readiness.reason,requested:readiness.requested,failures:readiness.failures,...ready,samplesMs:readiness.samples,withinThreshold:readyWithin},
  gates:{acknowledgement:ackWithin?'LOCAL_FIXTURE_WITHIN_THRESHOLD':'LOCAL_FIXTURE_EXCEEDED',readiness:readiness.state==='MEASURED'?(readyWithin?'MEASURED_WITHIN_THRESHOLD':'MEASURED_EXCEEDED'):'UNRUN'},
  qualification:{state:'UNQUALIFIED',note:'Loopback fixture latency is not deployed UI acknowledgement; readiness requires the live isolated-worker probe. Neither number satisfies the plan performance gate.'}};
}

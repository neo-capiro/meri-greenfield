/** Run lifecycle telemetry from the canonical run-owner publish path. Every worker-reported `run.status` transition is accepted by
 * `service.publish` and returned as the durable event, so the observer sees authoritative transitions after they commit. One `meri.run`
 * span per run is emitted at its terminal transition, starting at the first transition this process accepted and carrying each
 * transition as a span event; the run counter and duration histogram are recorded at the same point. State is process-local and
 * bounded: after a restart, or once a run is evicted, the terminal span is still emitted with `meri.run.duration_known=false`.
 * Control-originated cancellation appended by the lifecycle journal does not pass through `publish` and is not observed here. */
const TERMINAL=new Set(['completed','failed','cancelled']),MAX_TRANSITIONS=64;
export function createRunLifecycleObserver({instruments,now=Date.now,maxTrackedRuns=10000}){
 const open=new Map(),finished=new Set();
 const bounded=(collection,key,value)=>{if(collection.size>=maxTrackedRuns)collection.delete(collection.keys().next().value);return value===undefined?collection.add(key):collection.set(key,value);};
 function observe(event){
  if(event?.type!=='run.status')return;const {binding,sequence,data:{state,reasonCode}}=event,key=binding.runId,at=now();
  if(finished.has(key))return;let run=open.get(key);
  if(run&&sequence<=run.sequence)return;
  if(!TERMINAL.has(state)){
   if(!run)bounded(open,key,run={startedAtMs:at,sequence,transitions:[]});
   run.sequence=sequence;if(run.transitions.length<MAX_TRANSITIONS)run.transitions.push({state,at});return;
  }
  open.delete(key);bounded(finished,key);
  const span=instruments.startSpan('meri.run',{startTime:run?.startedAtMs??at,attributes:{'meri.tenant.id':binding.tenantId,'meri.conversation.id':binding.conversationId,'meri.run.id':binding.runId,'meri.run.attempt':binding.attemptId}});
  for(const t of run?.transitions??[])span.addEvent('meri.run.transition',{'meri.run.state':t.state},t.at);
  instruments.endSpan(span,{endTime:at,attributes:{'meri.run.state':state,'meri.run.duration_known':run!==undefined},...(state==='failed'?{failure:reasonCode}:{})});
  instruments.recordRun({state,reasonCode:reasonCode??null,...(run?{durationMs:at-run.startedAtMs}:{})});
 }
 return Object.freeze({
  observe,
  /** The same service with `publish` observed. Telemetry never changes the publish result or its failure. */
  observeRunOwner(service){
   const publish=service.publish;
   return Object.freeze({...service,async publish(input){const event=await publish(input);try{observe(event);}catch{}return event;}});
  },
 });
}

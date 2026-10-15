/** Runtime instruments over `@opentelemetry/api` only. Construction registers nothing: without a started SDK (sdk.mjs, owned by the
 * control lifecycle) the tracer and meter are the API's no-ops. Every attribute passes redaction before it reaches the API. */
import {trace,metrics,SpanKind,SpanStatusCode} from '@opentelemetry/api';
import {redactAttributes} from './redaction.mjs';
export const INSTRUMENTATION='meri.runtime';
/** Failure and reason codes become attributes only in their closed upper-case form; anything else is `OTHER`. */
export const closedCode=value=>typeof value==='string'&&/^[A-Z0-9_]{1,64}$/u.test(value)?value:'OTHER';
const count=value=>Number.isSafeInteger(value)&&value>=0;
export function createRuntimeInstruments({tracerProvider=trace.getTracerProvider(),meterProvider=metrics.getMeterProvider()}={}){
 const tracer=tracerProvider.getTracer(INSTRUMENTATION),meter=meterProvider.getMeter(INSTRUMENTATION);
 const runs=meter.createCounter('meri.runs',{description:'Runs that reached a terminal state',unit:'{run}'});
 const cost=meter.createHistogram('meri.run.cost',{description:'Measured cost per terminal run',unit:'uUSD'});
 const duration=meter.createHistogram('meri.run.duration',{description:'Observed run duration from first to terminal transition',unit:'ms'});
 const requests=meter.createHistogram('meri.http.server.duration',{description:'Control HTTP time to response headers',unit:'ms'});
 return Object.freeze({
  /** Metric dimensions are the terminal state and closed reason only; tenant and run identifiers stay on spans. Cost is recorded
   * only when the caller supplies a measured value. */
  recordRun({state,reasonCode=null,costMicroUSD,durationMs}){
   const a=redactAttributes({'meri.run.state':state,...(reasonCode===null?{}:{'meri.run.reason':closedCode(reasonCode)})});
   runs.add(1,a);if(count(costMicroUSD))cost.record(costMicroUSD,a);if(count(durationMs))duration.record(durationMs,a);
  },
  recordRequest(durationMs,attributes){if(count(durationMs))requests.record(durationMs,redactAttributes(attributes));},
  startSpan(name,{attributes,kind=SpanKind.INTERNAL,startTime}={}){return tracer.startSpan(name,{kind,attributes:redactAttributes(attributes),...(startTime===undefined?{}:{startTime})});},
  /** Ends a span with redacted final attributes and a closed failure code, if any. */
  endSpan(span,{attributes,failure,endTime}={}){
   if(attributes)span.setAttributes(redactAttributes(attributes));
   span.setStatus(failure===undefined?{code:SpanStatusCode.OK}:{code:SpanStatusCode.ERROR,message:closedCode(failure)});span.end(endTime);
  },
 });
}

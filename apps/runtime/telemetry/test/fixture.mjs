/** In-process OpenTelemetry providers for instrument tests: spans and metrics are read back without any exporter or network. */
import {tracing,metrics} from '@opentelemetry/sdk-node';
import {createRuntimeInstruments} from '../instruments.mjs';
class CollectingReader extends metrics.MetricReader{async onForceFlush(){}async onShutdown(){}}
export function inMemoryInstruments(){
 const exporter=new tracing.InMemorySpanExporter(),tracerProvider=new tracing.BasicTracerProvider({spanProcessors:[new tracing.SimpleSpanProcessor(exporter)]});
 const reader=new CollectingReader(),meterProvider=new metrics.MeterProvider({readers:[reader]});
 const instruments=createRuntimeInstruments({tracerProvider,meterProvider});
 async function points(name){const {resourceMetrics}=await reader.collect();const metric=resourceMetrics.scopeMetrics.flatMap(s=>s.metrics).find(m=>m.descriptor.name===name);return metric?metric.dataPoints:[];}
 return {instruments,spans:()=>exporter.getFinishedSpans(),points,close:async()=>{await tracerProvider.shutdown();await meterProvider.shutdown();}};
}

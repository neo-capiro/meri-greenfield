/** OpenTelemetry SDK lifecycle for an already validated `telemetry` block (config.mjs is its single validator). Constructed and
 * started only by the control owner when `telemetry.enabled === true`, stopped by its explicit close, which flushes both exporters and
 * then unregisters the global API providers. Importing this module registers nothing. Resource detection is disabled so no process
 * arguments, host names or environment values become resource attributes; identity comes from the validated versions object.
 * Logs are not exported: an empty processor list keeps the SDK from configuring its default OTLP log exporter. */
import {NodeSDK,resources,metrics as sdkMetrics} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {trace,metrics,context,propagation} from '@opentelemetry/api';
export const SIGNAL_PATHS=Object.freeze({traces:'/v1/traces',metrics:'/v1/metrics'});
export const DEFAULT_EXPORT_INTERVAL_MS=15000;
export function telemetryResource({serviceName,versions}){
 return resources.resourceFromAttributes({'service.name':serviceName,'service.version':versions.imageDigest,'meri.versions.sdk':versions.sdk,'meri.versions.cli':versions.cli,'meri.versions.contracts':versions.contracts,'meri.versions.skills_digest':versions.skillsDigest,'meri.versions.checkpoint_format':versions.checkpointFormat});
}
export function startTelemetrySdk({endpoint,exportIntervalMs=DEFAULT_EXPORT_INTERVAL_MS,serviceName,versions,timeoutMs}){
 const sdk=new NodeSDK({resource:telemetryResource({serviceName,versions}),autoDetectResources:false,instrumentations:[],logRecordProcessors:[],
  traceExporter:new OTLPTraceExporter({url:endpoint+SIGNAL_PATHS.traces,timeoutMillis:timeoutMs}),
  metricReaders:[new sdkMetrics.PeriodicExportingMetricReader({exporter:new OTLPMetricExporter({url:endpoint+SIGNAL_PATHS.metrics,timeoutMillis:timeoutMs}),exportIntervalMillis:exportIntervalMs,exportTimeoutMillis:Math.min(timeoutMs,exportIntervalMs)})]});
 sdk.start();let closing;
 return Object.freeze({close:()=>closing??=sdk.shutdown().finally(()=>{trace.disable();metrics.disable();propagation.disable();context.disable();})});
}

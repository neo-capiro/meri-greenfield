// Compile assertions against the pinned 0.223.0 / 1.9.1 declarations for the exact SDK options sdk.mjs passes.
import {NodeSDK,metrics,resources,type NodeSDKConfiguration} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {trace,metrics as api,context,propagation} from '@opentelemetry/api';
const endpoint='https://collector.synthetic.invalid';
const configuration:Partial<NodeSDKConfiguration>={resource:resources.resourceFromAttributes({'service.name':'meri-control'}),autoDetectResources:false,instrumentations:[],logRecordProcessors:[],
 traceExporter:new OTLPTraceExporter({url:endpoint+'/v1/traces',timeoutMillis:2000}),
 metricReaders:[new metrics.PeriodicExportingMetricReader({exporter:new OTLPMetricExporter({url:endpoint+'/v1/metrics',timeoutMillis:2000}),exportIntervalMillis:15000,exportTimeoutMillis:2000})]};
const sdk=new NodeSDK(configuration);sdk.start();
const shutdown:Promise<void>=sdk.shutdown();
const unregister:void[]=[trace.disable(),api.disable(),propagation.disable(),context.disable()];
void [shutdown,unregister];

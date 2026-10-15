/** Control telemetry composition, loaded by control.mjs only when `telemetry.enabled === true`; importing it starts nothing. */
import {startTelemetrySdk} from './sdk.mjs';
import {createRuntimeInstruments} from './instruments.mjs';
import {createRunLifecycleObserver} from './run-lifecycle.mjs';
import {instrumentApplication} from './http.mjs';
export const DEFAULT_SERVICE_NAME='meri-control';
/** Starts the SDK for a validated control configuration and returns the instrumentation hooks plus the owned close. */
export function startControlTelemetry({configuration,now=Date.now}){
 const t=configuration.telemetry,sdk=startTelemetrySdk({endpoint:t.endpoint,exportIntervalMs:t.exportIntervalMs,serviceName:t.serviceName??DEFAULT_SERVICE_NAME,versions:configuration.versions,timeoutMs:configuration.limits.requestMs});
 const instruments=createRuntimeInstruments(),lifecycle=createRunLifecycleObserver({instruments,now});
 return Object.freeze({observeRunOwner:service=>lifecycle.observeRunOwner(service),instrumentApplication:application=>instrumentApplication(instruments,application,{now}),close:sdk.close});
}

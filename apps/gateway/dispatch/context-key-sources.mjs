/** P5: the trusted source of every dispatch context key a read contract declares (`binding.contextKeys`), by dispatch path.
 * Data plus a pure classifier; it supplies nothing and authorizes nothing. `operation-context.mjs` and the owners named below
 * stay the only producers. A key whose source is not listed here for its path has no trusted producer, so its read must not
 * be registered (pinned by `test/context-key-sources.test.mjs` against the canonical bindings and the SDK registry). */
import {nativeReadGroup} from './native-read-context.mjs';
import {retainedReadGroup} from './retained-read-context.mjs';

const NATIVE='apps/runtime/native-authority/native-read-credentials/source-read-context.mjs (createSourceReadContext)';
/** Trusted sources per dispatch path and key. Every entry names the owner that produces the value and where it comes from. */
export const CONTEXT_KEY_SOURCES=Object.freeze({
 native:Object.freeze({
  asOf:`control clock at the task scope's first native observation, pinned for the scope and sent to Core as the trusted read observation (native-read-observation-0.2) — ${NATIVE}`,
  defaultAsOf:`control clock at the first observation when the request carries no asOfDate, pinned for the scope — ${NATIVE}`,
  defaultCongress:'control configuration `defaultCongress` (render key) — source-read-context.mjs',
  actorRole:'Core membership receipt (`application-authority/membership`, current native authority) — native-read-credentials/core-client.mjs',
  evidenceAccuracyMode:'Core `read-mode-observation` receipt for the exact operation and request hash — native-read-credentials/read-mode-observation.mjs',
  clientResolution:'request selector, resolved through the Core `clients/check-ref` observation for names or taken as a UUID, then checked against the current native visible clients and the subject — source-read-context.mjs',
  citationResolution:'request citation selector (legalSliceContext), checked with the same client resolution — gateway/sources/research-legal-legislation/request-context.mjs',
  effectiveScope:'request folder/client scope (newsSliceContext) checked against the current native visible clients — gateway/sources/research-legal-news/request-context.mjs',
  windowAsOf:'request window plus the pinned observation clock (newsSliceContext) — gateway/sources/research-legal-news/request-context.mjs',
  defaultYear:'explicit request personnel year only (D015 #6: never implicit) — gateway/sources/research-legal-news/request-context.mjs',
  owner:'current native principal (actor) from the Core identity receipt — gateway/sources/research-legal-news/request-context.mjs',
  tenantId:'run binding tenant (current gateway authority) — source-read-context.mjs',
  binding:'current gateway authority binding (createCurrentToolAuthority) — native-read-context.mjs',
  subject:'current gateway authority subject (createCurrentToolAuthority) — native-read-context.mjs',
  clientReference:'request clientId (UUID or name), name resolved through the Core `clients/check-ref` observation and equal to the selected client — source-read-context.mjs',
 }),
 retained:Object.freeze({
  asOf:'control clock at observation, bound into the Core retained principal envelope (CapiroRetained) — dispatch/retained-read-context.mjs',
  effectiveScope:'request scope checked by the Core retained principal issuance — dispatch/retained-read-context.mjs',
  clientResolution:'request client checked by the Core retained principal issuance — dispatch/retained-read-context.mjs',
  binding:'current gateway authority binding — dispatch/retained-read-context.mjs',
  subject:'current gateway authority subject — dispatch/retained-read-context.mjs',
 }),
 'bill-text':Object.freeze({defaultCongress:'control configuration `defaultCongress` — dispatch/bill-text-context.mjs'}),
 'profile:bound-projection/1':Object.freeze({
  tenantId:'current authority binding tenant — dispatch/projection-read-context.mjs',
  userId:'current authority binding actor — dispatch/projection-read-context.mjs',
  asOf:'control clock at observation — dispatch/projection-read-context.mjs',
  clientResolution:'request client checked against the current authority subject — dispatch/projection-read-context.mjs',
  defaultCongress:'control configuration `defaultCongress` — dispatch/projection-read-context.mjs',
 }),
 'profile:actions-complete/1':Object.freeze({binding:'current authority binding — dispatch/action-read-context.mjs',clientResolution:'request client checked against the current authority subject — dispatch/action-read-context.mjs'}),
 'profile:client-documents/1':Object.freeze({binding:'current authority binding — dispatch/projection-read-context.mjs',subject:'current authority subject — dispatch/projection-read-context.mjs'}),
 'profile:portfolio-evidence/1':Object.freeze({binding:'current authority binding — dispatch/operation-context.mjs',subject:'current authority subject — dispatch/operation-context.mjs'}),
 'profile:memory-proposals/1':Object.freeze({subject:'current authority subject — dispatch/memory-read-context.mjs',previous:'retained previous record from the memory context port — dispatch/memory-read-context.mjs'}),
 'profile:schedule-execution/1':Object.freeze({scheduleContext:'schedule owner (product path, not a meri_reads tool) — apps/control/schedules'}),
});

/** The dispatch path `operation-context.mjs` selects for a binding (same predicates, same order). Bill text takes the native
 * path when native ports are composed, otherwise its own bill-text context. */
export function readContextPath(binding,{nativePortsComposed=true}={}){
 const entry={contract:{binding}};
 if(nativeReadGroup(entry)&&(nativePortsComposed||binding.group!=='bill-text'))return 'native';
 if(binding.group==='bill-text')return 'bill-text';
 if(retainedReadGroup(entry))return 'retained';
 if(binding.dispatchProfile!==undefined)return `profile:${binding.dispatchProfile}`;
 return 'generic';
}

/** Every declared key with its trusted source, or `source: null` when the selected path has no trusted producer for it. */
export function readContextSupply(binding,options){
 const path=readContextPath(binding,options),sources=CONTEXT_KEY_SOURCES[path]??{};
 return Object.freeze({path,keys:Object.freeze((binding.contextKeys??[]).map(key=>Object.freeze({key,source:Object.hasOwn(sources,key)?sources[key]:null})))});
}

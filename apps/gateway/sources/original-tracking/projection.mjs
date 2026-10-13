/** Receipt projection preserves native identity/proofs; it never qualifies source truth. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from './request-context.mjs';
export function projectOriginalTrackingPage(value,context,{requestId,traceId,retrievedAt}) {
  const native=frozenData(value),task=context.operation.id==='query_tasks',rows=task?'tasks':'actions';
  ownFields(native,['tool','generatedAt','clientId','total','returned',rows,'scope','coverage']);
  if(native.tool!==context.operation.id||native.clientId!==context.input.clientId)deny('INVALID_RESULT');
  const selection=context.input,requirements=context.contract.descriptor.sourceRequirements;
  const page={kind:task?'task-read-page':'action-item-client-scoped-page',contractVersion:'0.2.0',operation:context.operation,
    requestId,traceId,binding:context.authority.binding,subject:context.authority.subject,window:{basis:'unbounded'},
    argumentsSha256:canonicalSha256(selection),appliedFilters:[],generatedAt:native.generatedAt,
    sources:requirements.map(source=>({...source,snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',
      synchronizedAt:null,asOf:null,retrievedAt,freshness:'unknown'})).map(({purpose:ignored,...source})=>source),
    coverage:{sourcesRequested:requirements.map(s=>s.sourceId),sourcesChecked:requirements.map(s=>s.sourceId),sourcesUnavailable:[],
      enumeration:'unknown',enumerableTotal:null,returnedCount:native.returned,truncated:!native.coverage.complete,historySupport:'unsupported',limitations:[
        'Native coverage, content hashes and versions are unauthenticated producer assertions; no qualified freshness, history, snapshot or exhaustive absence.',
        'Source authority describes the declared original owner; this receipt does not verify producer identity or authentic current authorization.',
        'Opaque native cursor is forwarded without decoding, authentication or snapshot-safe continuation.']},
    selection,order:task?'owner-order-unconfirmed':selection.sort==='priority'?
      'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed':'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',
    snapshotVersionId:null,clientId:native.clientId,scope:native.scope,total:native.total,returned:native.returned,[rows]:native[rows],
    pageCoverage:native.coverage,continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
  try{context.contract.assertOutput(page,{request:context.request,...context.normalizationContext});}catch{deny('INVALID_RESULT');}
  return frozenData(page);
}

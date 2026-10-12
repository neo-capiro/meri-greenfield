/** Native fields are preserved; new Meri lineage describes receipt, not source qualification. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertActionItemsCompleteResult,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields,operation} from './request-context.mjs';
const requirements=resolveOperationContract(operation).descriptor.sourceRequirements;

export function projectActionItems(value,context,{requestId,traceId,retrievedAt}) {
  const native=frozenData(value);
  if(context.input.mode==='unscoped_list')return frozenData(assertActionItemsCompleteResult(native,context.request,context.options));
  ownFields(native,['tool','generatedAt','clientId','total','returned','actions','scope','coverage']);
  if(native.tool!=='query_action_items')deny('INVALID_RESULT');
  const selection=context.input.selection;
  const page={kind:'action-item-client-scoped-page',contractVersion:'0.2.0',
    operation:{id:'query_action_items',version:'0.2.0'},requestId,traceId,
    binding:context.authority.binding,subject:context.authority.subject,window:{basis:'unbounded'},
    argumentsSha256:canonicalSha256(selection),appliedFilters:[],generatedAt:native.generatedAt,
    sources:requirements.map(source=>({sourceId:source.sourceId,authority:source.authority,snapshotVersionId:null,
      adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt,freshness:'unknown'})),
    coverage:{sourcesRequested:requirements.map(x=>x.sourceId),sourcesChecked:requirements.map(x=>x.sourceId),
      sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:native.returned,
      truncated:!native.coverage.complete,historySupport:'unsupported',limitations:[
        'Native coverage is a source assertion; no qualified freshness, snapshot or exhaustive absence.',
        'Receipt lineage does not authenticate native cursor contents or establish current source truth.']},
    selection,order:selection.sort==='priority'?'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed':
      'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',snapshotVersionId:null,
    clientId:native.clientId,scope:native.scope,total:native.total,returned:native.returned,actions:native.actions,
    pageCoverage:native.coverage,continuation:{cursor:null,requiredReads:[],remainingSources:[]},
    evidenceReady:false,negativeAssertion:{kind:'none'}};
  return frozenData(assertActionItemsCompleteResult(page,context.request,context.options));
}

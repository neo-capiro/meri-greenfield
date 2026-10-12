/** New Meri projection of existing authorized source DTOs; no source dereference. */
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { frozenData } from '../source-admission.mjs';
import { deny } from '../../dispatch/operation-result.mjs';

const selected = (value, keys) => Object.fromEntries(keys.map(key => {
  if (!Object.hasOwn(value, key)) deny('INVALID_RESULT');
  return [key, value[key]];
}));
const record = value => {
  if (!value || Array.isArray(value) || typeof value !== 'object') deny('INVALID_RESULT');
};
function coverage(scope, sourceView, limitation) {
  return {scope, sourceView, corpusComplete:false, sourceBytesVerified:false, limitations:[limitation]};
}
const reviewKeys = ['id','portfolioId','targetKind','targetId','revision','updatedAt','evidenceFor','evidenceAgainst'];
const snapshotKeys = ['id','portfolioId','portfolioRevision','contentHash','calculationVersion',
  'capturedAt','observedAt','readAt','versions','limitations','clientAccessRequirements'];
const continuityKeys = ['id','portfolioId','priorDecisionId','currentDecisionId','continuityKey',
  'priorDependencyFingerprint','dependencyFingerprint','status','identityMapping','changedDependencies',
  'originalEvidence','sourceEdition','relevantPeriodStart','relevantPeriodEnd','expiryDate',
  'reopeningReason','reopeningReviewId','createdAt','updatedAt'];

export function projectPortfolioEvidence(raw, input, authority) {
  const source = frozenData(raw);
  let data;
  if (input.origin === 'review') {
    if (!Array.isArray(source) || source.length !== 4) deny('INVALID_RESULT');
    const matches = [];
    for (const lane of source) {
      if (!Array.isArray(lane) || lane.length > 10000) deny('RESOURCE_LIMIT');
      const seen = new Set();
      for (const row of lane) {
        record(row);
        if (row.tenantId !== authority.binding.tenantId || row.portfolioId !== input.portfolioId ||
            typeof row.id !== 'string' || seen.has(row.id)) deny('INVALID_RESULT');
        seen.add(row.id);
        if (row.id === input.recordId) matches.push(row);
      }
    }
    // Rows can move between separate lane reads. Missing is unavailable; it is
    // never an assertion of nonexistence. Conflicting observed versions refuse.
    if (!matches.length) deny('UNAVAILABLE');
    if (matches.some(row => canonicalSha256(row) !== canonicalSha256(matches[0]))) deny('INVALID_RESULT');
    data = {...selected(matches[0], reviewKeys), origin:'review',
      coverage:coverage('exact_review','four_lane_non_atomic',
        'Exact observed review only. Four lane reads are not an atomic snapshot or proof of absence.')};
  } else if (input.origin === 'snapshot') {
    record(source); record(source.projection);
    if (source.projection.portfolioId !== input.portfolioId ||
        source.projection.portfolioRevision !== source.portfolioRevision ||
        source.projection.calculationVersion !== source.calculationVersion) deny('INVALID_RESULT');
    data = {...selected(source, snapshotKeys), contributions:source.projection.contributions, origin:'snapshot',
      coverage:coverage('retained_snapshot','retained_snapshot',
        'Retained projected snapshot evidence only. Hashes and version references are unverified source claims.')};
  } else if (input.origin === 'current_continuity') {
    record(source);
    if (!Array.isArray(source.items) || source.items.length > 10000) deny('RESOURCE_LIMIT');
    const items = source.items.map(row => {
      record(row);
      if (row.tenantId !== authority.binding.tenantId || row.portfolioId !== input.portfolioId) deny('INVALID_RESULT');
      return {...selected(row, continuityKeys), ...(Object.hasOwn(row,'persisted') ? {persisted:row.persisted} : {})};
    });
    data = {origin:'current_continuity', portfolioId:input.portfolioId, items, counts:source.counts,
      ...(Object.hasOwn(source,'knownAtSupport') ? {knownAtSupport:source.knownAtSupport} : {}),
      ...(Object.hasOwn(source,'limitations') ? {limitations:source.limitations} : {}),
      coverage:coverage('current_continuity','current_derived_projection',
        'Current annual projection may derive readonly continuity. It does not expose unrestricted decision history.')};
  } else deny('INVALID_ARGUMENTS');
  return {binding:authority.binding, subject:authority.subject, data};
}

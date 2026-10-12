/** Domain relationships for frozen funding read envelopes, never source truth. */
const fail = message => { throw new Error(message); };
export const FUNDING_ENVELOPE_MAX_CHARACTERS = 24_000;
export function fundingInstant(value) {
  const stamp = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString() !== value)
    fail('Funding requires a canonical comparable ISO instant');
  return stamp;
}
export function assertFundingEnvelope(value) {
  fundingInstant(value.asOf);
  // The frozen protocol measures JS JSON characters (UTF-16), not UTF-8 bytes.
  if (JSON.stringify(value).length > FUNDING_ENVELOPE_MAX_CHARACTERS)
    fail('Funding envelope exceeds 24000 JSON characters; producer must return a refusal');
  if (value.state === 'denied' && value.explanation !== 'Not available for this client.')
    fail('Funding denial must not disclose client existence');
  if (value.state !== 'available') return;
  const seen = new Set();
  for (const row of value.truncated ?? []) {
    if (seen.has(row.collection) || row.total <= row.kept) fail('Funding truncation must describe actual unique loss');
    seen.add(row.collection);
  }
}
function deadline(value, asOf) {
  if (value.basis === 'unknown') {
    if ([value.at, value.dateOnly, value.timeZone, value.daysRemaining].some(v => v !== null) || value.status !== 'unknown')
      fail('Unknown deadline cannot assert a cutoff');
    return;
  }
  const at = fundingInstant(value.at), now = fundingInstant(asOf);
  if (value.dateOnly === null || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateOnly) ||
      (value.basis === 'date_only_end_of_day' && !value.timeZone) ||
      value.daysRemaining !== Math.ceil((at - now) / 86_400_000) ||
      value.status !== (at >= now ? 'open' : 'closed')) fail('Funding deadline arithmetic/basis mismatch');
}
export function assertFundingBrief(row, asOf) {
  if (row.deadline) deadline(row.deadline, asOf);
}
export function assertFundingFacts(row, asOf, page = { summaryOffset: 0, summaryLimit: 1200 }) {
  assertFundingBrief(row, asOf);
  if (row.ref.source === 'grants_gov' && row.contractValue !== null ||
      row.ref.source === 'sam_gov' && row.grantFunding !== null) fail('Grant funding and contract value have distinct source meanings');
  if (row.contractValue && ((row.contractValue.estimatedValue === null) !== (row.contractValue.basis === 'not_stated_by_source')))
    fail('Contract value basis cannot convert unknown to zero');
  const read = row.summaryRead, end = read.offset + read.returnedCharacters;
  if (read.offset !== Math.min(page.summaryOffset, read.totalCharacters) ||
      read.returnedCharacters !== Math.min(page.summaryLimit, read.totalCharacters - read.offset) ||
      (row.summary?.length ?? 0) !== read.returnedCharacters ||
      read.truncated !== (read.offset > 0 || end < read.totalCharacters) ||
      read.nextOffset !== (end < read.totalCharacters ? end : null) ||
      read.sourceUpdatedAt !== row.sourceUpdatedAt ||
      read.state !== (row.summaryIsLink ? 'link_only' : read.totalCharacters > 0 ? 'available' : 'missing'))
    fail('Funding summary range/UTF-16 continuation mismatch');
  const evidence = row.evidence;
  if (evidence.recordRef !== `${row.ref.source}:${row.ref.sourceRecordId}` ||
      evidence.recommendationConfidence !== (row.recommendation?.recommendationConfidence ?? null))
    fail('Funding evidence identity/confidence substitution');
  const rejected = row.eligibility.state === 'ineligible';
  if (evidence.disqualifiers.length !== (rejected ? 1 : 0) ||
      rejected && evidence.disqualifiers[0].reason !== row.eligibility.reason)
    fail('Relevance and unassessed eligibility do not establish disqualification');
  const sam = row.ref.source === 'sam_gov';
  if (evidence.requirements.state !== (sam ? 'not_requested' : 'notice_body') ||
      evidence.requirements.tool !== (sam ? 'get_funding_opportunity_requirements' : 'get_funding_opportunity'))
    fail('Funding requirements source handoff mismatch');
  const expected = [
    ...(!row.sourceUrl ? ['sourceUrl'] : []), ...(!row.sourceUpdatedAt ? ['sourceUpdatedAt'] : []),
    ...(!row.responseDeadline && !row.responseDeadlineNote ? ['responseDeadline'] : []),
    ...(!row.placeOfPerformance ? ['placeOfPerformance'] : []),
    ...(!sam && row.eligibleApplicantTypes.length === 0 ? ['eligibleApplicantTypes'] : []),
    ...(read.totalCharacters === 0 || row.summaryIsLink ? ['noticeText'] : []),
  ];
  if (JSON.stringify(evidence.missingFields) !== JSON.stringify(expected)) fail('Funding missing-fact disclosure mismatch');
}
function scopedDeadlineCounts(rows, counts, asOf) {
  for (const row of rows) assertFundingBrief(row, asOf);
  const withDeadline = rows.filter(row => row.deadline);
  if (withDeadline.length && withDeadline.length !== rows.length) fail('Mixed funding deadline projection mode');
  if (counts.deadlinesIn30Days !== null) {
    if (withDeadline.length !== rows.length || counts.deadlinesIn30Days !== rows.filter(row =>
      row.deadline.status === 'open' && row.deadline.daysRemaining !== null && row.deadline.daysRemaining <= 30).length)
      fail('Funding deadline count describes only returned rows');
  } else if (withDeadline.length) fail('Deadline facts require the matching scoped count');
}
export function assertFundingSearch(data, envelope, input) {
  if (envelope.truncated) fail('Search pagination is not a collection truncation envelope');
  fundingInstant(data.generatedAt);
  const sources = input.source === undefined ? ['grants_gov', 'sam_gov'] : [input.source];
  const lifecycle = input.activeState === 'all' ? ['active', 'closed', 'post_award'] : [input.activeState];
  const criteria = data.criteria;
  for (const [key, value] of Object.entries({clientId: input.clientId, query: input.query, page: input.page, pageSize: input.pageSize, sources, lifecycle}))
    if (JSON.stringify(criteria[key]) !== JSON.stringify(value)) fail('Funding search criteria substitution');
  for (const key of ['types', 'agencies', 'sectors', 'naicsCodes', 'pscCodes', 'setAsideCodes', 'eligibility', 'posted', 'geography', 'applicantTypes', 'funding', 'costShare', 'methods', 'disbursement', 'grantPrerequisites', 'codes', 'keywordTerms'])
    if ((criteria[key]?.length ?? 0) !== 0) fail('Funding search cannot add an unrequested filter');
  if (Object.hasOwn(criteria, 'queryMatch')) fail('Funding search cannot add an unrequested match mode');
  if (data.clientId !== input.clientId || data.page !== input.page || data.pageSize !== input.pageSize ||
      data.opportunities.length > data.pageSize || JSON.stringify(data.coverage.sources) !== JSON.stringify(sources))
    fail('Funding search identity/page mismatch');
  const hasMore = data.total === null ? data.opportunities.length === data.pageSize : data.page * data.pageSize < data.total;
  if (data.hasMore !== hasMore || data.nextPage !== (hasMore ? data.page + 1 : null) || data.coverage.totalIsCapped !== data.totalIsCapped)
    fail('Funding search continuation mismatch');
  if (data.coverage.pageCoversMatchedResults && (data.totalIsCapped || hasMore || data.page !== 1 || data.total === null))
    fail('Funding search cannot claim full matched-page coverage');
  for (const row of data.opportunities) {
    if (!sources.includes(row.ref.source) || row.clientId !== input.clientId) fail('Funding search row scope substitution');
    assertFundingFacts(row, envelope.asOf);
  }
  scopedDeadlineCounts(data.opportunities, data.counts, envelope.asOf);
}
export function assertFundingClientContext(data, envelope, input) {
  if (data.clientId !== input.clientId) fail('Funding client substitution');
  for (const [key, source] of [['topGrants', 'grants_gov'], ['topContracts', 'sam_gov']])
    for (const row of data[key]) if (row.ref.source !== source) fail('Funding top rows source substitution');
  const rows = [...data.topGrants, ...data.topContracts];
  scopedDeadlineCounts(rows, data.counts, envelope.asOf);
  if (data.nextDeadline !== null) {
    deadline(data.nextDeadline, envelope.asOf);
    const earliest = rows.filter(row => row.deadline?.status === 'open' && row.deadline.at !== null)
      .sort((a, b) => a.deadline.at.localeCompare(b.deadline.at))[0]?.deadline;
    if (!earliest || Object.keys(data.nextDeadline).length !== Object.keys(earliest).length ||
        Object.entries(earliest).some(([key, value]) => data.nextDeadline[key] !== value))
      fail('Next deadline must come from the sampled top rows');
  } else if (rows.some(row => row.deadline?.status === 'open' && row.deadline.at !== null))
    fail('Next sampled deadline omitted');
  for (const row of envelope.truncated ?? []) {
    if (!['topGrants', 'topContracts'].includes(row.collection) || row.kept !== 5 || row.kept !== data[row.collection].length)
      fail('Funding top-row truncation mismatch');
  }
}
export function assertFundingLandscape(data, envelope, sources) {
  const reports = new Map(data.sources.map(row => [row.source, row]));
  if (reports.size !== sources.length || data.sources.length !== sources.length || sources.some(source => !reports.has(source)))
    fail('Funding landscape needs every declared source once');
  if (data.sources.every(row => row.state === 'denied')) fail('Denied landscape must be a refusal envelope');
  const wired = new Set(['program_element', 'client_facility', 'congressional_district']);
  for (const row of data.sources) {
    if (row.state === 'denied' || (!wired.has(row.source) && row.state !== 'not_wired') ||
        (row.state === 'available') !== (row.itemCount > 0) ||
        (wired.has(row.source) && !['available', 'empty'].includes(row.state)))
      fail('Funding landscape source state/count mismatch');
  }
  if (data.coverage.available !== data.sources.filter(row => row.state === 'available').length)
    fail('Funding landscape coverage mismatch');
  const total = data.sources.reduce((sum, row) => sum + row.itemCount, 0);
  if (!Number.isSafeInteger(total)) fail('Funding landscape count overflow');
  if (data.items.length !== Math.min(total, 40)) fail('Funding landscape retained item count mismatch');
  const loss = envelope.truncated;
  if (total > 40) {
    if (loss?.length !== 1 || loss[0].collection !== 'items' || loss[0].kept !== 40 || loss[0].total !== total)
      fail('Landscape truncation must preserve pre-truncation counts');
  } else if (loss) fail('Unshortened landscape cannot claim truncation');
  for (const report of data.sources) {
    const kept = data.items.filter(item => item.source === report.source).length;
    if (kept > report.itemCount || total <= 40 && kept !== report.itemCount) fail('Landscape source counts do not cover retained rows');
  }
  // fingerprint names the full ordered packet. No recomputation from the slice
  // can authenticate it, and no producer/current-policy proof is claimed here.
}

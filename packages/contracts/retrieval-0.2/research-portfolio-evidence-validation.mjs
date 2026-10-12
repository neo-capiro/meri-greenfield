/** Projected evidence correlation, not authentication or proof of source truth. */
import { snapshotOperationData } from './operation-contracts.mjs';
import { createResearchPortfolioValidators } from './research-portfolio-validation.mjs';

const operation = 'get_research_evidence';
const fail = () => { throw new Error('Invalid Portfolio evidence projection'); };
const coverageKinds = Object.freeze({review:['exact_review','four_lane_non_atomic'],
  snapshot:['retained_snapshot','retained_snapshot'],
  current_continuity:['current_continuity','current_derived_projection']});
const unique = (rows, key) => { if (new Set(rows.map(row => row[key])).size !== rows.length) fail(); };

export function createResearchPortfolioEvidenceValidators(dependencies) {
  const {validateShape, canonicalSha256} = dependencies;
  const {normalizeResearchPortfolioInput} = createResearchPortfolioValidators(dependencies);
  function normalizeResearchPortfolioEvidenceInput(id, raw, context = {}) {
    if (id !== operation) fail();
    const request = snapshotOperationData(raw);
    validateShape('ResearchPortfolioEvidenceInput', request);
    const selected = normalizeResearchPortfolioInput('get_research_portfolio',
      request.conversationId === undefined ? {} : {conversationId:request.conversationId}, context);
    const input = {...selected, origin:request.origin,
      ...(request.recordId === undefined ? {} : {recordId:request.recordId})};
    validateShape('ResearchPortfolioEvidenceSelection', input);
    return {input, metadata:null};
  }
  function assertResearchPortfolioEvidenceOutput(id, raw, request, context = {}) {
    const {input} = normalizeResearchPortfolioEvidenceInput(id, request, context);
    const page = snapshotOperationData(raw);
    validateShape('ResearchPortfolioEvidenceResult', page);
    if (canonicalSha256(page.binding) !== canonicalSha256(context.binding) ||
        canonicalSha256(page.subject) !== canonicalSha256(context.subject)) fail();
    const value = page.data, kinds = coverageKinds[input.origin];
    if (value.origin !== input.origin || value.portfolioId !== input.portfolioId ||
        value.coverage.scope !== kinds[0] || value.coverage.sourceView !== kinds[1]) fail();
    if (input.recordId !== undefined && value.id !== input.recordId) fail();
    if (value.origin === 'review') {
      for (const [key, stance] of [['evidenceFor','for'],['evidenceAgainst','against']])
        if (value[key].some(item => item.stance !== stance)) fail();
    } else if (value.origin === 'snapshot') {
      unique(value.contributions, 'contributionId');
      // Source hashes and references are preserved claims, never recomputed from
      // this deliberately narrower projection or upgraded to byte verification.
    } else {
      unique(value.items, 'id'); unique(value.items, 'continuityKey');
      if (value.items.some(item => item.portfolioId !== input.portfolioId)) fail();
      for (const [status, count] of Object.entries(value.counts))
        if (count !== value.items.filter(item => item.status === status).length) fail();
      for (const row of value.items) for (const key of ['relevantPeriodStart','relevantPeriodEnd','expiryDate'])
        if (row[key] !== null && !Number.isFinite(Date.parse(row[key]))) fail();
    }
    return page;
  }
  return {normalizeResearchPortfolioEvidenceInput, assertResearchPortfolioEvidenceOutput};
}

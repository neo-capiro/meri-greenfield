// Stored-rule projection consistency only. Observed clocks confer no current authority.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail = message => { throw new Error(message); };
export const RULE_STATUS_OPERATION_IDS = Object.freeze(['get_state_rule_status']);
const clipped = (value, maximum) => typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : null;
const instant = value => {
  const millis = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) fail('Rule status requires canonical serialized instants');
  return millis;
};

export function createRuleStatusValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Rule status validator configuration');
  const constant = name => schema.$defs[name].const;
  const definition = (id, suffix) => {
    if (typeof id !== 'string' || id !== RULE_STATUS_OPERATION_IDS[0]) fail('Unknown rule status operation');
    return `RuleStatus${suffix}`;
  };
  const clocks = options => {
    const context = snapshotOperationData(options); validateShape('RuleStatusContext', context);
    return {stageAsOf: instant(context.stageAsOf), commentAsOf: instant(context.commentAsOf)};
  };
  function normalizeRuleStatusInput(id, request, options = {}) {
    const name = definition(id, 'Request'), raw = snapshotOperationData(request); clocks(options);
    validateShape(name, raw);
    const input = {}, query = clipped(raw.query, 200), state = clipped(raw.state, 2);
    if (query !== null) input.query = query;
    if (state !== null) {
      input.state = state.toUpperCase();
      if (input.state.length > 2) fail('Rule status state normalization exceeds typed bound');
    }
    validateShape(definition(id, 'Input'), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({})});
  }
  function unresolved(page, input) {
    const matches = page.ambiguousMatches;
    if (!input.query) {
      if (matches || page.note !== constant('RuleStatusMissingNote')) fail('Missing rule query must retain explicit refusal');
      return;
    }
    if (!matches) {
      const note = `No rule or notice matched "${input.query}"${input.state ? ` in ${input.state}` : ''}. Say so explicitly — do not describe a rule's status from memory.`;
      if (page.note !== note) fail('No-match rule note must bind the request');
      return;
    }
    let federalSeen = false, stateCount = 0, federalCount = 0;
    const identities = new Set();
    for (const row of matches) {
      if (row.jurisdiction === 'state') {
        stateCount++;
        if (federalSeen || (input.state && row.state !== input.state)) fail('Rule ambiguity state order or selector mismatch');
      } else {
        federalSeen = true; federalCount++;
        if (input.state) fail('Scoped rule search cannot include federal candidates');
      }
      const identity = JSON.stringify([row.jurisdiction, row.id]);
      if (identities.has(identity)) fail('Duplicate rule candidate identity');
      identities.add(identity);
    }
    if (stateCount > 6 || federalCount > 6 || page.note !== `"${input.query}" matches ${matches.length} rules/notices — ask which one (by id) before describing its status.`)
      fail('Rule ambiguity window or clarification mismatch');
  }
  function found(page, input, context) {
    if (!input.query || (input.state && page.jurisdiction !== 'state')) fail('Rule found result violates request scope');
    const state = page.jurisdiction === 'state';
    const dates = [page.publicationDate, page.effectiveDate, page.commentPeriod.start, page.commentPeriod.end];
    if (state) dates.push(page.filingDate);
    for (const value of dates) if (value !== null) {
      instant(value);
      if (state && !value.endsWith('T00:00:00.000Z')) fail('State rule SQLDate must serialize at UTC midnight');
    }
    const end = page.commentPeriod.end === null ? null : instant(page.commentPeriod.end);
    const start = page.commentPeriod.start === null ? null : instant(page.commentPeriod.start);
    const effective = page.effectiveDate === null ? null : instant(page.effectiveDate);
    const type = (page.ruleType ?? '').toUpperCase(), kinds = constant('RuleStatusTypeStages');
    const kind = Object.hasOwn(kinds, type) ? kinds[type] : 'notice';
    const expectedStage = kind === 'proposed'
      ? end !== null && end < context.stageAsOf ? 'comment_closed' : 'nprm'
      : kind === 'final' ? effective !== null && effective <= context.stageAsOf ? 'effective' : 'final' : 'notice';
    if (page.stage !== expectedStage || page.stageLabel !== constant('RuleStatusLabels')[expectedStage]) fail('Rule lifecycle stage or label mismatch');
    const accepting = constant('RuleStatusCommentStages').includes(page.stage);
    const open = accepting && end !== null && end > context.commentAsOf && (start === null || start <= context.commentAsOf);
    if (page.commentPeriod.isOpen !== open) fail('Rule comment window does not match its separate observed clock');
    const needsNote = accepting && end === null;
    if (Object.hasOwn(page, 'note') !== needsNote || (needsNote && page.note !== constant('RuleStatusMissingDeadlineNote')))
      fail('Rule missing-deadline note mismatch');
  }
  function assertRuleStatusOutput(id, value, request, options = {}) {
    const {input} = normalizeRuleStatusInput(id, request, options), context = clocks(options), page = snapshotOperationData(value);
    validateShape(definition(id, 'Output'), page); instant(page.generatedAt);
    if (page.found) found(page, input, context); else unresolved(page, input);
    return page;
  }
  function validateRuleStatusShape(name, value) {
    if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name)) fail('Unknown rule status shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizeRuleStatusInput, assertRuleStatusOutput, validateRuleStatusShape,
    ruleStatusInputDefinition: id => definition(id, 'Input'), ruleStatusOutputDefinition: id => definition(id, 'Output')});
}

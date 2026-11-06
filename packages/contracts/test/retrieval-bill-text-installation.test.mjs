import test from 'node:test';
import assert from 'node:assert/strict';
// Exercise the real eager catalog registration used by the AgentCore entrypoint,
// rather than a bill-only validator with a synthetic catalog assertion.
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {selectSkill} from '../../skills/index.mjs';

test('installed bill search admits an invalid selector outcome and keeps absence distinct', () => {
  const search = resolveOperationContract({id: 'search_congress_bills', version: '0.2.0'});
  const context = {defaultCongress: 119};
  const invalidRequest = search.normalizeInput({query: 'S. 2809x'}, context).request;
  const exactRequest = search.normalizeInput({query: 'S. 999999'}, context).request;
  const page = {tool: 'search_congress_bills', generatedAt: '2026-11-06T12:00:00.000Z',
    data: [], total: 0, page: 1, limit: 20};
  const invalid = {...page, currentStatus: 'invalid_request',
    note: 'Invalid bill designation or conflicting Congress. No bill lookup was performed; provide an exact bill designation and Congress.'};
  const missing = {...page, resolvedBy: 'bill-id'};
  assert.doesNotThrow(() => search.assertOutput(invalid, {...context, request: invalidRequest}));
  assert.doesNotThrow(() => search.assertOutput(missing, {...context, request: exactRequest}));
  assert.throws(() => search.assertOutput(missing, {...context, request: invalidRequest}));
  assert.throws(() => search.assertOutput(invalid, {...context, request: exactRequest}));
});

test('the installed bill-watch skill retains its persisted selection after catalog admission', () => {
  const selected = selectSkill('quick_skill.bill_watch', '1.0.0');
  assert.equal(selected.pin.catalogSha256, '41aed2fc63dc40cafe987ee3059a13b605b7d3796c31f60ed6ca26939954bfcc');
  assert(selected.manifest.allowedOperations.some(operation => operation.id === 'read_bill_text'));
  assert.notEqual(selected.installationCatalogSha256, selected.pin.catalogSha256);
});

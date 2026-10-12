import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const outcomes = JSON.parse(readFileSync(new URL('./pinned-helper-characterization.stdout.txt', import.meta.url)));
const guards = JSON.parse(readFileSync(new URL('./pinned-disposition-characterization.stdout.txt', import.meta.url)));
const ref = 'fd8765ec01d292013758606204f2c9d886cd31c1';

test('pinned real helper retains exact admin vocabulary and firm/client approval differences', () => {
  assert.equal(outcomes.ref, ref);
  assert.deepEqual(outcomes.adminRoles.filter(row => row.admin).map(row => row.role), ['user_admin', 'capiro_admin']);
  for (const role of ['user_admin', 'capiro_admin']) for (const scope of ['firm', 'client'])
    assert.equal(outcomes.rows.find(row => row.role === role && row.scope === scope && row.memoryClass === 'institutional_authoritative' && row.self).decision.allowed, true);
  assert.equal(outcomes.rows.find(row => row.role === 'standard_user' && row.scope === 'firm' && row.memoryClass === 'institutional_authoritative' && !row.self).decision.reason, 'admin_required');
  assert.equal(outcomes.rows.find(row => row.role === 'standard_user' && row.scope === 'client' && row.memoryClass === 'institutional_authoritative' && !row.self).decision.basis, 'explicit_grant');
});

test('helper inputs still require trusted service facts; null fallback is not proven denial', () => {
  const row = label => outcomes.variants.find(value => value.scenario === label).decision;
  assert.equal(row('blocked-wall').reason, 'ethical_wall');
  assert.equal(row('suspended-client').reason, 'archived_client');
  assert.equal(row('archived-client').reason, 'archived_client');
  assert.equal(row('ordinary-other-no-grants').reason, 'missing_grant');
  assert.equal(row('ordinary-self-approve-grant').reason, 'self_review');
  assert.equal(row('admin-impersonating-standard').allowed, false);
  assert.equal(row('standard-impersonating-admin').allowed, true);
  assert.equal(row('impersonation-missing-actor').allowed, true);
  assert.equal(row('missing-client-status').allowed, true);
});

test('actual candidate rule outcomes preserve pending shared and recognized automated review', () => {
  assert.equal(outcomes.proposals.length, 18);
  for (const row of outcomes.proposals) {
    assert.equal(row.outcome, row.scope === 'personal' && row.sourceKind === 'manual' ? 'PASS' : 'WARN');
    if (row.sourceKind === 'model_extraction') assert.equal(row.ruleId, 'memory.model_extraction.requires_review');
    if (row.sourceKind === 'learning_signal') assert.equal(row.ruleId, 'memory.learning_signal.requires_review');
  }
});

test('actual method guards keep approve, reject and withdrawal distinct in all18 scoped cases', () => {
  assert.equal(guards.ref, ref); assert.equal(guards.rows.length, 18);
  for (const row of guards.rows) {
    assert.equal(row.sharedApprovalGuard, row.self && row.scope !== 'user_private' && row.role === 'standard_user' ? 'refused' : 'passed');
    assert.equal(row.independentRejectionGuard, row.self && row.scope !== 'user_private' ? 'refused' : 'passed');
    assert.equal(row.withdrawalGuard, row.self ? 'passed' : 'refused');
    assert.equal(row.terminalCalls, row.self ? 1 : 0); assert.equal(row.withdrawnStatusSelected, row.self);
    assert.equal(row.withdrawalFlagChecks, 1);
  }
});

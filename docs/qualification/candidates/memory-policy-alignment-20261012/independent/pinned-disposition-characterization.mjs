/** Characterize exact local source guards; no legacy service or database is started. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const ref = 'fd8765ec01d292013758606204f2c9d886cd31c1';
const repo = process.env.MEMORY_POLICY_REFERENCE_REPO ?? '/workspace/capirov2';
const prefix = 'apps/api/src/memory/';
const files = {
  'memory-review-admin-policy.ts': 'ce7d9b36b52b7b63d1a8bdcaf0bab2acf3c57187dedc5752a80f8e95f733adc3',
  'memory-candidate.service.ts': '0dd0ed91a682ebb5f1104ebacbb0ae682b1735e1f7e77518b8d7de04dc24bbc9',
  'governed-memory-candidate.service.ts': '00616d8adeaf7631fc5ad467feff8598a23e1dc8e76a60711157d3998324ccb1',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const read = name => {
  const bytes = execFileSync('git', ['-C', repo, 'show', `${ref}:${prefix}${name}`]);
  assert.equal(sha(bytes), files[name]); return bytes.toString('utf8');
};
const fragments = [];
const method = (name, source, async = false) => {
  const start = source.indexOf(` ${name}(`) + 1;
  assert.ok(start > 0);
  const end = source.indexOf('\n  }', start) + 4;
  const content = source.slice(start, end);
  fragments.push({ name, bytes: Buffer.byteLength(content), sha256: sha(content),
    startLine: source.slice(0, start).split('\n').length, endLine: source.slice(0, end).split('\n').length });
  return `${async ? 'async ' : ''}${content}`;
};

try {
  const adminUrl = url(stripTypeScriptTypes(read('memory-review-admin-policy.ts')));
  const candidate = read('memory-candidate.service.ts');
  const governed = read('governed-memory-candidate.service.ts');
  const source = `import {isMemoryReviewAdminRole} from '${adminUrl}';
    class ForbiddenException extends Error {}
    function assertSyntheticCandidateWithdrawalInTx(){throw Error('UNQUALIFIED_DEPENDENCY');}
    export class Probe {
      ${method('requireSharedApprovalPolicy', candidate)}
      ${method('requireGovernedIndependentReviewer', governed)}
      ${method('withdrawPending', governed, true)}
    }`;
  const { Probe } = await import(url(stripTypeScriptTypes(source)));
  const rows = [];
  for (const scope of ['firm', 'client', 'user_private']) for (const role of ['standard_user', 'user_admin', 'capiro_admin'])
    for (const self of [true, false]) {
      const proposedBy = self ? 'synthetic-actor' : 'synthetic-other';
      const probe = new Probe();
      const result = { scope, role, self };
      for (const [operation, run] of [
        ['sharedApprovalGuard', () => probe.requireSharedApprovalPolicy({ scope, proposedBy }, 'synthetic-actor', { userId: 'synthetic-actor', role })],
        ['independentRejectionGuard', () => probe.requireGovernedIndependentReviewer({ scope, proposedBy }, 'synthetic-actor')],
      ]) {
        try { run(); result[operation] = 'passed'; } catch (error) { result[operation] = error.name === 'Error' ? 'refused' : 'unexpected'; }
      }
      let terminalCalls = 0; let selectedStatus; let flagChecks = 0;
      probe.requireWithdrawalEnabled = () => { flagChecks++; };
      probe.governedPrisma = { withTenantUser: async (...args) => args.find(value => typeof value === 'function')({}) };
      probe.lockPendingDispositionCandidateInTx = async () => ({ id: 'synthetic-candidate', scope, proposedBy });
      probe.decideTerminalInTx = async (...args) => { terminalCalls++; selectedStatus = args.find(value => value === 'withdrawn'); };
      try {
        await probe.withdrawPending({ tenantId: 'synthetic-tenant', userId: 'synthetic-actor', role }, 'synthetic-candidate');
        result.withdrawalGuard = 'passed';
      } catch (error) { result.withdrawalGuard = error.name === 'Error' ? 'refused' : 'unexpected'; }
      result.withdrawalFlagChecks = flagChecks; result.terminalCalls = terminalCalls;
      result.withdrawnStatusSelected = selectedStatus === 'withdrawn'; rows.push(result);
      assert.equal(result.sharedApprovalGuard, self && scope !== 'user_private' && role === 'standard_user' ? 'refused' : 'passed');
      assert.equal(result.independentRejectionGuard, self && scope !== 'user_private' ? 'refused' : 'passed');
      assert.equal(result.withdrawalGuard, self ? 'passed' : 'refused');
      assert.equal(flagChecks, 1); assert.equal(terminalCalls, self ? 1 : 0);
      assert.equal(result.withdrawnStatusSelected, self);
    }
  console.log(JSON.stringify({ ref, files, fragments,
    scope: 'Exact method guards only, with isolated constructor-free harness and injected flag/transaction/lock/terminal stubs. Not complete authorization, policy flags, SQL or runtime acceptance.', rows }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'HARNESS_FAILURE', errorType: error?.name ?? 'unknown', code: error?.code ?? null }));
  process.exitCode = 1;
}

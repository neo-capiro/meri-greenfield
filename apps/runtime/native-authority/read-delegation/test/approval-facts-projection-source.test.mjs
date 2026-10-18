import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PLAN, migrationBody} from '../../../../../infra/product-preview/first-chat-migrate.mjs';

const original = readFileSync(new URL('../migrations/0001_read_delegation_facts.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const extension = readFileSync(new URL('../migrations/0002_prepared_approval_facts.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const columns = text => text.slice(text.indexOf('SELECT a.run_id,'), text.indexOf("c.projection->'scopes' AS run_scopes") + "c.projection->'scopes' AS run_scopes".length);
const admission = text => text.slice(text.indexOf('  FROM meri_product_budget.tool_run_allocations a'), text.indexOf(') adm ON true') + ') adm ON true'.length);

test('prepared approval source extends the existing run view without changing original admission', () => {
  assert.equal(columns(extension), columns(original));
  assert.equal(admission(extension), admission(original));
  assert.match(extension, /CREATE OR REPLACE VIEW meri_read_delegation_facts\.run_facts_v1 WITH \(security_barrier = true\)/u);
  assert.match(extension, /c\.projection->'scopes' AS run_scopes,\s*prepared\.prepared_approvals,\s*prepared\.prepared_approvals_overflow/u);
  assert.doesNotMatch(extension, /\bGRANT\b|\bREVOKE\b|current_admission_v1/u);
});

test('correlated approval projection is bounded and contains only the agreed original fields', () => {
  for (const identity of [
    'm.tenant_id = c.tenant_id',
    "m.actor_id = c.projection->'binding'->>'actorId'",
    "m.payload->'record'->'binding'->>'conversationId' = c.conversation_id::text",
    "m.payload->'record'->'binding'->>'runId' = a.run_id::text",
  ]) assert.ok(extension.includes(identity), identity);
  assert.match(extension, /ORDER BY m\.proposal_id\s+LIMIT 65/u);
  assert.match(extension, /FILTER \(WHERE q\.ordinal <= 64\)/u);
  assert.match(extension, /count\(\*\) > 64 AS prepared_approvals_overflow/u);
  const record = extension.slice(extension.indexOf("'record', jsonb_build_object("), extension.indexOf(')) ORDER BY q.proposal_id'));
  assert.deepEqual([...record.matchAll(/'([A-Za-z]+)', q\.payload->'record'->'([A-Za-z]+)'/gu)].map(x => [x[1], x[2]]), [
    ['proposalId', 'proposalId'], ['commandId', 'commandId'], ['idempotencyKey', 'idempotencyKey'],
    ['createdAt', 'createdAt'], ['expiresAt', 'expiresAt'], ['requiredApprover', 'requiredApprover'],
    ['binding', 'binding'], ['scopes', 'scopes'],
  ]);
  assert.doesNotMatch(record, /request|inputSha256|commandContext|arguments|attachments/u);
});

test('allocated source is pinned after original facts and before integration grants', () => {
  const source = readFileSync(new URL('../migrations/0002_prepared_approval_facts.sql', import.meta.url));
  const index = PLAN.findIndex(e => e.path.endsWith('/0002_prepared_approval_facts.sql'));
  assert.ok(index > 0);
  assert.ok(PLAN[index - 1].path.endsWith('/0001_read_delegation_facts.sql'));
  assert.equal(PLAN[index + 1].kind, 'phase:integration_grants');
  assert.equal(PLAN[index].stage, 'integration');
  assert.equal(PLAN[index].pinned, createHash('sha256').update(source).digest('hex'));
  assert.equal(migrationBody(extension).includes('CREATE OR REPLACE VIEW meri_read_delegation_facts.run_facts_v1'), true);
  assert.match(extension, /CREATE INDEX approval_metadata_run_facts_idx\s+ON meri_commands\.approval_metadata/u);
});

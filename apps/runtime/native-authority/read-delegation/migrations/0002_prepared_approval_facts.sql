-- SOURCE-ONLY allocated integration migration. Extend the existing, already granted run facts view with a bounded
-- projection of Meri's original prepared approval metadata. Requires 0001 and the Meri
-- approval-metadata table. No new role, grant, function or Core admission predicate.
-- Registered in first-chat-migrate.mjs PLAN after facts 0001 and approval metadata 0001.
-- No live SQL apply or runtime readback is implied by source registration.
BEGIN;
CREATE INDEX approval_metadata_run_facts_idx
  ON meri_commands.approval_metadata
  (tenant_id, actor_id,
   ((payload->'record'->'binding'->>'conversationId')),
   ((payload->'record'->'binding'->>'runId')),
   proposal_id);
CREATE OR REPLACE VIEW meri_read_delegation_facts.run_facts_v1 WITH (security_barrier = true) AS
SELECT a.run_id,
       c.tenant_id,
       c.conversation_id,
       a.allocation_sha256,
       a.allocation->'manifest'->'allowedOperations' AS allowed_operations,
       a.max_tool_calls,
       LEAST(a.started_at + make_interval(secs => (a.allocation->'budgets'->>'maxRuntimeSeconds')::double precision),
             (a.allocation->'schedule'->>'expiresAt')::timestamptz) AS run_deadline,
       (SELECT count(*) FROM meri_product_budget.tool_reservations t WHERE t.run_id = a.run_id) AS reserved_calls,
       r.attempt,
       r.fence,
       r.policy_revision,
       COALESCE((SELECT NOT b.quarantined FROM meri_product_budget.budget b WHERE b.id = 1), false) AND COALESCE(adm.admitted, false) AS admitted,
       LEAST(a.started_at + make_interval(secs => (a.allocation->'budgets'->>'maxRuntimeSeconds')::double precision),
             (a.allocation->'schedule'->>'expiresAt')::timestamptz, adm.record_until, adm.grants_until) AS admitted_until,
       c.projection->>'state' AS run_state,
       c.projection->'binding' AS run_binding,
       c.projection->'scopes' AS run_scopes,
       prepared.prepared_approvals,
       prepared.prepared_approvals_overflow
  FROM meri_product_budget.tool_run_allocations a
  JOIN meri_product_budget.runs r ON r.run_id = a.run_id
  JOIN meri_conversations.runs c ON c.run_id = a.run_id
  LEFT JOIN LATERAL (
   SELECT n.record->>'state' = 'ADMITTED'
          AND n.record->'binding' = c.projection->'binding'
          AND r.worker_arn = n.record->'resource'->>'taskArn'
          AND n.record->>'allocationSha256' = a.allocation_sha256
          AND (n.record->'qualification'->>'attempt')::integer = r.attempt
          AND (n.record->'binding'->>'writerFence')::integer = r.fence
          AND n.record->'qualification'->>'policyRevision' = r.policy_revision
          AND jsonb_array_length(n.record->'grantIntents') >= 1
          AND jsonb_array_length(n.record->'resource'->'grantFactsJsons') = jsonb_array_length(n.record->'grantIntents')
          AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(n.record->'grantIntents') gi
            WHERE NOT EXISTS (
             SELECT 1 FROM meri_product_budget.grants g
               JOIN meri_product_budget.tool_grant_bindings gb ON gb.grant_id = g.grant_id AND gb.run_id = a.run_id
              WHERE g.grant_id::text = gi->>'grantId' AND g.run_id = a.run_id AND g.state = 'ACTIVE'
                AND g.capability_sha256 = gi->>'capabilitySha256' AND g.attempt = r.attempt AND g.fence = r.fence
                AND g.policy_revision = r.policy_revision AND g.worker_arn = n.record->'resource'->>'taskArn'
                AND g.expires_at > clock_timestamp()
                AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(n.record->'resource'->'grantFactsJsons') f(fact)
                             WHERE f.fact::jsonb->>'grantId' = gi->>'grantId' AND f.fact::jsonb = gb.facts))) AS admitted,
          to_timestamp((n.record->>'expiresAtMs')::double precision / 1000) AS record_until,
          (SELECT min(g.expires_at) FROM meri_product_budget.grants g
            WHERE g.grant_id::text IN (SELECT gi->>'grantId' FROM jsonb_array_elements(n.record->'grantIntents') gi)) AS grants_until
     FROM meri_conversations.native_allocations n
    WHERE n.tenant_id = c.tenant_id AND n.conversation_id = c.conversation_id AND n.run_id = a.run_id) adm ON true
  LEFT JOIN LATERAL (
   SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'proposal_id', q.proposal_id::text,
            'command_id', q.command_id::text,
            'idempotency_key', q.idempotency_key,
            'command_sha256', q.command_sha256,
            'record', jsonb_build_object(
              'proposalId', q.payload->'record'->'proposalId',
              'commandId', q.payload->'record'->'commandId',
              'idempotencyKey', q.payload->'record'->'idempotencyKey',
              'createdAt', q.payload->'record'->'createdAt',
              'expiresAt', q.payload->'record'->'expiresAt',
              'requiredApprover', q.payload->'record'->'requiredApprover',
              'binding', q.payload->'record'->'binding',
              'scopes', q.payload->'record'->'scopes')) ORDER BY q.proposal_id)
           FILTER (WHERE q.ordinal <= 64), '[]'::jsonb) AS prepared_approvals,
          count(*) > 64 AS prepared_approvals_overflow
     FROM (
      SELECT m.*, row_number() OVER (ORDER BY m.proposal_id) AS ordinal
        FROM (
         SELECT m.proposal_id, m.command_id, m.idempotency_key, m.command_sha256, m.payload
           FROM meri_commands.approval_metadata m
          -- Relational tenant/actor are independent of the stored record: Core compares
          -- the full original binding and rejects any disagreement instead of hiding it.
          WHERE m.tenant_id = c.tenant_id
            AND m.actor_id = c.projection->'binding'->>'actorId'
            AND m.payload->'record'->'binding'->>'conversationId' = c.conversation_id::text
            AND m.payload->'record'->'binding'->>'runId' = a.run_id::text
          ORDER BY m.proposal_id
          LIMIT 65
        ) m
     ) q
  ) prepared ON true;
COMMIT;

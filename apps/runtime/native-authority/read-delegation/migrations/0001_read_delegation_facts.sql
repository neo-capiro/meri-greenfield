-- SOURCE ONLY. Run-bound read delegation (RC1 option B, D016-A 4): the owner-backed facts Core verifies at every delegation
-- create, token issue, token use and response release (FABLE-RUN-BOUND-READ-DELEGATION-20261018.md §4; dot 6246089074 #1).
-- Core never trusts a caller digest for allocation, operations, deadline, allowance, fence or run state: it reads these
-- read-only views of Meri's own owner tables in the same transaction as each check. Row existence is never authority: Core
-- requires `admitted` and now < `admitted_until` (dot 6249255722).
--  - `admitted` is Meri's canonical current-admission predicate (admitted-run-current.mjs readCurrentAdmission) over the EXACT
--    ORIGINAL admitted set: the run's saved ADMITTED allocation record (meri_conversations.native_allocations) declares every
--    original grant (record.grantIntents) and its exact stored facts (record.resource.grantFactsJsons, bound to the launched
--    task ARN). Every declared grant must be ACTIVE, unexpired, of this run's attempt, fence, policy, capability digest and
--    worker ARN, and bound to the run by a tool_grant_bindings row whose facts equal the stored facts; the budget must not be
--    quarantined and the record's allocation digest must be the installed allocation's. Any other grant (a later execution
--    grant, or a surviving sibling) never substitutes for a missing, revoked or expired declared grant.
--  - `admitted_until` is the earliest of the run deadline, the record's own expiry and every declared grant's expiry.
-- A revoked grant (Meri admission revoke sets grants.state = 'REVOKED') or a quarantined budget ends delegated authority at the
-- next issue, use or release.
--  - run_facts_v1: the run's installed allocation (sha256, allowed operations, call allowance, deadline), Meri's reserved-call
--    count (the same count the budget owner checks before every reservation), the attempt/fence/policy of the run's grant
--    owner, and the run's current state, binding and scopes.
--  - reservations_v1: the tool reservation a `tool` token must match (UNKNOWN, same run, operation and arguments hash).
--  - occurrences_v1 / schedules_v1: an unattended delegation's occurrence (DISPATCHED, for exactly this run binding) and the
--    schedule projection its consent was given for (owner actor, generation, projection sha256).
-- Only the product namespace is exposed: qualification runs never get a delegation. No row data is copied.
-- CREATE only: no existing object is altered or dropped. Requires the conversation and budget migrations (meri stage) and
-- schedules 0001-0002 (integration stage). Run as meri_product_migrator, the owner of every base schema read here.
-- Operator-applied in the 'integration' stage only; no roles, grants, credentials or keys are supplied here (the Core API
-- runtime role's USAGE/SELECT grant is in the integration grants phase).
BEGIN;
CREATE SCHEMA meri_read_delegation_facts;
REVOKE ALL ON SCHEMA meri_read_delegation_facts FROM PUBLIC;
CREATE VIEW meri_read_delegation_facts.run_facts_v1 WITH (security_barrier = true) AS
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
       c.projection->'scopes' AS run_scopes
  FROM meri_product_budget.tool_run_allocations a
  JOIN meri_product_budget.runs r ON r.run_id = a.run_id
  JOIN meri_conversations.runs c ON c.run_id = a.run_id
  LEFT JOIN LATERAL (
   SELECT n.record->>'state' = 'ADMITTED'
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
    WHERE n.tenant_id = c.tenant_id AND n.conversation_id = c.conversation_id AND n.run_id = a.run_id) adm ON true;
CREATE VIEW meri_read_delegation_facts.reservations_v1 WITH (security_barrier = true) AS
SELECT invocation_id, run_id, operation, arguments_sha256, state
  FROM meri_product_budget.tool_reservations;
CREATE VIEW meri_read_delegation_facts.occurrences_v1 WITH (security_barrier = true) AS
SELECT tenant_id, occurrence_key, schedule_id, generation, state, effect->'binding' AS run_binding, created_at
  FROM meri_schedules.occurrences;
CREATE VIEW meri_read_delegation_facts.schedules_v1 WITH (security_barrier = true) AS
SELECT tenant_id, schedule_id, owner_actor_id, generation, projection_sha256
  FROM meri_schedules.projections;
COMMIT;

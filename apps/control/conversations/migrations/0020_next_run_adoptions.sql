-- Centrally allocated 0020, source only. Install in the integration stage after
-- conversations 0001-0019 and product budget 0001-0002. This migration must not
-- be applied on a database lacking either budget table family: an absent cross-
-- owner claim store is not evidence that a reserved target is unused.
--
-- The existing conversation transaction locks hashtextextended(tenant:conversation,0).
-- Every first-write path below takes that same lock before testing the adoption.
-- Adoption checks claims without taking budget row locks: product budget writers
-- may already hold those locks before entering their INSERT trigger.
-- transition_sha256 is an atomic stale-writer fence, not the effective descriptor
-- digest. The trusted issuer/budget owner must read the current accepted Run and
-- readEffectiveFromClient descriptor before granting or dispatching authority.
-- Application roles must not receive TRUNCATE or table ownership on claim rows.
BEGIN;
DO $$ BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_READ_COMMITTED_REQUIRED';
 END IF;
 IF to_regclass('meri_conversations.initial_run_bindings') IS NULL
    OR to_regclass('meri_conversations.next_runs') IS NULL
    OR to_regclass('meri_conversations.run_issuances') IS NULL
    OR to_regclass('meri_conversations.model_run_issuances') IS NULL
    OR to_regclass('meri_conversations.native_allocations') IS NULL
    OR to_regclass('meri_conversations.native_executions') IS NULL
    OR to_regclass('meri_conversations.native_restorations') IS NULL
    OR to_regclass('meri_conversations.retention_subjects') IS NULL
    OR to_regclass('meri_conversations.retention_purges') IS NULL
    OR to_regclass('meri_product_budget.runs') IS NULL
    OR to_regclass('meri_product_budget.tenant_run_reservations') IS NULL
    OR to_regclass('meri_product_budget.tool_run_allocations') IS NULL
    OR to_regclass('meri_product_budget.grants') IS NULL
    OR to_regclass('meri_product_budget.tool_grant_bindings') IS NULL
    OR to_regclass('meri_product_budget.requests') IS NULL
    OR to_regclass('meri_product_budget.tool_reservations') IS NULL
    OR to_regclass('meri_product_budget.tool_invocations') IS NULL THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_DEPENDENCY_MISSING';
 END IF;
END $$;
-- Drain in-flight pre-trigger INSERTs. These locks are held through index
-- builds and trigger registration, so no writer can commit in the unchecked
-- installation interval. Nonconcurrent index builds are deliberate: 0020 is
-- one atomic installation and needs a controlled write pause/lock-timeout plan.
LOCK TABLE meri_conversations.next_runs, meri_conversations.initial_run_bindings,
 meri_conversations.runs,
 meri_conversations.run_issuances, meri_conversations.model_run_issuances,
 meri_conversations.native_allocations, meri_conversations.native_executions,
 meri_conversations.native_restorations,
 meri_product_budget.runs, meri_product_budget.tenant_run_reservations,
 meri_product_budget.tool_run_allocations, meri_product_budget.grants,
 meri_product_budget.tool_grant_bindings,
 meri_product_budget.requests, meri_product_budget.tool_reservations,
 meri_product_budget.tool_invocations IN SHARE ROW EXCLUSIVE MODE;

-- Product budget 0001 identifies a run by UUID alone. Its first-write guard
-- resolves that UUID against all three conversation locators; leading tenant
-- indexes cannot bound these lookups. The INCLUDE fields avoid a second heap
-- read when visibility permits without imposing a new global-UUID uniqueness
-- rule on historical rows.
CREATE INDEX next_run_adoption_next_target_uuid_idx
 ON meri_conversations.next_runs (target_run_id) INCLUDE (tenant_id,conversation_id);
CREATE INDEX next_run_adoption_run_uuid_idx
 ON meri_conversations.runs (run_id) INCLUDE (tenant_id,conversation_id);
CREATE INDEX next_run_adoption_initial_uuid_idx
 ON meri_conversations.initial_run_bindings (run_id) INCLUDE (tenant_id,conversation_id);
-- The adoption absence and source-grant census use run_id alone. Budget 0001
-- already has run_id PRIMARY KEY on runs/tool_run_allocations and a leading
-- run_id UNIQUE index on tool_invocations(run_id,producer_key_sha256).
CREATE INDEX next_run_adoption_tenant_reservation_run_idx
 ON meri_product_budget.tenant_run_reservations (run_id);
CREATE INDEX next_run_adoption_grant_run_idx ON meri_product_budget.grants (run_id);
CREATE INDEX next_run_adoption_tool_grant_binding_run_idx
 ON meri_product_budget.tool_grant_bindings (run_id);
CREATE INDEX next_run_adoption_request_run_idx ON meri_product_budget.requests (run_id);
CREATE INDEX next_run_adoption_tool_reservation_run_idx
 ON meri_product_budget.tool_reservations (run_id);

CREATE TABLE meri_conversations.next_run_adoptions (
 tenant_id text NOT NULL, conversation_id uuid NOT NULL, target_run_id uuid NOT NULL,
 receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
 receipt_sha256 text NOT NULL CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (tenant_id,conversation_id,target_run_id),
 UNIQUE (receipt_sha256),
 FOREIGN KEY (tenant_id,conversation_id,target_run_id)
  REFERENCES meri_conversations.next_runs(tenant_id,conversation_id,target_run_id)
);

-- The transition SHA is null for the original lineage. An adopted target and
-- all its descendants must carry the exact immutable adoption receipt SHA.
ALTER TABLE meri_conversations.runs ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_conversations.run_issuances ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_conversations.model_run_issuances ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_conversations.native_allocations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_conversations.native_executions ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_conversations.native_restorations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.runs ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.tenant_run_reservations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.tool_run_allocations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.grants ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.requests ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.tool_reservations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.tool_invocations ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE meri_product_budget.tool_grant_bindings ADD COLUMN transition_sha256 text
 CHECK (transition_sha256 IS NULL OR transition_sha256 ~ '^[a-f0-9]{64}$');

CREATE FUNCTION meri_conversations.adoption_transition_for_run(
 p_tenant text,p_conversation uuid,p_run uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cursor_run uuid := p_run; predecessor uuid; transition text;
        seen uuid[] := ARRAY[]::uuid[]; depth integer := 0;
BEGIN
 LOOP
  IF cursor_run = ANY(seen) OR depth >= 1024 THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_LINEAGE_CORRUPT';
  END IF;
  seen := array_append(seen,cursor_run); depth := depth + 1;
  SELECT n.source_run_id INTO predecessor
   FROM meri_conversations.next_runs n
   WHERE n.tenant_id=p_tenant AND n.conversation_id=p_conversation
     AND n.target_run_id=cursor_run;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT a.receipt_sha256 INTO transition
   FROM meri_conversations.next_run_adoptions a
   WHERE a.tenant_id=p_tenant AND a.conversation_id=p_conversation
     AND a.target_run_id=cursor_run;
  IF FOUND THEN RETURN transition; END IF;
  cursor_run := predecessor;
 END LOOP;
END $$;

CREATE FUNCTION meri_conversations.guard_adopted_claim(
 p_tenant text,p_conversation uuid,p_run uuid,p_transition text,
 p_acceptance_insert boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE expected text; reserved_state text; reserved_binding jsonb;
        accepted_binding jsonb; accepted_transition text;
BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_READ_COMMITTED_REQUIRED';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(p_tenant || ':' || p_conversation::text,0));
 -- A reserved successor means the source was terminal and its task retired or
 -- foreclosed. No new authority or budget first write may resurrect it. Existing
 -- rows still settle/update in place, preserving UNKNOWN liability and Stop.
 IF EXISTS (SELECT 1 FROM meri_conversations.next_runs n
   WHERE n.tenant_id=p_tenant AND n.conversation_id=p_conversation
     AND n.source_run_id=p_run) THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_SOURCE_SUPERSEDED';
 END IF;
 expected := meri_conversations.adoption_transition_for_run(p_tenant,p_conversation,p_run);
 IF p_transition IS DISTINCT FROM expected THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_TRANSITION_REFUSED';
 END IF;
 -- The accepted Run is the authority junction. Before it exists, the one
 -- permitted adopted-target first write is that Run INSERT itself. A correct
 -- receipt SHA never licenses task, native or product work on RESERVED alone.
 IF expected IS NOT NULL THEN
  SELECT n.state,n.reservation->'target',r.projection->'binding',r.transition_sha256
   INTO reserved_state,reserved_binding,accepted_binding,accepted_transition
   FROM meri_conversations.next_runs n
   LEFT JOIN meri_conversations.runs r ON r.tenant_id=n.tenant_id
     AND r.conversation_id=n.conversation_id AND r.run_id=n.target_run_id
   WHERE n.tenant_id=p_tenant AND n.conversation_id=p_conversation
     AND n.target_run_id=p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_ACCEPTANCE_MISSING'; END IF;
  IF p_acceptance_insert THEN
   IF reserved_state <> 'RESERVED' OR accepted_binding IS NOT NULL THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED';
   END IF;
  ELSIF reserved_state <> 'ACCEPTED'
      OR accepted_binding IS DISTINCT FROM reserved_binding
      OR accepted_transition IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED';
  END IF;
 END IF;
END $$;

-- Product budget 0001 uses run_id alone. An original binding, accepted run or
-- reserved target must exist BEFORE every new product row, even without adoption:
-- allowing an unlocated row to commit later could race a future reservation of
-- that UUID. Never choose a tenant by guess; any locator collision is a HOLD.
CREATE FUNCTION meri_conversations.guard_adopted_product_claim(
 p_run uuid,p_transition text,p_tenant text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE matching bigint; tenants text[]; conversations uuid[];
BEGIN
 SELECT count(*),array_agg(k.tenant_id),array_agg(k.conversation_id)
  INTO matching,tenants,conversations
  FROM (
   SELECT n.tenant_id,n.conversation_id FROM meri_conversations.next_runs n
    WHERE n.target_run_id=p_run
   UNION
   SELECT r.tenant_id,r.conversation_id FROM meri_conversations.runs r
    WHERE r.run_id=p_run
   UNION
   SELECT i.tenant_id,i.conversation_id FROM meri_conversations.initial_run_bindings i
    WHERE i.run_id=p_run
  ) AS k;
 IF matching > 1 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_PRODUCT_RUN_AMBIGUOUS'; END IF;
 IF matching = 0 THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_PRODUCT_RUN_UNBOUND';
 END IF;
 IF p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM tenants[1] THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_PRODUCT_TENANT_REFUSED';
 END IF;
 PERFORM meri_conversations.guard_adopted_claim(
  tenants[1],conversations[1],p_run,p_transition);
END $$;

CREATE FUNCTION meri_conversations.guard_conversation_claim_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE adopted_versions jsonb; reserved_binding jsonb; reserved_state text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_DELETE_REFUSED'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.transition_sha256)
     IS DISTINCT FROM
     (OLD.tenant_id,OLD.conversation_id,OLD.run_id,OLD.transition_sha256) THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
  END IF;
  IF TG_TABLE_NAME='runs' THEN
   IF NEW.projection->'binding' IS DISTINCT FROM OLD.projection->'binding'
      OR NEW.projection->'versions' IS DISTINCT FROM OLD.projection->'versions' THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_BINDING_IMMUTABLE';
   END IF;
  END IF;
  IF TG_TABLE_NAME IN ('run_issuances','model_run_issuances') THEN
   IF NEW.binding IS DISTINCT FROM OLD.binding THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_BINDING_IMMUTABLE';
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 -- 0011 predates the explicit binding/scalar CHECK added in 0015. Enforce it
 -- here for both task and model rows so a false locator cannot evade absence.
 IF TG_TABLE_NAME IN ('run_issuances','model_run_issuances') THEN
  IF NEW.binding->>'tenantId' IS DISTINCT FROM NEW.tenant_id
      OR NEW.binding->>'conversationId' IS DISTINCT FROM NEW.conversation_id::text
      OR NEW.binding->>'runId' IS DISTINCT FROM NEW.run_id::text THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_BINDING_REFUSED';
  END IF;
 END IF;
 PERFORM meri_conversations.guard_adopted_claim(
  NEW.tenant_id,NEW.conversation_id,NEW.run_id,NEW.transition_sha256,
  TG_TABLE_NAME='runs');
 IF TG_TABLE_NAME='runs' AND NEW.transition_sha256 IS NOT NULL THEN
  SELECT n.state,n.reservation->'target' INTO reserved_state,reserved_binding
   FROM meri_conversations.next_runs n WHERE n.tenant_id=NEW.tenant_id
    AND n.conversation_id=NEW.conversation_id AND n.target_run_id=NEW.run_id;
  IF reserved_state <> 'RESERVED' OR NEW.projection->'binding' IS DISTINCT FROM reserved_binding THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED';
  END IF;
 END IF;
 IF TG_TABLE_NAME='runs' AND NEW.transition_sha256 IS NOT NULL THEN
  SELECT a.receipt->'toVersions' INTO adopted_versions
   FROM meri_conversations.next_run_adoptions a
   WHERE a.receipt_sha256=NEW.transition_sha256 AND a.target_run_id=NEW.run_id;
  IF adopted_versions IS NOT NULL AND NEW.projection->'versions' IS DISTINCT FROM adopted_versions THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_VERSIONS_REFUSED';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER adoption_run_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.runs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();
CREATE TRIGGER adoption_task_issuance_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.run_issuances
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();
CREATE TRIGGER adoption_model_issuance_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.model_run_issuances
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();
CREATE TRIGGER adoption_native_allocation_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.native_allocations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();
CREATE TRIGGER adoption_native_execution_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.native_executions
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();
CREATE TRIGGER adoption_native_restoration_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations.native_restorations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_conversation_claim_transition();

CREATE FUNCTION meri_conversations.guard_product_claim_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_DELETE_REFUSED'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.run_id IS DISTINCT FROM OLD.run_id
     OR NEW.transition_sha256 IS DISTINCT FROM OLD.transition_sha256 THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
  END IF;
  IF TG_TABLE_NAME='tenant_run_reservations' THEN
   IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
   END IF;
  ELSIF TG_TABLE_NAME='grants' OR TG_TABLE_NAME='tool_grant_bindings' THEN
   IF NEW.grant_id IS DISTINCT FROM OLD.grant_id THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
   END IF;
  ELSIF TG_TABLE_NAME='requests' THEN
   IF NEW.request_id IS DISTINCT FROM OLD.request_id
      OR NEW.grant_id IS DISTINCT FROM OLD.grant_id THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
   END IF;
  ELSIF TG_TABLE_NAME='tool_reservations' THEN
   IF NEW.invocation_id IS DISTINCT FROM OLD.invocation_id
      OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
      OR NEW.grant_id IS DISTINCT FROM OLD.grant_id THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
   END IF;
  ELSIF TG_TABLE_NAME='tool_invocations' THEN
   IF NEW.invocation_id IS DISTINCT FROM OLD.invocation_id THEN
    RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE';
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='tenant_run_reservations' THEN
  PERFORM meri_conversations.guard_adopted_product_claim(NEW.run_id,NEW.transition_sha256,NEW.tenant_id);
 ELSE
  PERFORM meri_conversations.guard_adopted_product_claim(NEW.run_id,NEW.transition_sha256);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER adoption_product_run_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.runs
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_tenant_reservation_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.tenant_run_reservations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_tool_allocation_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.tool_run_allocations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_product_grant_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.grants
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_product_request_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.requests
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_tool_reservation_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.tool_reservations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_tool_invocation_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.tool_invocations
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();
CREATE TRIGGER adoption_tool_grant_binding_claim BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget.tool_grant_bindings
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_product_claim_transition();

CREATE FUNCTION meri_conversations.guard_next_run_adoption_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE reserved meri_conversations.next_runs%ROWTYPE;
        original meri_conversations.initial_run_bindings%ROWTYPE;
        source_run meri_conversations.runs%ROWTYPE;
        source_allocation meri_conversations.native_allocations%ROWTYPE;
        source_grants text[]; receipt_grants text[]; budget_grants text[];
        adopted_at numeric; checked_at numeric; authority_expiry numeric; valid_until numeric;
        db_now_ms numeric;
BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_READ_COMMITTED_REQUIRED';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(NEW.tenant_id || ':' || NEW.conversation_id::text,0));
 SELECT * INTO reserved FROM meri_conversations.next_runs n
  WHERE n.tenant_id=NEW.tenant_id AND n.conversation_id=NEW.conversation_id
    AND n.target_run_id=NEW.target_run_id FOR UPDATE;
 IF NOT FOUND OR reserved.state <> 'RESERVED'
    OR reserved.reservation->'facts'->'checkpoint' IS DISTINCT FROM 'null'::jsonb
    OR NEW.receipt->'target' IS DISTINCT FROM reserved.reservation->'target'
    OR NEW.receipt->'source' IS DISTINCT FROM reserved.reservation->'source'
    OR NEW.receipt->>'reservationSha256' IS DISTINCT FROM reserved.reservation_sha256
    OR NEW.receipt->'fromVersions' IS DISTINCT FROM reserved.reservation->'versions'
    OR NEW.receipt->'scopes' IS DISTINCT FROM reserved.reservation->'scopes'
    OR NEW.receipt->>'policyRevision' IS DISTINCT FROM reserved.reservation->>'policyRevision'
    OR NEW.receipt->>'fromConfigurationSha256' IS NOT DISTINCT FROM NEW.receipt->>'toConfigurationSha256'
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_RESERVATION_REFUSED'; END IF;
 IF EXISTS (SELECT 1 FROM meri_conversations.next_run_adoptions a
    WHERE a.tenant_id=NEW.tenant_id AND a.conversation_id=NEW.conversation_id) THEN
  RAISE EXCEPTION 'NEXT_RUN_ADOPTION_SECOND_TRANSITION_HOLD';
 END IF;
 SELECT * INTO original FROM meri_conversations.initial_run_bindings i
  WHERE i.tenant_id=NEW.tenant_id AND i.conversation_id=NEW.conversation_id;
 IF NOT FOUND OR NEW.receipt->>'originalAdmissionSha256' IS DISTINCT FROM original.record_sha256
    OR NEW.receipt->>'fromConfigurationSha256' IS DISTINCT FROM original.record->>'configurationSha256'
    OR NEW.receipt->>'selectedClientId' IS DISTINCT FROM original.record->>'selectedClientId'
    OR NEW.receipt->>'policyRevision' IS DISTINCT FROM original.record->>'policyRevision'
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_ORIGINAL_REFUSED'; END IF;
 SELECT * INTO source_run FROM meri_conversations.runs r
  WHERE r.tenant_id=NEW.tenant_id AND r.conversation_id=NEW.conversation_id
    AND r.run_id=reserved.source_run_id;
 IF NOT FOUND OR source_run.projection->>'state' NOT IN ('failed','cancelled')
    OR source_run.projection->'binding' IS DISTINCT FROM reserved.reservation->'source'
    OR source_run.projection->'versions' IS DISTINCT FROM reserved.reservation->'versions'
    OR EXISTS (SELECT 1 FROM meri_conversations.runs later
       WHERE later.tenant_id=NEW.tenant_id AND later.conversation_id=NEW.conversation_id
         AND later.projection#>>'{binding,writerFence}' IS NOT NULL
         AND (later.projection#>>'{binding,writerFence}')::numeric >
             (source_run.projection#>>'{binding,writerFence}')::numeric)
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_SOURCE_REFUSED'; END IF;
 SELECT * INTO source_allocation FROM meri_conversations.native_allocations a
  WHERE a.tenant_id=NEW.tenant_id AND a.conversation_id=NEW.conversation_id
    AND a.run_id=reserved.source_run_id;
 IF NOT FOUND OR source_allocation.record->'binding' IS DISTINCT FROM reserved.reservation->'source'
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_SOURCE_ALLOCATION_MISSING'; END IF;
 IF reserved.reservation->'facts' ? 'noAuthority' THEN
  IF source_allocation.record->>'state' <> 'FORECLOSED'
     OR source_allocation.record_sha256 IS DISTINCT FROM reserved.reservation#>>'{facts,noAuthority,foreclosureSha256}'
     OR source_allocation.record#>>'{foreclosure,state}' IS DISTINCT FROM source_run.projection->>'state'
     OR EXISTS (SELECT 1 FROM meri_conversations.run_issuances i
       WHERE i.tenant_id=NEW.tenant_id AND i.conversation_id=NEW.conversation_id
         AND i.run_id=reserved.source_run_id)
     OR EXISTS (SELECT 1 FROM meri_conversations.model_run_issuances i
       WHERE i.tenant_id=NEW.tenant_id AND i.conversation_id=NEW.conversation_id
         AND i.run_id=reserved.source_run_id)
     OR EXISTS (SELECT 1 FROM meri_product_budget.runs r
       WHERE r.run_id=reserved.source_run_id)
     OR EXISTS (SELECT 1 FROM meri_product_budget.grants g
       WHERE g.run_id=reserved.source_run_id) THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_FORECLOSURE_REFUSED';
  END IF;
 ELSE
  IF source_allocation.record->>'state' <> 'RETIRED'
     OR source_allocation.record#>'{original,binding}' IS DISTINCT FROM reserved.reservation->'source'
     OR source_allocation.record#>'{resource,physicalStopProven}' IS DISTINCT FROM 'true'::jsonb
     OR reserved.reservation#>'{facts,retirement,physicalStopProven}' IS DISTINCT FROM 'true'::jsonb
  THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_RETIREMENT_REFUSED'; END IF;
  SELECT array_agg(x.grant_fact->>'grantId' ORDER BY x.grant_fact->>'grantId') INTO source_grants
   FROM pg_catalog.jsonb_array_elements(source_allocation.record->'grantIntents') AS x(grant_fact);
  SELECT array_agg(x.grant_id ORDER BY x.grant_id) INTO receipt_grants
   FROM pg_catalog.jsonb_array_elements_text(reserved.reservation#>'{facts,revocation,grantIds}') AS x(grant_id);
  SELECT array_agg(g.grant_id::text ORDER BY g.grant_id::text) INTO budget_grants
   FROM meri_product_budget.grants g WHERE g.run_id=reserved.source_run_id;
  IF source_grants IS NULL OR source_grants IS DISTINCT FROM receipt_grants
     OR source_grants IS DISTINCT FROM budget_grants
     OR EXISTS (SELECT 1 FROM meri_product_budget.grants g
       WHERE g.run_id=reserved.source_run_id AND g.state <> 'REVOKED') THEN
   RAISE EXCEPTION 'NEXT_RUN_ADOPTION_REVOCATION_REFUSED';
  END IF;
 END IF;
 -- Source UNKNOWN model/tool reservations and HELD/RELEASED tenant holds are
 -- retained liabilities. They remain untouched and the canonical budget owner
 -- counts them when the new target seeks admission. Physical Stop/FORECLOSED
 -- and no active grant are the adoption-side no-new-effect boundary.
 IF EXISTS (SELECT 1 FROM meri_product_budget.grants g
       WHERE g.run_id=reserved.source_run_id AND g.state<>'REVOKED')
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_SOURCE_GRANT_ACTIVE'; END IF;
 -- A suppressed or in-progress retention subject cannot start a new run.
 IF EXISTS (SELECT 1 FROM meri_conversations.retention_subjects s
       WHERE s.tenant_id=NEW.tenant_id AND s.conversation_id=NEW.conversation_id
         AND s.state='SUPPRESSED')
    OR EXISTS (SELECT 1 FROM meri_conversations.retention_purges p
       WHERE p.tenant_id=NEW.tenant_id AND p.conversation_id=NEW.conversation_id
         AND p.state IN ('PLANNED','UNKNOWN'))
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_RETENTION_HOLD'; END IF;
 IF jsonb_typeof(NEW.receipt->'adoptedAtMs') IS DISTINCT FROM 'number'
    OR jsonb_typeof(NEW.receipt->'authorityCheckedAtMs') IS DISTINCT FROM 'number'
    OR jsonb_typeof(NEW.receipt->'authorityExpiresAtMs') IS DISTINCT FROM 'number'
    OR jsonb_typeof(NEW.receipt->'validUntilMs') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLOCK_REFUSED'; END IF;
 adopted_at := (NEW.receipt->>'adoptedAtMs')::numeric;
 checked_at := (NEW.receipt->>'authorityCheckedAtMs')::numeric;
 authority_expiry := (NEW.receipt->>'authorityExpiresAtMs')::numeric;
 valid_until := (NEW.receipt->>'validUntilMs')::numeric;
 -- Centrally accepted cross-host observation bound: both the adoption event
 -- and its fresh authority observation must be within 5000 ms of DB time.
 db_now_ms := EXTRACT(EPOCH FROM pg_catalog.clock_timestamp()) * 1000;
 IF checked_at < 0 OR adopted_at < 0 OR authority_expiry < 1 OR valid_until < 1
    OR checked_at > adopted_at OR adopted_at >= valid_until
    OR valid_until > authority_expiry OR valid_until <= db_now_ms
    OR pg_catalog.abs(adopted_at - db_now_ms) > 5000
    OR pg_catalog.abs(checked_at - db_now_ms) > 5000
    OR checked_at < EXTRACT(EPOCH FROM (reserved.reservation->>'reservedAt')::timestamptz) * 1000
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_CLOCK_REFUSED'; END IF;
 -- All rows count, including CLAIMED, UNKNOWN, REVOKED, RETIRED, RELEASED and
 -- NO_DISPATCH. A state label never proves the target was unused.
 IF EXISTS (SELECT 1 FROM meri_conversations.runs r WHERE r.tenant_id=NEW.tenant_id AND r.conversation_id=NEW.conversation_id AND r.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_conversations.run_issuances i WHERE i.tenant_id=NEW.tenant_id AND i.conversation_id=NEW.conversation_id AND i.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_conversations.model_run_issuances i WHERE i.tenant_id=NEW.tenant_id AND i.conversation_id=NEW.conversation_id AND i.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_conversations.native_allocations a WHERE a.tenant_id=NEW.tenant_id AND a.conversation_id=NEW.conversation_id AND a.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_conversations.native_executions e WHERE e.tenant_id=NEW.tenant_id AND e.conversation_id=NEW.conversation_id AND e.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_conversations.native_restorations r WHERE r.tenant_id=NEW.tenant_id AND r.conversation_id=NEW.conversation_id AND r.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.runs r WHERE r.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.tenant_run_reservations r WHERE r.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.tool_run_allocations a WHERE a.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.grants g WHERE g.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.tool_grant_bindings g WHERE g.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.requests q WHERE q.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.tool_reservations q WHERE q.run_id=NEW.target_run_id)
    OR EXISTS (SELECT 1 FROM meri_product_budget.tool_invocations q WHERE q.run_id=NEW.target_run_id)
 THEN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_TARGET_ALREADY_CLAIMED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_next_run_adoption BEFORE INSERT ON meri_conversations.next_run_adoptions
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.guard_next_run_adoption_insert();
CREATE FUNCTION meri_conversations.reject_next_run_adoption_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'NEXT_RUN_ADOPTION_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_next_run_adoption BEFORE UPDATE OR DELETE ON meri_conversations.next_run_adoptions
 FOR EACH ROW EXECUTE FUNCTION meri_conversations.reject_next_run_adoption_change();
CREATE TRIGGER immutable_next_run_adoption_truncate BEFORE TRUNCATE ON meri_conversations.next_run_adoptions
 FOR EACH STATEMENT EXECUTE FUNCTION meri_conversations.reject_next_run_adoption_change();

-- SECURITY DEFINER is essential for a narrow cross-schema decision without
-- granting the conversation app role arbitrary product-budget SELECT. The
-- migrator must own these functions and both schemas. Runtime roles receive no
-- direct function EXECUTE; trigger invocation needs only table DML privileges.
REVOKE ALL ON FUNCTION meri_conversations.adoption_transition_for_run(text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.guard_adopted_claim(text,uuid,uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.guard_adopted_product_claim(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.guard_conversation_claim_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.guard_product_claim_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.guard_next_run_adoption_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION meri_conversations.reject_next_run_adoption_change() FROM PUBLIC;
COMMIT;

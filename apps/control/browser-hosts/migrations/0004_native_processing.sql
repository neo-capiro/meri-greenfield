-- Forward-only native-processing purpose delta (slot 78). Earlier allocation/migration bytes stay immutable.
-- Browser-only and legacy (absent hostMode) behaviour is preserved exactly; native is an explicit third purpose.
BEGIN;
-- 1. Purpose vocabulary: legacy (absent), browser-only and native-processing only.
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocation_placement;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_allocation_placement CHECK(
  ((NOT allocation_json ? 'hostMode') OR allocation_json->>'hostMode' IN ('browser-only','native-processing')) IS TRUE
 );
-- 2. One unterminated allocation per (tenant,conversation,purpose). Revoked/quarantined still reserve their purpose.
DROP INDEX meri_host_control.one_unterminated_host_per_conversation;
CREATE UNIQUE INDEX one_unterminated_host_per_conversation_purpose
 ON meri_host_control.host_allocations(tenant_id,conversation_id,COALESCE(allocation_json->>'hostMode','legacy'))
 WHERE state<>'terminated';
-- 3. Admission: the SAME canonical tenant/conversation advisory lock is taken BEFORE any insert, by the trusted writer
--    and here at the DB boundary (including zero-row conversations). The conflict decision is a fresh VOLATILE read
--    after the lock, and it inspects EVERY conflicting row, so a stale snapshot cannot admit a conflicting purpose.
CREATE FUNCTION meri_host_control.admit_allocation() RETURNS trigger LANGUAGE plpgsql VOLATILE
 SET search_path=pg_catalog AS $$
DECLARE
 requested_purpose text := COALESCE(NEW.allocation_json->>'hostMode','legacy');
 found_purposes text[];
BEGIN
 IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
 -- A stale snapshot cannot be used to claim a fresh read: the boundary requires READ COMMITTED.
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_ISOLATION_REFUSED';
 END IF;
 -- The canonical tenant:conversation admission lock comes BEFORE any conflict read (zero-row conversations included).
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id||':'||NEW.conversation_id::text,0));
 -- Physical-key replay of the identical allocation is idempotent regardless of any other explicit purpose present.
 PERFORM 1 FROM meri_host_control.host_allocations a
  WHERE a.host_id=NEW.host_id AND a.generation=NEW.generation AND a.state='active'
    AND a.allocation_sha256=NEW.allocation_sha256 AND a.record_sha256=NEW.record_sha256;
 IF FOUND THEN RETURN NEW; END IF;
 SELECT array_agg(DISTINCT COALESCE(a.allocation_json->>'hostMode','legacy'))
  INTO found_purposes
  FROM meri_host_control.host_allocations a
  WHERE a.tenant_id=NEW.tenant_id AND a.conversation_id=NEW.conversation_id AND a.state<>'terminated';
 IF found_purposes IS NULL THEN RETURN NEW; END IF;
 -- Legacy (absent mode) is exclusive in BOTH directions.
 IF requested_purpose='legacy' OR 'legacy'=ANY(found_purposes) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_PURPOSE_CONFLICT';
 END IF;
 -- An explicit purpose that ALREADY exists is a same-purpose physical conflict (replay already returned above);
 -- a DIFFERENT explicit purpose coexists in either insertion order.
 IF requested_purpose=ANY(found_purposes) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_PRESENT';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER host_allocation_admit BEFORE INSERT ON meri_host_control.host_allocations
 FOR EACH ROW EXECUTE FUNCTION meri_host_control.admit_allocation();
-- 4. The writer takes the SAME canonical lock before insert (the existing allocator calls this in one transaction).
CREATE FUNCTION meri_host_control.lock_conversation_admission(requested_tenant text,requested_conversation uuid)
 RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT pg_advisory_xact_lock(hashtextextended(requested_tenant||':'||requested_conversation::text,0))
$$;
REVOKE ALL ON FUNCTION meri_host_control.lock_conversation_admission(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION meri_host_control.lock_conversation_admission(text,uuid) TO meri_host_allocator;
-- 5. Verified teardown: accepted legacy/browser semantics stay EXACTLY as 0003 (browserEgress closed, outer IS TRUE),
--    plus a native branch built on processing-specific proof. No weaker/null substitution is admitted.
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_teardown_receipt;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_teardown_receipt CHECK(
  (state<>'terminated' AND teardown_json IS NULL AND teardown_sha256 IS NULL) OR
  (state='terminated' AND teardown_json IS NOT NULL AND teardown_sha256 IS NOT NULL
   AND teardown_sha256~'^[0-9a-f]{64}$'
   AND (jsonb_typeof(teardown_json)='object'
    AND teardown_json->>'schema'='meri-d005-host-teardown/1'
    AND teardown_json->>'allocationSha256'=allocation_sha256
    AND teardown_json->>'hostIdentitySha256'=host_identity_sha256
    AND teardown_json->>'status'='VERIFIED'
    AND teardown_json->>'hostDestroy'='requested' AND teardown_json->>'hostAbsence'='confirmed'
    AND teardown_json->>'processes'='exited'
    AND (
     ((NOT allocation_json ? 'hostMode') AND (NOT teardown_json ? 'processScope')
      AND teardown_json->>'browserEgress'='closed' AND teardown_json->>'bashEgress'='closed'
      AND teardown_json->>'browserState'='disposed')
     OR (allocation_json->>'hostMode'='browser-only'
      AND teardown_json->>'processScope'='browser-host-descendants'
      AND teardown_json->>'browserEgress'='closed' AND teardown_json->>'bashEgress'='not-applicable'
      AND teardown_json->>'browserState'='disposed')
     OR (allocation_json->>'hostMode'='native-processing'
      AND teardown_json->>'processScope'='native-processing-descendants'
      AND teardown_json->>'cgroup'='removed' AND teardown_json->>'networkNamespace'='removed'
      AND teardown_json->>'browserEgress'='not-applicable' AND teardown_json->>'browserState'='not-applicable'
      AND teardown_json->>'bashEgress'='not-applicable')
    )) IS TRUE)
 );
COMMIT;

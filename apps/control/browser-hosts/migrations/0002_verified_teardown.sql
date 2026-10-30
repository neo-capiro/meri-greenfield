-- Forward-only: 0001 remains immutable. Native absence is observed by the
-- existing trusted teardown owner, never inferred from revocation or expiry.
BEGIN;
ALTER TABLE meri_host_control.host_allocations
 ADD COLUMN teardown_json jsonb,
 ADD COLUMN teardown_sha256 char(64),
 ADD CONSTRAINT host_teardown_receipt CHECK(
  (state<>'terminated' AND teardown_json IS NULL AND teardown_sha256 IS NULL) OR
  (state='terminated' AND teardown_json IS NOT NULL AND teardown_sha256 IS NOT NULL
   AND teardown_sha256~'^[0-9a-f]{64}$'
   AND (jsonb_typeof(teardown_json)='object'
    AND teardown_json->>'schema'='meri-d005-host-teardown/1'
    AND teardown_json->>'allocationSha256'=allocation_sha256
    AND teardown_json->>'hostIdentitySha256'=host_identity_sha256
    AND teardown_json->>'status'='VERIFIED'
    AND teardown_json->>'browserEgress'='closed' AND teardown_json->>'bashEgress'='closed'
    AND teardown_json->>'processes'='exited' AND teardown_json->>'browserState'='disposed'
    AND teardown_json->>'hostDestroy'='requested' AND teardown_json->>'hostAbsence'='confirmed') IS TRUE)
 );
CREATE OR REPLACE FUNCTION meri_host_control.guard_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'active' OR NEW.teardown_json IS NOT NULL OR NEW.teardown_sha256 IS NOT NULL THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-ARRAY['state','teardown_json','teardown_sha256']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['state','teardown_json','teardown_sha256']) THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 IF OLD.state='terminated' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
  (OLD.state='active' AND NEW.state IN ('revoked','quarantined','terminated')) OR
  (OLD.state IN ('revoked','quarantined') AND NEW.state='terminated')
 ) THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 RETURN NEW;
END $$;
GRANT UPDATE(teardown_json,teardown_sha256) ON meri_host_control.host_allocations TO meri_host_allocator;
COMMIT;

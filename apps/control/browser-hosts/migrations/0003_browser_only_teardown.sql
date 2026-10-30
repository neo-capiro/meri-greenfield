-- Forward-only placement-aware teardown. Earlier allocation/migration bytes
-- remain immutable. The allocator pins hostMode in the hashed allocation JSON.
BEGIN;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_allocation_placement CHECK(
  ((NOT allocation_json ? 'hostMode') OR allocation_json->>'hostMode'='browser-only') IS TRUE
 );
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
    AND teardown_json->>'browserEgress'='closed'
    AND teardown_json->>'processes'='exited' AND teardown_json->>'browserState'='disposed'
    AND teardown_json->>'hostDestroy'='requested' AND teardown_json->>'hostAbsence'='confirmed'
    AND (
     ((NOT allocation_json ? 'hostMode') AND (NOT teardown_json ? 'processScope') AND teardown_json->>'bashEgress'='closed')
     OR (allocation_json->>'hostMode'='browser-only'
      AND teardown_json->>'processScope'='browser-host-descendants'
      AND teardown_json->>'bashEgress'='not-applicable')
    )) IS TRUE)
 );
COMMIT;

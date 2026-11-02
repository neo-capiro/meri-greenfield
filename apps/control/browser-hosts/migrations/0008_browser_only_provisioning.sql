-- Browser-only hosts take the SAME provisioned lifecycle as native-processing hosts: reserve -> dispatch -> bootstrap ->
-- admit -> teardown, with a declaration, an observed instance, bootstrap custody, the observer journal and the certificate
-- window. Before this delta a browser-only row could only be inserted directly as 'active' (no production writer did so).
-- Every object below is the exact pinned 0006/0007 body with 'native-processing' purpose gates widened to the two
-- provisioned purposes; legacy (absent hostMode) rows and historical native rows are untouched. Browser-only teardown
-- keeps its own receipt branch from 0004 (processScope browser-host-descendants, browserEgress closed, browserState disposed).
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='60s';
LOCK TABLE meri_host_control.host_allocations IN ACCESS EXCLUSIVE MODE;
DO $predecessor$
BEGIN
 IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='meri_host_control.host_allocations'::regclass)) IS DISTINCT FROM current_user THEN RAISE EXCEPTION 'BROWSER_ONLY_OWNER'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.guard_allocation()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='ee96403bf8406b9b98e15db632f77ce39cb84ceba6c7088b18ebbd95e7536367' AND prosecdef=false AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'BROWSER_ONLY_FUNCTION_PREDECESSOR: %','meri_host_control.guard_allocation()'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('meri_host_control.guard_native_observer()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='24b998630c9116f54bc7efaf236fc45fae7a0b6a67c2d8094f3bc15361ba5883' AND prosecdef=true AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) THEN RAISE EXCEPTION 'BROWSER_ONLY_FUNCTION_PREDECESSOR: %','meri_host_control.guard_native_observer()'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='meri_host_control.host_allocations'::regclass AND convalidated AND conname IN ('native_physical_phase','native_declaration_shape','host_allocation_certificate_window','host_teardown_receipt','host_allocation_placement'))<>5 THEN RAISE EXCEPTION 'BROWSER_ONLY_CONSTRAINT_PREDECESSOR'; END IF;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocation_placement' AND pg_get_constraintdef(oid) LIKE '%browser-only%') THEN RAISE EXCEPTION 'BROWSER_ONLY_PLACEMENT_PREDECESSOR'; END IF;
 -- Browser-only rows could only be legacy direct active inserts before this delta; none is expected. Refuse by name
 -- rather than surfacing as a generic constraint violation when the widened declaration shape is re-added.
 IF EXISTS(SELECT FROM meri_host_control.host_allocations WHERE allocation_json->>'hostMode'='browser-only') THEN RAISE EXCEPTION 'BROWSER_ONLY_ROWS_PRESENT'; END IF;
END $predecessor$;

-- 1. Pre-effect states (reserved, dispatching, unknown, refused) for both provisioned purposes.
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT native_physical_phase;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_physical_phase CHECK((
  (state IN ('reserved','dispatching','unknown','refused')
   AND host_identity_json IS NULL AND host_identity_sha256 IS NULL AND endpoint_json IS NULL
   AND record_sha256 IS NULL AND client_cert_sha256 IS NULL AND client_dns_name IS NULL
   AND client_cert_not_after_ms IS NULL AND server_cert_not_after_ms IS NULL
   AND allocation_json->>'hostMode' IN ('native-processing','browser-only'))
  OR
  (state IN ('active','revoked','quarantined','terminated')
   AND host_identity_json IS NOT NULL AND host_identity_sha256 IS NOT NULL
   AND endpoint_json IS NOT NULL AND record_sha256 IS NOT NULL AND client_cert_sha256 IS NOT NULL
   AND client_dns_name IS NOT NULL AND client_cert_not_after_ms IS NOT NULL
   AND server_cert_not_after_ms IS NOT NULL)
 ) IS TRUE);

-- 2. A declaration is required for both provisioned purposes and still forbidden for legacy rows.
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT native_declaration_shape;
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_declaration_shape CHECK((
  ((allocation_json->>'hostMode' IS NULL OR allocation_json->>'hostMode' NOT IN ('native-processing','browser-only'))
   AND declaration_json IS NULL AND declaration_sha256 IS NULL)
  OR
  (allocation_json->>'hostMode' IN ('native-processing','browser-only')
   AND jsonb_typeof(declaration_json)='object'
   AND char_length(declaration_sha256)=64 AND declaration_sha256 ~ '^[0-9a-f]{64}$'
   AND jsonb_typeof(declaration_json)='object'
   AND declaration_json->>'schema' IN ('meri-native-provisioning-declaration/1','meri-native-provisioning-declaration/2')
   AND declaration_json->>'accountId' ~ '^[0-9]{12}$'
   AND declaration_json->>'region'='us-east-1'
   AND declaration_json->>'imageDigest' ~ '^sha256:[0-9a-f]{64}$'
   AND declaration_json->>'token' ~ '^[0-9a-f]{64}$'
   AND declaration_json->'leaseDeadlineMs'=to_jsonb(lease_deadline_ms)
   AND declaration_json->'placement'->>'subnetId'=declaration_json->'launch'->>'SubnetId'
   AND declaration_json->'placement'->>'iamInstanceProfile'=declaration_json->'launch'->'IamInstanceProfile'->>'Name')
  OR
  -- historical complete native rows admitted before this extension remain valid
  (allocation_json->>'hostMode'='native-processing' AND declaration_json IS NULL AND declaration_sha256 IS NULL
   AND state IN ('active','revoked','quarantined','terminated')
   AND host_identity_json IS NOT NULL AND endpoint_json IS NOT NULL)
 ) IS TRUE);

-- 3. The C2 serverAuth cleanup window applies to both provisioned purposes under the same /2 custody proof.
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocation_certificate_window;
ALTER TABLE meri_host_control.host_allocations ADD CONSTRAINT host_allocation_certificate_window CHECK (
 -- Preserve the complete old predicate, including its pre-effect NULL behavior.
 (client_cert_not_after_ms<=lease_deadline_ms AND server_cert_not_after_ms<=lease_deadline_ms)
 OR (
  client_cert_not_after_ms<=lease_deadline_ms
  AND server_cert_not_after_ms<=(lease_deadline_ms::numeric+25000)
  AND allocation_json->>'hostMode' IN ('native-processing','browser-only')
  AND declaration_json->>'schema'='meri-native-provisioning-declaration/2'
  AND declaration_json->'leaseDeadlineMs'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>>'{watchdog,schema}'='meri-native-watchdog-intent/1'
  AND declaration_json#>>'{watchdog,input,schema}'='meri-native-watchdog-input/2'
  AND declaration_json#>'{watchdog,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>'{watchdog,cleanupCeilingMs}'=to_jsonb(lease_deadline_ms::numeric+25000)
  AND declaration_json#>'{watchdog,deadlineMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND declaration_json#>'{watchdog,input,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND declaration_json#>'{watchdog,input,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json->>'schema'='meri-native-physical-contexts/2'
  AND native_physical_context_json#>>'{managed,phase}'='managed'
  AND native_physical_context_json#>'{managed,leaseDeadlineMs}'=to_jsonb(lease_deadline_ms)
  AND native_physical_context_json#>'{managed,startedAtMs}'=to_jsonb(lease_deadline_ms)
  AND native_physical_context_json#>'{managed,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json#>'{managed,deadlineMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND native_physical_context_json#>>'{managed,declarationSha256}'=declaration_sha256::text
  AND bootstrap_prepare_json->>'state'='succeeded'
  AND bootstrap_install_json->>'state'='succeeded'
  AND bootstrap_prepare_json#>'{observation,scope}'=bootstrap_install_json#>'{observation,scope}'
  AND bootstrap_prepare_json#>'{observation,scope,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
  AND bootstrap_install_json#>'{observation,scope,cleanupCeilingMs}'=declaration_json#>'{watchdog,cleanupCeilingMs}'
 ) IS TRUE
);

COMMENT ON CONSTRAINT host_allocation_certificate_window ON meri_host_control.host_allocations IS 'C2: original workload/client lease unchanged; serverAuth cleanup extension only for /2 with matching original watchdog/context and protected successful bootstrap scope, for native-processing and browser-only hosts. Actual certificate lifetime proof remains source-owned.';

-- 4. Row guard: the 0006 body with its five native-processing purpose gates widened to the provisioned purposes.
CREATE OR REPLACE FUNCTION meri_host_control.guard_allocation() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
DECLARE purpose text;step text;o jsonb;n jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 purpose:=COALESCE((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])->'allocation_json'->>'hostMode','legacy');
 IF TG_OP='INSERT' THEN
  IF purpose IN ('native-processing','browser-only') THEN
   IF (NEW.state<>'reserved' OR NEW.dispatch_started_at_ms IS NOT NULL OR NEW.observed_instance_json IS NOT NULL
    OR NEW.bootstrap_prepare_json IS NOT NULL OR NEW.bootstrap_install_json IS NOT NULL
    OR NEW.teardown_json IS NOT NULL OR NEW.teardown_sha256 IS NOT NULL
    OR NEW.declaration_json IS NULL OR NEW.declaration_sha256 IS NULL
    OR jsonb_typeof(NEW.declaration_json->'bootstrapSpec') IS DISTINCT FROM 'object'
    OR NEW.declaration_json->'bootstrapSpec'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-spec/1'
    OR NEW.host_identity_json IS NOT NULL OR NEW.host_identity_sha256 IS NOT NULL
    OR NEW.endpoint_json IS NOT NULL OR NEW.record_sha256 IS NOT NULL OR NEW.client_cert_sha256 IS NOT NULL
    OR NEW.client_dns_name IS NOT NULL OR NEW.client_cert_not_after_ms IS NOT NULL
    OR NEW.server_cert_not_after_ms IS NOT NULL) IS TRUE
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
  ELSE
   IF NEW.state<>'active' OR NEW.declaration_json IS NOT NULL OR NEW.declaration_sha256 IS NOT NULL
    OR NEW.dispatch_started_at_ms IS NOT NULL OR NEW.observed_instance_json IS NOT NULL
    OR NEW.bootstrap_prepare_json IS NOT NULL OR NEW.bootstrap_install_json IS NOT NULL
    OR NEW.teardown_json IS NOT NULL OR NEW.teardown_sha256 IS NOT NULL
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 -- Tombstones are fully immutable: any byte change, including receipt, refuses.
 IF OLD.state IN ('refused','terminated') AND (to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical']) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Identity/lease/owner/declaration/credential are ALWAYS immutable.
 IF ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  IS DISTINCT FROM ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Physical fill is allowed ONLY on dispatching/unknown -> active.
 IF ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  IS DISTINCT FROM ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  AND NOT(OLD.state IN ('dispatching','unknown') AND NEW.state='active')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Admitted/terminal physical data is immutable; only state and a valid teardown may change.
 IF OLD.state IN ('active','revoked','quarantined','terminated') AND
  ((to_jsonb(NEW)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','teardown_json','teardown_sha256']) IS DISTINCT FROM
  ((to_jsonb(OLD)-ARRAY['native_physical_context_json','native_physical_context_sha256','native_physical_context_canonical','native_physical_resources_json','native_physical_resources_sha256','native_physical_resources_canonical','native_physical_dispatch_json','native_physical_dispatch_sha256','native_physical_dispatch_canonical','native_physical_dispatch_result_json','native_physical_dispatch_result_sha256','native_physical_dispatch_result_canonical','native_physical_observations_json','native_physical_observations_sha256','native_physical_observations_canonical','native_physical_result_json','native_physical_result_sha256','native_physical_result_canonical'])-ARRAY['state','teardown_json','teardown_sha256'])
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Allowed state transitions. No dispatching/unknown -> terminated before a real absence proof.
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
   (OLD.state='reserved' AND NEW.state IN ('dispatching','refused')) OR
   (OLD.state='dispatching' AND NEW.state IN ('unknown','active')) OR
   (OLD.state='unknown' AND NEW.state='active') OR
   (OLD.state='active' AND NEW.state IN ('revoked','quarantined','terminated')) OR
   (OLD.state IN ('revoked','quarantined') AND NEW.state='terminated')) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Native new-lineage dispatching/unknown/active rows must carry the original dispatch timestamp.
 IF purpose IN ('native-processing','browser-only') AND NEW.declaration_json IS NOT NULL AND NEW.state IN ('dispatching','unknown','active') AND NEW.dispatch_started_at_ms IS NULL
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Active new-lineage rows must carry the observed instance that matches the physical identity.
 IF purpose IN ('native-processing','browser-only') AND NEW.state='active' AND NEW.declaration_json IS NOT NULL AND
  (NEW.observed_instance_json IS NULL OR NEW.observed_instance_json->>'instanceId' IS DISTINCT FROM NEW.host_identity_json->>'instanceId')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 -- Native activation requires BOTH retained successful bootstrap operations with public custody.
 IF purpose IN ('native-processing','browser-only') AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND
  (NEW.bootstrap_prepare_json IS NULL OR NEW.bootstrap_install_json IS NULL
   OR jsonb_typeof(NEW.bootstrap_prepare_json)<>'object' OR jsonb_typeof(NEW.bootstrap_install_json)<>'object'
   OR NEW.bootstrap_prepare_json->>'state' IS DISTINCT FROM 'succeeded'
   OR NEW.bootstrap_install_json->>'state' IS DISTINCT FROM 'succeeded'
   OR NEW.bootstrap_prepare_json->>'step' IS DISTINCT FROM 'prepare'
   OR NEW.bootstrap_install_json->>'step' IS DISTINCT FROM 'install'
   OR NEW.bootstrap_prepare_json->'commandId'='null'::jsonb
   OR NEW.bootstrap_install_json->'commandId'='null'::jsonb
   OR NEW.bootstrap_prepare_json->'observation'='null'::jsonb
   OR NEW.bootstrap_install_json->'observation'='null'::jsonb) IS TRUE
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_BOOTSTRAP_REQUIRED'; END IF;
 -- Public cross-record custody joins for native activation (JS owns canonical hashing/crypto proof).
 IF purpose IN ('native-processing','browser-only') AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND (
  NEW.bootstrap_prepare_json->'observation'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-prepare/1'
  OR NEW.bootstrap_install_json->'observation'->>'schema' IS DISTINCT FROM 'meri-native-bootstrap-install/1'
  OR NEW.bootstrap_prepare_json->'observation'->>'operationId' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'dispatchId'
  OR NEW.bootstrap_install_json->'observation'->>'operationId' IS DISTINCT FROM NEW.bootstrap_install_json->>'dispatchId'
  OR NEW.bootstrap_prepare_json->'observation'->>'requestSha256' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'requestSha256'
  OR NEW.bootstrap_install_json->'observation'->>'requestSha256' IS DISTINCT FROM NEW.bootstrap_install_json->>'requestSha256'
  OR NEW.bootstrap_prepare_json->'observation'->>'bootId' IS DISTINCT FROM NEW.host_identity_json->>'bootId'
  OR NEW.bootstrap_install_json->'observation'->>'bootId' IS DISTINCT FROM NEW.host_identity_json->>'bootId'
  OR NEW.bootstrap_install_json->'observation'->>'prepareOperationId' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'dispatchId'
  OR NEW.bootstrap_install_json->'observation'->>'prepareRequestSha256' IS DISTINCT FROM NEW.bootstrap_prepare_json->>'requestSha256'
  OR NEW.bootstrap_prepare_json->'observation'->'scope' IS DISTINCT FROM NEW.bootstrap_install_json->'observation'->'scope'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'allocation' IS DISTINCT FROM NEW.allocation_json
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'originalBinding' IS DISTINCT FROM NEW.original_binding_json
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'ownerInstanceId' IS DISTINCT FROM NEW.owner_instance_id::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'declarationSha256' IS DISTINCT FROM NEW.declaration_sha256::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->>'instanceId' IS DISTINCT FROM NEW.observed_instance_json->>'instanceId'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'address' IS DISTINCT FROM NEW.endpoint_json->>'address'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'port' IS DISTINCT FROM NEW.endpoint_json->>'port'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'serverName' IS DISTINCT FROM NEW.endpoint_json->>'serverName'
  OR NEW.bootstrap_install_json->'observation'->>'hostCertificateSha256' IS DISTINCT FROM NEW.client_cert_sha256::text
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'imageDigest' IS DISTINCT FROM NEW.declaration_json->>'imageDigest'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'sourceCommit' IS DISTINCT FROM NEW.declaration_json->>'sourceCommit'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'bootstrapSha256' IS DISTINCT FROM NEW.declaration_json->>'bootstrapSha256'
  OR ((NEW.bootstrap_prepare_json->'request')-ARRAY['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds','Parameters','TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']) IS DISTINCT FROM '{}'::jsonb
  OR ((NEW.bootstrap_install_json->'request')-ARRAY['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds','Parameters','TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']) IS DISTINCT FROM '{}'::jsonb
  OR NEW.bootstrap_prepare_json->'request'->>'TimeoutSeconds' IS DISTINCT FROM '30'
  OR NEW.bootstrap_install_json->'request'->>'TimeoutSeconds' IS DISTINCT FROM '30'
  OR NEW.bootstrap_prepare_json->'request'->>'MaxConcurrency' IS DISTINCT FROM '1'
  OR NEW.bootstrap_install_json->'request'->>'MaxConcurrency' IS DISTINCT FROM '1'
  OR NEW.bootstrap_prepare_json->'request'->>'MaxErrors' IS DISTINCT FROM '0'
  OR NEW.bootstrap_install_json->'request'->>'MaxErrors' IS DISTINCT FROM '0'
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload'->0) IS DISTINCT FROM 'string'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload'->0) IS DISTINCT FROM 'string'
  OR (NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload'->>0) !~ '^[A-Za-z0-9_-]+$'
  OR (NEW.bootstrap_install_json->'request'->'Parameters'->'Payload'->>0) !~ '^[A-Za-z0-9_-]+$'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'name'
  OR NEW.bootstrap_install_json->'request'->>'DocumentName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'name'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentVersion' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'version'
  OR NEW.bootstrap_install_json->'request'->>'DocumentVersion' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'version'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentHash' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'sha256'
  OR NEW.bootstrap_install_json->'request'->>'DocumentHash' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'document'->>'sha256'
  OR NEW.bootstrap_prepare_json->'request'->>'DocumentHashType' IS DISTINCT FROM 'Sha256'
  OR NEW.bootstrap_install_json->'request'->>'DocumentHashType' IS DISTINCT FROM 'Sha256'
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request') IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request') IS DISTINCT FROM 'object'
  OR NEW.bootstrap_prepare_json->'request'->'InstanceIds' IS DISTINCT FROM jsonb_build_array(NEW.observed_instance_json->>'instanceId')
  OR NEW.bootstrap_install_json->'request'->'InstanceIds' IS DISTINCT FROM jsonb_build_array(NEW.observed_instance_json->>'instanceId')
  OR NEW.bootstrap_prepare_json->'request'->>'Comment' IS DISTINCT FROM 'meri-native-prepare-'||(NEW.bootstrap_prepare_json->>'dispatchId')
  OR NEW.bootstrap_install_json->'request'->>'Comment' IS DISTINCT FROM 'meri-native-install-'||(NEW.bootstrap_install_json->>'dispatchId')
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters') IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters') IS DISTINCT FROM 'object'
  OR (NEW.bootstrap_prepare_json->'request'->'Parameters' ?& ARRAY['Payload']) IS NOT TRUE
  OR (NEW.bootstrap_install_json->'request'->'Parameters' ?& ARRAY['Payload']) IS NOT TRUE
  OR ((NEW.bootstrap_prepare_json->'request'->'Parameters')-ARRAY['Payload']) IS DISTINCT FROM '{}'::jsonb
  OR ((NEW.bootstrap_install_json->'request'->'Parameters')-ARRAY['Payload']) IS DISTINCT FROM '{}'::jsonb
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload') IS DISTINCT FROM 'array'
  OR jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload') IS DISTINCT FROM 'array'
  OR (CASE WHEN jsonb_typeof(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload')='array'
   THEN jsonb_array_length(NEW.bootstrap_prepare_json->'request'->'Parameters'->'Payload') ELSE -1 END) IS DISTINCT FROM 1
  OR (CASE WHEN jsonb_typeof(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload')='array'
   THEN jsonb_array_length(NEW.bootstrap_install_json->'request'->'Parameters'->'Payload') ELSE -1 END) IS DISTINCT FROM 1
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'port' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'hostEndpoint'->>'port'
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'endpoint'->>'serverName' IS DISTINCT FROM NEW.declaration_json->'bootstrapSpec'->'hostEndpoint'->>'serverName'
  OR (NEW.bootstrap_prepare_json->'observation'->'scope'->'source' ? 'nativeHelperSha256') IS DISTINCT FROM (NEW.declaration_json ? 'nativeHelperSha256')
  OR NEW.bootstrap_prepare_json->'observation'->'scope'->'source'->>'nativeHelperSha256' IS DISTINCT FROM NEW.declaration_json->>'nativeHelperSha256'
  OR NEW.bootstrap_install_json->'observation'->>'serverCertificateSha256' IS DISTINCT FROM NEW.endpoint_json->>'serverFingerprintSha256'
 ) IS TRUE THEN RAISE EXCEPTION 'HOST_ALLOCATION_BOOTSTRAP_CUSTODY'; END IF;
 -- Dispatch timestamp once-only: only reserved->dispatching, positive, inside the original lease.
 IF NEW.dispatch_started_at_ms IS DISTINCT FROM OLD.dispatch_started_at_ms THEN
  IF OLD.dispatch_started_at_ms IS NOT NULL OR NEW.dispatch_started_at_ms IS NULL
   OR NOT(OLD.state='reserved' AND NEW.state='dispatching') OR NEW.dispatch_started_at_ms<1
   OR NEW.dispatch_started_at_ms>NEW.lease_deadline_ms THEN
   RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 END IF;
 -- Observed instance: bind once; a partially observed null address may fill once for the SAME instance.
 IF NEW.observed_instance_json IS DISTINCT FROM OLD.observed_instance_json THEN
  IF OLD.observed_instance_json IS NULL THEN
   IF NEW.observed_instance_json IS NULL OR OLD.state NOT IN ('dispatching','unknown')
    THEN RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
  ELSIF OLD.state IN ('dispatching','unknown')
   AND OLD.observed_instance_json->>'instanceId'=NEW.observed_instance_json->>'instanceId'
   AND OLD.observed_instance_json->'privateIp'='null'::jsonb
   AND NEW.observed_instance_json->'privateIp'<>'null'::jsonb
   AND jsonb_typeof(NEW.observed_instance_json->'privateIp')='string'
   AND (NEW.observed_instance_json-ARRAY['instanceId','privateIp'])='{}'::jsonb
  THEN NULL;
  ELSE RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 END IF;
 IF OLD.state IN ('reserved','refused') AND NEW.observed_instance_json IS NOT NULL THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 -- Refusal requires proven never-dispatched in BOTH old and new row.
 IF NEW.state='refused' AND OLD.state<>'refused' AND (OLD.state<>'reserved' OR NEW.dispatch_started_at_ms IS NOT NULL
  OR NEW.observed_instance_json IS NOT NULL OR NEW.bootstrap_prepare_json IS NOT NULL
  OR NEW.bootstrap_install_json IS NOT NULL OR NEW.teardown_json IS NOT NULL) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Bootstrap slots: bounded forward-only operations. Known fields never change/clear.
 FOR step IN SELECT unnest(ARRAY['prepare','install']) LOOP
  o:=CASE step WHEN 'prepare' THEN OLD.bootstrap_prepare_json ELSE OLD.bootstrap_install_json END;
  n:=CASE step WHEN 'prepare' THEN NEW.bootstrap_prepare_json ELSE NEW.bootstrap_install_json END;
  IF n IS NOT DISTINCT FROM o THEN CONTINUE; END IF;
  IF o IS NOT NULL AND n IS NULL THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
  IF (n IS NOT NULL AND jsonb_typeof(n)='object'
   AND (n ?& ARRAY['step','state','dispatchId','requestSha256','request','commandId','observation'])
   AND (n-ARRAY['step','state','dispatchId','requestSha256','request','commandId','observation'])='{}'::jsonb
   AND n->>'step'=step AND n->>'state' IN ('reserved','dispatching','unknown','succeeded','failed')
   AND n->>'dispatchId' ~ '^[0-9a-f]{64}$' AND n->>'requestSha256' ~ '^[0-9a-f]{64}$'
   AND jsonb_typeof(n->'request')='object'
   AND (n->'commandId' IS NULL OR n->'commandId'='null'::jsonb OR
    (jsonb_typeof(n->'commandId')='string' AND length(n->>'commandId') BETWEEN 1 AND 256))
   AND (n->'observation' IS NULL OR n->'observation'='null'::jsonb OR jsonb_typeof(n->'observation')='object')
   AND octet_length(n::text)<=65536) IS NOT TRUE
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  IF o IS NULL THEN
   IF n->>'state'<>'reserved' OR n->'commandId'<>'null'::jsonb OR n->'observation'<>'null'::jsonb
    OR OLD.state NOT IN ('dispatching','unknown','active')
   THEN RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  ELSE
   IF n->>'step'<>o->>'step' OR n->>'dispatchId' IS DISTINCT FROM o->>'dispatchId'
    OR n->>'requestSha256' IS DISTINCT FROM o->>'requestSha256'
    OR n->'request' IS DISTINCT FROM o->'request' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->'commandId'<>'null'::jsonb AND n->'commandId' IS DISTINCT FROM o->'commandId' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->'observation'<>'null'::jsonb AND n->'observation' IS DISTINCT FROM o->'observation' THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF o->>'state' IN ('succeeded','failed') AND n IS DISTINCT FROM o THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_IMMUTABLE'; END IF;
   IF n->>'state' IS DISTINCT FROM o->>'state' AND NOT (
    (o->>'state'='reserved' AND n->>'state' IN ('dispatching','failed')) OR
    (o->>'state'='dispatching' AND n->>'state' IN ('unknown','succeeded','failed')) OR
    (o->>'state'='unknown' AND n->>'state' IN ('succeeded','failed'))) THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
   IF o->>'state'='reserved' AND n->'commandId'<>'null'::jsonb THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
   IF n->'observation'<>'null'::jsonb AND (n->>'commandId' IS NULL OR n->>'commandId'='' OR n->>'state'<>'succeeded') THEN
    RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
  END IF;
 END LOOP;
 IF NEW.bootstrap_install_json IS NOT NULL AND (NEW.bootstrap_prepare_json IS NULL
  OR jsonb_typeof(NEW.bootstrap_prepare_json)<>'object'
  OR NEW.bootstrap_prepare_json->>'state'<>'succeeded'
  OR NEW.bootstrap_prepare_json->'observation' IS NULL
  OR NEW.bootstrap_prepare_json->'observation'='null'::jsonb
  OR jsonb_typeof(NEW.bootstrap_prepare_json->'observation')<>'object') THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_OPERATION_REFUSED'; END IF;
 RETURN NEW;
END $$;

-- 5. Observer guard: the 0006 body; V2_CONTEXT_REQUIRED accepts both provisioned purposes.
CREATE OR REPLACE FUNCTION meri_host_control.guard_native_observer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb:=to_jsonb(NEW);old_r jsonb;names text[]:=ARRAY['context','resources','dispatch','dispatch_result','observations','result'];limits integer[]:=ARRAY[32768,262144,16384,16384,524288,65536];
 name text;prefix text;v jsonb;old_v jsonb;t text;digest text;idx integer:=0;phase text;c jsonb;s jsonb;claim jsonb;outcome jsonb;e jsonb;old_phase jsonb;new_phase jsonb;ref text;
 now_ms numeric:=floor(extract(epoch FROM clock_timestamp())*1000);is_v2 boolean;all_null boolean:=true;scheduled jsonb;dispatch_ms numeric;attempt jsonb;uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
 IF TG_OP='UPDATE' THEN old_r:=to_jsonb(OLD); END IF;
 is_v2:=coalesce(NEW.declaration_json->>'schema'='meri-native-provisioning-declaration/2',false);
 FOREACH name IN ARRAY names LOOP
  idx:=idx+1;prefix:='native_physical_'||name;v:=r->(prefix||'_json');t:=r->>(prefix||'_canonical');digest:=r->>(prefix||'_sha256');
  IF v='null'::jsonb THEN PERFORM meri_host_control.observer_require(t IS NULL AND digest IS NULL,'TRIPLET_NULL');
  ELSE
   all_null:=false;
   PERFORM meri_host_control.observer_require(jsonb_typeof(v)='object' AND t IS NOT NULL AND digest~'^[0-9a-f]{64}$'
    AND meri_host_control.observer_size(t)<=limits[idx] AND t::jsonb=v AND meri_host_control.observer_hash(t)=digest,'TRIPLET_INTEGRITY');
  END IF;
  IF TG_OP='UPDATE' AND (NOT is_v2 OR OLD.state IN('terminated','refused') OR OLD.state='reserved') THEN
   PERFORM meri_host_control.observer_require((r->(prefix||'_json')) IS NOT DISTINCT FROM (old_r->(prefix||'_json')) AND (r->(prefix||'_sha256')) IS NOT DISTINCT FROM (old_r->(prefix||'_sha256')) AND (r->(prefix||'_canonical')) IS NOT DISTINCT FROM (old_r->(prefix||'_canonical')),'TERMINAL_OR_RESERVED_IMMUTABLE');
  END IF;
 END LOOP;
 IF NOT is_v2 THEN PERFORM meri_host_control.observer_require(all_null,'OLD_PROTOCOL');RETURN NEW; END IF;
 PERFORM meri_host_control.observer_require(NEW.allocation_json->>'hostMode' IN ('native-processing','browser-only') AND NEW.native_physical_context_json IS NOT NULL,'V2_CONTEXT_REQUIRED');
 PERFORM meri_host_control.observer_context(r);
 IF TG_OP='INSERT' THEN
  PERFORM meri_host_control.observer_require(NEW.state='reserved' AND NEW.native_physical_context_json->'ordinary'='null'::jsonb
   AND NEW.native_physical_resources_json IS NULL AND NEW.native_physical_dispatch_json IS NULL AND NEW.native_physical_dispatch_result_json IS NULL
   AND NEW.native_physical_observations_json IS NULL AND NEW.native_physical_result_json IS NULL,'RESERVE_ONLY');RETURN NEW;
 END IF;
 PERFORM meri_host_control.observer_require(OLD.declaration_json->>'schema'='meri-native-provisioning-declaration/2' AND OLD.native_physical_context_json IS NOT NULL,'NO_RETROFIT');
 FOREACH name IN ARRAY names LOOP
  IF name='observations' THEN CONTINUE; END IF;
  prefix:='native_physical_'||name;v:=r->(prefix||'_json');old_v:=old_r->(prefix||'_json');
  IF v='null'::jsonb THEN PERFORM meri_host_control.observer_require(old_v='null'::jsonb,'SLOT_ERASE');CONTINUE; END IF;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(v,ARRAY['schema','ordinary','managed']) AND v->>'schema'=CASE name
   WHEN 'context' THEN 'meri-native-physical-contexts/2' WHEN 'resources' THEN 'meri-native-physical-resource-sets/2' WHEN 'dispatch' THEN 'meri-native-physical-dispatches/2'
   WHEN 'dispatch_result' THEN 'meri-native-physical-dispatch-results/2' WHEN 'result' THEN 'meri-native-physical-results/2' END,'SLOT_ENVELOPE');
  FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
   old_phase:=coalesce(old_v->phase,'null'::jsonb);new_phase:=v->phase;
   IF old_phase<>'null'::jsonb THEN
    IF phase='managed' AND name IN('dispatch','dispatch_result') THEN
     IF name='dispatch' THEN
      PERFORM meri_host_control.observer_require(new_phase->'executionArn'=old_phase->'executionArn' AND new_phase->'inputSha256'=old_phase->'inputSha256','MANAGED_APPEND');
      FOR attempt IN SELECT value FROM jsonb_array_elements(old_phase->'attempts') LOOP
       PERFORM meri_host_control.observer_require(EXISTS(SELECT FROM jsonb_array_elements(new_phase->'attempts') x WHERE x=attempt),'MANAGED_ATTEMPT_IMMUTABLE');
      END LOOP;
     ELSE PERFORM meri_host_control.observer_require(new_phase->'executionArn'=old_phase->'executionArn' AND NOT EXISTS(SELECT FROM jsonb_array_elements(old_phase->'historyEventIds') WITH ORDINALITY x(value,n) WHERE new_phase->'historyEventIds'->(x.n::int-1) IS DISTINCT FROM x.value),'MANAGED_OUTCOME_APPEND'); END IF;
    ELSE PERFORM meri_host_control.observer_require(new_phase=old_phase AND meri_host_control.observer_raw(r->>(prefix||'_canonical'),ARRAY[phase])=meri_host_control.observer_raw(old_r->>(prefix||'_canonical'),ARRAY[phase]),'PHASE_IMMUTABLE'); END IF;
   END IF;
   IF old_r->'native_physical_result_json'->phase IS NOT NULL AND old_r->'native_physical_result_json'->phase<>'null'::jsonb THEN
    PERFORM meri_host_control.observer_require(new_phase=old_phase,'FINAL_PHASE_FROZEN');
   END IF;
  END LOOP;
 END LOOP;
 IF OLD.native_physical_context_json->'ordinary'='null'::jsonb AND NEW.native_physical_context_json->'ordinary'<>'null'::jsonb THEN
  PERFORM meri_host_control.observer_require(NEW.state IN('dispatching','unknown','active','revoked','quarantined') AND (NEW.native_physical_context_json#>>'{ordinary,startedAtMs}')::numeric BETWEEN floor(extract(epoch FROM transaction_timestamp())*1000) AND now_ms,'ORDINARY_START');
 END IF;
 PERFORM meri_host_control.observer_journal(r,old_r,TG_OP,now_ms);
 FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
  c:=NEW.native_physical_context_json->phase;s:=NEW.native_physical_resources_json->phase;
  IF s IS NOT NULL AND s<>'null'::jsonb THEN
   PERFORM meri_host_control.observer_require(jsonb_typeof(c)='object','RESOURCE_CONTEXT');PERFORM meri_host_control.observer_resources(r,phase,s);
  END IF;
 END LOOP;
 claim:=NEW.native_physical_dispatch_json->'ordinary';
 IF claim IS NOT NULL AND claim<>'null'::jsonb THEN
  c:=NEW.native_physical_context_json->'ordinary';s:=NEW.native_physical_resources_json->'ordinary';
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(claim,ARRAY['contextSha256','resourcesSha256','dispatchId','ownerProcessId','requestSha256','instanceId','claimedAtMs'])
   AND jsonb_typeof(c)='object' AND jsonb_typeof(s)='object' AND claim->>'dispatchId'~uuid_pattern AND claim->>'ownerProcessId'~uuid_pattern
   AND claim->>'contextSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_context_canonical,ARRAY['ordinary']))
   AND claim->>'resourcesSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_resources_canonical,ARRAY['ordinary']))
   AND claim->'instanceId'=s->'instanceId' AND claim->>'requestSha256'=meri_host_control.observer_hash('{"InstanceIds":['||to_json(s->>'instanceId')::text||']}')
   AND meri_host_control.observer_int(claim->'claimedAtMs',1) AND (claim->>'claimedAtMs')::numeric>=(s->>'completedAtMs')::numeric AND (claim->>'claimedAtMs')::numeric<(c->>'deadlineMs')::numeric,'ORDINARY_CLAIM');
  SELECT value INTO e FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') WHERE value->>'stage'='termination';
  PERFORM meri_host_control.observer_require(e->>'phase'='ordinary' AND e->'operationId'=claim->'dispatchId' AND e#>'{request,dispatchId}'=claim->'dispatchId' AND e#>'{request,instanceId}'=claim->'instanceId' AND e->'startedAtMs'=claim->'claimedAtMs','CLAIM_EVENT');
 ELSE PERFORM meri_host_control.observer_require(NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->>'stage'='termination'),'CLAIM_REQUIRED'); END IF;
 outcome:=NEW.native_physical_dispatch_result_json->'ordinary';
 IF outcome IS NOT NULL AND outcome<>'null'::jsonb THEN
  e:=meri_host_control.observer_event(NEW.native_physical_observations_json,outcome->>'eventId');
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(outcome,ARRAY['dispatchId','eventId']) AND outcome->'dispatchId'=claim->'dispatchId' AND e->>'stage'='termination' AND e#>'{request,dispatchId}'=claim->'dispatchId' AND e->'completion'<>'null'::jsonb,'DISPATCH_OUTCOME');
 END IF;
 PERFORM meri_host_control.observer_require((coalesce(NEW.native_physical_dispatch_json->'managed','null'::jsonb)='null'::jsonb)=(coalesce(NEW.native_physical_dispatch_result_json->'managed','null'::jsonb)='null'::jsonb),'MANAGED_PAIR');
 IF NEW.native_physical_dispatch_json->'managed' IS NOT NULL AND NEW.native_physical_dispatch_json->'managed'<>'null'::jsonb THEN scheduled:=meri_host_control.observer_managed(r); END IF;
 FOREACH phase IN ARRAY ARRAY['ordinary','managed'] LOOP
  outcome:=NEW.native_physical_result_json->phase;IF outcome IS NULL OR outcome='null'::jsonb THEN CONTINUE;END IF;
  c:=NEW.native_physical_context_json->phase;s:=NEW.native_physical_resources_json->phase;
  PERFORM meri_host_control.observer_require(meri_host_control.observer_object(outcome,ARRAY['contextSha256','resourcesSha256','evidenceEventIds','status','reason','finalizedAtMs'])
   AND jsonb_typeof(c)='object' AND outcome->>'contextSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_context_canonical,ARRAY[phase]))
   AND (s IS NULL OR s='null'::jsonb)=(outcome->'resourcesSha256'='null'::jsonb)
   AND (s IS NULL OR s='null'::jsonb OR outcome->>'resourcesSha256'=meri_host_control.observer_hash(meri_host_control.observer_raw(NEW.native_physical_resources_canonical,ARRAY[phase])))
   AND meri_host_control.observer_int(outcome->'finalizedAtMs',1) AND (outcome->>'finalizedAtMs')::numeric<=now_ms
   AND meri_host_control.observer_strings(outcome->'evidenceEventIds',uuid_pattern)
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->>'phase'=phase AND entry->'completion'='null'::jsonb),'PHASE_RESULT');
  FOR ref IN SELECT value FROM jsonb_array_elements_text(outcome->'evidenceEventIds') LOOP PERFORM meri_host_control.observer_require(meri_host_control.observer_event(NEW.native_physical_observations_json,ref) IS NOT NULL,'RESULT_REFERENCE');END LOOP;
  IF outcome->>'status'='verified-absent' THEN
   PERFORM meri_host_control.observer_require(outcome->'reason'='null'::jsonb,'VERIFIED_REASON');
   IF phase='ordinary' THEN dispatch_ms:=(claim->>'claimedAtMs')::numeric;
   ELSE SELECT (x->>'atMs')::numeric INTO dispatch_ms FROM jsonb_array_elements(scheduled) x WHERE x->'instanceId'=s->'instanceId';END IF;
   PERFORM meri_host_control.observer_verified(r,phase,outcome,dispatch_ms);
  ELSE
   PERFORM meri_host_control.observer_require(outcome->>'status'='unknown-final' AND outcome->>'reason' IN('deadline','discovery-incomplete','no-owned-instance','multiple-owned-instances','custody-conflict','preobservation-missing','metadata-missing','operation-unknown','budget-exhausted','superseded-by-full-teardown')
    AND ((outcome->>'finalizedAtMs')::numeric>=(c->>'deadlineMs')::numeric OR outcome->>'reason' IN('custody-conflict','budget-exhausted','multiple-owned-instances','superseded-by-full-teardown')),'UNKNOWN_RESULT');
   IF outcome->>'reason'='superseded-by-full-teardown' THEN PERFORM meri_host_control.observer_require(NEW.native_physical_observations_json->'closedForFullTeardown'<>'null'::jsonb AND NEW.native_physical_result_json#>>'{ordinary,status}'='verified-absent','SUPERSEDED_FENCE'); END IF;
  END IF;
 END LOOP;
 IF NEW.state='terminated' THEN
  PERFORM meri_host_control.observer_require(NEW.native_physical_observations_json#>>'{closedForFullTeardown,receiptSha256}'=NEW.teardown_sha256 AND NEW.native_physical_result_json#>>'{ordinary,status}'='verified-absent'
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(NEW.native_physical_observations_json->'entries') entry WHERE entry->'completion'='null'::jsonb)
   AND NEW.native_physical_result_json->'managed'<>'null'::jsonb,'FULL_TEARDOWN');
 END IF;
 RETURN NEW;
END $$;
COMMIT;

-- UNNUMBERED SOURCE PROPOSAL. NOT a migration, NOT applied. DB assigns the ordinal and qualifies on real PG.
-- Extends the SAME meri_host_control.host_allocations row; no companion table or registry.
-- Predecessors 0001-0004 and reserved 78/79 are immutable. Verified baseline: host_identity/endpoint/state
-- definitions from the actual PG16 captures (f6364913 / 100841ba).
BEGIN;

-- Physical/material fields are NULL until observed and admitted.
ALTER TABLE meri_host_control.host_allocations
 ALTER COLUMN host_identity_json DROP NOT NULL,
 ALTER COLUMN host_identity_sha256 DROP NOT NULL,
 ALTER COLUMN endpoint_json DROP NOT NULL,
 ALTER COLUMN record_sha256 DROP NOT NULL,
 ALTER COLUMN client_cert_sha256 DROP NOT NULL,
 ALTER COLUMN client_dns_name DROP NOT NULL,
 ALTER COLUMN client_cert_not_after_ms DROP NOT NULL,
 ALTER COLUMN server_cert_not_after_ms DROP NOT NULL;

-- 1. Verify the THREE exact predecessor definitions before replacing them. Mismatch aborts.
DO $$
DECLARE d1 text;d2 text;d3 text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO d1 FROM pg_constraint
  WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocations_check3';
 SELECT pg_get_constraintdef(oid) INTO d2 FROM pg_constraint
  WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocations_endpoint_json_check';
 SELECT pg_get_constraintdef(oid) INTO d3 FROM pg_constraint
  WHERE conrelid='meri_host_control.host_allocations'::regclass AND conname='host_allocations_state_check';
 IF d1 IS DISTINCT FROM $q$CHECK ((((jsonb_typeof(host_identity_json) = 'object'::text) AND ((host_identity_json ->> 'hostId'::text) = (host_id)::text) AND ((host_identity_json ->> 'conversationId'::text) = (conversation_id)::text)) IS TRUE))$q$
  OR d2 IS DISTINCT FROM $q$CHECK ((((jsonb_typeof(endpoint_json) = 'object'::text) AND (endpoint_json ?& ARRAY['address'::text, 'port'::text, 'serverName'::text, 'serverFingerprintSha256'::text])) IS TRUE))$q$
  OR d3 IS DISTINCT FROM $q$CHECK ((state = ANY (ARRAY['active'::text, 'revoked'::text, 'quarantined'::text, 'terminated'::text])))$q$
 THEN RAISE EXCEPTION 'HOST0001_CONSTRAINT_DEFINITION_MISMATCH'; END IF;
END $$;
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocations_check3;
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocations_endpoint_json_check;
ALTER TABLE meri_host_control.host_allocations DROP CONSTRAINT host_allocations_state_check;

ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_allocations_state_check CHECK(state IN
  ('reserved','dispatching','unknown','refused','active','revoked','quarantined','terminated'));

-- 2. Same-row pre-effect/bootstrap facts and phase-aware replacements of the two 0001 shape checks.
ALTER TABLE meri_host_control.host_allocations
 ADD COLUMN declaration_json jsonb,
 ADD COLUMN declaration_sha256 char(64),
 ADD COLUMN observed_instance_json jsonb,
 ADD COLUMN dispatch_started_at_ms bigint,
 ADD COLUMN bootstrap_prepare_json jsonb,
 ADD COLUMN bootstrap_install_json jsonb;

ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_allocations_check3 CHECK((
  (state IN ('reserved','dispatching','unknown','refused') AND host_identity_json IS NULL)
  OR
  (state IN ('active','revoked','quarantined','terminated')
   AND jsonb_typeof(host_identity_json)='object'
   AND host_identity_json->>'hostId'=host_id::text
   AND host_identity_json->>'conversationId'=conversation_id::text)
 ) IS TRUE);

ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT host_allocations_endpoint_json_check CHECK((
  (state IN ('reserved','dispatching','unknown','refused') AND endpoint_json IS NULL)
  OR
  (state IN ('active','revoked','quarantined','terminated')
   AND jsonb_typeof(endpoint_json)='object'
   AND endpoint_json ?& ARRAY['address','port','serverName','serverFingerprintSha256'])
 ) IS TRUE);

ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_declaration_shape CHECK((
  (allocation_json->>'hostMode' IS DISTINCT FROM 'native-processing'
   AND declaration_json IS NULL AND declaration_sha256 IS NULL)
  OR
  (allocation_json->>'hostMode'='native-processing'
   AND jsonb_typeof(declaration_json)='object'
   AND char_length(declaration_sha256)=64 AND declaration_sha256 ~ '^[0-9a-f]{64}$'
   AND jsonb_typeof(declaration_json)='object'
   AND declaration_json->>'schema'='meri-native-provisioning-declaration/1'
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

ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_observed_instance_shape CHECK((
  observed_instance_json IS NULL
  OR (
   jsonb_typeof(observed_instance_json)='object'
   AND observed_instance_json ?& ARRAY['instanceId','privateIp']
   AND (observed_instance_json-ARRAY['instanceId','privateIp'])='{}'::jsonb
   AND observed_instance_json->>'instanceId' ~ '^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$'
   AND (
    observed_instance_json->'privateIp'='null'::jsonb
    OR (
     jsonb_typeof(observed_instance_json->'privateIp')='string'
     AND observed_instance_json->>'privateIp' ~ '^((10\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9]))|(192\.168\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9]))|(172\.(1[6-9]|2[0-9]|3[01])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])))$'
    )
   )
  )
 ) IS TRUE);

-- 3. Physical phase: pre-effect rows have NO physical fields; admitted rows have ALL of them.
ALTER TABLE meri_host_control.host_allocations
 ADD CONSTRAINT native_physical_phase CHECK((
  (state IN ('reserved','dispatching','unknown','refused')
   AND host_identity_json IS NULL AND host_identity_sha256 IS NULL AND endpoint_json IS NULL
   AND record_sha256 IS NULL AND client_cert_sha256 IS NULL AND client_dns_name IS NULL
   AND client_cert_not_after_ms IS NULL AND server_cert_not_after_ms IS NULL
   AND allocation_json->>'hostMode'='native-processing')
  OR
  (state IN ('active','revoked','quarantined','terminated')
   AND host_identity_json IS NOT NULL AND host_identity_sha256 IS NOT NULL
   AND endpoint_json IS NOT NULL AND record_sha256 IS NOT NULL AND client_cert_sha256 IS NOT NULL
   AND client_dns_name IS NOT NULL AND client_cert_not_after_ms IS NOT NULL
   AND server_cert_not_after_ms IS NOT NULL)
 ) IS TRUE);

-- 4. Purpose uniqueness: all ownership states reserve; only terminated and PROVEN never-dispatched refused free.
DROP INDEX meri_host_control.one_unterminated_host_per_conversation_purpose;
CREATE UNIQUE INDEX one_unterminated_host_per_conversation_purpose
 ON meri_host_control.host_allocations(tenant_id,conversation_id,COALESCE(allocation_json->>'hostMode','legacy'))
 WHERE state<>'terminated' AND NOT(state='refused' AND dispatch_started_at_ms IS NULL
   AND observed_instance_json IS NULL AND bootstrap_prepare_json IS NULL AND bootstrap_install_json IS NULL);

-- 5. Guard: explicit phase branches. No pre-admission termination; tombstones fully immutable.
CREATE OR REPLACE FUNCTION meri_host_control.guard_allocation() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
DECLARE purpose text;step text;o jsonb;n jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 purpose:=COALESCE(to_jsonb(NEW)->'allocation_json'->>'hostMode','legacy');
 IF TG_OP='INSERT' THEN
  IF purpose='native-processing' THEN
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
 IF OLD.state IN ('refused','terminated') AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
  RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Identity/lease/owner/declaration/credential are ALWAYS immutable.
 IF (to_jsonb(NEW)-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256','host_identity_json','host_identity_sha256','endpoint_json',
  'record_sha256','client_cert_sha256','client_dns_name','client_cert_not_after_ms','server_cert_not_after_ms'])
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Physical fill is allowed ONLY on dispatching/unknown -> active.
 IF (to_jsonb(NEW)-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','observed_instance_json','dispatch_started_at_ms','bootstrap_prepare_json',
  'bootstrap_install_json','teardown_json','teardown_sha256'])
  AND NOT(OLD.state IN ('dispatching','unknown') AND NEW.state='active')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 -- Admitted/terminal physical data is immutable; only state and a valid teardown may change.
 IF OLD.state IN ('active','revoked','quarantined','terminated') AND
  (to_jsonb(NEW)-ARRAY['state','teardown_json','teardown_sha256']) IS DISTINCT FROM
  (to_jsonb(OLD)-ARRAY['state','teardown_json','teardown_sha256'])
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
 IF purpose='native-processing' AND NEW.declaration_json IS NOT NULL AND NEW.state IN ('dispatching','unknown','active') AND NEW.dispatch_started_at_ms IS NULL
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 -- Active new-lineage rows must carry the observed instance that matches the physical identity.
 IF purpose='native-processing' AND NEW.state='active' AND NEW.declaration_json IS NOT NULL AND
  (NEW.observed_instance_json IS NULL OR NEW.observed_instance_json->>'instanceId' IS DISTINCT FROM NEW.host_identity_json->>'instanceId')
  THEN RAISE EXCEPTION 'HOST_ALLOCATION_INSTANCE_IMMUTABLE'; END IF;
 -- Native activation requires BOTH retained successful bootstrap operations with public custody.
 IF purpose='native-processing' AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND
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
 IF purpose='native-processing' AND NEW.state='active' AND OLD.state IN ('dispatching','unknown') AND (
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

-- 6. DB-boundary admission: canonical lock/READ COMMITTED, exact active replay, no duplicate reserved INSERT.
CREATE OR REPLACE FUNCTION meri_host_control.admit_allocation() RETURNS trigger LANGUAGE plpgsql VOLATILE
 SET search_path=pg_catalog AS $$
DECLARE requested_purpose text := COALESCE(NEW.allocation_json->>'hostMode','legacy');found_purposes text[];
BEGIN
 IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'HOST_ALLOCATION_ISOLATION_REFUSED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id||':'||NEW.conversation_id::text,0));
 PERFORM 1 FROM meri_host_control.host_allocations a
  WHERE a.host_id=NEW.host_id AND a.generation=NEW.generation AND a.state='active'
   AND a.allocation_sha256=NEW.allocation_sha256 AND a.record_sha256=NEW.record_sha256;
 IF FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM meri_host_control.host_allocations a WHERE a.host_id=NEW.host_id AND a.generation=NEW.generation;
 IF FOUND THEN RAISE EXCEPTION 'HOST_ALLOCATION_PRESENT'; END IF;
 SELECT array_agg(DISTINCT COALESCE(a.allocation_json->>'hostMode','legacy')) INTO found_purposes
  FROM meri_host_control.host_allocations a
  WHERE a.tenant_id=NEW.tenant_id AND a.conversation_id=NEW.conversation_id AND a.state<>'terminated'
   AND NOT(a.state='refused' AND a.dispatch_started_at_ms IS NULL AND a.observed_instance_json IS NULL
    AND a.bootstrap_prepare_json IS NULL AND a.bootstrap_install_json IS NULL);
 IF found_purposes IS NULL THEN RETURN NEW; END IF;
 IF requested_purpose='legacy' OR 'legacy'=ANY(found_purposes) THEN RAISE EXCEPTION 'HOST_ALLOCATION_PURPOSE_CONFLICT'; END IF;
 IF requested_purpose=ANY(found_purposes) THEN RAISE EXCEPTION 'HOST_ALLOCATION_PRESENT'; END IF;
 RETURN NEW;
END $$;

-- 7. Minimal privileges for the EXISTING NOLOGIN allocator role.
GRANT UPDATE (state,dispatch_started_at_ms,observed_instance_json,bootstrap_prepare_json,bootstrap_install_json,
 host_identity_json,host_identity_sha256,endpoint_json,record_sha256,client_cert_sha256,client_dns_name,
 client_cert_not_after_ms,server_cert_not_after_ms,teardown_json,teardown_sha256)
 ON meri_host_control.host_allocations TO meri_host_allocator;

COMMIT;

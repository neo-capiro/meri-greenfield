-- Single physical browser host owner shared by routing and currentness. Source only.
-- Allocation/credential issuance belongs to the trusted provisioning role; control can only read and consume nonces.
BEGIN;
CREATE SCHEMA meri_host_control;
REVOKE ALL ON SCHEMA meri_host_control FROM PUBLIC;
CREATE TABLE meri_host_control.host_allocations (
 host_id uuid NOT NULL, generation bigint NOT NULL CHECK(generation>0),
 tenant_id text NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 128), conversation_id uuid NOT NULL,
 allocation_json jsonb NOT NULL, allocation_sha256 char(64) NOT NULL CHECK(allocation_sha256~'^[0-9a-f]{64}$'),
 original_binding_json jsonb NOT NULL, host_identity_json jsonb NOT NULL,
 host_identity_sha256 char(64) NOT NULL CHECK(host_identity_sha256~'^[0-9a-f]{64}$'),
 owner_instance_id uuid NOT NULL, endpoint_json jsonb NOT NULL,
 record_sha256 char(64) NOT NULL CHECK(record_sha256~'^[0-9a-f]{64}$'),
 client_cert_sha256 char(64) NOT NULL UNIQUE CHECK(client_cert_sha256~'^[0-9a-f]{64}$'),
 client_dns_name text NOT NULL, client_cert_not_after_ms bigint NOT NULL CHECK(client_cert_not_after_ms>0),
 server_cert_not_after_ms bigint NOT NULL CHECK(server_cert_not_after_ms>0),
 credential_revision bigint NOT NULL CHECK(credential_revision=1),
 lease_deadline_ms bigint NOT NULL CHECK(lease_deadline_ms>0),
 state text NOT NULL CHECK(state IN ('active','revoked','quarantined','terminated')),
 PRIMARY KEY(host_id,generation),
 CHECK(client_cert_not_after_ms<=lease_deadline_ms AND server_cert_not_after_ms<=lease_deadline_ms),
 CHECK((jsonb_typeof(allocation_json)='object' AND allocation_json->>'hostId'=host_id::text
   AND allocation_json->>'tenantId'=tenant_id AND allocation_json->>'conversationId'=conversation_id::text
   AND allocation_json->'generation'=to_jsonb(generation) AND allocation_json->'leaseDeadlineMs'=to_jsonb(lease_deadline_ms)) IS TRUE),
 CHECK((jsonb_typeof(original_binding_json)='object' AND original_binding_json->>'tenantId'=tenant_id
   AND original_binding_json->>'conversationId'=conversation_id::text) IS TRUE),
 CHECK((jsonb_typeof(host_identity_json)='object' AND host_identity_json->>'hostId'=host_id::text
   AND host_identity_json->>'conversationId'=conversation_id::text) IS TRUE),
 CHECK((jsonb_typeof(endpoint_json)='object' AND endpoint_json ?& ARRAY['address','port','serverName','serverFingerprintSha256']) IS TRUE)
);
-- A revoked or quarantined host may still exist physically. It cannot be replaced until verified teardown.
CREATE UNIQUE INDEX one_unterminated_host_per_conversation ON meri_host_control.host_allocations(tenant_id,conversation_id) WHERE state<>'terminated';
CREATE TABLE meri_host_control.request_nonces (
 host_id uuid NOT NULL, generation bigint NOT NULL, nonce_sha256 char(64) NOT NULL CHECK(nonce_sha256~'^[0-9a-f]{64}$'),
 PRIMARY KEY(host_id,generation,nonce_sha256),
 FOREIGN KEY(host_id,generation) REFERENCES meri_host_control.host_allocations ON DELETE RESTRICT
);
CREATE FUNCTION meri_host_control.guard_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.state<>'active' THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
   RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') THEN RAISE EXCEPTION 'HOST_ALLOCATION_IMMUTABLE'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
   (OLD.state='active' AND NEW.state IN ('revoked','quarantined','terminated')) OR
   (OLD.state IN ('revoked','quarantined') AND NEW.state='terminated')
 ) THEN RAISE EXCEPTION 'HOST_ALLOCATION_STATE_REFUSED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER host_allocation_immutable BEFORE INSERT OR UPDATE OR DELETE ON meri_host_control.host_allocations FOR EACH ROW EXECUTE FUNCTION meri_host_control.guard_allocation();
-- PostgreSQL row locks otherwise require an UPDATE grant. Fixed definer functions
-- retain the row lock in the caller's transaction without granting mutation rights.
CREATE FUNCTION meri_host_control.lock_allocation(requested_host uuid,requested_generation bigint)
 RETURNS SETOF meri_host_control.host_allocations LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT * FROM meri_host_control.host_allocations WHERE host_id=requested_host AND generation=requested_generation FOR SHARE
$$;
CREATE FUNCTION meri_host_control.lock_conversation(requested_tenant text,requested_conversation uuid)
 RETURNS SETOF meri_host_control.host_allocations LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT * FROM meri_host_control.host_allocations WHERE tenant_id=requested_tenant AND conversation_id=requested_conversation AND state<>'terminated' FOR SHARE
$$;
REVOKE ALL ON ALL TABLES IN SCHEMA meri_host_control FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA meri_host_control FROM PUBLIC;
-- Do not create login identities or grant role membership. Deployment maps its existing issuer/control identities.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='meri_host_allocator') THEN CREATE ROLE meri_host_allocator NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='meri_host_currentness') THEN CREATE ROLE meri_host_currentness NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA meri_host_control TO meri_host_allocator,meri_host_currentness;
GRANT SELECT,INSERT ON meri_host_control.host_allocations TO meri_host_allocator;
GRANT UPDATE(state) ON meri_host_control.host_allocations TO meri_host_allocator;
GRANT SELECT ON meri_host_control.host_allocations TO meri_host_currentness;
GRANT SELECT,INSERT ON meri_host_control.request_nonces TO meri_host_currentness;
GRANT EXECUTE ON FUNCTION meri_host_control.lock_allocation(uuid,bigint),meri_host_control.lock_conversation(text,uuid) TO meri_host_currentness,meri_host_allocator;
COMMIT;

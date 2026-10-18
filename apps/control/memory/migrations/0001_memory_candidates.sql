-- CANDIDATE migration (Fable, lane B, 18 October 2026): the producer journal of apps/control/memory/postgres-journal.mjs.
-- No owner has allocated this ID yet (M1 request of 16 October, PR #121) and no runtime applies it. CREATE-only, in the Meri-owned
-- schema meri_memory; no role, grant, seed, ALTER or DROP. The body below is the meri_memory section of
-- docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql, unchanged.
CREATE SCHEMA meri_memory;

-- Producer outbox. The candidate and its hash are written once; only the submission columns move. Review status lives in Core.
CREATE TABLE meri_memory.candidates (
  tenant_id         text        NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  candidate_id      uuid        NOT NULL,
  proposer_actor_id text        NOT NULL CHECK (length(proposer_actor_id) BETWEEN 1 AND 128),
  idempotency_key   text        NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_sha256    char(64)    NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  candidate         jsonb       NOT NULL,
  candidate_sha256  char(64)    NOT NULL CHECK (candidate_sha256 ~ '^[a-f0-9]{64}$'),
  scope             text        NOT NULL CHECK (scope IN ('personal','client','firm')),
  client_id         uuid        NULL,
  created_at        timestamptz NOT NULL,
  submission_state  text        NOT NULL CHECK (submission_state IN ('PREPARED','SUBMITTED','SUBMISSION_UNKNOWN')),
  review_id         uuid        NULL,
  submitted_at      timestamptz NULL,
  PRIMARY KEY (tenant_id, candidate_id),
  UNIQUE (tenant_id, proposer_actor_id, idempotency_key),
  CHECK ((scope = 'client') = (client_id IS NOT NULL)),
  CHECK ((submission_state = 'SUBMITTED') = (review_id IS NOT NULL))
);
CREATE INDEX candidates_proposer_recent ON meri_memory.candidates (tenant_id, proposer_actor_id, created_at DESC, candidate_id DESC);

-- Immutability: identity, request and candidate columns can never change after insert.
CREATE FUNCTION meri_memory.candidates_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.tenant_id, NEW.candidate_id, NEW.proposer_actor_id, NEW.idempotency_key, NEW.request_sha256, NEW.candidate, NEW.candidate_sha256,
      NEW.scope, NEW.client_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.candidate_id, OLD.proposer_actor_id, OLD.idempotency_key, OLD.request_sha256, OLD.candidate, OLD.candidate_sha256,
      OLD.scope, OLD.client_id, OLD.created_at) THEN
    RAISE EXCEPTION 'memory candidates are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER candidates_immutable BEFORE UPDATE ON meri_memory.candidates FOR EACH ROW EXECUTE FUNCTION meri_memory.candidates_immutable();

-- Existing CONTROL role only. Runtime/worker roles receive no upload row or object authority.
-- DELETE is consumed by the existing exact-target retention purge after suppression, never by read handlers.
GRANT USAGE ON SCHEMA meri_uploads TO meri_control_runtime;
GRANT SELECT, INSERT, DELETE ON meri_uploads.originals TO meri_control_runtime;
GRANT UPDATE (revision, record, record_sha256) ON meri_uploads.originals TO meri_control_runtime;

-- Per-run turn ceiling for long research jobs: tenant settings may now choose up to 1000 turns (packages/contracts/run-limits.mjs
-- MAX_RUN_TURNS), and a never-configured row defaults to 100 turns / USD 10 per run (DEFAULT_MODEL_LIMITS). 0021 remains immutable
-- history; configured tenant rows, the monthly cap and every grant are untouched. PostgreSQL named the 0021 column CHECK
-- tenant_settings_sdk_max_turns_check. Deployment is a separately reviewed operation (snapshot first).
BEGIN;
ALTER TABLE meri_settings.tenant_settings
 DROP CONSTRAINT tenant_settings_sdk_max_turns_check,
 ADD CONSTRAINT tenant_settings_sdk_max_turns_check CHECK (sdk_max_turns BETWEEN 1 AND 1000),
 ALTER COLUMN sdk_max_turns SET DEFAULT 100,
 ALTER COLUMN sdk_max_budget_micro_usd SET DEFAULT 10000000;
COMMIT;

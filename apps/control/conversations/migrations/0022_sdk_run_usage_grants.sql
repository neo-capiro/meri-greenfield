-- Item 0 step 2: control reads canonical model policy and records usage on its existing run.
-- Schema usage and runs SELECT come from the earlier integration/first-chat grants.
-- Policy remains read-only; no lock-only UPDATE privilege is needed for a statement snapshot.
BEGIN;
GRANT SELECT (tenant_id,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd)
 ON TABLE meri_settings.tenant_settings TO meri_control_runtime;
GRANT UPDATE (sdk_usage,sdk_usage_sha256,sdk_charge_micro_usd,sdk_usage_recorded_at)
 ON TABLE meri_conversations.runs TO meri_control_runtime;
COMMIT;

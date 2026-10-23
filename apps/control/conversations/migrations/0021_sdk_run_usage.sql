-- Item 0 step 2, root-allocated 0021. Existing run rows own accounting; no reservation or settlement ledger.
-- Prior migrations and historical budget tables remain unchanged. Deployment is a separately reviewed operation.
BEGIN;
ALTER TABLE meri_settings.tenant_settings
 ADD COLUMN monthly_cap_micro_usd bigint CHECK (monthly_cap_micro_usd BETWEEN 1 AND 9007199254740991),
 ADD COLUMN sdk_max_turns integer NOT NULL DEFAULT 20 CHECK (sdk_max_turns BETWEEN 1 AND 100),
 ADD COLUMN sdk_max_budget_micro_usd bigint NOT NULL DEFAULT 2000000 CHECK (sdk_max_budget_micro_usd BETWEEN 1 AND 9007199254740991);

-- Existing caps are policy, not spend or reservations. Carry them exactly; never invent a monthly default.
-- The literal base document is JCS {"capabilityPolicy":{},"defaultTimezone":"UTC"}; its SHA is verified by source tests.
INSERT INTO meri_settings.tenant_settings
 (tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd)
 SELECT tenant_id,1,'{"capabilityPolicy":{},"defaultTimezone":"UTC"}'::jsonb,
 '3c363ad696e13b00e9fae192f9ddd3be74b75a5ad957b891cb296659902f8564',clock_timestamp(),'migration:0021',monthly_cap_micro_usd
 FROM meri_product_budget.tenant_budgets
 ON CONFLICT (tenant_id) DO UPDATE SET monthly_cap_micro_usd=EXCLUDED.monthly_cap_micro_usd;

ALTER TABLE meri_conversations.runs
 ADD COLUMN sdk_usage jsonb CHECK (sdk_usage IS NULL OR jsonb_typeof(sdk_usage)='object'),
 ADD COLUMN sdk_usage_sha256 text CHECK (sdk_usage_sha256 IS NULL OR sdk_usage_sha256 ~ '^[a-f0-9]{64}$'),
 ADD COLUMN sdk_charge_micro_usd bigint CHECK (sdk_charge_micro_usd BETWEEN 0 AND 9007199254740991),
 ADD COLUMN sdk_usage_recorded_at timestamptz,
 ADD CONSTRAINT sdk_usage_record_consistent CHECK ((
  (sdk_usage IS NULL AND sdk_usage_sha256 IS NULL AND sdk_charge_micro_usd IS NULL AND sdk_usage_recorded_at IS NULL) OR
  (sdk_usage IS NOT NULL AND sdk_usage_sha256 IS NOT NULL AND sdk_usage_recorded_at IS NOT NULL AND
   ((sdk_usage->>'status'='recorded' AND sdk_charge_micro_usd IS NOT NULL AND sdk_usage->>'chargeMicroUsd'=sdk_charge_micro_usd::text) OR
    (sdk_usage->>'status'='unavailable' AND sdk_charge_micro_usd IS NULL AND sdk_usage->'chargeMicroUsd'='null'::jsonb)))) IS TRUE);
CREATE INDEX runs_sdk_monthly_usage ON meri_conversations.runs(tenant_id,sdk_usage_recorded_at)
 WHERE sdk_usage IS NOT NULL;
COMMIT;

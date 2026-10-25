-- The existing tenant settings store reads all persisted columns, performs
-- revision-checked saves, and appends/reads audit records through the control role.
-- Core's current membership and tenant.settings.manage permission remain the
-- authority for tenant administration; the canonical store retains CAS and audit.
BEGIN;

GRANT SELECT (tenant_id, revision, document, document_sha256, updated_at, updated_by,
  monthly_cap_micro_usd, sdk_max_turns, sdk_max_budget_micro_usd),
  INSERT (tenant_id, revision, document, document_sha256, updated_at, updated_by,
  monthly_cap_micro_usd, sdk_max_turns, sdk_max_budget_micro_usd)
ON meri_settings.tenant_settings TO meri_control_runtime;

GRANT UPDATE (revision, document, document_sha256, updated_at, updated_by,
  monthly_cap_micro_usd, sdk_max_turns, sdk_max_budget_micro_usd)
ON meri_settings.tenant_settings TO meri_control_runtime;

-- INSERT is already granted by the immutable integration installer. Reading the
-- existing bounded audit route also needs tenant_id for its tenant predicate.
GRANT SELECT (sequence, audit_id, tenant_id, target, subject_actor_id, actor_id,
  from_revision, to_revision, before_sha256, after_sha256, platform_sha256,
  changed_fields, recorded_at)
ON meri_settings.settings_audit TO meri_control_runtime;

COMMIT;

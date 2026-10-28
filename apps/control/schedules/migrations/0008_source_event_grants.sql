-- Only the existing schedule-domain runtime receives producer events and retains the approved
-- binding. No worker grant, default privilege, delete/truncate or table-wide update; the
-- binding table stays INSERT-only for the runtime (its trigger already refuses every UPDATE).
REVOKE ALL ON meri_schedules.source_event_bindings FROM PUBLIC;
GRANT SELECT, INSERT ON meri_schedules.source_event_bindings TO meri_control_runtime;
REVOKE ALL ON meri_schedules.source_events FROM PUBLIC;
GRANT SELECT, INSERT ON meri_schedules.source_events TO meri_control_runtime;
GRANT UPDATE (state,code,occurrence_key,updated_at) ON meri_schedules.source_events TO meri_control_runtime;

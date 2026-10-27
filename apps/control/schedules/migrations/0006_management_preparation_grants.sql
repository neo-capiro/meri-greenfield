-- Only the existing authenticated foreground Control owner may retain a proposal.
-- No worker grant, default privilege, delete/truncate or table-wide update.
REVOKE ALL ON meri_schedules.management_preparations FROM PUBLIC;
GRANT SELECT, INSERT ON meri_schedules.management_preparations TO meri_control_runtime;
GRANT UPDATE (state,proposal_id,outcome,settled_at) ON meri_schedules.management_preparations TO meri_control_runtime;

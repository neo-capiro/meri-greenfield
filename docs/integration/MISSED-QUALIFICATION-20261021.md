# Missed qualification source recovery, 21 October 2026

Base: `3c56c3e981ba868a2af103c4cae9f65a0d47458d` (current published main at audit start).

The human requested complete source consolidation, then explicitly retained final merges and narrowed the work to gaps not already covered by existing consolidation branches or active owners. This supplemental branch recovers the remaining compatible qualification source; it is not another full runtime consolidation, a deployment, or a live database operation.

## Implementation outline

- Recover the three trusted invocation PostgreSQL qualification files from PR27 `7b2167834e624825d07a16950211c448a841865b`.
- Reuse the current canonical direct authenticated loopback admission helper, trusted invocation owner, durable gateway and budget implementation. Do not revive PR25's prepared-container trust profile or introduce a second admission path.
- Keep all twelve native assertions: trusted production and normalization, four post-COMMIT acknowledgement-loss phases, independent-pool contention and producer identity, read-only reconciliation, request/context substitution refusal, disabled execution, forged completion refusal, and preservation of UNKNOWN accounting.
- Keep explicit admission and migration-0003 hash checks ahead of application imports or pool construction. The native entry remains outside ordinary test discovery and performs no migration/schema creation.
- Adapt only the offline admission fixture to the current direct-loopback password profile and portable file URL handling. Verify the offline suite and parse all recovered modules. Actual PostgreSQL contention, narrow-role and image qualification remain unrun; this task does not allocate an engine or apply migrations.

## Preserved ownership and holds

Existing PR189 read composition, PR190 write composition, B1/B2 contract proposals, configuration adoption, P2 proof reuse and current c10 chat lanes remain separately identified in the audit ledger. Browser host qualification, memory tombstone owner reconciliation, application migrations and deployment remain held. The Core-owned Planner continuation replaces the old Meri Planner loop under D7-1; the old loop is not restored.

The current first-response and next-turn SDK configuration-directory repairs remain on the base. No established branch or PR is merged by this work.

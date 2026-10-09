# Dependency queue

Git-backed task ledger is the selected fallback because no qualified active Hermes dispatcher exists. This preparation ledger becomes authoritative only after repository initialization. Codex updates it after independent acceptance; worker status never promotes dependencies automatically. Initial limit: three implementation sessions plus one separate reviewer, with H00 alone first.

| Task/package | State | Dependencies | Owner/owned paths | Acceptance |
| --- | --- | --- | --- | --- |
| W00 discovery | in progress | user decisions/source discovery | Codex, docs/coordination and inventory | real repository/account/region/source/scope decisions |
| W01 contracts 0.1.0 | independently reviewed, awaiting pinned commit | independent source policy discovery | Codex, packages/contracts and root lockfile | review accepted, 10 checks passed; pinned freeze commit pending |
| H00 Hermes qualification | prepared, not launched | confirmed repository + accepted W01 freeze | one Hermes implementation session, evals/qualification/hermes-session* and own handoff only | edit/checkpoint/explicit resume/commit; independent Hermes review and Codex rerun |
| W02 runtime qualification | queued | W00–W01 + accepted H00 | Lane A, apps/worker/qualification and scoped infra qualification paths | pinned SDK/CLI/Chromium/Office/proxy, Fargate sandbox/egress, interrupt+state/files restore, Temporal topology |
| W03 isolated foundation | queued | accepted W02 | Lane A, new infra only | G2 new stack, sources disabled, IAM/network/encryption/ownership fixtures |
| W04 authorization and reads | queued | W01; W03 for live sources | Lane B, apps/gateway and own eval fixtures | G3 all agreed domains, tenant/wall/mail/private-memory/revocation fixtures |
| W05 durable runs | queued | W02–W03 | Lane A, apps/control+broker worker assignments | SDK+file recovery, approval restart, fencing/cancel/schedules |
| W06 workspace UI | queued | W01; W05 for live integration | Lane C, apps/web | every visible control has live E2E check |
| W07 artifacts/browser | queued | W02; W04–W06 for integration | Lane C, sequential scoped tickets | native bytes/render/revise, public browser then individually qualified authenticated work |
| W08 commands | queued | accepted W04+W05 | Lane B, scoped command handlers | immutable approval/current authority/idempotency/receipts, zero duplicate effects |
| W09 independent verification | queued | starts with W01 | Lane D separate Hermes reviewer | exact-commit evidence; no own implementation review |
| W10 immutable staging | queued | W03–W09 accepted | Codex deploy, D verifies | full G6 suite and candidate manifest, restore/rollback/in-flight compatibility |
| W11 controlled release | queued, not authorized | W10 plus release authorization | Codex | G7 internal/tenant canary; cutover only after complete tests and explicit owner authorization |

No migration IDs allocated. No cloud deployment, live source operation, production task or dependent live integration is ready. Reserve shared paths and migrations per ticket before launch.

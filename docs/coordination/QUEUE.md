# Dependency queue

Git-backed task ledger is the selected fallback because no qualified active Hermes dispatcher exists. This preparation ledger becomes authoritative only after repository initialization. Codex updates it after independent acceptance; worker status never promotes dependencies automatically. Initial limit: three implementation sessions plus one separate reviewer, with H00 alone first.

| Task/package | State | Dependencies | Owner/owned paths | Acceptance |
| --- | --- | --- | --- | --- |
| W00 discovery | in progress | user decisions/source discovery | Codex, docs/coordination and inventory | real repository/account/region/source/scope decisions |
| W01 contracts 0.1.0 | frozen at 7a44d575 | independent source policy discovery | Codex, packages/contracts and root lockfile | review accepted, 10 checks passed; contracts/v0.1.0 pinned |
| H00 Hermes qualification | accepted a398b9ea | confirmed repository + accepted W01 freeze | one Hermes implementation session, evals/qualification/hermes-session* and own handoff only | explicit resume verified; separate Hermes review + Codex exact-commit rerun, 15 checks passed; findings in H00-ACCEPTANCE.md |
| W02 runtime qualification | second reviewed imagef4f008f built; scan12critical/64high unaccepted; baseline taskSTOPPEDbeforestartup/DNSCNAME repairreviewed; securityrefreshactive/proxy0575bb4pendingreview; G1 open | W01+H00; source work separately gated G0 | Hermes worker owns15 paths/proxy12; Codex new qualification Build+Runtime resources | exact G1 checklist in docs/qualification/G1-REMAINING-WORK.md; no dependent promotion |
| W03 isolated foundation | queued | accepted W02 | Lane A, new infra only | G2 new stack, sources disabled, IAM/network/encryption/ownership fixtures |
| W04 authorization and reads | queued | W01; W03 for live sources | Lane B, apps/gateway and own eval fixtures | G3 all agreed domains, tenant/wall/mail/private-memory/revocation fixtures |
| W05 durable runs | queued | W02ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“W03 | Lane A, apps/control+broker worker assignments | SDK+file recovery, approval restart, fencing/cancel/schedules |
| W06 workspace UI | queued | W01; W05 for live integration | Lane C, apps/web | every visible control has live E2E check |
| W07 artifacts/browser | queued | W02; W04ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“W06 for integration | Lane C, sequential scoped tickets | native bytes/render/revise, public browser then individually qualified authenticated work |
| W08 commands | queued | accepted W04+W05 | Lane B, scoped command handlers | immutable approval/current authority/idempotency/receipts, zero duplicate effects |
| W09 independent verification | queued | starts with W01 | Lane D separate Hermes reviewer | exact-commit evidence; no own implementation review |
| W10 immutable staging | queued | W03ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“W09 accepted | Codex deploy, D verifies | full G6 suite and candidate manifest, restore/rollback/in-flight compatibility |
| W11 controlled release | queued, not authorized | W10 plus release authorization | Codex | G7 internal/tenant canary; cutover only after complete tests and explicit owner authorization |

No migration IDs allocated. Only the two new qualification stacks have deployed; first synthetic baseline task is confirmedSTOPPED20:43:31Z; no active task currently. No source operation, production task or dependent live integration is ready. Reserve shared paths and migrations per ticket before launch.

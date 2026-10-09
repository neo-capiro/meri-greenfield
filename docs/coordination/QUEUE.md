# Dependency queue

Git-backed task ledger is the selected fallback because no qualified active Hermes dispatcher exists. This preparation ledger becomes authoritative only after repository initialization. Codex updates it after independent acceptance; worker status never promotes dependencies automatically. Initial limit: three implementation sessions plus one separate reviewer, with H00 alone first.

| Task/package | State | Dependencies | Owner/owned paths | Acceptance |
| --- | --- | --- | --- | --- |
| W00 discovery | in progress | user decisions/source discovery | Codex, docs/coordination and inventory | real repository/account/region/source/scope decisions |
| W01 contracts 0.1.0 | frozen at 7a44d575 | independent source policy discovery | Codex, packages/contracts and root lockfile | review accepted, 10 checks passed; contracts/v0.1.0 pinned |
| H00 Hermes qualification | accepted a398b9ea | confirmed repository + accepted W01 freeze | one Hermes implementation session, evals/qualification/hermes-session* and own handoff only | explicit resume verified; separate Hermes review + Codex exact-commit rerun, 15 checks passed; findings in H00-ACCEPTANCE.md |
| W02 runtime qualification | baseline3 STOPPED exit1:5/6 passed, Chromium namespace EPERM; new browser host approved D005; scan2critical/13high unresolved; G1 open | W01+H00; source work separately gated G0 | Worker797da3a and proxy1ba863b accepted preparation only; Codex new resources | image7327 from source8785118; exact G1 checklist; no dependent promotion |
| W02-03 Temporal compatibility | d96168b accepted design/offline after separate real Hermes review and owner15+22 checks/typecheck | W01+H00, independent G1 design | implementation20261009_171204_d65a88,14paths; reviewer20261009_175809_821a18 | W02-03-TEMPORAL-ACCEPTANCE; live Temporal HA/recovery unrun |
| W02-04 UI transport compatibility | final3c836ee/code7d094e1 accepted offline; separate real Hermes review and owner15+19/typecheck passed | W01+H00, independent G1 preparation | implementation20261009_172411_d70282,14paths; reviewer20261009_180714_1c878e | composed writer/transport/externalChat and owner adversarial checks; no deployed UI claim |
| W02-05 SDK synthetic wire capture | bounded real Hermes implementation active; native execution not authorized to writer | accepted worker/proxy preparation; independent G1 wire evidence | hermes/w02-sdk-capture,4new files, basea41e83b,40turns/3600sec | exact public SDK/protocol options, offline negative fixtures; separate review before owner build/run |
| W02-06 dedicated browser host | bounded real Hermes preparation active; no host launched | explicit userD005, image7327; independent G1 browser qualification | hermes/w02-browser-host,9new files, base76148d6,40turns/3600sec | exact new-resource template/bootstrap/seccomp/observer/deadline reviews before owner cloud execution |
| W03 isolated foundation | queued | accepted W02 | Lane A, new infra only | G2 new stack, sources disabled, IAM/network/encryption/ownership fixtures |
| W04 authorization and reads | queued | W01; W03 for live sources | Lane B, apps/gateway and own eval fixtures | G3 all agreed domains, tenant/wall/mail/private-memory/revocation fixtures |
| W05 durable runs | queued | W02 and W03 | Lane A, apps/control+broker worker assignments | SDK+file recovery, approval restart, fencing/cancel/schedules |
| W06 workspace UI | queued | W01; W05 for live integration | Lane C, apps/web | every visible control has live E2E check |
| W07 artifacts/browser | queued | W02; W04-W06 for integration | Lane C, sequential scoped tickets | native bytes/render/revise, public browser then individually qualified authenticated work |
| W08 commands | queued | accepted W04+W05 | Lane B, scoped command handlers | immutable approval/current authority/idempotency/receipts, zero duplicate effects |
| W09 independent verification | queued | starts with W01 | Lane D separate Hermes reviewer | exact-commit evidence; no own implementation review |
| W10 immutable staging | queued | W03-W09 accepted | Codex deploy, D verifies | full G6 suite and candidate manifest, restore/rollback/in-flight compatibility |
| W11 controlled release | queued, not authorized | W10 plus release authorization | Codex | G7 internal/tenant canary; cutover only after complete tests and explicit owner authorization |

No migration IDs allocated. Only the two new qualification stacks have deployed. All baseline tasks are stopped; latest4a9c2d40 STOPPED21:58:08.400Z, exit1. No active task, source operation, production service or dependent live integration is ready. D005 authorizes qualification of a NEW isolated browser host; app/control remain Fargate. Reserve shared paths and migrations per ticket before launch.

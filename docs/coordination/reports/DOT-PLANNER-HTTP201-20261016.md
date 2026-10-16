# Focused Core materializer compatibility correction

Source `a18efc52738fd731cd9264cbe30366d73a705e61`, tree `5e4fac39d34a8c524ddf42938c27157b4204a2cc`, directc8c48227. Only `apps/control/objective-planner/materializer.mjs` and its existing test file changed. Original b8 source/evidence is preserved. This fixes compatibility with the Core622 Nest materializer: POST success201, GET success200. No unsupported200 POST fallback. All observations remain mutable; no immutable ACK/application authority is inferred.

Evidence `docs/qualification/candidates/dot-planner-20261016/http201-{before,after}.*`: new valid201/malformed201/oversized201/method-status cases against original code produced34pass/3fail; corrected source37/37. Raw failure/success output and exact source hashes/argv remain. POST malformed/oversized201 stays UNKNOWN; no retry, bounded body/deadline/cancellation preserved. One synthetic Node process, heap128MiB, hard wall30s, working-set cap256MiB, sampled peak49,246,208bytes, elapsed171ms, free physical memory11,689,480,192bytes; process exited, no ports/services. Hash-only dependency stub and fixed scripted transport; no real Core/Temporal/DB/provider qualification. Diff check passed.

Parent independently accepted separate model terminal-fence source af5804e507ad27a07b9375b52d91b5b7b0b4d0a4, author7/7; no independent test execution inferred. Qualification owns its integration.

Actual fixed objective.plan.prepare/immutable ACK/read/defaultcanonical association remains a distinct Core-owned source contract. The new server/Temporal continuation successor will use that fixed receiving contract, not this compatibility client. No held0012, frozen contract, runtime activation or credential change.

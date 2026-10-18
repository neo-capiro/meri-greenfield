# Terminal independent review — REVIEWED_HOLD / DO NOT RUN

Retained historical receipts, failed attempts, sanitization and outcome claims: **ACCEPT for handoff only**. Portable wrapper execution: **HOLD / DO NOT RUN**. Parent instructed safe-stop and publication of the disclosed defect instead of continuing implementation. No database or operating-system process qualification was performed for this wrapper.

Remaining defect: `scripts/qualification/user-preferences/run.mjs` bounds subprocesses through `host.run`, but calls `admin.connect()`, owned-client `connect()` and `admin`/`setup`/`restored` `query()` directly. Their fixed driver timeouts do not check the approved absolute deadline before invocation. A sufficiently slow sequence can issue later CREATE DATABASE, schema, GRANT or snapshot SQL after the approved cutoff before another subprocess observes the normal-work reserve. Existing cleanup and late-HOLD behavior do not authorize that later SQL. Do not use `--execute`, even with a supplied approval reference.

Future repair instructions, requiring a separate source task and review:

1. Route every main PostgreSQL connection and query through one normal-work admission/bound that checks the absolute approved cutoff minus the cleanup reserve before any call begins, and caps each call's timeout to the remaining permitted work time.
2. Keep owned cleanup closes on their separate shared cleanup budget; do not remove the cutoff/late-HOLD checks or weaken PID/process/data-directory ownership guards. A timeout is not proof of physical SQL cancellation.
3. Review the complete repaired source and refresh the exact source/head/tree and bundle manifest. Only then seek explicit approval for a future disposable local run. Do not reuse the historical approval or denied retry as execution authority.
4. Correct the canonical test's separate CIDR comparison defect only in its separately owned, reviewed source task; that test and reserved SQL are unchanged here. Preserve all failed receipts. No further implementation or execution occurred after this terminal review.

Previously raised wrapper findings are addressed at source-review level: connection-close and shared-cleanup bounds, mandatory late-window HOLD, independent OS start-time plus actual data-directory argument binding against PID reuse, conservative unknown-start preservation, Node24 preflight and safe-output path masking. Their operating-system/database execution remains **UNRUN**. Four syntax checks and five inert CLI checks passed before the terminal documentation-only labels; these do not establish safe execution of the runner.

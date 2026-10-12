# Read-only fresh Windows runner capture

Base: `19d64a1b5446337ad10a0068229164133756a073`, tree `63af3468f319fc07ecb16cd71fc01f546654f759`. Dedicated branch/worktree: `task/fresh-runner-capture-20261011`, `meri-fresh-runner-capture-20261011`.

The collector produces measured source-only observations for the actual Windows Python 3.11.15 shipper. It grants no runner/build/security/runtime authority and makes no AWS API request. STS remains a separate canonical shipper operation.

Ownership and outline:

- `worker_runner_inventory.py`: selected stdlib/native/runtime/helper membership, identity checks, streaming SHA-256, bounded time/bytes/members, stable rescan, and exclusive observation-file ownership/cleanup. Filesystem and clock are injected. Borrowed runtimes and parents are never modified or removed.
- `worker_runner_capture.py`: thin argument/configuration and actual host identity adapter, composition, canonical local AWS CLI `--version` with bounded subprocess output/teardown, and CLI exit handling. The version runner is injected in tests. It never calls STS or loads credentials.
- `test_worker_runner_capture.py`: source-only filesystem/process/configuration negatives and successful synthetic observations. Windows execution remains unrun here.
- This task, matching report and `docs/qualification/candidates/fresh-runner-capture-20261011/**`: scrubbed local evidence only.

Canonical helper paths derive from existing builder `HELPERS`, adding the binding module and both new capture owners as a distinct measured profile. Historical tuple, pins, authorities and execution paths remain untouched. Coverage explicitly excludes site-packages, the whole Hermes environment and the AWS CLI's complete installation closure.

The CLI requires an explicit read-only capture flag and a fresh absolute output slot under this checkout's existing `.task-inputs` directory. Host/version and configuration refusal precede filesystem inventory, native invocation or output allocation. Collection is bounded and import-safe. Checks cover exact membership stability, missing/extra/duplicate/casefold paths, symlink/reparse/hardlink refusal, mutation, limits/deadlines, invalid/wrong-host configuration and cleanup of exclusively owned output. No recursive delegation, network/cloud/Docker/provider action or remote Git publication is permitted in this lane. Primary independently reviews the return before publication or actual shipper execution.

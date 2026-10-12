# AWS shipper next read-only measurement

**READ_ONLY_HOST_CAPTURE. NOT_EXECUTABLE_BUILD_PACKET. Zero AWS requests from this collector.**

Accepted collector source: author `a3c3c340218690ff1b02672ab50565014f51eae2`, tree `b4f70e4cb2edc6c2e894edbb3aaf3acb2869c2e4`; final independent review `ae4ba22ea5b598cc808270acc252435aa0fbe7d3`. The [review](CODEX-FRESH-RUNNER-CAPTURE-FINAL-INDEPENDENT-20261012.md) accepts source and direct-child ownership only. Actual Windows APIs, whole executable closure and process-tree qualification remain unrun. Source-equivalent publication is returned in PR #8's coordination comment; acquire that exact published revision and verify its recorded tree before running.

The three new owners are `worker_runner_capture.py`, `worker_runner_inventory.py` and `test_worker_runner_capture.py` under `scripts/qualification`. They leave all legacy builder/runtime/caller/context/assembler guards unchanged. Primary combined capture27 and builder18 tests passed at local `81150afb9fcb7e5ed0469568daff3b9c1b0bd00d`; raw receipts are [retained](../../qualification/candidates/consolidation-closeout-20261011/runner-integration/checks.json).

## Exact Windows action

From a clean isolated checkout of the returned accepted publication, ensure `.task-inputs` already exists as a plain caller-owned directory. The output must be a new never-used slot. The observed runner executable below is an input expectation, not a newly verified identity:

```powershell
& 'C:\Users\neoma\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe' -I -B -S scripts/qualification/worker_runner_capture.py --read-only-host-capture --output (Join-Path (Get-Location).Path '.task-inputs\worker-runner-capture-20261012-r1')
```

Exit 0 means bounded selected measurements were written, fsynced and read back. Exit 2 means configuration, host or capture refusal. Preserve the original bounded owner stdout/stderr/exit receipt either way. Do not reuse a partial slot or modify source to force acceptance. Return the four result files (`runner-capture.json`, `capture-index.json`, and both AWS CLI version streams), their exact hashes/bytes, the source commit/tree and original command receipt in the shipper's allocated evidence paths.

The sole native action is the canonical AWS CLI executable's `--version`; no STS, provider, database, image build, fence or cloud resource action is invoked. Existing separately owned canonical STS evidence remains separate. No credentials, environment dump or source-file bodies are captured. Borrowed runtimes and parents are never deleted or modified. Failure cleanup preserves foreign files and removes only exact owned identities. Missing inherited-pipe EOF refuses boundedly and explicitly leaves descendant teardown unqualified; it does not claim ownership of a process tree.

## Limits and subsequent dependency

This inventories the actual Python executable, selected stdlib/native files and twelve helper records. It deliberately excludes pyc/ZIP/startup configuration, unselected native dependencies, whole AWS CLI installation and OS/ACL closure. Every runner/build/scan/runtime/G1 admission flag stays false. A successful capture does not authorize a build or bypass the old Administrator/hermes-cli profile.

The primary still needs complete executable/source/context closure, an independently accepted new execution profile, supported image remediation, an exact single-action infrastructure cost/cleanup/fence packet and durable model-budget reconciliation before requesting cloud execution. The historical scan locator remains unknown. The old image must not launch. No production cutover or standalone Meri frontend deployment is requested. Preserve all existing resources and the six shared endpoint ENIs.

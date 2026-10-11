# SDK discovery public-import independent source review

Review outline recorded before evidence checks. Codex reviews candidate `1ea207d518266b97750fbe5dc7529dbb4a010f4b` against parent `8586f6279eac5a43132d4df3a7dbb6962c808009`; the sole owned tracked path is this report. Production remains owned by the source author, contracts by the canonical public package. Inspect the exact import-only production delta, public export and packed member bindings, unchanged options/test assertions, and retained binary consumer evidence. Read/hash DATA only; no candidate imports, test replay, installation, network, native SDK or admission. Return scoped findings and finite evidence with all prior failures intact.

Verdict: **PASS for this bounded source import repair; no scoped source finding.** The integration owner retains acceptance. This review ran no candidate tests, imports, npm, installation, SDK query, native CLI, network, cloud or model operation.

## Exact source and public ownership

Candidate `1ea207d518266b97750fbe5dc7529dbb4a010f4b` is the direct child of the stated base and its author worktree is clean. Its entire tracked scope is the options module, existing options test, and author report. Independent raw Git/current comparisons establish:

| Candidate path | Bytes | SHA256 |
| --- | ---: | --- |
| `apps/worker/qualification/probes/sdk-discovery-options.mjs` | 6113 | `868d470804fbc6aa3cfad5a9a2f39ca5ac2b71881c020b20db122efa7b16479b` |
| `apps/worker/qualification/probes/sdk-discovery-options.test.mjs` | 8608 | `dd1e03d0f0641bf7133cb29e3c2259f0c9a1779aae8e3a29618e92b045f096f2` |
| `docs/coordination/reports/CODEX-G1-SDK-DISCOVERY-PUBLIC-IMPORT.md` | 6128 | `e4d0e51d51cda8e1dcb23ac7ac7bf95a8eeb6bfb05082b861a30a8f7773de5ea` |

The only production change is line 4's import specifier: private repository traversal becomes `@capiro/meri-contracts/node`. Replacing exactly that one literal recovers the complete base source bytes. The unchanged canonical package's `exports['./node']` maps directly to `./validate.mjs`, which exports the same `validateShape` and `contractVersion='0.1.0'`. Its relative schema URL remains inside the packed package, and its Ajv/formats/canonicalize dependencies remain canonical. No validator copy, fallback resolver, import-time external initialization or new authority owner was introduced. Reading the bundled schema and compiling its validators are the existing Node validator behavior.

All options functions, record/accessor checks, call order, capture composition, environment flags, fixture descriptors, persistence restrictions, frozen context and borrowed callback/controller/server identities are byte unchanged. The new exact canonical-error assertion supplements the existing invalid-fence mutation. Removing precisely its import and six-line assertion addition recovers the entire old test bytes; all eleven original cases and seven existing binding mutations remain. The tools module/tests and capture builder are unchanged. Contracts manifest/schema/validator, worker package/lock and Dockerfile also match base raw Git.

## Packed consumer evidence independently corroborated

This reviewer fully read the author runner, denial preload, delta proof and report, then ran one stdlib DATA-only corroborator. It read/rehashed **16,314 record occurrences / 3,523 distinct records**, including every **692** final-manifest payload. Candidate modules were never imported. The author final manifest is 937786 bytes, SHA256 `ef0961e53d4a50cf61d1fa2981d8f1d4026c668987fabb670c036762e52f6e47`.

The actual archive is `@capiro/meri-contracts@0.1.0`, 48823 bytes, SHA256 `2f15ade9458cbffe960b7cc36c6fb77cb54cc2a0eca4bc7c0f918b77cfacd4ee`. All eleven regular members, 536413 unpacked bytes, independently equal base Git and the extracted consumer bytes. The consumer is outside repository ancestry at `C:/Users/neoma/AppData/Local/Temp/meri-sdk-public-import-20261011-0212`; the old four-parent relative target is absent. Its five probe/test files equal exact candidate/unchanged production sources. Current descendants contain no reparse point. Dependency copies retain Ajv 8.20.0, ajv-formats 3.0.1, canonicalize 5.1.0, fast-deep-equal 3.1.3, fast-uri 3.1.8, json-schema-traverse 1.0.0, require-from-string 2.0.2 and test Zod 4.6.5. This is a genuine packed consumer populated by verified extraction and ordinary dependency copies, not proof of an npm dependency installation.

Retained raw TAP establishes one successful combined invocation: **23 passed, 0 failed/cancelled/skipped** (11 options + 12 tools), `2026-10-11T02:12:21.493109Z` to `02:12:22.209893Z`. All 2838 pre/post source/runtime/dependency/consumer/archive records match. Stdout is 5452 bytes, SHA256 `2f431b4bd078ce911f671192c2340a8c4ed35f4de550dfe58732c827b9048313`; stderr is empty. Fixed Node used `--permission`, consumer-only filesystem access, the denial preload and `--test-isolation=none`. The successful pack used `--offline --ignore-scripts`, with separate empty npm configs and disabled audit/notifier/funding. These are source-level restrictions, not OS network isolation or a full npm implementation freeze.

The first pack's exit 1 is retained, with its actual 199-byte double-loading-NUL-config stderr SHA256 `852d911b568e63c1232b111a1a8008ad5cf49bf8a75cbb81c134bbed4760eb56`. It preceded archive/consumer/test creation. The fresh second preparation changes config paths, not product assertions, and no successful suite was repeated. The report accurately distinguishes the tool-transcript wrapper traceback from separately retained binary child streams. Raw envelopes were written before outcome assertions; CRLF conversion applies only to the parsing view. Direct-child 60-second supervision and post-completion 2 MiB capture bounds do not imply descendant cleanup or a streaming memory bound.

## Remaining qualification boundaries

The unchanged worker package does not yet declare/install this public package and the current recipe has not assembled this repaired source into a newly reviewed image. The tools module already has the same public-package dependency. Root must explicitly bind packed contracts, dependency closure, image assembly and source pins before actual discovery execution; this candidate does not silently supply that packaging. This is the documented next prerequisite rather than a defect in the allocated import-only change.

No actual SDK MCP registration, native tool-search protocol, permission callback integration, provider/proxy compatibility, model outcome, SessionStore, compaction/replacement, sandbox, image security, persistence or G1 pass follows. Canonical validation checks shape and grants no authority. The full deployment scope and existing persistence limitations remain unchanged.

Independent evidence is in `C:/dev/main/meri-greenfield-worktrees/g1-sdk-public-import-review/.task-inputs/sdk-public-import-review-1/`. `verify-data.py` is a finite DATA/raw-Git checker, not a candidate runner; `result.json` is 35894 bytes, SHA256 `228ffc1a4d098910393cb3705ba5f41f0b15510cfaa8d49d8cdc17c7d90696a6`. The adjacent finite final manifest and separate commit readback bind this sole report, checker, Git binary streams and result. Author evidence remains at `C:/dev/main/meri-greenfield-worktrees/g1-sdk-discovery-public-import/.task-inputs/sdk-discovery-public-import-2/`; first-failure evidence remains in sibling `sdk-discovery-public-import-1/`.

Codex independent source/DATA review CLOSED. No runtime or admission approval was written.

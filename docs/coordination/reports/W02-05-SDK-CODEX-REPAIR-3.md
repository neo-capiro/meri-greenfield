# W02-05 SDK repair 3: independent Codex rejection

Codex independent review, 9 October 2026. Exact closed candidate **`fdf2035600a35a10974813aac787a0e091b51e74`**, worktree `C:/dev/main/meri-greenfield-worktrees/w02-sdk-capture`, real implementation session `20261009_182329_21b4bc`. Read the preceding owner rejection and `.task-inputs/W02-sdk-capture-repair-3.md`, inspected the exact commit/source and installed pinned SDK declarations/source. This review is separate from any real Hermes reviewer. Verdict: **REJECT; not accepted for integration, image build or native capture. No G1/W03/cutover promotion.**

## Scope and identity

No candidate source, tests, report, dependencies or infrastructure were edited. Only ignored fake-fixture scratch files were added in the candidate worktree; this owner report is the sole root-repository edit requested for this review. No Agent SDK import/query, native CLI/browser/Office execution, server/socket, AWS/provider/network call, source or credential retrieval, commit or push occurred. The spawner/main reproductions evaluate exact candidate function bodies with injected fake process/host effects; they do not call the real spawner or real host builder. Pure Node Writable/EventEmitter, timers and hashing are used offline.

| Candidate path | SHA256 |
| --- | --- |
| `apps/worker/qualification/probes/sdk-capture-options.mjs` | `964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e` |
| `apps/worker/qualification/probes/sdk-capture.mjs` | `a4fc4bad7c67681c901937ca0560d7eeacc616fc6c77bf7ead9c07d55263ce80` |
| `apps/worker/qualification/probes/sdk-capture.test.mjs` | `593acab1fb401fd27c78456a3f8e7ce2e330644298be8566f5f5394d66e8fe67` |
| `docs/coordination/reports/W02-05-SDK-WIRE-CAPTURE.md` | `a8881c5ace84e59cd976b1bbf78ea83c9d564676f0cf1c31ff4e05a284903c76` |

## Checks and replay

- Owned capture suite: **52 tests passed, 0 failed**.
- Existing worker suite: **81 passed, 0 failed**.
- Root contract/session suite: **15 passed, 0 failed**.
- Independent replay: **14 checks, 6 passed, 8 failed; exit 1, REJECT**.
- Candidate tracked worktree remains clean; `git diff --check` passed.

Replay from the candidate worktree: `node .task-inputs/codex-sdk-repair3-audit.mjs`.

- Harness: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-capture/.task-inputs/codex-sdk-repair3-audit.mjs`, SHA256 `a84a8b8bdddb1f6ffed8fd8db84a41ebf7833e725e6b4f639097c80e4b1e9739`.
- Results: `C:/dev/main/meri-greenfield-worktrees/w02-sdk-capture/.task-inputs/codex-sdk-repair3-audit-results.json`, SHA256 `f47a3f76446a8a8f2e2f7a07570556d1e4b224b716f129764d3493808d571af4`.
- The harness checks the exact candidate source hash before evaluation. Result elapsed-time observations may change on another replay.

## Eight reproduced failures and minimal repair points

All line numbers below refer to `apps/worker/qualification/probes/sdk-capture.mjs` in the exact candidate.

1. **Normal required Messages fields suppress all wire export** — lines 120, 126–139, 339, 950. `CREDENTIAL_KEY` matches `token` anywhere, including required `max_tokens:256`. A complete synthetic Messages fixture with model, max_tokens, streaming, system, thinking, metadata, exact tool declaration and message sequence produces `ok:false`, `hashOnly:[true,true]`, zero body chunks. Installed pinned `@anthropic-ai/sdk` Beta `MessageCreateParamsBase` declares `max_tokens: number` as required; owned happy-path fixtures omit it. Distinguish declared numeric protocol fields from credential fields; retain rejection of `api_key:OPAQUE_SYNTHETIC_CREDENTIAL`. Add the full type-backed request fixture as a meaningful positive case.

2. **Error name exposes secret-shaped content** — lines 80–82, used at 860 and other error paths. Setting a fake resolver error's `name` to `sk-ant-OPAQUE_SYNTHETIC_CREDENTIAL` exports that literal in `settings resolution failed (...)`. Filtering characters is not classification. Export fixed allowlisted error classes/reason codes or a hash of unknown names, rather than trusting an arbitrary name.

3. **Rejected wire values leak through reasons** — lines 301–302, 315–317, 944; analogous value interpolation also exists in method/path/peer and result subtype/stop-reason failures. A foreign tool-use id `sk-ant-OPAQUE_SYNTHETIC_CREDENTIAL` is rejected but then appears verbatim in the manifest reason. Use fixed validation reasons; do not interpolate opaque request/result values into exported diagnostics. A failure before body sensitivity classification must still remain confidential.

4. **Argv option values are exported as flag names** — lines 609–614, exported at 967. `argvFlags` preserves every argument beginning with `-`, including `--api-key=OPAQUE_SYNTHETIC_CREDENTIAL` and `--settings={"secret":"OPAQUE_SYNTHETIC_CREDENTIAL"}`. This replay returns `ok:true` with literal values in logs. Exact pinned SDK source function `je` at byte offset 1135013 returns `${e}=${t}`, so equals-form values are a real public SDK spawn format. Keep complete argv count/byte count/hash; export only explicitly safe flag names, stripping values and withholding unknown/sensitive names.

5. **Output record failure still exits successfully** — lines 1023–1024 versus 1136–1142. When a manifest exceeds the record cap, `buildOutputLines` emits a failed manifest/end pair, but `main` returns the original `report.ok`. Exact main-body replay with fake host/run result and successful fake stdout yields emitted `ok:[false,false]` and **exit 0**. Make output construction return an explicit effective verdict and propagate it through manifest, end record and process status.

6. **Expired output deadline permits further writes and success** — lines 1035–1056, 1064–1069. With `deadlineAt:0`, injected `now()` already at 6000 ms (beyond even the added 5000 ms), 100 synchronous callback writes still occur and `writeLines` returns `ok:true`. The one-millisecond timer cannot enforce an already expired deadline when callbacks resolve first. Check the absolute deadline before each write and completion; remove the silent deadline extension and keep one bounded export window.

7. **Child exit before stderr EOF permits premature success** — lines 673–704, 938–975. The exact real-spawner body is evaluated with an EventEmitter process/stdio fake. The fake emits an actual child exit 0 after both wire requests; stderr remains open. Capture returns **`ok:true`, reported stderr total 0**. Then 65537 stderr bytes and EOF arrive; the owned spawn record detects overflow only after success was returned. The custom SDK transport uses the custom process's exit directly, unlike its local-process stderr-drain wrapper. Require bounded owned stderr EOF/stdio-close confirmation before a positive verdict, and include late overflow/read errors in that verdict. Preserve actual child-exit verification; a kill request is still not proof.

8. **Write callback error becomes unhandled stream error** — lines 1038–1045, 1056. A pure Node Writable whose `_write` invokes its callback with an Error makes `writeOnce` return `ok:false`, but `finish` removes its error listener before Node emits the corresponding `error` event. An uncaught-exception observer confirms the unhandled Error. Keep the stream error path handled through callback/error settlement and bounded failure cleanup, including delayed errors after timeout. Do not force `process.exit` to hide flushing failures.

## Repairs that now pass

The six independent passing checks cover resolver rejection, timeout and malformed shape stopping before wire/server/query/spawn construction; Query.return rejection and timeout failing qualification; and a 25 ms startup hang returning failure in roughly 30 ms while firing the provided AbortSignal and never querying/spawning. No additional startup failure is asserted from that replay. The SDK supplied-environment replacement and public Query.return cleanup findings from the previous review remain valid; no invented environment merge or particular close-method requirement is introduced.

The required repair is confined to the owned capture module/tests/report (options only if a concrete fix needs it), with meaningful regressions for these eight observations. It needs no dependencies, native execution, cloud deployment, provider calls, production HA work or gate changes. A separate actual review remains necessary after a corrected candidate closes.

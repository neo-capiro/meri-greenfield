# Independent proxy ingress repair review

Codex narrow review outline, 10 October 2026 UTC. Candidate `5a341d4db1456d83b3ce23e6c48299caa9fdae15`, parent `fa1f4000dee7d57a9229e2f803dd9dde895afd5c`. This reviewer identified the original defect and did not author its repair. Original blocked report commit `c1c19858375022ec278e6af40b8db13ef237f244` remains unchanged.

1. Verify the exact three-line production insertion and 26 added test lines preserve all original production/test bytes and state/API dependencies.
2. Execute the 22 canonical checks and identical 14 independent controls once against this exact repair, capturing fixed-bounded child outputs and pre/post source pins.
3. Assess only the earlier stale-pull defect; preserve actual-server/continuous-watcher, resource-cancellation and deployed authentication limitations.

Only this report and ignored review evidence are owned. No candidate edits, cloud, database, application HTTP server, provider/model, Docker or Hermes action is authorized.

Decision: **PASS for the bounded source repair.** No remaining blocker was identified in the repaired downstream-resume ordering. This is an independent Codex review of another Codex author's repair, not an application or G1 acceptance.

The production diff adds two explanatory comments and `await self.recheck()` at `runtime/ingress.py:134–136`, immediately after the consumer resumes from `yield item` and before the next `anext` task at line 137. Removing that exact three-line insertion produces the parent's complete raw production bytes. Removing the exact 26-line insertion at `test/test_ingress.py:195–220` produces the parent's complete raw test bytes, preserving all original 20 cases. The added cases exercise revocation and lease expiry during downstream suspension and assert no second-pull side effect plus iterator closure. The Git diff contains only this production file, this test file and the new author report. State admission, APIs, dependencies and all other source are unchanged.

Both suites ran once using the verified Python 3.12.14 binary at `C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`, with `-I -B`, fixed working directory, EOF stdin and separate binary captures. The source repair justifies these new executions; no unchanged test was replayed to obtain a green wrapper.

| Execution | Actual result | UTC start/end | Direct-child bound |
| --- | --- | --- | --- |
| Canonical focused ingress | 22/22 PASS, exit 0; unittest 5.091s, child 5.296s | 19:17:29.796760–19:17:35.093778 | 120s |
| Identical independent literal controls | 14/14 PASS, zero failed, exit 0; child 0.157s | 19:17:35.093778–19:17:35.250665 | 30s |

The independent witness is byte-identical to the original 14-control witness (5,863 bytes, SHA256 `872d0cffdf6c126408d6906ff6a420f637b91ef95457a03b25515de52bd8e72c`). It imports production admission code and supplies its own literal in-memory store; it does not import candidate test fixtures. Both earlier failing sequences now record only `first-pull`. Revoking the grant after the first yielded item returns `FRESH_STATE_DENIED`; expiring the peer lease returns `PEER_OBSERVATION_EXPIRED`. Both record iterator closure before any second provider pull. The other 12 controls retain their original expectations: ordinary admission, duplicate/forwarded/CRLF/oversized headers, invalid finite/boolean lease values, a changed current fence, a revoked grant, sanitized database failure and unauthorized iterator ownership.

Content-free failure and cancellation boundaries are unchanged. `recheck()` preserves `CancelledError`, converts other state failures to the fixed `FRESH_STATE_DENIED` code without embedding database content, and checks the peer before and after the awaited state operation. Iterator construction and closure are intentional protocol hooks: the unauthorized witness records `aiter` and `aclose`, with no `anext` or database operation. Therefore “before source” must be read as before provider pull/database work, not before all iterator protocol hooks. The outer `finally` continues to cancel its owned pending pull and attempt closure. These checks prove neither forced termination of a cancellation-resistant iterator nor interruption of a running database thread.

Exact candidate pins independently match raw Git:

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `apps/proxy/qualification/runtime/ingress.py` | 6,410 | `5e9924fb0e58a3f632159d0e38c9b8f06230729f986f27af1775b390244ae112` |
| `apps/proxy/qualification/test/test_ingress.py` | 12,503 | `5f40d958df95febda7d9f3e124592554282bef069e09ff72e524f703e493958e` |
| `apps/proxy/qualification/state/admission.py` | 1,504 | `7936012c2f723da75362f87652635e87cb700fb5d9ce020c7263c7ea89412b4a` |
| `docs/coordination/reports/CODEX-G1-PROXY-INGRESS-REPAIR.md` | 2,314 | `52677bc85b9a59b8e82602d396dcbb38e22ae882483a0ef8ae9161bed0ba362d` |

Evidence is retained beneath this review worktree's `.task-inputs/ingress-repair-independent-1/`. Its `manifest.json` is 21,184 bytes, SHA256 `c4c600ca4310e16ac77dc3ba19f1a12586c32f4508b7a353ef36d47064ec5473`; it binds the two executions, 19 existing source records before/after execution and all 64 original author evidence records. Those source records are raw-Git equal and stable. The newly added repair report was separately verified against exact candidate Git by `source-proof.json`, not included in the 19 pre/post records. That proof is 2,185 bytes, SHA256 `79cf6e9c96ff5ca2ccdbeb1073bae56525c536be230ce7d82fd232fd53c26c8c`, and binds the exact insertion-removal comparisons and author repair receipt. Canonical stderr is 2,876 bytes, SHA256 `f0daa15093ca7b1af86d242a2a1a17ff48646eb7577b9ba4929007af2d6d31b4`; independent stdout is 2,313 bytes, SHA256 `d2234dd432ac39415dc2ae4130ff45cc7a050d7aadffe95e404b1a7d0d966d9c`. Canonical stdout and independent stderr are empty. Original blocked findings and their failed captures remain unchanged in the original review worktree and commit `c1c19858375022ec278e6af40b8db13ef237f244`.

The author report and retained successful repair receipt agree on 22 passing cases. Its initial isolated-Python module-discovery failure remains explicitly disclosed in that report/root tool history; this review does not claim to have a separate raw artifact for that invocation. Earlier original-author fixture failures also remain part of the original evidence.

The wrapper has a direct-child time limit and captures outputs after completion; `capture_output` is not a streaming allocation bound or a descendant-process supervisor. Only ordinary asyncio local-loop infrastructure was used. No actual server, PostgreSQL, ECS/TLS peer observer, key provisioning, provider/model call, container or cloud resource was exercised. Polling still suspends while the generator is yielded to a blocked downstream consumer. A separately owned continuous server watcher remains necessary to establish deployed revocation within 30 seconds. The trusted peer observation, live authentication, failure/cancellation of actual dependencies, proxy composition and G1 remain open. **CLOSED: source repair review only; owner integration and admission remain separate.**

# Meri source readiness — 12 October 2026

**NOT_EXECUTABLE. Author packet; independent review pending. G0 accepted, G1 OPEN, G2–G7 unentered.**

This bounded continuation derives the original capability accounting and prepares the missing G1 evidence requirements. It changes no product source, tests, dependency locks, contracts, infrastructure, frontend, source connectivity or deployment authority. The accepted source baseline is PR7 `5ee46446b5f60034916f00b2a665b3e2bef9cf60`, tree `985e0fdafe23d68b6f2e81a092cf098d8ede3182`. Preserved PR9 `c57b7d26df7de2acbd8c7d8edc7098f7d495053a` is context; its additional candidates are not accepted by this packet. PR8 `28fbfc7e40799fdb4e59eabd35c5b9bf80f117d9` is historical evidence intake only. These are pinned local Git observations, not a fresh remote-head refresh by this author.

## Implementation outline recorded before generation

- Reuse the canonical `docs/coordination/r2/capabilities.json`, `skills.json` and private `packages/contracts/retrieval-0.2/catalog.json`. Derive a read-only snapshot, never a second runtime registry.
- Keep the offline generator and its machine-readable requirements/evidence inside the allocated candidate directory. Resolve every source reference from immutable Git objects, recording blob, bytes and SHA-256; copy no private producer bodies.
- Separate accepted source, preserved candidate, historical native evidence, retained failures and unrun requirements. Keep current execution identities and authorizations null when unavailable.
- Verify deterministic regeneration, exact original IDs/dispositions, catalog availability, fourteen pending skills and the original 47 scan rows. Review the final diff against the exact baseline. The parent independently reviews this delivery.

## Deliverables and boundaries

[Capability accounting](../../qualification/candidates/source-readiness-20261012/capability-accounting.json) contains every original ID, its exact selected/deferred boundary, current catalog mapping/status, original parity action and next dependency. It preserves **139 original capabilities: 96 selected, 43 deferred; 13 bound but unavailable, 83 selected unmapped**. All fourteen original skill IDs remain proposed/pending with null manifest versions. The accounting is a snapshot derived from canonical owners, with no execution role.

[G1 evidence packet](../../qualification/candidates/source-readiness-20261012/packet.json) binds each requirement to actual source/report/evidence paths in [the source manifest](../../qualification/candidates/source-readiness-20261012/source-manifest.json). [Requirements](../../qualification/candidates/source-readiness-20261012/g1-requirements.json) distinguish recorded passes, failures and unrun native checks and name the next owner action. [Image finding accounting](../../qualification/candidates/source-readiness-20261012/image-findings.json) derives all 47 original rows without changing their OPEN dispositions. The old digest is forbidden to launch.

Current source readiness does not close runner, image, SDK/proxy, task identity, budgets, native recovery, browser/renderer isolation, artifact inspection, state integration or measured qualification. An actual Windows runner capture has not returned in the pinned evidence. The offline binding inspector cannot authorize `prepare` or `execute`. Existing Aurora remains the eventual state selection; stale new-RDS definitions must not be deployed. No SQL, network, resource, credential, paid-model or provider action is included in this packet.

The adopted architecture remains Claude Agent SDK for the only model loop, Temporal for durable orchestration, AI SDK/Elements for UI transport, and governed proxies for trusted context. Public `0.1.0` remains separate from private retrieval `0.2.0`. Local synthetic checks cannot substitute for native G1 evidence. Fourteen original product skill implementations remain pending; no host artifact skills or legacy Capiro implementation is copied.

Memory and gateway reviews run in separate owners' paths. At the pinned handover, memory lacks independent acceptance and `list_memory_proposals` stays unmapped/unavailable. Producer administrator self-approval conflicts with the wrapper's another-reviewer rule; dot must resolve consequential approval semantics before dependent implementation. Gateway's preserved original negative control remained pending after 100 ms under shortened release authority; author18/18 is not independent acceptance. Their outcomes require separate acceptance and an explicit refresh of this snapshot.

## Unmet external inputs

Current `capiro-agent-ops` access was reported as 404 by the parent. This author made no retrieval attempt; affected host/Hermes actions remain blocked, while independent source work can continue. The historical aggregate $10 model allowance has unknown expenditure/reservations/remainder. Current caller, task/fence identity, durable paid ledger, infrastructure cost ceiling, exact action/resource approval, admitted patched image and runtime cleanup authority are all unset. Prior consumed build approval is not reusable.

The selected Aurora, historical callers and resources are historical context only. No inferred credentials, IAM/network/database permission or current capacity is supplied. Shared frontend and Cleanup1 owners retain their work; affected integration requires their own coordination.

`G1-REMAINING-WORK.md` is retained unchanged but its current-header narrative includes older PR heads and three catalog bindings. The newer exact handover and canonical accepted catalog control this snapshot. The ledger's historical Codex-only owner labels are also not current staffing authority; continuation/user direction supersedes them. No historical failure evidence or original tests were altered.

## Verification and remaining work

Fresh author verification is recorded in [checks.json](../../qualification/candidates/source-readiness-20261012/checks.json), with raw stdout/stderr. The generator's `--check` mode compares generated bytes to the pinned Git sources and refuses drift; it does not run any native or cloud operation. Historical test counts in the requirement matrix are attributed to their original reports and are not claimed as reruns here.

Fresh generation and deterministic `--check` passed: 78 exact source-file identities, all139 original rows,96/43 scope,13 unavailable bindings,83 unmapped selected IDs,14 pending skill IDs and47 OPEN image findings. Authored staged whitespace and exclusive-path checks passed. No production tests were rerun for this documentation-only snapshot; native/Windows/cloud/model/SQL checks remain unrun. Regenerate with `python3 docs/qualification/candidates/source-readiness-20261012/generate.py`; verify without writes by adding `--check`.

Independent parent review and integration remain pending. This delivery grants no source-candidate acceptance beyond the already accepted PR7 baseline, no executable shipping authority, and no G1 or release acceptance.

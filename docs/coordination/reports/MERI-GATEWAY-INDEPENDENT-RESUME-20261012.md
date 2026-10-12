# Gateway independent resumed review — 12 October 2026

Review base: preservation `c57b7d26df7de2acbd8c7d8edc7098f7d495053a`, tree `66135fa4cc69de9fbae12d77b4cc3bc24305a074`. Review branch `review/meri-gateway-independent-20261012`; reviewer writes only this report and `docs/qualification/candidates/gateway-independent-resume-20261012/`. Parent separately assigns production repair author. No frontend, cloud, provider, customer, paid-model or Hermes operations are authorized for this review.

Implementation outline: keep all eight original gateway modules/fixture/test bytes unchanged. Replay retained release-deadline control, original 17 tests and author 18 cases with accepted thirteen-entry canonical catalog. Independently probe each authority refresh boundary while identity/business/source work is parked; measure cancellation, no late result/next-port effects and uncertainty. Preserve failing evidence before requesting repair; review exact author commit separately. Local seeded ports do not qualify authentic runtime, signatures, durable budgets, source lineage or atomic publication.

Read repository AGENTS and implementation standards, adopted R2 gateway/authority/deployment scope, 11 October continuation, exact 12 October handover, context index/source snapshots/candidate freeze and original gateway task/reports/control. Repository `.agents` is absent; workspace `.agents` and `.codex` are empty. Historical gateway Git objects are absent locally; reconstructing source from recorded hashes will establish file-byte equality only, never unavailable commit/tree equality.

## Preserved candidate decision: HOLD

1. **Fresh inner authority deadlines do not bound pending work.** Thirteen independent controls fail: initial validated capability expiry followed by parked `currentRun`; and each before-reservation, before-effect, before-release and final authorization phase with shorter capability expiry then parked `currentRun`, or shorter observed run deadline then parked business/source policy. Each reports deadline `NOW+20`, still pending after 100 ms with the port signal un-aborted. Owned cancellation then rejects without output, releases synthetic pending work and records the expected uncertainty. Applying the deadline only after the complete `identify`/`check` returns is insufficient.
2. **Late cancelled capability verification still invokes the next trusted port.** Five of eighteen cancellation controls fail: initial identity and all four refresh phases invoke `currentRun` when a parked `verifyCapability` resolves after dispatch has returned `CANCELLED`. No result escapes, but the new port call violates cancellation containment. Late completion must check cancellation before another trusted port starts.

Both defects are in `authorization/current-tool-authority.mjs` composition with `dispatch/tool-dispatch.mjs`. A separate author is repairing immediate validated-deadline propagation and post-await cancellation checks. The reviewer does not edit production source.

| Independent baseline check | Outcome |
| --- | --- |
| Original eight gateway files reconstructed and checked against retained original SHA256s | All eight exact byte hashes match; no historical Git identity asserted |
| Original 17 unchanged tests with accepted thirteen-entry catalog | 17/17 PASS, exit 0 |
| Preserved author suite with actual thirteen-entry catalog | 18/18 PASS, exit 0 |
| Unmodified original release-deadline control against reconstructed original gateway bytes | Expected FAIL, exit 1; pending after 100 ms, then CANCELLED and one uncertainty call |
| Same unmodified control against preserved narrow repair | PASS, exit 0; DEADLINE and one uncertainty call |
| New inner deadline matrix | 0/13 PASS, exit 1; all thirteen fail the 100 ms bound |
| New cancellation/late-completion matrix | 13/18 PASS, 5 FAIL, exit 1; each failing next call is `currentRun` |

Current catalog bytes equal accepted publication `5ee46446b5f60034916f00b2a665b3e2bef9cf60` exactly: 13 descriptors. The current contract facade also contains the preserved additive memory candidate; an additional exact accepted-contract composition will accompany repaired-source review. Production source remains hardwired unavailable with zero exposure/effects.

Initial `npm ci --ignore-scripts --no-audit --no-fund` failed (exit 254) because default `/home/agent/.npm/_cacache` was unavailable; stdout/stderr are retained. Rerun with owned `/tmp/meri-gateway-review-npm-cache-20261012` succeeded, exit 0. No package or lock mutation. Node is v24.19.0. Every bounded check receipt records command array, raw stream hashes, physical exit and absent owned process group; no live runner or runtime qualification occurred.

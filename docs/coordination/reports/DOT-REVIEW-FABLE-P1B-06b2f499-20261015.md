# P1B independent review handoff — 15 October 2026

Central coordinator decision: **HOLD source; tenant gate and signed links remain unmounted.** Fable owns implementation; Codex's current support is limited to independent review and documentation. This record does not authorize source edits by this lane, contract freeze, runtime activation, migration execution, AWS, model/provider calls or deployment.

Exact source: [`06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40`](https://github.com/neo-capiro/meri-greenfield/commit/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40), tree `39fe8b930fe245ae23eecd40119c470420e54459`.

Review base: `ba40647c5b6f1f81773869e41ce82c099d64d505`; four commits and 34 changed files. These describe scope, not acceptance.

The central coordinator's independent reviewers supplied and reproduced the diagnostics below. In this bounded documentation lane, the author inspected cited source and Git identities, and independently recomputed both provenance mismatches. The author did **not** rerun diagnostics, tests or qualification. Review requirements are not an approved replacement wire or implementation.

## P1b: tenant liability, final release authority and provenance

1. **Keep uncertain financial liability held.** [policy.mjs, lines 35–46](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/apps/gateway/budget/tenant/policy.mjs#L35) releases both slot and cost hold while usage is unknown, then permits later settlement. A cap of 100 can reserve 100, release it, admit another 100, then settle the prior run at 70, producing 170 in held/settled liability. The coordinator reproduced this with scripted SQL and a diagnostic; [the current PostgreSQL test](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/apps/gateway/budget/tenant/test/tenant-budget-postgres.test.mjs#L63) does not establish native isolation. Separate concurrency release from financial liability; preserve uncertain cost until authoritative settlement or no-dispatch proof. Do not treat cancellation as proof of zero usage.

2. **Recheck current authority immediately before bytes leave.** The correct source is [`apps/runtime/artifacts/download-links.mjs`, lines 50–58](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/apps/runtime/artifacts/download-links.mjs#L50), **not** an `apps/control/artifacts` path. Redemption authenticates before awaited work, but after the final awaited suppression-generation check it tests token expiry/lifetime and returns bytes without a fresh current-authority read. The coordinator's diagnostic revoked the session during that final await: the wrapper returned 200 while a subsequent canonical download returned 403. Recheck current session authority, actor, scope and expiry immediately before release after awaited work. Preserve exact version, byte hash and suppression checks.

3. **Publish a newly reviewed provenance candidate.** The [candidate manifest](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/scripts/qualification/assembled-image/candidate-manifest-fable-20261015c.json#L45) differs from actual source; [source-proof.test.mjs, lines 34–43](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/scripts/qualification/assembled-image/source-proof.test.mjs#L34) compares those exact bytes. The documentation author independently confirmed:

| Path | Actual Git blob | Actual source SHA-256 | Manifest-declared SHA-256 |
| --- | --- | --- | --- |
| `apps/runtime/config.mjs` | `945d6dd3f6d4dcf9a28b28b0af8edae2b345fcb6` | `0619400bca451d223026c2a2b529ac2f92c6bee5267714768fc7319052b7125a` | `3bec69435fae9157aeb3d7c5b3181828c5c345dbe25a7259550b39547efd8810` |
| `apps/runtime/control.mjs` | `b7500b1c28b6798b48cb72f9b665148789c64023` | `a04df035948584bd809b55ffd287479714b5b1f61a3429607fe836a5eba88cf4` | `ae032c58f380db2c0165af815ed0f94a6d5d1746ccc7527e81cd4e80e6a51b3c` |

Preserve old manifests and historical proof rows. Publish a new reviewed candidate/provenance record through the existing owner process; do not relabel or rewrite historical evidence. No image build or admission is authorized here.

The P1b reviewer reported 18 isolated unit/scripted tests passed, one real-PG test skipped and two diagnostics reproduced. No full telemetry/typecheck, complete artifact integration, full source-proof suite, image or live proof was established.

## Central migration handoff to Fable

[Allocation commit `1b61483d2a9e554fa4818533c5cb09eb952af3de`](https://github.com/neo-capiro/meri-greenfield/commit/1b61483d2a9e554fa4818533c5cb09eb952af3de), tree `6552dd331769e53c896338a9c85e14589fcc42e4`, reserves **`apps/gateway/budget/migrations/0002_tenant_budgets.sql` in `meri_product_budget` exclusively for Fable, source authoring only**. All three document blobs were independently reviewed and matched remote readback. The [allocation](../tasks/CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md) and [19-head collision inventory](../tasks/CODEX-TENANT-BUDGET-0002-COLLISION-20261015.json) preserve exact evidence.

This resolves numbering, not P1b acceptance. No SQL is created or executed by this handoff. Preserve product-budget 0001. Conversation 0011 is a separate reservation; [conditional result custody 0012](../tasks/CODEX-STRATEGY-RESULT-STORE-0012-CONDITIONAL-ALLOCATION-20261015.md) remains under its existing authoring hold. Do not allocate conversation 0012/0013 to tenant budgets or infer that an authored 0011 freezes its binding.

## Ownership and next evidence

Fable must return reviewed corrections at a new exact commit with focused regression evidence for every finding, keeping failed/skipped checks visible. Any separately proposed contract, migration or integration requires its existing owner review. No synthetic or scripted outcome supplies native, isolation, live authority or release proof.

The stopped discovery candidate and prior source-only/proposal-only checkpoints retain their original scopes. No product source is changed by this record.

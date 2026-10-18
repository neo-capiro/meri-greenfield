# Economic public-data source slice

Base: `74bf7032285ed83b17a67e2fc2b0f5308eb9862b` in the task-owned
`meri-remaining-next` worktree. This increment implements only
`query_economic_data@0.2.0`; the other public-data operations remain in scope.

## Implementation outline and ownership

- `apps/gateway/sources/public-data/handler.mjs` owns the one explicit native
  route and exports `createPublicDataHandlers(configuration, operations)`.
- Existing `retained-reads/native-handler.mjs` owns current tenant/user/operation
  decision checks, credential selection, bounded HTTP receiving and the private
  carrier. The family factory accepts economic-operation references only.
- Frozen public-data contracts own normalization and closed result validation.
  The original flat request is sent unchanged for one native trim/cap pass.
- Source-shaped fixtures reuse the existing bill-text authority fixture and
  synthetic credential ports. Tests cross actual HTTP JSON bytes, without
  provider, database or native source execution.
- Root owns shared helper eligibility, current native owner wiring, partial
  registration, SDK exposure, manifests and the scope ledger. No shared file,
  contract, startup, infrastructure or dependency changes belong to this slice.

## Actual native binding

Pinned Core source is `neo-capiro/capiro-backend`
`b525032222515d636b0dae2d46e40c7c3d8b5528`, tree
`16723770a8e111fc66bcf70d36ff32ab71eb9928`. Read through GitHub:

- [Active dispatch](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2668)
  and [actual producer](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L6411-L6536).
- [Published producer mapping](https://github.com/neo-capiro/capiro-backend/blob/384325afaaf7ad34aeb9ff9b2f183d667ee17343/docs/retained-read-producer-mapping-20261016/market-producers.json)
  preserves the native transport and source limitations.

The route is fixed `POST /api/clio/tools/query_economic_data`, with the original
flat JSON body and raw producer response. It requires the current native user,
internal service credential, `stored_public_data` source and exact operation
decision under `tool.read`. The frozen context is `{}`. No provider key, client
geography, evidence mode, timestamp or source completeness is inferred.

Core reads global stored rows with `withSystem`: Census districts, BLS series
with at most 12 recent data points each, or BEA rows. The outer row limit is
1–50 (default 20). Source defaults to Census. BLS runtime selectors and BEA's
`datasetName` / `dataset` alias are supported by the frozen receiving contract,
even though the older native advertised schema lists fewer arguments. Unknown
sources retain the native `tool` + `error` branch, without fabricated data.

These are stored DB reads. No live provider HTTP or analytics audit write is
established by this producer path. Reported timestamps and returned windows do
not establish source freshness, complete coverage or authoritative absence.

## Remaining sibling dependencies

`search_federal_grants` and `search_federal_awards` require a genuinely current
`evidenceAccuracyMode` (`off`, `shadow`, `enforce`) captured from the native
tenant policy owner. [The native resolver](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/common/meri-evidence-accuracy-flags.ts#L13-L19)
uses server rollout configuration and the tenant/surface. Response dates or the
presence of precision fields cannot establish that authority. Grants also
capture their own source clock. Those missing interfaces remain separate holds;
they do not prevent implementing the economic operation independently.

## Verification and state

Root added economic-only shared helper/owner eligibility before the first test
run. The factory still rejects the two policy-dependent siblings, foreign and
duplicate references, and wrong versions. No shared file was edited by this
slice author.

The first focused run passed **50/50**, with zero failures or skips: 21 new
adapter tests and 29 existing frozen public-data contract tests. It used Node
24.19.0 with `--preserve-symlinks --max-old-space-size=256 --test
--test-concurrency=1`; the task-local worker overlay is Zod 4.6.7. Full output and
command/exit metadata are in
[`focused.txt`](../../../apps/gateway/sources/public-data/test/evidence/focused.txt)
and [`focused.json`](../../../apps/gateway/sources/public-data/test/evidence/focused.json).

Coverage includes all three stored variants; original flat bodies and proofs;
one trim/cap pass and alias precedence; exact state, district, series, dataset
and year receiving; nullable and opaque storage values; BLS's 12-point bound;
bounded/empty pages and the unknown-source error branch; authority, credential,
context and digest refusals; cancellation, expiry and byte limits. The sibling
contract checks do not establish implemented sibling adapters or a current
tenant mode source.

State: **one operation implemented at source; SDK exposure remains withheld;
qualified/live zero**. Independent source review, parent-owned partial gateway
composition and measured installation remain separate from this local result.
No provider/DB/audit execution, credential creation, startup, migration,
activation or deployment occurred. All task-owned test processes exited.

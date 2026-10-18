# Meri memory signed transport source slice

Base: Meri PR171 `d117a7d4d6de94f25943d54c0b15d82c891b9b96`.
Branch: `codex/meri-memory-signed-transport-20261018`. Core source stays on its
separate receiver branch. The [Core coordination pin](https://github.com/neo-capiro/capiro-backend/pull/88#issuecomment-6252628690)
defines the proposed page proof and one-use helper wire; neither side enables a
listener from these source changes.

## Responsibilities and boundaries

- The canonical gateway keeps the original `search_memory@0.2.0` and
  `memory.list_own_proposals@0.2.0` ADMITTED grants, UNKNOWN reservation, exact
  normalized arguments hash, current tenant/actor/selected-client authority,
  retention, settlement, and final release. The trusted invocation ID is the
  Core token call key. Model input never supplies it.
- The existing run read delegation issues exactly one ordinary `tool` token
  after reservation for a selected-client source read. It gains a *distinct*
  one-use `memory_eligibility` helper token for the same memory page call key.
  The ordinary tool ceiling stays one. Core owns the consumed parent JTI,
  proof signature, durable helper row, current run checks and canonical memory
  eligibility predicate; Meri does not copy those owners.
- The client-knowledge adapter sends one signed page request, validates the
  unchanged canonical result and opaque Core page proof response header, then
  uses the proof to request a helper token and sends one bounded callback to
  Core. It validates the exact eligibility receipt and passes its expiry
  privately into the outer dispatcher deadline before retention and settlement.
- The proposal adapter sends the exact original operation to the versioned
  signed path and preserves the canonical proposal result. The historical raw
  `list_memory_proposals` Core route is a different tool path. Personal memory
  reads remain held because the current Option B delegation selects one client.
- Task-local family composition supplies fixed Core routes and delegates
  credentials to the existing run owner. Any proposal continuation store must
  come from the existing trusted durable context owner. Absence is a closed
  configuration failure; this slice does not introduce a second store.

The request bodies, canonical hashes, correlation header, page proof, token
issuance fields, and eligibility receipt are pinned in the Core coordination
comment. The signed helper body is at most 16,384 UTF-8 bytes. Core and Meri
must commit matching additive helper schemas before either receiver opens.
The callback `deadlineMs` is Meri's current source cutoff after the validated
parent credential receipt: `min(gateway deadline, Meri request timeout,
parent credential expiry)`. Core can bind the opaque proof to its parent token
expiry and require callback deadline no later than that proof expiry. The
[Core deadline clarification](https://github.com/neo-capiro/capiro-backend/pull/88#issuecomment-6252759753)
records the exact field order and correlation header.

## Verification and release boundary

Focused synthetic checks cover exact emitted bytes, one-use credential request,
selected-client and call-key refusal, invalid or absent proof, eligibility
result/record mismatch, and expiry during or after settlement. Review the
changed source closure and per-family installation hashes before qualification.
No live credentials, SQL, provider calls, AWS action, listener activation or
deployment are part of this source slice. Core's held memory `090000` migration,
listener availability and runtime image/configuration readback remain separate
release gates.

The source slice's focused checks passed: signed memory adapter 23/23, memory
family integration 10/10, proposal source 48/48, dispatcher 73/73, task
composition 9/9, delegation 20/20 and credential relay 13/13. A broader
family run still has unrelated PR171 action/query_tasks fixture failures; three
runtime composition suites could not load uninstalled `@anthropic-ai/claude-agent-sdk`
or `@capiro/meri-contracts` at that check. After installing the lockfile-pinned
worker packages locally, the source-only P2 measurement completed: catalog
SHA-256 `58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c`,
skills digest `40e6270e9394ebcd86c60ee06f3689d5069ebc04dde0d7b60ece63fd63ce55fa`,
full 76-operation/42-family measurement SHA-256
`eb7f0cd742728ac15c7f01f5bc7d01c42158120406ad8557986061fce3670660`.
The memory handler source hashes are
`search_memory@0.2.0=e25db635504a59f037d67a8c18d4cc0a63800fd72bc12180160cac6711930009`
and `memory.list_own_proposals@0.2.0=541696b8d61a587b2b363a75758e43d9c92a70102d3fae708113242e449c574b`.
These are source-tree values, not an image receipt or live qualification.

Production installation remains closed on two independent missing owners.
Core PR88 has not yet mounted the proof-header page, distinct helper issuer
and receiver, or signed proposal alias. Meri's runtime CLI does not supply a
task-bound durable `memoryContextPortsForTask`; the selected task composer
refuses a `memory-proposals` installation without it. The only existing
proposal continuation ports found in this tree are synthetic tests. The
shared CLI/context owner must provide and qualify the real port, then record
the refreshed P2 measurement and current release evidence. Selected-client
memory reads remain the only candidate under the present delegation; personal
memory selection needs its separate authority decision.

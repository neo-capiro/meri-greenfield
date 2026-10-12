# RC1 capability successor — source closeout

The successor implements trusted mail continuation and binds the existing
client-scoped action-item contract. It does not complete retrieval, expose tools
or accept a runtime gate. Frozen RC1 remains
`2f06feccca731d6cd388612cd568185ecc29668f` (tree
`39165ddad3989434908087f4571b70bea000a98d`). Main remains
`8b123bea4c90794dc2d766814b6ddbdbfe0928bc` locally and remotely.

The combined source freeze tested by root is
`6d2b0b0b2b53a7c229a84a7a44bf8feb9b1140f6`, tree
`63e61fd05f4d02b1734ad82c467124db62c7759c`. Root receipts are committed at
`e38dc366d66ba7f285402c4365fd465fa29f8833`; that subsequent commit changes only
evidence and a packet verifier. The separate final integration verdict is in
[the integration review](CODEX-CAPABILITY-INTEGRATION-REVIEW-20261012.md).

## Scope and responsibility

Reconciliation against D012, the adopted R2 plan and the workbook inventory
preserves **139 original IDs: 96 selected and 43 deferred**. Fourteen originals
have typed replacement mappings, all unavailable. Eighty-two remain unmapped;
one of those, `query_action_items`, now has a partial client-scoped binding.
There are fifteen private typed operations, not fifteen complete native mappings.
The original 139 rows and fourteen descriptors are unchanged. All operation
handlers remain null, availability unimplemented, qualification pending and
retries zero. Public contracts remain 0.1.0; private operation contracts remain
0.2.0 and the private catalog advances to 0.2.3.

The workbook's 322 New Meri requirements, 48 SDK rows, 93 workflow rows and
60 UI states remain separate product obligations. They are not additive native
capability counts, and these two source slices do not satisfy them. Fourteen
named skills remain unqualified. No capability was removed or marked complete.

Root owned integration and shared-path allocation. The action and mail lanes
had separate authors, independent reviewers, worktrees and exact source bases;
the combined candidate receives a third independent review. See the
[implementation outline](../tasks/CODEX-CAPABILITY-SUCCESSOR-20261012.md).

## Source changes

Mail list/search previously required a trusted previous page for positive
offsets, but dispatch never supplied or retained one. The new cohesive
`mail-read-context.mjs` composes injected raw-JSON storage ports with the existing
canonical normalization, current authorization, bounded lifetime and budget
owner. It binds the retained page to run identity, policy, stable authorized
subject, operation and exact next selection/anchor. Stored pages remain immutable.
The existing validator still requires exact previous/current page subject and
window, including authorizationDecisionId. First-page authority checks may
rotate decision IDs when stable authority agrees; no new approval or identity
policy was introduced. A changed prior/current page decision ID still refuses.
Retained expiry never exceeds the effective request/authority deadline, and
load/retain/settlement cannot extend a newly shortened deadline.

`operation-context.mjs` selects the canonical profile and normalizes mail input
once. `tool-dispatch.mjs` adds the specific mail ports and exposes a read of the
monotone deadline through the existing lifetime delegate. No independent timer,
budget store, authorization engine, model loop or source adapter was added.

The sole `catalog-validation.mjs` registry binds `query_action_items` to the
existing action input/page validators. It requires trusted actor context and
rejects the unclosed client-less mode. Its explicit partial-coverage metadata
enforces a pending/null original mapping and absent compatibility aliases.
Recommendation status remains separate from task acceptance or completed work;
opaque cursor handling does not establish authentication, snapshot or source
coverage. Existing schemas and family validators are unchanged.

Production changes are confined to these three dispatch modules and the
catalog/binding pair. The original tests remain, with only approved operation
count/registration/profile characterizations updated. Their original bytes and
expected pre-update failures are retained. No control, worker, proxy, runtime,
qualification-script, infrastructure, lockfile, schema or frontend changes occur.

## Exact reviews and verification

| Lane | Author source | Independent source verdict |
| --- | --- | --- |
| Action | `59a2b629cda0d3838ec1b5235d2a8d64aadf3402` | ACCEPT_SOURCE; reviewer `0a1a632ab6696619ac245e1bd3f1e2c21883c92a`; 25/25 controls and 44/44 preservation checks |
| Mail | `8c4ec8dc2a9caad8640eb9f4741f5de2d7696887` | ACCEPT_SOURCE; reviewer `4b455db1b8a21f8588f51cd89fa851b09d19afdb`; 48/48 controls and 19/19 preservation checks |

The third reviewer returned **ACCEPT_SOURCE** for the exact combined source
freeze above: **127/127** focused controls and **160/160** preservation/receipt
checks passed, recorded in review-only commit
`80b862e294fe5241ec030a699958ab3fed1400fe`. Its initial 157/160 audit used a TAP-prefix assumption against
Node's spec output; the failed checker/receipt and parser-only correction remain
preserved. No production repair or test weakening was required.

Mail author evidence is frozen separately at
`3d3978735dd7c14a46530f3102da9c0ed0e55312`. Original author/reviewer branches and
commits are retained; integration uses their reviewable commits without rewriting
them. No main or RC1 branch is merged or moved.

Root's combined source check passed **637/637**, with no skipped tests. It runs
all contract and gateway tests, including both new independent suites and the
original deadline, parked-port, memory, durable-budget and pure Hermes controls.
Public generated bytes, TypeScript and **7/7** distribution tests pass.
Preservation checks cover every original native row and descriptor, protected
source/public/runtime paths, exact R2 plan hash and RC1/main references. All
**80** members of the four author/reviewer manifests retain their recorded bytes.
Raw commands, streams, source heads, hashes and owned-process receipts are in
[integration evidence](../../qualification/candidates/capability-successor-20261012/integration/).

The original missing-binding/profile controls, pre-update characterizations and
three reviewer-fixture assumption failures remain preserved with their reasons.
Mail's standalone 281/282 gateway result was the pre-existing profile-list
characterization owned by the action lane; the combined 637/637 check includes
the approved update. Raw assertion streams also contain whitespace failures;
their bytes are unchanged. Scoped stdout/stderr attributes exclude only those
immutable streams from formatting checks. Authored source/tests/reports and the
final combined whitespace check pass.

Historical action-author captures failed physical cleanup for five exited
esbuild zombies adopted by PID 1. The author report retains their exact PIDs and
Z states; those captures are not described as cleanup successes. No live owned
process remained. Fresh root and broader mail checks used the existing Linux
subreaper capture, reaped their descendants and confirmed all owned process
groups absent. No attempt was made to alter PID 1 or other owners' processes.

## Remaining gates and next source dependencies

Source connectivity remains disabled. G0 is accepted; **G1 remains OPEN and
G2–G7 remain unentered**. Native verification belongs to the separate runtime
owner; reported PostgreSQL results are not accepted by this source packet.
Runtime-owner harness/runner changes and their reserved paths remain untouched.
No native database/model/browser run, provider access, host setup, cloud image,
resource, credential, security/network/database change, deployment or spend was
performed here. The rejected historical image was not launched.

Retained storage durability/security, actual source truth/current client and
mailbox walls, authoritative cursor handling, real adapters, SDK discovery and
all runtime evidence still require qualification. A rehashed but semantically
invalid trusted prior page can be rejected by canonical output validation after
the read handler; the result is withheld and unsettled liability remains UNKNOWN.
These tests do not certify the injected ports or a successful live tool.

Next independent source work should close trusted subject/window resolution and
immutable skill admission using established contracts. The existing window
checker does not choose this/last intervals from a trusted clock; unknown fiscal
calendars must remain refused. Of the 82 unmapped selected IDs, 81 still lack an
operation-specific input/output contract pair here; client-less action listing
remains the additional explicit gap. Real read adapters need exact supported
producer interfaces before implementation. Governed writes, artifacts and
schedules remain required scope, with their own approval/idempotency/durability
contracts. No active skill manifests or successful tool fixtures should stand in
for that work. The memory administrator self-approval conflict and unreconciled
paid-model allowance are unchanged; no approval-write or paid-model action is
authorized by this source acceptance.

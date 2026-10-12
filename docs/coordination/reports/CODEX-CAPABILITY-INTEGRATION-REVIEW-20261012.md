# Capability successor independent integration review

**ACCEPT_SOURCE** for commit `6d2b0b0b2b53a7c229a84a7a44bf8feb9b1140f6`,
tree `63e61fd05f4d02b1734ad82c467124db62c7759c`. This accepts the combined private
client-scoped action-item binding and trusted mail continuation source only.
Runtime acceptance remains **HOLD**; G1 stays open and G2–G7 unentered.

Reviewed from a separate pinned worktree with no production or maintained-test
edits. Criteria were sent before the integration freeze and are retained in
[criteria.json](../../qualification/candidates/capability-successor-20261012/integration-review/criteria.json).
Root verification receipts are independently bound to commit
`e38dc366d66ba7f285402c4365fd465fa29f8833`, tree
`4f419f4bb9ea2e5abd948506b0bf256841965b41`; that commit adds only integration
evidence after the reviewed source.

## Findings and verification

No source defect requiring correction was found. The five changed production
files exactly match the independently accepted lane sources:

- Action author `59a2b629cda0d3838ec1b5235d2a8d64aadf3402`, independent acceptance
  `0a1a632ab6696619ac245e1bd3f1e2c21883c92a` (25/25 controls).
- Mail author `8c4ec8dc2a9caad8640eb9f4741f5de2d7696887`, independent acceptance
  `4b455db1b8a21f8588f51cd89fa851b09d19afdb` (48/48 controls).

The new mail module owns retained-page validation and retention; the existing
contract validator, authority, lifetime, dispatch and budget owners remain
canonical. The action binding uses the existing operational contract and sole
registry. No adapter, enabled manifest, source connection, model loop, schema,
dependency or public export was introduced.

Independent connected replay: **127/127 passed**, covering both new lane control
sets and original memory controls. In particular, first-page current authority
decision IDs may rotate when stable authority agrees; previous/current **page**
subject equality still includes the decision ID and differing page IDs refuse.
No broader fixed-ID rule is inferred. Deadline, parked-port, cancellation,
revocation, release and uncertain-budget controls passed.

Independent source/evidence audit: **160/160 passed**. It verifies:

- Original 139 native row objects and literal JSON bytes, and all original 14
  descriptor objects/literal bytes/order remain unchanged from RC1
  `2f06feccca731d6cd388612cd568185ecc29668f`.
- Counts remain 96 selected / 43 deferred, 14 mapped and unavailable, 82 selected
  pending. There are 15 unavailable typed operations: `query_action_items` has
  one partial client-scoped binding within the 82, with native row pending,
  null replacement and no compatibility aliases. Client-less behavior remains
  unclosed; typed binding does not establish native parity.
- Public 0.1/private 0.2 separation, schemas, lockfiles, R2 inventories/plan,
  proxy, worker, control, qualification scripts and infrastructure are preserved.
  RC1 branch/tag and main references remain unchanged.
- All **80** declared lane-manifest members (9 + 18 + 32 + 21) match exact
  sizes/hashes. Root receipt bytes and every referenced raw stream match their
  committed identities and reviewed source head with zero tracked source diff.
- Root **637/637** combined source checks and **7/7** public distribution tests
  passed; public generated/typecheck commands, preservation, remote references
  and whitespace checks exited zero. Their raw receipts were inspected and
  verified instead of unnecessarily repeating the broad suite.

Evidence: [focused replay](../../qualification/candidates/capability-successor-20261012/integration-review/focused-connected.json)
and [independent audit](../../qualification/candidates/capability-successor-20261012/integration-review/independent-audit-corrected.json).
The audit stdout contains the individual assertions and receipt digests.

## Preserved failures, cleanup and limits

The first reviewer audit was **157 pass / 3 fail** because its summary parser
expected TAP `#` prefixes while the saved Node spec reporter used `ℹ`. The exact
initial checker and raw result are retained; only the evidence parser changed.
The corrected replay is 160/160. No product test or saved result was changed.
See [diagnosis](../../qualification/candidates/capability-successor-20261012/integration-review/audit-correction.json).

Earlier author/reviewer negative controls, characterization failures, and raw
whitespace exit 2 remain preserved. The new whitespace attributes apply only to
raw stdout/stderr; authored files retain normal checks. The historical action
author cleanup result remains `FAIL_EXITED_ZOMBIES_ADOPTED_BY_PID1`: five exited
esbuild zombies, no live owned work. No PID1 cleanup was attempted. Subsequent
root and reviewer captures independently report their owned groups absent;
passing later cleanup does not erase the historical failure.

The reviewer used the existing exact-lock dependency installation through one
temporary owned symlink; it was removed without altering the borrowed install.
No services, native/runtime/setup actions, database, network/provider calls,
paid models, cloud operations or customer data were used. These local checks do
not qualify actual adapters, retained-page storage, runtime isolation, model
execution, durability or deployment gates. Source connectivity stays disabled.

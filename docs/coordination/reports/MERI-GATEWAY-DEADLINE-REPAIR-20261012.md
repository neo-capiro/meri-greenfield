# Gateway authority deadline propagation repair — 12 October 2026

Author lane: gateway_author. Base: `c57b7d26df7de2acbd8c7d8edc7098f7d495053a`.
Dedicated branch: `task/meri-gateway-deadline-repair-20261012`.

## Implementation outline recorded before edits

The canonical dispatch lifetime owns deadline timers, cancellation and shrink-only
deadline state. Current tool authority validates trusted capability, run, business
and source facts. Add a small internal synchronous `limitDeadline` callback from
the dispatcher to authority: publish validated capability expiry and validated
current-run deadline immediately, before starting a subsequent awaited port.
Recheck cancellation/expiry between port completions so late ignored completions
cannot start new ports. No public 0.1/private 0.2 contract, catalog, policy or
approval semantics change is proposed.

Keep source connectivity and discovery disabled, preserve existing settlement and
uncertainty semantics, and reuse `createDispatchLifetime.limitDeadline`. Preserve
the original 17 cases plus the existing parked-settlement regression bytewise;
append separate meaningful regressions for newly narrowed inner deadlines,
invalid/stale facts, cancellation and late completions. Retain the failed baseline
and repaired outputs. Run gateway tests, original negative control, contract and
public distribution checks as dependencies permit. A separate reviewer replays
the candidate and the integration owner alone records acceptance. Local synthetic
source checks do not qualify real ports, durable budget storage or any runtime gate.

Allowed writes are `apps/gateway/**`, this report and
`docs/qualification/candidates/gateway-deadline-repair-20261012/**`. No recursive
delegation, cloud/provider/customer/native/frontend/Hermes action is authorized.

## Author result (pending independent acceptance)

`current-tool-authority.mjs` now requires the dispatch-owned synchronous
`limitDeadline` callback for internal identify/check calls. It validates epoch
timestamps, publishes each validated capability expiry and current-run deadline
before the next awaited port, and checks expiry/cancellation before starting later
ports. `tool-dispatch.mjs` supplies the existing lifetime method. The lifetime
implementation and its monotonic rule, reservation/settlement handling, all public
contracts, catalog, fixture carrier and production factory remain unchanged.

Added `authority-deadline.test.mjs` separately. The entire existing 18-case
`gateway.test.mjs` remains byte-for-byte identical to the pinned preservation base
(SHA-256 `6f71caf19539fca672c1217df079e58a6ed772f91648536bfe3f45e8a2d5d0e4`).
No previously failing negative control was edited.

Author checks and retained failures:

- Before source edits, gateway suite: **19 PASS / 14 FAIL**. The existing 18 and
  invalid-fact refusal passed; 13 freshly narrowed inner deadline controls and
  one late capability/cancellation control failed. All raw outputs are retained.
- Deadline repair: **33/33 PASS**. These cover all five identity/check stages,
  parked current-run/business/source ports, late completion suppression and
  reservation uncertainty exactly once only before settlement.
- Additional parent/reviewer timestamp finding: schema-valid
  `2026-10-11T23:59:60Z` becomes `NaN` under `Date.parse`, and the pre-guard
  implementation released output. The focused failure is retained. An earlier
  exploratory `00:59:60Z` fixture was already schema-invalid and correctly
  refused; its passing output is also retained and is not the failing proof.
  Added explicit safe-integer epoch guards for issuance and expiry without a
  public schema change. Final gateway suite: **34/34 PASS**.
- Original retained release-deadline control: **PASS**, rejected with `DEADLINE`
  within 100 ms while settlement was parked, one uncertainty call, parked fixture
  released during cleanup. Original control source and original failed evidence
  are unchanged.
- Root `npm run check`: initial **206 PASS / 2 FAIL** from the absent root
  `node_modules` layout (missing canonicalize import and a root lstat). After
  exact root `npm ci --ignore-scripts`, **216/216 PASS**. No lock changed.
- Public generated-file check, TypeScript check and public package **7/7 PASS**.
- `git diff --check`: **PASS**. No new architecture/lint command exists for this
  gateway surface. Canonical contract checks are the existing repository checks.

Raw stdout/stderr and a checks/preservation manifest are in
`docs/qualification/candidates/gateway-deadline-repair-20261012/`.
Installed ignored dependencies belong to this worktree; the npm cache is
`/tmp/meri-gateway-author-npm-cache`. Test processes exited normally; every parked
fixture in the author regressions is resolved in `finally`, and timers are
cleared. No background model, SQL, cloud, browser or Hermes job was launched.

Independent reviewer must replay the exact frozen commit, original controls,
actual accepted 13-entry catalog and their own parked-port/cancellation/timestamp
adversarial controls. Author success is not ACCEPT_SOURCE. Source connectivity
and discovery stay disabled; real signature verification, current durable
authority, durable reservations, source adapters/lineage, physical worker stop,
native/runtime G1 evidence and subsequent gates remain unqualified.

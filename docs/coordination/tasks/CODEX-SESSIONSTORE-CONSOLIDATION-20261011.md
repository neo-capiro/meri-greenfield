# Optional SessionStore source consolidation

11 October 2026 UTC. Parent-owned bounded source integration; no runtime,
provider, AWS, remote Git write, merge or deployment authority.

## Exact inputs and ownership

Local base `a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`, tree
`3181f8e0d75299e39fc45a738baff4c41e01463e`, is source-equivalent to published
backend `415a55827b3f6343a0835e1d0e30fa0c69d673e6`. Candidate PR2 is
`65d9c750639e0d370985827983f24019a3f585ab`, tree
`38f8a71278e8dd28ddf0bad4bec2101bccd0a923`. Dedicated worktree:
`meri-sessionstore-consolidation-20261011`; branch
`task/sessionstore-consolidation-20261011`.

Owned candidate paths are `apps/worker/qualification/checkpoint/` files
`bound-session-store.mjs`, `verify-session-store.mjs`,
`session-store.test.mjs`, `session-store-eval-provider.mjs`,
`promptfooconfig.json`, `native-capture-boundaries.test.mjs` and the existing
canonical `native-session-files.mjs`; historical reports
`PORTFOLIO-SESSIONSTORE-CANDIDATE.md` and `PORTFOLIO-NATIVE-CAPTURE-RACE.md`;
this task, matching consolidation report, and
`docs/qualification/candidates/sessionstore-consolidation-20261011/**`.
The parent explicitly authorizes the proposed canonical native capture change.
No scanner, driver, SDK options, public contracts, locks, infrastructure or
unrelated source is owned. Original reports and existing test assertions stay
unchanged. Parent review independently accepts or holds the returned source.

## Implementation outline and review criteria

1. Inspect exact candidate tree bytes and affected native capture callers. Recover
   missing local objects only through the approved connector, with external Git
   blob identity verification; retain the local Git lazy-fetch failure.
2. Keep the optional run-bound SDK SessionStore adapter separate from snapshot
   verification. Reuse the canonical SDK reference implementation, restore
   verifier and public RunBinding/hash contracts. No second agent loop or new
   dependency is introduced.
3. Review queue/deadline/uncertain-write handling: the injected trusted transport
   owns authentication and atomic current-fence enforcement. Unknown commits
   block subsequent dispatch; settling adapter-observed calls is neither an SDK
   flush nor a durable checkpoint acknowledgement.
4. Preserve full identity/metadata checks inside the caller-owned config namespace.
   Above it, tolerate unrelated sibling metadata while repeatedly checking
   directory identity, owner/mode, link/type and real path. Ancestor replacement
   must still refuse. Caller-owned quiescence remains a prerequisite; no hostile
   filesystem atomicity or native process/layout completeness is claimed.
5. Integrate only the nine candidate paths into the newer exact base. Retain all
   existing native and SessionStore cases, run meaningful bounded Node 24 source
   checks and classify scanner-owned/full-suite failures separately. Retain raw
   outputs, exits, hashes and resource cleanup observations.

Only synthetic source qualification is authorized. Actual SDK mirroring,
transport/storage durability, A stop/B resume, subagent/compaction completeness,
workspace binding, stale-generation denial and full G1/product recovery remain
separate qualification work.

## Separately allocated pin advancement

The parent extends ownership only to
`apps/worker/qualification/component-pins.json` interruptionPackaging provenance
and its native-session-files record. Freeze the source candidate for independent
security review first, then bind the accepted source commit and exact new file
bytes/hash. Preserve all other component/image records and original assertions;
this source-only refresh confers no image build or runtime authority.

## Inert-admission repair allocation

Independent review of frozen `09b962f` (adapter unchanged at `cf9eb76`) found
that key accessors could return an authorized project during validation and a
foreign project during dispatch; JSON admission also invoked caller getters.
The parent returned the adapter as HOLD and allocated a bounded repair from
`cf9eb76a0f9ea797151a2684bc83592ae1033c9f`. Owned source is limited to
`bound-session-store.mjs`, `session-store.test.mjs`, the new cohesive
`session-store-data.mjs`, and narrowly `verify-session-store.mjs` for expected
snapshot JSON admission. Existing native helpers, driver, public contracts,
component pins and dependencies remain unchanged.

Record the original independent proof byte-exact. Reject proxies/accessors,
non-plain or non-JSON data without executing caller code. Descriptor-snapshot
keys once and dispatch the same frozen values. One SessionStore data module
owns shared inert JSON/key-record semantics; trusted executable dependency
methods are captured separately and preserve their original receiver. Preserve
all sixteen original test bodies and add changing-getter/proxy/toJSON regressions,
including zero transport effects when key/expected-input admission rejects.
Retain uncertain-write/fence behavior and all earlier failed receipts. Run
bounded focused checks and return a clean commit for independent review.

# Mail continuation source author packet

Base: `5b1b5985bc73cbfe901c17e65acf9fd50b3d7e33`. Source freeze:
`8c4ec8dc2a9caad8640eb9f4741f5de2d7696887`, tree
`24115292d908255c5f794fe216040158c0fdd955`. Worktree
`/workspace/meri-mail-successor-20261012`, branch
`task/meri-mail-successor-20261012`. This packet is an author submission for
independent source review; it is not runtime or source-connectivity acceptance.

## Implemented composition

The existing canonical mail list/search bindings select `mail-candidates/1`.
`operation-context.mjs` now normalizes that input once through its canonical
operation contract, supplies the same immutable selection to current authority
and execution, and composes the new cohesive `mail-read-context.mjs`. That module
owns only trusted retained-page exchange. Existing page schemas, output
validation, filter hashes, registry, current-authority checks, accounting and
memory context remain canonical and unchanged.

The optional trusted `mailContextPorts` contains exactly two plain data methods:
`loadPrevious({key, signal})` and `retain({record, signal})`. Both return bounded
raw JSON receipts. The key binds the full RunBinding, operation, policy revision,
stable subject and canonical selection. The stable subject excludes only
`authorizationDecisionId`, preserving existing authority-decision rotation. The
retained page preserves the exact parsed JSON values, including its actual decision
ID. The existing validator still requires full previous/current **page** subject
equality; a changed page decision ID rejects continuation. Root explicitly
clarified this distinction after the initial outline; no new all-stage decision
pin or approval semantics was introduced.

Offset-positive requests load and validate a retained page before reservation or
handler execution. Missing records, substitution, digest mismatch, invalid
timestamps, noncontinuing selections and extended deadlines refuse. Remaining
semantic relationships are validated by the existing canonical output validator
with the exact prior page; those failures can occur after the handler and retain
UNKNOWN accounting, but cannot release output. No production filter-digest or
page-validator algorithm was copied.

Only a canonically validated page with a next offset is retained, after fresh
release authority and before existing settlement/final authority. Exact digest,
key and fresh acknowledgement checks bind the receipt. Future, stale or
deadline-extended receipts reject; immutable outbound keys/pages prevent a
storage port from mutating execution data. Revocation still blocks output even
when historical settlement already succeeded. A settled charge is not refunded
or relabeled UNKNOWN merely because final authority subsequently refuses.

The dispatcher wraps its existing `limitDeadline` callback only to remember its
monotone minimum. The canonical lifetime receives every shortening immediately;
the retained expiry cannot exceed the current request, authority, prior record
or durable-budget minimum. There is no second timer or cancellation owner.
Loaded expiry is published before subsequent authority/port work. Source-disabled
construction and all original memory interfaces remain unchanged.

## Evidence and verification

Raw commands, exit codes, timestamps, stdout/stderr and hashes are in
[`mail-author/`](../../qualification/candidates/capability-successor-20261012/mail-author/).
The pre-edit outline and original dispatcher/context bytes are retained there.

| Check | Actual result |
| --- | --- |
| Initial connected two-case baseline | **0/2**, expected `GATEWAY_CONFIGURATION` because base profile was not yet handled |
| Connected rerun after implementation | **2/2** |
| Final focused mail author cases | **44/44** |
| Full gateway source suite | **281/282**, one separately owned profile-list expectation |
| Root `npm run check` | **244/244** |
| Public distribution generation/type checks and tests | **PASS**, **7/7** tests |
| Offline packet/source preservation verifier | **101/101** |
| Authored/source whitespace check | **PASS** |
| Initial full staged whitespace check including raw failure output | **FAIL**, two preserved trailing-space lines |

The original two-case diagnostic ran before the additional adversarial cases
were appended; its exact raw failure is retained, but it is not claimed to have
used the final 44-case file unchanged. Focused controls exercise actual canonical
resolver/current authority/dispatcher traversal, full page subject mismatch,
immutable context, corrupt/stale/substituted receipts, cancellation, revocation,
budget-shortened retention and parked load/retain/settlement. The original
gateway tests, including freshly shortened release deadlines during parked
settlement and original authority port parking, were not edited and passed in
the full gateway run.

The source tree preserves 4,891 of 4,893 original paths byte-for-byte. Only the
two allocated existing composition modules changed; the other two source paths
are new. Every original test/assertion, schema, catalog, public contract, lock
and memory context file is unchanged. The manifest pins 32 packet members,
including this report; it explicitly excludes itself and its later verifier
stdout/stderr. Git binds those excluded receipts at the final evidence freeze.
The initial full staged whitespace check reports two spaces-only lines emitted in
the original gateway assertion failure. Its output and exit 2 are retained;
the raw failure bytes were not normalized. Archiving that check also preserves
those spaces in its own stdout. The final authored/source check excludes raw
`.bin`, `.stdout` and `.stderr` streams and passes.

The sole full-gateway failure is the original
`memory-context-independent.test.mjs` profile-list assertion at line 97. It still
expects only memory, whereas the root's base already includes the two mail
profiles. The action author exclusively owns that intentional registration
expectation update. Its failed stdout is preserved; this lane did not modify or
skip the original assertion. Root must run the combined successor after
integrating that reviewed lane.

No dependencies were installed. Root and contracts `node_modules` were
physically copied from the accepted `/workspace/meri-source-continuation-20261012`
trees; donor directories were not mutated. Package/lock files are unchanged.
The copies are ignored workspace dependencies, not committed artifacts.

Initial three captures reaped their direct child and did not time out; they did
not independently establish descendant-group absence. After the root's cleanup
instruction, all broader checks used the unchanged accepted Linux subreaper
capture. All three owned groups were confirmed absent without timeout or kill;
five exited descendants were reaped across root/distribution checks. No borrowed
process or PID1 child was touched. Synthetic parked-port promises are explicitly
completed during test cleanup; late completions cannot initiate more work.

## Remaining gates

No retained-storage implementation, durable retention guarantee, provider
adapter, live mail access, runtime execution, deployment or native gate is
qualified here. Trusted receipt provenance and a bounded/cancellation-aware
storage transport remain prerequisites; an injected in-memory fixture proves
the source contract only. All canonical production descriptors remain
unavailable; source connectivity stays disabled. Mail remains candidate-only,
with unknown enumeration, null snapshot and decisive-read requirements; it does
not establish absence or evidence readiness.

The original scope remains 139 capabilities: 96 selected, 43 deferred; this mail
lane changes no inventory disposition. It does not close trusted subject/window
resolution, immutable skill admission, producer/Temporal dependencies or G1–G7.
No new loop, state store, schema, package, approval policy, private body or cloud,
database, provider, customer, browser or native operation was introduced.

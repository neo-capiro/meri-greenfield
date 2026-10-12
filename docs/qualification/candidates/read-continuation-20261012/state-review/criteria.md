# Independent state source criteria — frozen before author candidate

Review base: `f45f155d0128ae4ac269989f60121e4f04b207de`. Discovery:
`d34da1a39aa68dd6f8af41ca5caee730ad1cdbfe`. Exact Capiro reference identities
are in `reference-identities.json`; only metadata and derived contract facts
are published. No reference implementation is imported or executed.

This reviewer owns only the independent state test, STATE-REVIEW report and
this evidence directory. Root authors the two-operation family and canonical
integration. Existing tests, descriptors, private/public separation and original
139-capability inventory remain unchanged by this review. Source acceptance
does not qualify an adapter, authorize source access or advance a runtime gate.

## Candidate requirements and independent controls

1. A cohesive factory uses the existing injected schema compilation and canonical
   inert-data snapshot helper. Import is inert; no provider, database, live
   resolver, quota reservation, writes or new generic framework is introduced.
   Unknown operation/fields and malformed shapes fail closed. Prototype, accessor,
   sparse-array, cyclic and non-finite/non-JSON inputs must not become admitted
   mutable data. Accepted arguments/results are detached and deeply immutable.
2. `search_state_bills`: closed typed inputs may deliberately be stricter than
   old coercion, but normalization/defaults/caps are documented. Optional query,
   state, session and status; limit 1–50/default20. String limits inherited from
   JavaScript slicing are UTF-16 limits; surrogate pairs cannot evade them.
   State normalization alone is not a recognized-jurisdiction proof.
3. Bill rows preserve the exact projected field set. IDs are stored natural keys,
   not UUID-only. Nullable chamber/sponsor/action/URL/status fields survive.
   Status is a stored nullable string, not an enum inferred from neighboring
   status tools. Canonical labels include `superseded`; unrecognized status is
   echoed as its label and null maps to `Unknown`. No source freshness, live
   resolution or legislative outcome is invented.
4. Bill totals are a separately obtained count, not an immutable snapshot or an
   absence certificate. Page length is bounded by admitted limit; do not impose
   atomic count/page equality or infer complete source coverage. Filtering
   relationships must respect actual equality/normalization semantics.
5. `get_state_legislator`: query is required; optional state and limit1–8/default5.
   Three exact result alternatives are preserved: one full match, no match with
   note, or zero full matches plus bounded ambiguous candidate rows and note.
   Full and ambiguous row shapes differ. No accidental hybrid alternatives.
6. Exact external-ID crosswalk takes precedence and ignores state hint. Its
   `matchedBy` namespace derives from free-form `EntityCrosswalk.idType`, not a
   newly invented source enum. Name-search result state can be constrained by
   state hint. A limit1 name search does not prove global identity uniqueness.
   Zero/ambiguous results do not certify database-wide absence or completeness.
7. Legislator chamber/district/party are nullable stored strings. Committees are
   opaque inert JSON (including scalar/object/array/null), not a fabricated array
   DTO. Private contact/source-evidence fields are excluded from this projection.
8. Output validation must bind admitted normalized arguments and canonical
   operation identity, retaining callback/context contracts without mutation or
   shadow walkers. Gateway rechecks current tool/source grants; global public
   storage and `withSystem` are not actor authorization. Candidate source false,
   unavailable handler-free bindings remain a root integration requirement.

## Pinned reference locations

- `meri-tools.service.ts`: advertised schemas1297–1326; bill projection5488–5542;
  legislator variants5836–5935; optional string9948; integer clamp10044;
  summary10285. Locations are at the immutable Capiro pin, not a new implementation.
- `schema.prisma`: EntityCrosswalk4315 (free-form namespace); StateBill6651;
  StateLegislator6722; global-source annotation immediately before state models.
- `packages/shared/src/index.ts`: stored status vocabulary/labels1500–1550.
- `meri-state-bill-status-tool.spec.ts`: legislator examples216–310.
- `meri-state-bill-live.ts`: neighboring live-provider/persistence interface only;
  this family must not inherit that resolver's effects.

## Replay and evidence plan

After the immutable candidate arrives, inspect production source and API, add
independent behavioral fixtures and refusal controls in the allocated test,
then run only local source suites through `capture-reaped.py` (120-second child
bound, owned descendant reaping, preserved streams and group-absence receipt).
Retain initial failures and distinguish bad reviewer fixtures from source defects;
author fixes production defects. Record exact candidate and test/source hashes,
source preservation and whitespace evidence, manifest, verdict and unrun gates.
No native33/9 tests, private source execution, network/provider/model calls,
SQL/services, runtime/image/cloud operations or frontend/proxy/worker changes.

Preparation note: the discovery packet is not in the stage2 outline base, so its
metadata was read by `git show` at its preserved freeze rather than assumed to
exist in this checkout. `.agents` has no local skill files. No tests have run at
this criteria freeze; no production candidate has yet been supplied.

# Admitted run author closeout

Base PR47: `84c2ca01d0bce025a0003b6e724d675a05f2975a`.
Final production source: `863b71de6dc0a965f9961184d65c83f484ce5fb0`.
Final source/test/docs head: `6b282c8cb57c0c95122be159e8ddd67f040d658c` (production bytes identical).

The concrete currentRun reader now checks existing persisted canonical run/grant/allocation/facts and original deadlines under the existing budget lock. The source-disabled mount installs that same function in session resolution, read authority and command authority. It creates actual durable lookup, metadata and command owners; no caller-supplied prebuilt services or currentRun escape hatch exists. One borrowed budget pool and two exact watched read/command grants cover configured and returned host identities. The generic lookup authorizer extracts the existing algorithm; the original local wrapper retains dynamic current identity and sanitized errors.

Checks:

- First immutable candidate f996c54f: 13/16. Real parked-known-expiry and missing watched-ledger/facts controls failed; a third HTTP fixture incorrectly expected403 instead of canonical401. All retained.
- Repaired author draft:15/16. Source controls passed; source-off query expectation corrected from NOT_DISPATCHED to existing conservative UNAVAILABLE/UNKNOWN (502). No accepted owner changed.
- Exact031182b0 focused run:64/64, including46 unchanged original budget/local controls.
- Exact863b71de:64/66; two newly added receipt tests assumed403 ACCESS_DENIED instead of existing resolveSession401 UNAUTHENTICATED/NOT_DISPATCHED. Both refused correctly; fixture expectations/preimages retained.
- Exact6b282c8c final author20/20. Production bytes unchanged from863. No original assertion edited/skipped.
- Independent reviewer reported65/65 at exact863, including all three actual host-port receipt substitution negatives, clock/deadline/late SQL/uncertainty and mount controls. Final reviewer packet remains separately owned.
- Offline preservation:11,160 base entries,11,157 byte-identical; only three explicitly allocated original source files changed. Public contract package/catalog unchanged. git diff --check passed.
- Five author process groups freshly physically absent; no timeout/kill in captures. Only two owned dependency symlinks removed; donor untouched. Actual owned HTTP listeners close in test finally blocks.

Source files/API and mounting recipe: `apps/control/admitted-runs/README.md`. Reusable actual source-test fixture: `apps/control/admitted-runs/test/fixture.mjs`, `admittedFixture()`; explicit `MERI_REVIEW_SOURCE_ROOT` is required. Its pool and identity/transport ports are synthetic, not native observations. Host-port allocation/credential effects retain their own semantics; only observed fixture counters and constructed canonical source/delivery/accounting owners establish the zero-effect source-off result here.

Remaining boundary: this is a concrete source reader of already active admission, explicitly dependent on the qualification-named persistence schema and canonical worker mapping. No migration or product lifecycle owner was added; upstream Grants activation and verified worker establishment remain independent. No qualification FixtureRegistry was promoted. Capiro bridge/current native-session adapters, product persistence, live database/transport and deployment remain unimplemented or unqualified external work. All production sources/catalog entries remain unavailable. No frontend, native DB, customer, provider, cloud, image or paid action occurred.

Merge order: f996c54f →031182b0 →863b71de →6b282c8c →author metadata packet. Preserve initial commits/raw failures. No additional production repair requested after independent65/65.

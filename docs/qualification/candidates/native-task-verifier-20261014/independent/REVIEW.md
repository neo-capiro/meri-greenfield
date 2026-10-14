# Independent task verifier and admitted composition review

**ACCEPT_SOURCE_LOCAL_VERIFIER_AND_ADMITTED_COMPOSITION** at `280c804dd0dcd114ec1a0b8803764f6187ad2049`. This acceptance covers canonical source composition with explicitly synthetic SQL/native authority resources, actual local loopback HTTP and actual owned local Node-child streams. It does not accept deployed task authority, real database snapshot/lock behavior, current backend identity, immutable runtime image, model/proxy, broker execution, Temporal or physical isolation. SDK/provider/database-server/cloud/document calls were zero.

Reviewed the existing native identity/context, task transport, worker receipt and SDK-session contracts; canonical admitted-grant parsing; and the PR74 launcher boundaries. The new verifier compares the existing raw capability SHA256, full binding and fixed trusted operation allowlist, reads current canonical admission and freshly resolves canonical identity/context, then returns the existing worker receipt. Its authority expiry retains the minimum original supervisor/native/admitted lease; a caller's bounded request deadline does not become a renewable authority lease. The trusted identity credential remains distinct from the selected worker token and crosses only the protected control-facing boundary.

The canonical admission extension shares `readCurrentAdmission` predicates, using a fixed repeatable-read read-only transaction and ordinary snapshot selects for verifier refresh. Existing `currentRun` and `withCurrentAllocation` retain their locking behavior. Separate snapshots before/after native authority avoid mixed per-query facts and allow later committed changes to refuse verification. Read-only snapshots can refresh during the canonical SDK-session owner's held allocation without acquiring its budget row lock again. Synthetic fixtures establish generated SQL and composition; they cannot establish PostgreSQL MVCC or deployment performance.

The admitted supervisor snapshots original configuration, forbids any configured task-grant hash as trusted-control caller, aborts pending preparation/verification when closed, exposes stable canonical product ports, and prepares PR74's one-use launcher with an expiry no greater than the original plan or receipt. No new minting, persistent grant registry, session owner, public schema, model loop or runtime receipt was introduced.

Independent command:

```text
MERI_REVIEW_SOURCE_ROOT=/workspace/meri-native-task-verifier python3 docs/qualification/candidates/native-task-verifier-20261014/independent/capture-reaped.py final-controls node --test docs/qualification/candidates/native-task-verifier-20261014/independent/controls.test.mjs
```

**8/8 PASS** on exact committed source, source diff 0 bytes, exit 0, no timeout, capture group absent and no capture fallback kill. Distinct controls check:

- An additional original task grant cannot become the trusted-control caller.
- Hostile command-context accessors and Proxy execute no traps or external reads.
- Fresh native expiry of 2200ms remains distinct from a 100ms request deadline and bounds the actual real-child registration witness.
- Mutation of the caller's operation list/launch argv/environment does not modify the compiled verifier or launcher plan.
- Closing a supervisor with parked native preparation aborts the supplied native signal, refuses the pending preparation and prevents subsequent authority dispatch.
- Actual loopback HTTP refuses worker caller tokens, foreign task tokens and caller-added credential/scope fields before SQL/native effects; valid trusted control receives a canonical no-store reply.
- Verification inside held locking admission executes exactly four fresh repeatable-read read-only snapshots with no `FOR UPDATE` or SQL effects; outer admission retains its original locks.
- Quarantine committed during native context work refuses the receipt without restoring or mutating revoked state.

The test resource helper is reused only for explicit synthetic SQL/native infrastructure. Independent assertions and the actual child fixture live in this directory. Every fixture directory and allocated child is retired through test-owned cleanup; narrowed-lease child cleanup explicitly asserts the launcher's physical-stop proof. Raw capture streams and module/test hashes are retained in the manifest.

Three initial static findings were fixed before the freeze: premature direct access to commandContext getters; close failing to abort pending prepare; and checking outer caller exclusion only against the selected grant instead of every original task grant. No independent failing test run occurred for this frozen candidate. The receiving handler follows the existing worker HTTP native Request pattern; these controls do not claim inert handling of arbitrary hostile Request subclasses/accessors. Real network inputs cannot supply JavaScript property traps.

Remaining acceptance inputs include the genuine deployed admitted grant/task provenance, protected control capability and native identity bindings, actual product database/migrations/grants, broker `execution/start/poll`, runner runtime/model/proxy and image bindings, approved physical isolation and Temporal. The backend's authority extraction remains separately owned. Real authenticated conversation/output acceptance remains unproven.

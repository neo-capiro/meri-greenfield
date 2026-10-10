# Independent proxy ingress preparation review

Codex review outline, 10 October 2026 UTC. Candidate `fa1f4000dee7d57a9229e2f803dd9dde895afd5c`; parent `b8c3405bbe2e7d92a0e4ac27fd4adcc42a3e75e1`. This reviewer did not author the ingress candidate.

1. Verify the exact four-path diff, canonical state interfaces and retained source/evidence pins.
2. Review trusted socket/peer provenance, current run/grant/fence/expiry checks, header denial and stream resource ownership.
3. Run one bounded canonical fake suite and focused independent negative controls; preserve failures and distinguish offline preparation from deployed authentication or revocation guarantees.

Only this new report and ignored review evidence are owned. No cloud, database, HTTP server, provider/model, Docker, installation, Hermes, source repair or integration action is authorized.

## Verdict: BLOCKED by a fresh-pull authorization gap

The candidate's canonical20 checks pass, but two independent literal controls establish one source defect: **after yielding an item, the wrapper starts its next upstream pull before rechecking authorization**. `runtime/ingress.py:133` yields; line134 immediately schedules `anext(iterator)` when the consumer resumes. Only line126, after the next wait, rechecks the lease and grant. Revoking the grant or expiring the peer lease between those calls still enters the upstream iterator's second body before publication is denied. An upstream pull can perform work even when its result is never published. This review does not claim a real provider send occurred.

Retained independent witness, executed once:

| Literal control | Expected | Actual |
|---|---|---|
| Consume first item; revoke authoritative grant; request next item | Fixed denial without a second source pull | `first-pull`, **`second-pull-side-effect`**, then `FRESH_STATE_DENIED`; iterator closed |
| Consume first item; replace the trusted lease with an already expired same-binding lease; request next item | Lease denial without a second source pull | `first-pull`, **`expired-peer-second-pull`**, then `PEER_OBSERVATION_EXPIRED`; iterator closed |

These exercise ordinary trusted composition and explicit lifecycle changes, not hostile Python objects. The expiry witness replaces only the internal observer lease to represent elapsed time without a31-second sleep; the grant witness uses actual fresh in-memory grant state. Both keep the original valid socket/key/run/fence inputs. No timer constants or candidate code are patched. The candidate still prevents the second item from being published; the failure concerns earlier source work.

**Bounded repair:** perform a fresh lease/current-state recheck after downstream resume and before scheduling every new owned iterator pull. Retain the existing publication check, periodic checks while a pull is pending, fixed failure reasons, cancellation/close behavior and no refund/settlement. Add both no-second-pull controls to the canonical suite. This repair does not supply an independent watcher during backpressure or prove the deployed30-second objective. Upstream dispatch must continue to require the separate final-body/CountTokens/durable UNKNOWN send guard; wrapping an already dispatched response cannot undo a send. No source repair was made by this reviewer.

## Scope and positive findings

The exact diff is four additions, three focused modules/tests plus the author report; no existing runtime, migration, contract, dependency or infrastructure file changes. The19 source records (four owned plus15 protected) match raw Git at the exact candidate and remained stable before/after checks. The15 protected records therefore also match the parent, whose diff contains only those four additions.

`GrantAdmission` reuses the qualification-only canonical `RunBinding`, `Grants._current` and `PostgresStore` transaction/budget interface. The store locks the singleton budget before obtaining database time; every admission then requires a non-quarantined budget, exact current run/attempt/task/fence/policy, ACTIVE unexpired grant, exact binding and matching capability hash. Grant mutation/revocation uses the same budget-lock ordering. This new reader creates no grant, reservation, settlement, refund, migration or provider send. The original ledger remains the sole durable send-slot/cost authority. Synthetic cursor tests do not establish actual database isolation, connection cancellation or TLS deployment.

The HTTP boundary requires exact POST `/v1/messages`, HTTPS metadata, matching raw path, empty query and a matching canonical private IPv4 socket/port. Header names/values/count/aggregate bytes are bounded; duplicate names, uppercase/noncanonical names, control characters, forwarded identity, alternate API credentials and Meri/LiteLLM override headers deny before state access. One32–256-byte printable opaque Bearer key is hash-compared and never included in results. Peer lease is frozen, finite, canonical-RFC1918, at most30seconds old, not future, and tied to the complete qualification binding and grant.

The peer object is trusted observation DATA, not proof of ECS provenance. Deployment still needs an independently observed exact task/ENI/IP/image/definition/run/fence and trustworthy actual TLS/socket metadata with forwarded rewriting disabled; the current file neither observes ECS nor authenticates the observer. Source construction cannot prove IP reuse protection, firewall/route/CA/key handling or native SDK interoperability. `state.grants.RunBinding` is the existing internal qualification record, not a new implementation of public contracts0.1.0's tenant/actor/conversation capability. Product membership/capability semantics are not claimed or altered.

Import inspection finds only definitions and pure standard-library constants in the new production modules; there is no import-time server/database/provider initialization. Tests import these modules with injected in-memory state. No application socket/server, database or provider is created by the reviewed controls. Standard asyncio initializes ordinary Windows event-loop infrastructure; this review does not claim a universal socket-denial sandbox.

## Stream and resource qualifications

The author correctly discloses that an async generator suspends at `yield`: quiet-stream polling therefore pauses during downstream backpressure. A server-owned independent watcher, lease refresh/provenance and transport abort path remain required before continuous revocation can be accepted. A fixed30-second lease also eventually denies an otherwise active long stream unless the trusted observer refreshes it; no renewal service exists here. A5-second `wait_for` can return while its blocking `to_thread` database operation continues; cancellation-resistant source iterators can defeat the nominal1-second shutdown waits. Those limits are already disclosed and are not represented as new measured source failures.

One additional wording correction is needed: the author calls its key-negative case denial before “iterator/database access.” `stream()` calls `aiter(source)` at line119 before authorization and attempts the owned iterator's `aclose` in `finally`. My literal negative records **`['aiter', 'aclose']`**, zero `anext` and zero state calls. The accurate claim is **before upstream pull/database access**, not before all iterator methods. This is a report precision issue; the documented ownership model can intentionally close an unauthorized supplied iterator.

## Checks actually run and retained history

Both reviewer commands used the verified bundled Python3.12.14 path `C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`, `-I -B`, fixed review worktree and stdin EOF. The canonical runner adds only this worktree and discovers the one `test_ingress.py`; independent controls import only production modules and use their own literal Store/binding/key, without importing the candidate test/fixture.

| Check | Actual outcome | External direct-child bound |
|---|---|---|
| Canonical ingress suite, once | **20/20 PASS**, unittest5.203s; child wall5.641s, exit0; stdout0B, stderr2562B |120s|
| Independent controls, once | **12/14 PASS, 2 FAIL**, child wall0.187s, exit1; stdout2392B, stderr0B |30s|

Independent positives/denials additionally cover an honest different literal binding, duplicate auth, forwarded authority, CRLF, aggregate header overflow, NaN/infinite/boolean lease timestamps, current fence mutation, fresh revocation, content-free database failure and iterator ownership on missing key. Counts describe assertions, not independent live workflows. No unchanged replay was performed to turn the two failures green.

The original author failure is preserved and verified: first19-test run exit1,18PASS/1FAIL, expected close flag absent because cancellation could happen before generator entry. Its repaired start-event fixture and added key-negative case produced the retained20/20 run exit0,5.25s. No source change was made to hide that fixture failure. The author wrapper's seven pre/post source hashes match; its `capture_output` and120-second timeout are direct-child supervision, not memory/tree bounds. Reviewer supervision has the same qualified limits. Actual captured outputs were small; no claim of hard output-allocation bound is made.

## Exact source and evidence

| Candidate file | Bytes | SHA256 |
|---|---:|---|
| `runtime/ingress.py` |6195|`17fc2e87e117e2b790cdceb2d534444f3c7761f72422db39cf93e9826e82aed1`|
| `state/admission.py` |1504|`7936012c2f723da75362f87652635e87cb700fb5d9ce020c7263c7ea89412b4a`|
| `test/test_ingress.py` |11163|`260e14072a9f55db7747d1e34c94e576a3fb827a225cc58e9afb2f3161336938`|
| Author report |9307|`62001f42cd66260c20278fff047e847c029c666972e1e37a6c18066939d24d91`|

The author's final manifest at `C:/dev/main/meri-greenfield-worktrees/proxy-deployment-preparation/.task-inputs/CODEX-G1-proxy-ingress-final-data-2/manifest.json` matches required SHA256 `b8a9767624c1948133cee14ecd4f54160e1b9cc66dea968ef2ea2e08ffa08f5e`. All64 declared rows were independently remeasured (4owned/15protected/45payload rows, not64 unique implementations). Both historical test captures, wrappers and raw Git readbacks are included. The later commit-readback1082B/SHA256 `fe661892b6db0bdc08c46ec9066f7afa7079fd9b67b6d83dec762a2c8f9c8652` confirms the exact candidate and four raw-Git-equal source bytes; current independent Git/source verification corroborates its data claims.

Reviewer evidence is under `.task-inputs/ingress-independent-1/`. Its manifest21147B/SHA256 `222dc61d6892e15a54a968ddc8b728c2bd513f20ccacfff995a655feb8d9e0fd` binds64 author rows,19 pre/post source hashes and both reviewer child envelopes. Canonical stderr SHA256 `bc38fd7b12a83abe20089a6beb6080aac60205b23c6596a8d44cc1d58fe79b2b`; independent stdout SHA256 `92d7bff35666d22dc62998efca0a5e23a1e9443508f49fcdd2d040c0c82724eb`. Fixed supervisor/independent source remains ignored beside those outputs. One exploratory read requested nonexistent `runtime/interfaces.py`; actual canonical interfaces were found in `bedrock_transport.py`, grants/store/ledger and the frozen schema. That navigation error is not a candidate failure.

**CLOSED / BLOCKED for owner source acceptance pending the narrow repair.** No self-merge, live ingress authentication, complete proxy admission, database/driver/Linux qualification,30-second deployed guarantee, real CountTokens/provider usage, paid inference, security waiver or G1 pass follows. Existing failed evidence remains unchanged.

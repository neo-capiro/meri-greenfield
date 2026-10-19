# Source348 complete startup successor: source-only handoff (2026-10-19)

## Exact source pin and scope

The reviewed successor code is `abfba7c5f3424f61a774815181ed9793b9add877` on `diagnostic/source348-load-build-handoff-20261019`. It follows the earlier load repair `de104e80d0876ac62bccbafb81055b0832cfc953` and preserves the frozen PR175/source348 history. This document has a later docs-only commit; the code pin above is the source to review and seal. No image was built, deployed, measured, or admitted here.

The earlier load-only handoff identified the next three-second `runner/runtime` and `runner/publish` limits. This successor gives the actual runner, native preparation, task process start, and first SDK session operations separate bounded stages within the **original** execution expiry. Other native and session calls retain their ordinary three-second limits; ordinary task byte transport remains eight seconds. The direct source changes are in `apps/runtime/{conversation-runner,native-client,remote-conversation-runner,task-bootstrap,sdk-first-session,sdk-session-runtime}.mjs`, `apps/runtime/native-authority/{independent-task,preparation-http,prepared-kickoff,remote-composition,remote-task-client,remote-task-http,session-client}.mjs`, `apps/worker/conversation/activity.mjs`, and `packages/runtime/runner-load-budget.mjs`. Focused tests and a model-free composed fixture accompany them.

## Bounded startup schedule

`runnerStartupBudget` derives its cutoffs from the trusted original `expiresAtMs` and the configured control request and shutdown limits. With the source-rendered 25-second control request and ten-second shutdown, each network stage is at most 23 seconds. The ordered stages are bootstrap, admission before gate, admission after gate, load, runtime, local setup, starting publication, preparation setup, running publication, native prepare, native start, and first SDK session. Local setup is three seconds. Preparation setup is 23 seconds. Every stage expires before the time reserved for every later stage; the earliest stage requires 558 seconds of remaining original lease for all allowances to be available.

The final reserve is 302 seconds: 115 seconds for one completion publication and up to four failed terminal attempts, three seconds for catch-side query close, 152 seconds for final cleanup including the Browser host's bounded settlement, 30 seconds for three shutdown steps, and two seconds of margin. The next model-frame wait stops by `original expiry - 302 seconds`; publication and completion capture retain a separate 23-second active window, and failure settlement keeps its own reserve. A shorter actual lease cuts stages off; it does not extend them. The exact issued original expiry and allocation schedule expiry remain required live readbacks. The previously reported 900-second configured run window alone does not establish that a particular fresh run has 558 seconds of available lease.

Startup-only longer calls require both an allowlisted operation and an absolute cutoff. Cancellation propagates into native fetch, gate proof, task start, and SDK session calls; late responses cannot turn an aborted request into success. Currentness, selected-client membership, retention, and task authority checks remain on the receiving paths. There is no bypass or new credential. The first fresh SDK session register/load/append each gets a one-shot bounded startup allowance; continuation and later session calls keep three seconds.

## Focused evidence and limits

* Load, budget, and native client tests: **29/29 passed** with import-only diagnostic stubs for unavailable local dependencies. This includes a 62-call dynamic load with synthetic 300 ms Core responses, cancellation, deadline, and revocation cases.
* Prepared kickoff gate: **9/9 passed**; the gate now accepts the intended eight-second proof cap instead of silently dropping it.
* Remote task startup tests: **2 passed, 1 skipped** on Windows. The skipped process cancellation case requires Linux `/proc`; the focused cancellation and late-response source path was reviewed separately.
* First fresh SDK mirror focused tests: **2/2 passed** with an import-only hook. The broader two-file run had 16 passing tests and two local `STORE_UNAVAILABLE` fixture failures before this path.
* The new no-model composed HTTP fixture passed **1/1** in 57.44 seconds. It exercises native load, runtime, starting/running and failed publication, task prepare/start, and synthetic 300 ms Core replies. It substitutes DB grants, task authority, and unavailable local integrations. It does not exercise the real SDK Query, model, TLS, ECS, Temporal, or deployed Core latency.

`git diff --check` and syntax checks on edited production modules passed. An independent changed-path review found and led to repair of the gate's dropped request cap, then found no further concrete first-chat startup timeout in these source paths. This is source evidence, not a live first-chat result or deployment qualification.

## Candidate proof rows and build gate

The historical `candidate-manifest-fable-20261015h.json` stays unchanged. At the exact code pin, **24 of its 45 file rows differ** from its historical hashes. Nine of those rows were touched by this successor; their current file SHA-256 values are below. These are measured source bytes, not an admitted candidate manifest:

| Affected historical row | Current SHA-256 |
| --- | --- |
| `apps/runtime/conversation-runner.mjs` | `166742d9e0068ebd193d330c5a06799791d2f8219f312a285e1b3dd687dc96f5` |
| `apps/runtime/native-authority/prepared-kickoff.mjs` | `6bd04f5b3f4035bbfd4ee79ff978c1d1d7eeec4bd443dbbe895845abfdd96db6` |
| `apps/runtime/native-authority/remote-composition.mjs` | `a7abd0806d71d95e41d9ffedc478b7c855369ee767d665e1569758ad367625fa` |
| `apps/runtime/native-authority/remote-task-client.mjs` | `3bb6fac71ed17ada40fa30dc1a709ad00d851fa96db2998853dc4bf847c9ea84` |
| `apps/runtime/native-authority/remote-task-http.mjs` | `6f2a13323c9da4b2c0d2bee8161de42faf1cb153107f62657488b845e746bb8d` |
| `apps/runtime/native-authority/test/prepared-kickoff.test.mjs` | `308a83138cca7ca67b6cd845daab3b985c2f83cd30d868bccd64ecf6d27394c1` |
| `apps/runtime/native-authority/test/remote-task.test.mjs` | `9d00d4a2fc3c147aca6f890bbdbfdfdceee1f3f47cd82008ab011cff1024dec9` |
| `apps/runtime/remote-conversation-runner.mjs` | `d071eb92be15f6b895074ff8f7bfd571d1b82a14564407b0ba14d1b60dbf4d66` |
| `apps/runtime/task-bootstrap.mjs` | `8b732ea438ee57a1ad6600874036374f2f335289ff1d1f81f0a6bcc0c2cb2eb7` |

The other 15 stale rows and the historical Dockerfile assertion remain as described in `SOURCE348-LOAD-BUILD-HANDOFF-20261019.md`; source proof previously failed at the `postgres-store.mjs` row. Review every changed row and the Dockerfile rule before producing a new candidate proof. The Node recipe must seal **this** exact source commit into a new archive/member manifest and versioned immutable S3 objects, then measure the runner inside the resulting image. Historical N21 hashes and receipts cannot transfer. A Node image is the minimal source rebuild set if the deployed proxy source/digest remains approved; the ARM64 image lane owns architecture selection.

The paid-build gate remains closed: the existing $600 reservations are fully allocated. Reconcile actual usage and unused reservations and obtain ordinary build authorization before CodeBuild. This handoff requests no paid build and performs no AWS mutation.

## Remaining live qualification

Read back the fresh conversation's original expiry and allocation schedule expiry, plus Core identity/context/membership receipt remaining time and correlated Core/DB latency. Verify the exact running Core image provenance before attributing source behavior to its deployment. Then qualify the new image with in-image source measurement, a fresh authorized first chat, runner stage diagnostics, task/Temporal state, and authenticated owner transcript. Existing D14 evidence places that runner failure before `cli.main`, without identifying its exact bootstrap failure. The `ac2d2a7a` startup instrumentation is observability only; a later `RUNNER_POSTSTART_REFUSED` would still require transport evidence. No CA, TLS, or config change follows from current evidence.

The historical failed chat remains **UNKNOWN** here. The supported same-origin FE18 history proxy can read `/api/conversations/list` and `/transcript` for a signed-in owner, and the recovery workflow may have already called stop. This thread has neither that signed-in browser context nor the separately provisioned Temporal control capability/config. Do not infer a binding from ECS or retry a prompt; compare the exact owner transcript and Temporal activity history before any manual stop-only reconciliation.

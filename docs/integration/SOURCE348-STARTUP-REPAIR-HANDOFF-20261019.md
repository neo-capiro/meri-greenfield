# Source348 complete startup successor: source-only handoff (2026-10-19)

## Exact source pin and scope

The reviewed startup code is `abfba7c5f3424f61a774815181ed9793b9add877` on `diagnostic/source348-load-build-handoff-20261019`. Candidate `i` and the synchronized static/COPY proof were committed at `78549037` after measuring that exact code tree. It follows the earlier load repair `de104e80d0876ac62bccbafb81055b0832cfc953` and preserves frozen PR175/source348. For a product image, seal the **exact final reviewed candidate commit**, which includes the proof and this handoff; do not seal the earlier code-only commit or a moving branch name. No image was built, deployed, measured, or admitted here.

The earlier load-only handoff identified the next three-second `runner/runtime` and `runner/publish` limits. This successor gives the actual runner, native preparation, task process start, and first SDK session operations separate bounded stages within the **original** execution expiry. Other native and session calls retain their ordinary three-second limits; ordinary task byte transport remains eight seconds. The direct source changes are in `apps/runtime/{conversation-runner,native-client,remote-conversation-runner,task-bootstrap,sdk-first-session,sdk-session-runtime}.mjs`, `apps/runtime/native-authority/{independent-task,preparation-http,prepared-kickoff,remote-composition,remote-task-client,remote-task-http,session-client}.mjs`, `apps/worker/conversation/activity.mjs`, and `packages/runtime/runner-load-budget.mjs`. Focused tests and a model-free composed fixture accompany them.

## Bounded startup schedule

`runnerStartupBudget` derives its cutoffs from the trusted original `expiresAtMs` and the configured control request and shutdown limits. With the source-rendered 25-second control request and ten-second shutdown, each network stage is at most 23 seconds. The ordered stages are bootstrap, admission before gate, admission after gate, load, runtime, local setup, starting publication, preparation setup, running publication, native prepare, native start, and first SDK session. Local setup is three seconds. Preparation setup is 23 seconds. Every stage expires before the time reserved for every later stage; the earliest stage requires 558 seconds of remaining original lease for all allowances to be available.

The final reserve is 302 seconds: 115 seconds for one completion publication and up to four failed terminal attempts, three seconds for catch-side query close, 152 seconds for final cleanup including the Browser host's bounded settlement, 30 seconds for three shutdown steps, and two seconds of margin. The next model-frame wait stops by `original expiry - 302 seconds`; publication and completion capture retain a separate 23-second active window, and failure settlement keeps its own reserve. A shorter actual lease cuts stages off; it does not extend them. The exact issued original expiry and allocation schedule expiry must be read back **before a fresh chat**, not before source packaging or an image build. The previously reported 900-second configured run window alone does not establish that a particular fresh run has 558 seconds of available lease.

Startup-only longer calls require both an allowlisted operation and an absolute cutoff. Cancellation propagates into native fetch, gate proof, task start, and SDK session calls; late responses cannot turn an aborted request into success. Currentness, selected-client membership, retention, and task authority checks remain on the receiving paths. There is no bypass or new credential. The first fresh SDK session register/load/append each gets a one-shot bounded startup allowance; continuation and later session calls keep three seconds.

## Focused evidence and limits

* Load, budget, and native client tests: **29/29 passed** with import-only diagnostic stubs for unavailable local dependencies. This includes a 62-call dynamic load with synthetic 300 ms Core responses, cancellation, deadline, and revocation cases.
* Prepared kickoff gate: **9/9 passed**; the gate now accepts the intended eight-second proof cap instead of silently dropping it.
* Remote task startup tests: **2 passed, 1 skipped** on Windows. The skipped process cancellation case requires Linux `/proc`; the focused cancellation and late-response source path was reviewed separately.
* First fresh SDK mirror focused tests: **2/2 passed** with an import-only hook. The broader two-file run had 16 passing tests and two local `STORE_UNAVAILABLE` fixture failures before this path.
* The new no-model composed HTTP fixture passed **1/1** in 57.44 seconds. It exercises native load, runtime, starting/running and failed publication, task prepare/start, and synthetic 300 ms Core replies. It substitutes DB grants, task authority, and unavailable local integrations. It does not exercise the real SDK Query, model, TLS, ECS, Temporal, or deployed Core latency.

`git diff --check` and syntax checks on edited production modules passed. The first independent review found the gate's dropped request cap, which was fixed. A second independent review covered the **full 23-file startup code/test diff** and connected bootstrap, gate, worker, task, SDK session, cancellation, late-response, terminal settlement, and cleanup paths at `abfba7c5`; it found no further concrete defect. This is source evidence, not a live first-chat result or deployment qualification.

## Candidate proof rows and build gate

The historical `candidate-manifest-fable-20261015h.json` stays byte-exact at SHA-256 `79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e`. At `abfba7c5`, **24/45 rows differ from candidate h**, while **28/45 differ from the immutable historical source manifest**. Four historical changes still equal h. The new `candidate-manifest-fable-20261015i.json` (`9612902e156cffbdce71bd71b9115bd8ce642d979583795fd2a5ac5df549f5e2`) records all 28 with rationale and hold decisions, exact h predecessor linkage for all 24 new changes, and the reviewed Dockerfile hash `e7e0427aca562ba0747ca0874ff284915af2ce40f32f4d5330857824e8d43022`. Nine of the h deltas came from the immediate startup successor; their source hashes are below:

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

The new candidate was checked against all 45 files at `abfba7c5`; independent selector validation found zero mismatches. `source-proof.test.mjs` and `frozen-candidate.test.mjs` now select the same `i` bytes and pass **12/12**, including the h-to-i chain, changed recipe row, all 16 `.dockerignore` proof-test exceptions, and network-isolated SWC helper pins. The old `postgres-store.mjs` manifest failure is closed at the source-proof level. Historical N21 hashes and receipts cannot transfer. A Node image is the minimal source rebuild set if the deployed proxy source/digest remains approved; the ARM64 image lane owns architecture selection. Actual Docker-filtered COPY and in-image byte measurement remain image qualification checks.

## Fable's offline source packet

Fable is the sole AWS operator. On the destination host, obtain the **published final full 40-character commit** and its complete Git objects, then use the committed `infra/product-preview/image-build-source.py` sealer. Its `--archive` and `--output` paths must be absolute, distinct, and absent; their parent must exist. From the final checkout:

```bash
SOURCE_COMMIT='<final reviewed handoff commit>'
PACKET_DIR='/absolute/new-packet-directory'
git rev-parse "$SOURCE_COMMIT^{commit}"
GIT_NO_LAZY_FETCH=1 git rev-list --objects --missing=print "$SOURCE_COMMIT"
GIT_NO_LAZY_FETCH=1 python3 -I -B -S infra/product-preview/image-build-source.py seal \
  --repository . --commit "$SOURCE_COMMIT" \
  --archive "$PACKET_DIR/product-source.zip" \
  --output "$PACKET_DIR/product-source-members.json"
```

Confirm the resolved commit is exact and that the `rev-list` output has **no `?` missing-object lines** before sealing. Neomart's checkout and retained payload availability have not been checked in this thread; this jumpbox's partial clone has zero missing reachable objects for the current commit. The sealer verifies member bytes against Git blobs and fixes member ordering, timestamp, modes, commit comment, and canonical member JSON. Its ZIP uses unpinned Python/zlib compression, so a different host can produce a different archive size/SHA for the same members. Record **Fable's locally measured** archive SHA-256, member-manifest SHA-256 and sizes for review before upload; never reuse an older archive hash without byte equality. The prior approximately 278 MB ZIP and 4 MB members file are sizing history only.

The retained public package inputs are tracked Git blobs: signed `infra/product-preview/runtime-packages/x86_64/` index and 44 APKs, four pinned wheels in `runtime-packages/wheels/`, their lock files, the public RDS CA bundle, and the Dockerfile. Do not transfer private packets, credential material, installed `node_modules`, or a historical build bundle. Build-time access to the separately pinned base images and locked npm packages is still required. Once Fable verifies and uploads the actual packet under the existing `product-runtime/<final-commit>/` prefix, use its real immutable S3 `versionId` and checksums in the complete schema-v2 request. Run the sealer's offline `verify` against that request and packet, then produce the exact buildspec with `createProductImageBuildRecipe()`; do not invent object versions or carry forward a historical request hash. Source sealing does not establish image or deployment acceptance.

The local static proof passed **12/12**, and the retained runtime package tests passed **22/22**. Python-based producer checks could not run on this Windows jumpbox because its configured Python shim returns `Access is denied`; a combined runtime-package/image-build run recorded 26 passes and 43 Python-dependent failures. Run the focused Python checks on Fable's supported operator host before using the packet. No Docker COPY test or paid build ran here.

Neo approved an additional **$5** at 16:11 UTC, moving the cap from $600 to **$605**; the earlier $600 reservations were fully allocated. The reported approximately $10.47 build-only list estimate does not create headroom. Fable, as sole AWS operator, must reconcile bounded actual usage/reservations against the $605 cap or obtain any further allocation before a paid build. This thread performs no AWS mutation.

## Remaining live qualification

Before a **fresh chat**, read back its issued original expiry and allocation schedule expiry, plus Core identity/context/membership receipt remaining time and correlated Core/DB latency. This is a pre-chat gate and does not delay source sealing or a separately authorized build. Fable's [read-only PR121 provenance](https://github.com/neo-capiro/meri-greenfield/pull/121#issuecomment-6271140406) maps deployed Core:2 digest `sha256:46acfc0734fd40afdfca6851ab542173b9d35eb9658d35c60180d716c02acde8` to ECR tag `ade7fc883b7459cbc50e6f71d40ce3644bace5ea` and successful CodeBuild `6ee29aa7`; the S3 source ZIP hash was not reverified. The mapped commit calls Clerk `sessions.getSession` on each identity request and lacks the later `ARTIFACT_AUTHORITY_TTL_MS`, consistent with measured Core latency. Do not attribute later Core constants to this deployed image. Then qualify the new Meri image with in-image source measurement, a fresh authorized first chat, runner stage diagnostics, task/Temporal state, and authenticated owner transcript. Existing D14 evidence places that runner failure before `cli.main`, without identifying its exact bootstrap failure. The `ac2d2a7a` startup instrumentation is observability only; a later `RUNNER_POSTSTART_REFUSED` would still require transport evidence. No CA, TLS, or config change follows from current evidence.

The historical failed chat remains **UNKNOWN** here. The supported same-origin FE18 history proxy can read `/api/conversations/list` and `/transcript` for a signed-in owner, and the recovery workflow may have already called stop. This thread has neither that signed-in browser context nor the separately provisioned Temporal control capability/config. Do not infer a binding from ECS or retry a prompt; compare the exact owner transcript and Temporal activity history before any manual stop-only reconciliation.

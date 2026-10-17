# Independent general-read installation review

Disposition: **ACCEPT_SOURCE — no blocking source findings in this bounded installation packet.** This is source-composition acceptance, not a mounted production installation, current native qualification or live-read claim. Parent still owns the final coherent run, staged-tree review, publication and any future startup mount.

Reviewed working source above PR119-equivalent local `546a8ad45e48539c3f0fc832018269cabadbf1ee`, tree `b1f79a9832393053c2db64cc9437bad8d59fc8e4`. Scope: new `general-read-installation/{configuration,runtime}.mjs`, its three fixture/test files, canonical integration's two-phase preparation and new `families/mail.mjs`. I did not author those changes. I authored `client-reference.mjs` in a separate lane and **exclude that implementation from this independent review**; its new COMMON label was checked only as manifest data. Other concurrent read-family changes are outside this packet's acceptance.

## Actual composition and authority boundaries

- The factory matches the existing synchronous hook. `remote-composition.mjs:106` joins the actual admitted pool/binding/original/allocation/grants/task ARN/issuance/request/scopes/current-entry/current-owner/source flag/limits/clock/signal with the three fields supplied by `createPreparedNativeReads`: current task verifier, task capability and approved read configuration. `configuration.mjs` admits this exact tuple, uses canonical grant parsing and checks original/grant bindings, capability digest, worker ARN, policy and original expiry. The gateway producer context must equal that admitted grant, its credential must equal the task capability, and producer execution ID must equal the original execution ID. Current facts remain the existing verifier/entry/admission owners' responsibility; local shape validation is not an issuer.
- Async preparation performs canonical source-file measurement only. It shares frozen source records and returns ordinary synchronous construction functions. Unsupported/duplicate IDs and async task-port factories refuse. Per-task construction creates fresh handler maps, family adapters and native credential/context owners, including a new canonical conversation-store facade over the borrowed pool. Task state, credentials and the native owner's per-signal pins are not cached across tasks.
- Native transport callbacks cannot replace the fresh owner: configuration admits only origin/fetch/request/response limits for those families, requires the exact Core authority origin, and injects its own per-call credential function and client-registry result gate. Existing task, current entry, run/store, native principal/membership, subject, source and expiry checks still execute in the canonical owner. Other transports and mail/retained/memory context ports remain explicit trusted borrowed dependencies.
- Missing qualification/discovery/authority/native owners or disabled source return the existing unavailable runtime without credential or source work. Preparation and construction do not read qualification, mint credentials or generate receipts. Pool connections and network/lifetime resources are acquired only through the existing bounded owners at execution. Borrowed pool, authority and credential ports are not disposed by this composition; no new background worker or connection is started at import/construction.
- `createControlGeneralReadRuntime` still constructs the canonical general installation owner and durable gateway mount. A fresh external current-installation receipt must match binding, exact scopes/policy, descriptor hash, handler source hash, qualification UUID and execution catalog. `registerMeasuredHandlers` reopens and measures the actual registered files under bounded lifetime with file cleanup. The gateway rechecks installation before and after source execution; current task/discovery/native joins and UNKNOWN/settlement behavior remain canonical. Source manifests or UUID syntax never qualify an operation by themselves.
- Selected skills retain their separate owner, selected skill/request/selection pins, current context and current selected-installation receipt. Prepared handlers are reusable input to that owner; a general receipt is not translated into a selected receipt. The packet does not mount either path into startup.
- The new mail family is a thin composition of the existing `createMailHttpAdapter` and `createMailReadHandler`, deriving references through `familyOperations('mail')`. Existing explicit endpoints, credential broker proof correlation, metadata/request binding, strict receiving, deadlines and cleanup remain in those unchanged adapters. No routes, mail registry or alternate authorization logic were added.

## Provenance and registry checks

The final integration is SHA256 `5250169fb7c5673f4bec6cfa48a19065fabdd711fd50ebaf63726c48b8e058c5`. Removing exactly the one root-added COMMON line for `client-reference.mjs` reproduces the author's recorded integration hash `05730055c1b0ba038516fae020aefcf7db6586261546ccf3823e4a58353d79f4`. This verifies the post-author production change is the stated manifest addition. It is not a loader or handler behavior change, but it changes measured source hashes and requires fresh current qualification.

COMMON measures both new composition modules and the new mail family plus its reused mail source modules for every composition. The new reader label occurs exactly once after deduplication. Native manifests retain the current owner/core/context and family helper measurements. No caller-supplied source hash or manifest replaces canonical preparation or use-time file measurement. This review checks the new/changed source measurements; it does not claim a new exhaustive closure audit of every historical dependency.

A passive import and canonical registry readback returned **70 OperationRefs / 40 SDK families / 43 constructors**, all referenced descriptors read-only with approval boundary `none`. Counts are derived from `familyReads()` and canonical constructors, not hardcoded into installation. Partial-only constructor families without SDK eligibility remain refused by this factory. These are source registry counts, not installed/live operations.

## Evidence and limits

I read the actual prepared-read/remote hook, current native owner, general runtime, installation, measured-handler and durable gateway composition alongside the new code and tests. Those existing owner, remote/prepared and canonical mail files have no diff in this packet. No test suite rerun was needed for this review; no blocking finding required a reproduction.

I independently verified stored stdout/stderr lengths and SHA256 values against all three direct process-capture receipts, with `captureIncomplete:false`:

| Authored execution | Result and reviewed explanation |
| --- | --- |
| Initial | 5/14 passed; nine failures enter the closed `createPreparedNativeReads` configuration from the fixture. The corrected fixture passes that API's exact fields and joins the full tuple only in the existing hook. |
| Runtime repair | 9/10 passed; the remaining expectation demanded raw `H.R. 1` on bill HTTP. The canonical adapter sends normalized `119-hr-1`; the repaired assertion separately retains original request and digest checks. |
| Final bounded selection | 15/15 passed, zero skips/cancellations, exit zero; Node24.19.0, 256MiB, serial and 30-second test deadline. |

Evidence: [final receipt](read-installation-20261017/installation-final.json), [final stdout](read-installation-20261017/installation-final.stdout.txt), [initial receipt](read-installation-20261017/installation-initial.json) and [repair receipt](read-installation-20261017/installation-runtime-repair1.json). Final receipt SHA256 is `2bc97dfbd60fd4e25f9725fcff719ff0aaa1024c45fb1232036f54ccaf129112`; its stdout SHA256 is `0b047f6118c6094ec809bb96c0786ce84b242ad7a124f7e648cce56ea7862664`.

The current preparation test additionally asserts the four new COMMON labels exactly once. Its hash differs from the archived final run because those provenance assertions were added afterward; I reviewed that additive assertion and do not claim the archived run executed it. The current integration's one-line manifest addition likewise postdates the authored run. Parent's final coherent run must use the exact current hashes below. The bounded acceptance does not convert those older execution bytes into a fresh run.

## Exact reviewed hashes

| File | SHA256 |
| --- | --- |
| `apps/gateway/general-reads/integration.mjs` | `5250169fb7c5673f4bec6cfa48a19065fabdd711fd50ebaf63726c48b8e058c5` |
| `apps/gateway/general-reads/families/mail.mjs` | `23442b41652196f7681ff44dadf02643edd0207499a990a8eef71bbc76be40bd` |
| `apps/runtime/native-authority/general-read-installation/configuration.mjs` | `2c9472b150243f52ffb599f3b56ddf4d64cdc666ddde4e4c01017f6d3437ba85` |
| `apps/runtime/native-authority/general-read-installation/runtime.mjs` | `dd560173deb4d5ffc0c1b3dd2ee54611c8a47c8c2da94e0da4252495c8732705` |
| `apps/runtime/native-authority/general-read-installation/test/fixture.mjs` | `c187dacf37e960dd8266a00326378445a66220e031e1bf0d112000127fc72eb6` |
| `apps/runtime/native-authority/general-read-installation/test/preparation.test.mjs` | `d9625e6e41b33fb767048c53a7ca13d6e232fc5cacb0409895957c6420089ba4` |
| `apps/runtime/native-authority/general-read-installation/test/runtime.test.mjs` | `d76c6853ecf6b8dbafeb3dcff111d5b7b2552a8d03091bfa57d35fe1e287a746` |

Only this new report is authored by the reviewer. No production/test edits, installation qualification, startup mount, builds, dependency installation, live Core/provider/database/cloud calls, recursive delegation, staging or commit occurred in this review. Actual current qualifier/discovery ports, native server compatibility and deployment acceptance remain external owner gates; installed/live count remains unclaimed.

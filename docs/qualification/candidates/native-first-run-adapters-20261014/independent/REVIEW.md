# Independent first-run adapter review

Decision: **ACCEPT_SOURCE_ONLY** at repaired source `a41c822abf11639808acb69b5d0399b690f2c856`; **HOLD_NATIVE_QUALIFICATION** and output awaiting separate explicit approval. Base PR67 is `c87a7321db17091db4baac75182d4727ad8acd75`. Original candidate `1c5cb7ab581071ecf0d10614bc8895d4ae7f5a7e` required a strict-input repair. This review performed no credential lookup/creation, native database or provider call, AWS/security/production write, document creation or remote messaging. Borrowed dependency symlinks were not changed.

## Finding and repair

Original task-authority.mjs checked inputSha256 with RegExp.test without requiring a string. A plain object with toString returning a valid digest executed its method during validation and reached the borrowed native verifier before refusal. This violates the adapter's strict inert-input/no-effect boundary, even though canonical receipt validation would subsequently refuse it.

Independent strict-input.test.mjs expected zero coercions and zero native calls. On exact clean `1c5cb7ab`, it recorded one coercion and one synthetic native call: **0/1 passed**, exit 1. The original test and failed raw streams/receipt remain unchanged. Coordinator repaired the condition by checking typeof inputSha256 is string before regex evaluation. The exact same independent assertion passes on repaired `a41c822a`.

No additional blocking source finding was identified. Native verifier/observer availability and actual execution remain distinct blockers; source composition does not implement these owners.

## Reviewed behavior and ownership

- createNativeTaskAuthority is an inert adapter to the existing worker/authorize operation, not a task issuer/signature verifier or policy substitute. It captures the original native.call method and receiver, validates closed capability/binding/operation/hash arguments before effects, carries an owned deadline/cancellation signal and validates fresh canonical receipt binding/operation/hash/scopes/client/policy/time. Its catch does not inspect thrown active error fields or retry.
- Existing worker-http uses the adapter without changing its run service/current-session checks. It continues refreshing authorization before and after the service effect and revoking its locally issued session in finally. The native capability client supports the added compiled deadlineMs transport option. Outer HTTP lifetime still bounds each request; this review did not rerun unrelated worker suites.
- createNativeFirstRunPorts captures original currentRun and withCurrentAllocation methods from the same borrowed admission object and captures the independent registration.read method. Identity/context uses the existing canonical prebound command context and native protocol; session ownership uses the unchanged durable owner/current-allocation transaction. Configuration is compiled server input, not request-installed authority. Construction performs no IO.
- Defaults and absent verifier/observer fail before authority observation or allocation/SQL effects. Strict unknown/getter/boolean configuration, foreign/expired/future receipts/observations and policy drift refuse. SDK init/main-key provenance, observation hash/identity and original expiry remain validated by the canonical durable owner.
- The composition exposes only identityContext and sdkSessionOwner. It supplies no approvedOutput, document options, source activation or output publication owner. Task/session authorization does not grant document creation.
- No allocation-lock reacquisition workaround was added. The wrapper does not call identity currentRun during session lease refresh. A focused independent check observes verifier refresh inside the existing held allocation lease without currentRun reacquisition. The real external verifier must satisfy that same lock boundary; this synthetic check does not qualify its implementation or a database lock.
- An independent synthetic revocation during the held allocation lease refused registration release and the canonical fixture rolled back its registered row. Cancellation aborted the signal supplied to an in-flight verifier and refused authority without retry. These checks prove local control flow, not physical remote exit or actual transaction isolation/durability.

## Actual checks and evidence

Both checks used an independently adapted Linux child-subreaper capture with exact source-head/clean-production-diff refusal before allocation, test-source hashes, raw stream hashes and source HEAD/diff checks after execution.

1. On `1c5cb7ab`: `node --test docs/qualification/candidates/native-first-run-adapters-20261014/independent/strict-input.test.mjs` — **0/1 passed**, exit 1; digest coercion/native-effect finding above.
2. On `a41c822a`: `node --test docs/qualification/candidates/native-first-run-adapters-20261014/independent/strict-input.test.mjs docs/qualification/candidates/native-first-run-adapters-20261014/independent/compiled-boundaries.test.mjs apps/runtime/native-authority/test/task-authority.test.mjs apps/runtime/native-authority/test/first-run-ports.test.mjs` — **18/18 passed**, exit 0. Four independent assertions cover unchanged coercion refusal, prototype-method replacement/original receiver/shared owner, revocation inside allocation lease and in-flight verifier cancellation. The other fourteen are the new focused adapter/composition controls, independently rerun on the repaired frozen source.

Both owned process groups were absent on completion; no timeout, group kill or descendant reaping was required. Production diff was empty and source HEAD stayed pinned before/after each check. Test/capture/raw hashes and changed source bytes are in manifest.json. Source, dependencies, locks, contracts, qualification schemas and prior evidence were not edited by this reviewer.

## Remaining gates

Genuine opaque task verifier/service bindings, an independently observing native SDK registration owner, approved product database/current-allocation resources, trusted model/proxy/runtime pins and physical isolation/cleanup remain unqualified. There was no real authenticated conversation, SDK/provider task, approved output run, native renderer or editable DOCX delivery. Separate explicit output approval remains required.

The newer frontend backend PR2 plan has three read-only routes and supersedes the older empty receiving allowlist; it does not provide canonical application-authority context, task verification or SDK observation. No frontend acceptance claim is made here. This candidate closes source wiring only and does not accept deployment, live authorization, output authority or whole-plan completion.

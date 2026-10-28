# MM10 qualified preview source successor — 27 October 2026

## 1. Scope and state

READY FOR INDEPENDENT SOURCE REVIEW. This implements the missing production preview composition and explicit public receiver, including the actual no-model renderer bridge. It does not establish ARM image qualification, native Office fidelity, frontend integration or deployed MM10 acceptance. No build, cloud/DB/provider/browser/product operation, target change, package publication or external message was performed. Existing Release remains the target owner.

## 2. Source and ownership

Own branch `codex/wave5-m5-qualified-preview-20261027`, isolated continuation of library `e1fb06c637ccad93b3b0bbbd8195846b97badf76` / tree `aa6b0c6d9a8c847153e764aabba72d4dc2804312`. M5's disjoint retained-origin read change `5619b86c0b69092e89fbe1c1ec2c13bdfbe89e4a` is composed as `a1605de852d0c60f9b90f6f6ad23a7d4791f35ff`; its authority behavior and evidence remain separately owned. The source commit/tree for this handoff are recorded in the external freeze receipt to avoid a self-referential pin.

Root allocated runtime artifact composition/configuration/custody, product documents, preview route/public receiver/generator and focused tests. The subsequent allocation includes four renderer owner modules, existing qualification/Office child-runner forwarding, narrow AgentCore HTTP/entrypoint handling, runtime Dockerfile/native system-package lock, AgentCore image environment binding and only the artifacts subsection of first-chat material. Other checkouts, migration owners, package/npm locks, archives and current c74 Release artifacts are preserved.

## 3. Design and canonical owners

The outline was coordinated before source edits: keep existing artifact service/immutable preview record, PostgreSQL/S3 custody and retention journal; compose request-local custody from the currently authorized source; add separate named public preview receivers; use the existing qualified renderer port and fixed LibreOffice converter. Native bridge ownership was then separately traced and allocated by root.

`preview-custody.mjs` selects the source's tenant/artifact after the ordinary authorized version read and reconciles under the existing journal exclusion. There is no deployment tenant, new ledger or cached authorization. The existing preview owner retains exact physical-write receipts after suppression and keeps uncertain claims non-replayable. The product family forwards the same renderer into generation and preview, with an explicit PDF admission switch that alone grants nothing. Source-PDF previews can be read without enabling new PDF generation.

The four bridge modules have distinct responsibilities: closed private transport messages; official AgentCore SDK invocation/own-session stop; one-use HTTP purpose handling; fixed child sandbox/qualification. HTTP remains separate from artifact authorization/storage. Qualification and conversion now use the exact same child runner, rather than probing one boundary and converting outside it. No generic execution framework, new compute service, IAM permission or authority registry is introduced.

## 4. Native boundary and image binding

The existing standard AgentCore V1 image runs a separate renderer-purpose session selected only by control, with a fresh server-generated session identity per qualification/conversion. The private body admits only qualification or fixed DOCX/XLSX/PPTX-to-PDF conversion, bounded bytes/hash/deadline. It accepts no command, SDK run, bearer, object URL or renderer configuration. Neither route invokes the model SDK. One-use and purpose claims recheck after asynchronous body reads. Transport does not retry; every dispatched session receives its own bounded StopRuntimeSession attempt, including cancellation/unknown delivery. Unknown cleanup remains refused.

The current official InvokeAgentRuntime API and installed JS SDK describe `qualifier` as an endpoint name: https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html . The client uses the configured endpoint (currently `preview`), not an unsupported numeric-version assumption. Every request pins the expected image; the runtime compares it against the image digest injected by the existing IaC owner from its immutable image URI. Response/session/admission/image identities are verified again. Endpoint drift is refused on each invocation. The SDK exposes and the client verifies the runtime session identity; this source does not invent an observed numeric runtime revision. The image digest is deployment-owner provenance, not an image self-attestation.

The existing ARM image installs source-pinned Wolfi LibreOffice 26.8.2.2-r0, bubblewrap 0.13.1-r0, util-linux-misc 2.42.4-r1 and Liberation fonts 2.1.5-r6. Docker ADD checksums and the append-only native lock match independently downloaded official package bytes. Existing lock members are preserved. Apk retains signature/dependency verification; exact installed transitive packages and image scans remain build/release evidence.

The fixed bubblewrap child hides role/workspace/credential parents, unshares network/PID/user/etc namespaces, drops capabilities, exposes a read-only image with only the owned private workspace writable, and applies fixed process/file limits. The canonical probe observes all eight requirements, including actual cgroup limits and no_new_privs. Missing kernel namespace support, unreadable/unbounded cgroups or any failed observation leaves the port unavailable. No boolean configuration can assert qualification. The actual ARM host must still demonstrate these properties and LibreOffice operation; Windows source tests are not that evidence.

## 5. Public and authority compatibility

The separate additive API under the existing document-access export is `receiveDocumentPreviewRequest`, `receiveDocumentPreviewPublication` and `receiveDocumentPreview`, with independently named `documentPreviewMetadata` / version 0.1.0. Existing closed DocumentAccessRoute remains inspect/download/history/list and refuses preview routes. All 45 old schema definitions are structurally unchanged. No existing envelope or RuntimeVersions.contracts changes. Immutable contracts 0.1.23 / UI-stream 0.1.10 excludes this successor; a later coordinated version/artifact/consumer allocation is required. No manifests, npm locks or archives are changed here.

The receiver admits only an inspect-verified generated version. Native files, raw/copied metadata, history/list rows and TXT/ZIP previews are refused. Publication preserves the full canonical immutable record, source identity and published/existing/UNKNOWN distinction. Reading can follow fresh inspect after reload, verifies source/preview identities, record hash, bounded bytes, PDF hash, page count and inline/sandbox/no-store headers. Cancellation releases the reader. Six `x-meri-preview-*` headers carry id, source-version, source-sha256, sha256, pages and record-sha256; the future frontend proxy must preserve them.

Derived availability does not rewrite source draft/pending status or claim native opening, recalculation equivalence or visual fidelity. `nativeQualified` remains false. M5's retained-origin policy allows preview reading after run cancellation under fresh Core/context/retention/source/release checks; create/revise/preview-publish still require a noncancelled stored run. The existing service owns authority before publication and release; the bridge never grants it.

## 6. Author checks

Native Windows Node 24.22.1. Existing exact or independently dependency-equivalent caches are reused read-only through task-owned junctions, with the UI workspace contracts link redirected to this checkout. No install or cache/lock mutation. Commands run from this checkout with Node24 on PATH:

- `node --experimental-test-module-mocks --test --test-concurrency=1 packages/contracts/test/document-preview-public.test.mjs packages/contracts/test/document-access-application-public.test.mjs apps/runtime/artifacts/test/preview-custody.test.mjs apps/control/document-application/test/preview-public-route.test.mjs apps/runtime/test/agentcore-http-client.test.mjs`: 197/197 PASS, exit0.
- `node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/artifacts/test/renderer-startup.test.mjs apps/runtime/artifacts/test/renderer-bridge.test.mjs`: 10/10 PASS, exit0 (startup, purpose race, single-use race, image drift, cancellation, no retry, own-session cleanup).
- Product documents test: 8/8 PASS, including actual composition of request-local custody, available/unavailable renderer and explicit PDF admission; earlier combined bridge/product command 15/15 PASS.
- `node --test --test-name-pattern 'qualified port preserves' apps/artifacts/test/renderer-qualification.test.mjs`: 1/1 PASS. The synthetic child runner is the exact one later used for conversion; workspace cleanup is verified.
- `node --experimental-test-module-mocks --test --test-name-pattern 'artifact renderer material' infra/product-preview/first-chat/render-features.test.mjs`: 1/1 PASS with MERI_REVIEW_SOURCE_ROOT set. Existing agentcore-runtime tests: 4/4 PASS, including exact image environment binding.
- Both document generators and `--check`: PASS. MERI_CONTRACT_TOOLCHAIN_ROOT selects the retained canonical generator toolchain. Strict focused TypeScript public test: PASS, exit0.
- Native package/download/Docker checksum agreement, append-only native lock, 45 unchanged access definitions, old frozen receiver runtime/types/schema/root wire/manifests/npm-lock equality, changed MJS syntax and `git diff --check`: PASS.

Unique checks above total 221 passing tests; earlier overlapping runs are not additional acceptance cases. Logs and exact commands are retained in the parent workspace's `work/wave5-mm10-*.log` and the external freeze receipt.

## 7. Failure witnesses and limits

The new composition test fails against the exact e1fb product-documents source because its closed owner input cannot admit a renderer. Removing the qualification-to-conversion runner forwarding causes the new same-runner test to fail. Each witness exited1 as intended; exact original source hashes were restored in `wave5-mm10-witness-receipt.log`. No witness state remains.

Initial test collections failed for absent local workspace dependencies; task-owned links repaired the isolated environment without installs. An initial synthetic route fixture used an expired fixed date; its actual-time deadline corrected the fixture, with no production workaround. All failures are preserved in the first-run logs. The inherited old core-authority test fixtures still use removed runOptions contracts; their prior exact-base comparison (7 PASS/6 FAIL) is retained by M5 and was not repaired or reclassified here. No broad suite/build/native-host or database qualification was run.

## 8. Remaining release and product work

Independent Hermes source review must use a fresh configured-default session, not the Wave4 deployment reviewer. Then root composes the current integration cohort and coordinates a later public package/FE consumer binding. Release alone builds the exact ARM digest once, verifies native package inventory/scans, and performs no-model sandbox/Office-PDF corpus qualification through the real configured endpoint. Retain actual image/endpoint/session/stop and observed probe receipts. If the host cannot enforce the native boundary, fix the concrete host limitation; do not bypass the gate.

Frontend explicit preview publication/read flow, headers, pending/unavailable/UNKNOWN/current-access behavior and mixed formats then need actual deployed acceptance, including reload, revocation, cancelled-origin reads, source-PDF reuse and no duplicate publication. Product-native Office correctness remains separate from derived preview availability. This handoff is not deployment approval or MM10 closure.

## 9. Preservation and next action

No shared services/ports or cloud resources were created. Local test processes ended; synthetic temporary workspaces were removed by their owners. Task-owned official APK scratch and reusable dependencies remain for review. The prior library/history, package cohorts, current Wave4 Release packet and all other checkouts remain intact. Root owns publication and release coordination. Next: freeze exact source/hash manifest and obtain bounded independent source review; publication-scale work starts only on a separate continuation after this freeze.

# dot → Fable: Meri completion instructions

Date: 15 October 2026. This is dot's coordination decision and forwardable instruction packet. Read alongside the pinned repository instructions. It authorizes the source work below; it does not override environment denials, grant credentials, or claim deployment readiness.

## 1. Repositories and exact starting point

- Meri runtime and this work: https://github.com/neo-capiro/meri-greenfield
- Unified frontend and preview integration: https://github.com/neo-capiro/capiro-frontend
- Extracted production backend and application authority: https://github.com/neo-capiro/capiro-backend
- Legacy production reference only: https://github.com/neo-capiro/capirov2 . Do not merge cleanup into its live frontend or import old Meri implementations.
- Preview: https://portfolio-preview.app.capiro.ai . A reachable preview is not evidence that Meri chat works.

Resume a fresh isolated worktree from `fable/meri-resume-20261015`, exact head `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. Preserve history; do not reset a shared checkout. Fetch and verify the full pin before editing.

Primary context:
- [Original complete dot handoff](https://github.com/neo-capiro/meri-greenfield/blob/215930c8092577e84da563b1496d1cca9a4ad4d7/docs/coordination/reports/DOT-HANDOFF-TO-FABLE-20261015.md)
- [Fable return report](https://github.com/neo-capiro/meri-greenfield/blob/b5be44d5141ae5fd3830aed789cb7ad525506c4e/docs/coordination/reports/FABLE-RESUME-RETURN-20261015.md)
- [Retention revision 2](https://github.com/neo-capiro/meri-greenfield/blob/b5be44d5141ae5fd3830aed789cb7ad525506c4e/docs/coordination/reports/FABLE-RETENTION-DELETION-PROPOSAL-V2-20261015.md)
- [Stand-in approval packet](https://github.com/neo-capiro/meri-greenfield/blob/b5be44d5141ae5fd3830aed789cb7ad525506c4e/docs/coordination/reports/FABLE-STANDIN-APPROVAL-PACKET-20261015.md)
- Read the repository's current AGENTS, implementation standards, ownership rules, source-proof manifest and the original handoff's linked contracts and gate definitions before implementation. Preserve the §11 commit ledger.

## 2. Explicit decisions on the returned work

**ACCEPT SOURCE ONLY:** `e32353f7fb040cf300f9ec4a843d76f2f1a4df2b`, specifically the prospective same-tenant/conversation allocation-claim exclusion in `native-preparation-journal.mjs` and lifecycle-seeded restorer fixtures. Preserve exact replay without redispatch, separate-conversation fork behavior, and `NEXT_RUN_NOT_RESERVED`.

**ACCEPT CANDIDATE RECORD:** the new unsealed `fable-20261015` proof candidate. Independent inspection verified all 45 file hashes, exactly 13 changed/32 unchanged, dot's preceding 12 changed rows carried unchanged, and both preceding manifest byte hashes preserved. Dockerfile was unchanged. This is not image admission or permission to alter proof expectations merely to obtain a pass.

**ACCEPT EVIDENCE PUBLICATION:** all 41 published evidence manifest entries fetched and matched by hash and size at latest head. This does not mean dot reran the tests independently.

**QUALIFICATION STILL OPEN:** test receipts were produced at `4609faa` plus seven dirty paths, not a clean final commit. Reported results are conversations 246/246, worker 138/138, native-authority 348/348, control-core 260/260, and source-proof initially 4/5 then 5/5. Preserve every initial failure and reason. Rerun affected suites at a clean, exact candidate source and record command, environment, source tree, exit, skips and output hashes. Do not rerun unrelated expensive suites without a reason.

Add a real concurrency control with two distinct target runs racing for the same tenant/conversation allocation, using separate PostgreSQL transactions and a start barrier. Exactly one may acquire a new claim; the other must receive the documented busy outcome. The present same-target claim/replay control does not establish that case. Keep the prior-state matrix, actual revocation, physical-stop proof, exact replay and separate-conversation fork controls.

Correct stale return-report sections that still say no product/proof/candidate changes occurred, and narrow Node conclusions to the exact inspected releases and source. Source acceptance does not waive these corrections.

## 3. Retention: proceed on bounded source work

ACCEPT the separation of immediate authorized suppression from later physical purge, exact-version targeting, complete reference inventory and restore reconciliation as the intended architecture. Revision 2 is not accepted verbatim: correct these two defects first.

1. A backup can predate a suppression-only decision before any purge receipt exists. Replaying only purge receipts can resurrect access. Retain an authoritative, ordered history of suppression, authorized release and purge transitions outside the restored database's rollback boundary, with durable acknowledgement and a recovery barrier. After restore, serving remains disabled until reconciliation is complete. Test a restore predating suppression with no purge receipt.
2. Do not require an exact `NoSuchVersion` exception from S3 HEAD. HEAD returns generic errors. Define and test the storage adapter's version-specific absence semantics and permission assumptions. A 403 or ambiguous response is UNKNOWN, never proof of deletion. See https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html . A delete marker is not proof that a particular historical version was erased.

Also reconcile BLOCKED purge states after restore; account for shared fork references before physical deletion. Define what suppression can actually revoke for in-flight tasks and already-issued signed URLs, including expiry/revocation limitations, rather than claiming immediate erasure of all outstanding access.

Implement independently testable policy-configured suppression, reference enumeration, reconciliation, purge planning and recovery controls. Keep production purge disabled until the actual retention policy, storage bindings and required authorization exist. This allows useful code and qualification work without inventing a legal retention period or performing deletion.

Decisions 1–8 from the proposal:
1. Cooling period: no global value approved. Make it an explicit versioned policy field. Missing policy blocks physical purge, not authorized suppression.
2. Per-class retention and policy ID: explicit required configuration; no guessed defaults. Do not reinterpret an earlier isolated “14 days” comment as a universal policy.
3. Suppression: use existing authenticated ownership/authorization semantics. A normal user may only use operations already allowed for their own scope; administrative or cross-user suppression remains owner-mediated. Do not broaden permissions to simplify testing.
4. Evidence bucket/prefix/write-once binding: shipping owner must supply verified references and access semantics. Build against a storage port and contract tests meanwhile; do not fabricate an AWS binding.
5. Object Lock/legal holds: obtain actual product-bucket configuration. Model holds explicitly; unresolved holds block purge. Do not turn on permanent retention controls or bypass holds.
6. Log retention and conversation identifiers: policy-configured, redacted, and classified separately from product artifacts. No invented retention interval or claim that log erasure occurred.
7. Migration IDs: proposed product `0010` and artifacts `0002` are pending central reservation verification. The current pinned directories show no collision but that is not an allocation. dot's Meri source owner is checking the canonical reservation record. Until the exact allocation is returned, prepare schema/design/tests without assigning or executing SQL migration IDs. Do not edit `0009`.
8. Scheduling: use deterministic, idempotent workflow identity per tenant, retention class and purge target/version, with versioned policy and an adjustable bounded sweep schedule. Coalesce duplicate sweeps, preserve retry/recovery semantics and avoid duplicate irreversible effects. Deployment schedule and Temporal binding remain shipping-owned. No new hard-coded product retention period.

## 4. Stand-in TLS rehearsal

HOLD execution of the current step 2. It changes the container's trusted CA store and `/etc/hosts`; previous permission denial and stop instruction remain in force. Broad overnight approval does not substitute for the exact security-sensitive action approval. Do not disable TLS verification, use insecure flags, or repeat a denied operation through another tool or host.

The read-only binary probes support plausibility, not proof that this pinned CLI uses the proposed trust store. That compatibility can be the bounded experiment's result.

Revise the packet so the exact disposable container, effective privileges, pre-existing files and hosts entries, exclusive ownership, bounded commands, cleanup on every failure and post-cleanup readbacks are explicit. Never overwrite a pre-existing CA, remove an unrelated hosts entry, or apply a blanket trust/permission rule. dot will present the exact final change for one-time approval. Only resume the denied step after approval is recorded and the environment's permission system accepts it.

Specific packet fixes: the current copy can overwrite an existing CA, directory creation can reuse existing data, cleanup removes all matching hosts lines, and there is no failure-safe trap/finally. Require absent targets, a recorded baseline and rollback limited to owned changes. Use explicit working directories and tracked process IDs; a background `cd` does not change the parent rehearsal directory. Correct TLS probes: an untrusted-certificate failure alone does not identify the trust store, and an IP-address probe needs a valid IP SAN or preserved SNI. Reconcile the Node preflight with its documented `--use-system-ca` requirement, confined to a reviewed qualification harness rather than changing admitted product or CLI configuration. Disclose that adding the CA temporarily affects every process using that container system trust store.

Leave `/opt/codex` rebinding stopped. A legitimate fresh isolated qualification environment must not replace a shared or installed runtime. Any needed filesystem/security action must have its own permitted scope.

After permitted setup, execute the two-turn and recovery rehearsal through the genuine pinned CLI and control-plane path, including per-run issuance, actual checkpoint completion/capture, restoration, revocation and physical retirement. A fixture-only or direct-store substitute does not prove the canonical path. A composed harness can qualify that path when it exercises the genuine pinned CLI and control-plane owners with explicitly labelled synthetic external ports; it still does not prove live infrastructure bindings. Keep negative TLS and fail-closed controls. Clean up only owned artifacts and retain receipts.

## 5. Shared source ownership is now assigned

dot's Meri source owner is working in an isolated worktree on:
- Contracts provenance metadata regeneration. Prove the generated bundle, schemas and types remain byte-identical; do not edit independent expected outcomes to conceal a behavior change.
- A fresh worker qualification candidate for the stale validator/SDK pin. Preserve old candidates and tie new provenance to exact accepted source and lock. Host wheel imports do not qualify the target image/profile.
- Checking central reservations for product `0010` and artifacts `0002`.

Fable owns the gap-5 follow-up controls, report corrections, retention design corrections and permitted retention source work. Do not duplicate edits to the shared metadata/candidate/allocation files while that owner is active. dot will return exact commits for integration and independently review the result.

## 6. Shipping bindings: required delivery contract

The sole AWS shipping owner is compiling the actual inventory. None of these should be represented as ready merely because interfaces or fixtures exist. Each delivery must include an accountable owner, safe reference, exact environment/source/image identity, tested behavior and status. Secret values must not enter chat, logs or Git.

Required for first usable authenticated chat:
- Backend authority origin plus real authenticated Neo identity, tenant/client context and audience/issuer verification. Never use synthetic identity as product success evidence.
- Dedicated product PostgreSQL runtime pool reference, schema state and trusted-owner migration execution receipt for the exact required product/budget migrations, including approved successors. Do not point new destructive migrations at existing production data by assumption.
- Temporal endpoint, namespace, task queue, TLS reference and reachable worker/service registration.
- Admitted immutable image digest, genuine broker/verifier/registration reader, per-run task-capability issuer and physical cleanup authority. Do not use the PR86 scan-blocked image as admitted.
- Approved model/provider/proxy route, renewed bounded budget and short-lived per-run credential issuance. Fixtures do not create credentials or provider authority.
- Frontend owner binding for opaque authenticated session issuance and proxy routing on the preview host, with desktop authenticated end-to-end evidence.
- For artifact gates: bucket, prefix, KMS reference, output grant, object/version identity and required retention/hold semantics.

Continue contract/source tests against explicit ports while bindings are pending. Leave live tests UNRUN with named dependencies; never turn them green using a substitute stand-in. Shipping performs cloud actions. Fable must not inherit deployment authority from this source-work packet.

## 7. Image remediation and qualification

The existing PR86 image remains unadmitted. Preserve the finding identities and zero-High/Critical admission policy. The shipping owner must provide the private finding table through an authorized private location, plus approved base-digest policy. Do not commit private findings or secrets to the public Meri repository.

Trace each remediated finding to the exact base/package/binary change and rerun the required scan. Merely upgrading a Node release or removing an OS zlib package is not proof that bundled zlib was fixed. Limit statements to inspected source/releases. Maintain reproducible lock-exact artifacts and target-profile controls; a host-profile wheel test is useful but not a target-container pass.

## 8. Execution order and parallel work

Run independent lanes in parallel with non-overlapping files:
1. Fable: clean-pin gap-5 controls and accurate evidence/report corrections.
2. Fable: retention corrections, policy-configured source and recovery controls with purge disabled.
3. dot's source owner: contracts metadata, worker record and central allocation check.
4. Shipping owner: binding inventory, reviewed image/build/scan and runtime setup within its existing authority; request precise action-time approval when required.
5. Frontend/backend owners: authority and preview-session integration. Desktop first; mobile remains deferred.

Do not wait on cloud bindings to finish independent source work. Do not keep reissuing denied commands or run no-op loops when the remaining work is genuinely owner-blocked. Return a precise dependency packet when source work is done.

## 9. Completion criteria

Source completion and project completion must be reported separately. The complete product requires:
- Clean, pushed exact commits and reproducible manifests; tests tied to those commits with all failures and reruns retained.
- Independent review of source, proof changes and shared owner commits.
- Gap-5 two-distinct-target concurrency and full predecessor-state coverage.
- Retention restore-suppression, permission ambiguity, exact-version handling and idempotency controls, with operational policy/bindings explicitly recorded.
- Actual admitted image and runtime bindings, followed by the original handoff's W00–W11, REL and RG gates. Preserve their exact definitions; do not replace them with this summary.
- First usable authenticated chat on the preview, a second turn preserving context, correct new/fork behavior, real completion checkpoints and recovery, budget revocation and physical cleanup.
- Required artifact generation/download/authorization and recovery evidence, plus frontend desktop end-to-end validation.
- No unowned live workers, temporary trust/hosts changes, dangling paid jobs or exposed secrets; exact cleanup receipts.

Return the §11 ledger, full SHAs, changed files, test commands/results, gate-by-gate PASS/FAIL/UNRUN, image digest and deployment receipts where actually executed, outstanding owner decisions and direct Git links. A partial successful source slice is not a finished Meri deployment.

## 10. Current limits of this response

This packet supplies dot's source decisions and concrete next work. It does not invent missing live bindings or legal/product retention settings. Migration reservation, exact trust approval and shipping references are still being obtained. Keep those dependent operations stopped while progressing the independently authorized work above.

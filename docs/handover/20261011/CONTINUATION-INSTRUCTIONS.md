# Continuation: multiple Hermes workers, cleanup coordination and Codex acceptance

This addendum records the human owner's latest handover direction on 11 October 2026: delegate remaining implementation to multiple Hermes workers, continue coordinating with the cleanup session, and make Codex responsible for validating **all Hermes work at the end of every phase or workstream**. It supersedes the earlier Codex-only restriction for future delegated continuation. The completed historical G0/G1 work retains its actual authorship and acceptance status. Publishing this document does not start a Hermes worker or accept G1.

The [adopted deployment plan](../../plans/MERI-DEPLOYMENT.md), [reference index](REFERENCE-INDEX.md), current repository rules and [implementation standards](../../IMPLEMENTATION-STANDARDS.md) remain controlling within this latest human instruction. Full SDK, Fargate app/control isolation, approved new browser host, source restrictions, $10 synthetic Bedrock cap and explicit G7 cutover approval remain in force.

## One integration owner

Codex owns task allocation, canonical contracts/catalogs, root locks, migration allocation, integration, independent verification, gate decisions, fresh runtime admission, cloud actions, release and coordination. Hermes implements bounded assigned work and returns reviewable commits. Hermes reports, green local tests and process exits cannot self-accept a stream or gate. Workers cannot recursively delegate, create schedulers, merge, deploy, change the architecture, access customer/provider credentials or widen authorization on their own.

## Parallel implementation waves

Use multiple concurrent Hermes sessions when dependencies and available resources permit, each in its own dedicated worktree with an exact reviewed base, writable paths and deadline. Do not allow simultaneous writes to a shared contract/schema/catalog/lockfile/migration. Codex serializes proposals to shared files. Revalidate the installed Hermes CLI's documented supported options before launching; do not assume unsupported example flags in the plan.

| Worker lane | First bounded assignment | Acceptance boundary and dependencies |
|---|---|---|
| H1 Proxy/runtime | Compose the accepted body collector and provenance into the next combined proxy source candidate; preserve complete source/context/archive/recipe closure. | Source candidate and targeted controls first. Codex independently reviews and separately admits actual build/auth/revocation/budget/provider execution. |
| H2 SDK recovery | Finish the preserved wire/fixture worker adapter, current-fence binding and immutable checkpoint publication source. | Coordinate contract ownership with H4; return a commit with honest partial flags. Codex reviews before any two-task interrupt/resume actual fixture. |
| H3 Browser | Complete exact-VolumeIds SOURCE5 diagnostics/error handling and qualified host/watchdog preparation. | No host launch or deletion from worker. Distinct review, fresh action admission and armed verified cleanup precede actual nonroot browser AND renderer sandbox tests. |
| H4 Contracts/retrieval | Propose typed contract families for the remaining selected intents, using reviewed 93-intent metadata. | Codex first accepts pending mail/metadata candidates, allocates domain paths and serializes catalog/common schema changes. All 96 selected intents and 14 original skill maps remain required. |
| H5 Frontend | Implement one named remaining Figma feature group in the separate frontend repository. | Use canonical backend contract transport and feature boundaries; coordinate exact interface version, UI controls and source-disabled behavior. No current Capiro implementation imports. |
| H6 Verification preparation | Prepare source-bound cohort manifests, refusal controls and gate evidence matrices for accepted candidates. | Separate from the corresponding implementation author. Codex still reruns meaningful checks and owns acceptance; synthetic data never substitutes for the awaited 75 real requests. |

These are lanes, not permission to launch six expensive/native jobs at once. Start with available independent source-only assignments, retain one writer per shared path, and add actual runs only after exact candidate/resource/cleanup admission. After G1 passes, apply the same bounded multiple-worker model to W03–W11 in dependency order. Keep source reads, workflows, original artifact skills, UI and governed mutations in cohesive modules.

## Mandatory Codex validation at every workstream or phase end

1. Collect every Hermes commit SHA, exact changed paths, implementation outline, raw evidence hashes, commands/exits, intentional behavior changes, known failures and unresolved assumptions. Preserve returned commits and unfinished work; never silently discard an inconvenient candidate.
2. Inspect the actual diff and affected callers against the frozen base. Check modularity, thin entry points, canonical ownership, contract compatibility, authorization/fences, safe imports, deadlines, cancellation, resource cleanup, artifact provenance and absence of dead code.
3. Independently run the relevant tests/checks on the exact returned commit in a clean or explicitly controlled review environment. Validate evidence binding and required negative cases. Keep local/static, actual bounded, integrated and deployment-gate outcomes separate. Use a separate Codex review session where helpful; an implementation author cannot supply its own independent acceptance.
4. Reject or return failures to the relevant Hermes lane with a bounded repair brief. Preserve failed results and reasons for reruns. Do not waive assertions, suppress discovered tests, replace visual baselines, relax sandbox controls, narrow accepted scope or reset UNKNOWN reservations to obtain a pass.
5. Integrate accepted commits in dependency order. Recheck shared interfaces and required combined regressions on the intended integrated candidate. A passing component at an earlier SHA cannot accept a changed integrated tree.
6. Publish a GitHub workstream/phase acceptance record with exact source/image/contract/skill/config/policy pins, checks actually run, remaining limitations and an explicit Codex ACCEPT or HOLD decision. Update the coordination ledger. **Only advance the phase or deployment gate when every required acceptance condition passes.**

Codex validates **every** Hermes delivery, including documentation, infrastructure definitions, adapters, UI, test changes, refactors and cleanup. A workstream acceptance does not automatically close G1–G7; the gate owner evaluates the full gate matrix separately. G7 still requires the human's explicit approval of the exact tested candidate.

## Continue coordination with the cleanup session

The human clarified that **the current cleanup execution is on another remote server, not this PC**. The next greenfield Codex execution must discover and coordinate with that active remote cleanup owner. Do not use a local chat/thread ID as the live cleanup endpoint. No remote cleanup server address, execution/session ID or current owner was verified during this handover. No coordination message was sent by this documentation task. Greenfield backend/frontend remain separate from the cleanup repository, `neo-capiro/capirov2`.

Cleanup plans are available on GitHub at the observed pinned source `d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7`: [CleanUp1](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp1.md), [CleanUp2](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp2.md), [CleanUp3](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp3.md), [CleanUp4](https://github.com/neo-capiro/capirov2/blob/d5a4e0ac82f8a313ae44c6b8f6b199adc71f1ed7/docs/plans/CleanUp4.md). Their presence was verified in GitHub's tree. Historical status shared in the local coordination chat reported all 11 C1 criteria open, with native validation, historical test preservation and evidence reconciliation remaining. It is not a verified current remote status. Retrieve the active remote execution's fresh candidate SHA and acceptance matrix before depending on it.

At resume, use available remote execution/task registries, repository coordination records and current cleanup branch/PR metadata to locate the active cleanup server and owner. A repository contributor or old chat title alone does not prove the active execution identity. Verify the remote session by a current response or signed/current handoff naming its server/session, source SHA, owner and scope. The user's direction authorizes continued coordination with that execution. If no routing is discoverable, request only the missing locator while continuing independent greenfield source work.

Exchange a small written boundary record: both remote execution owners/locators, exact branch/commit SHAs, current gate status, writable paths, interface/schema versions, auth/CORS/endpoint assumptions, source identities, migration allocations, fixture ownership, evidence retention, planned native jobs and merge/release windows. Publish the resulting coordination record in GitHub; leave unanswered coordination explicitly pending.

Repeat coordination **before shared API/auth/CORS/schema/migration/source-access changes; before overlapping native tests or evidence cleanup; before integration/merge/release; and at every affected phase or workstream end**. New frontend configuration must point to the intended backend; separate UI deployments can still mutate shared backend data. Avoid cleanup fixtures and preserve other sessions' processes, containers, volumes, evidence and branches. Do not copy cleanup/current Capiro implementation into greenfield or treat cleanup completion as greenfield gate acceptance.

If the cleanup owner is unavailable, record the proposed overlap and dependency, continue independent work, and hold only the affected shared integration/release action. Do not invent agreement. Current production cleanup deployments and greenfield G7 cutover remain separately controlled; this handover authorizes neither.

## Required worker brief and return

Every task names: owner and worker ID; exact base/contract SHA; dependencies; writable/read-only paths; canonical owners; expected behavior and failure cases; relevant tests; maximum runtime/turns and resources; allowed external actions; evidence directory and secret restrictions; cleanup responsibility; return commit and handoff format. Record PID/session creation time and owned resources, collect the handoff and close only the verified owned process promptly.

Return: changed files and why; focused module/interface structure; checks actually executed with raw evidence/hashes; failed and unrun gates; resource outcomes; unresolved overlaps; exact commit and next dependencies. End the bounded session. **Do not declare the phase complete: Codex independently validates all work and records the decision.**

## No dormant Hermes sessions

Codex must close each Hermes worker when its bounded task finishes, fails, is cancelled or reaches its deadline. Do not leave an idle interactive session, terminal, child process or waiting worker behind to preserve context. Persist context in its committed handoff and evidence manifest, then exit.

- Before launch, record the session ID, PID/process-group identity, creation time, checkout, owned child processes/resources and hard deadline. Use only documented CLI/session APIs. Every launch has cleanup in a `finally`/equivalent supervisor path.
- Collect the returned commit and scrubbed logs/handoff before closure. Ask the worker to exit normally; close the owned session/terminal. Verify that its process and owned children have exited and mark the session CLOSED in the coordination record.
- If graceful closure fails, terminate only the verified owned process group/session after checking PID creation identity. Do not use broad process-name kills, terminate the cleanup execution, touch another worker or remove shared containers/volumes.
- Revoke task-scoped temporary credentials and clean only verified owned ephemeral resources. Preserve source worktrees and raw evidence unless their separately authorized retention policy permits removal.
- Record task outcome and teardown outcome separately. If physical closure cannot be verified, report UNKNOWN, investigate the exact owned resource and hold dependent admission; do not mark it closed based on a log message.
- Before another wave and at every phase/workstream end, reconcile the worker registry with actual owned processes. There must be no unexplained live or dormant Hermes worker from completed tasks. New work uses a fresh bounded session with an explicit brief.

See the [remote pickup runbook](REMOTE-PICKUP.md) and [exact code checkpoint manifest](REMOTE-CODE-MANIFEST.json) before allocating the first remote wave.

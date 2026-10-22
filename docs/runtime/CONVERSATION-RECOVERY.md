# Conversation continuity and recovery

An image-only deploy does not invalidate existing conversations. A change to
`policyRevision`, the SDK/CLI pair, or the session contract/checkpoint format can
invalidate continuation; never replace an incompatible SDK session silently.
Current identity, membership, client scope, expiry and retained-checkpoint checks
still apply. A dormant original that never started follows the C12 re-preparation
owner; an original that acquired authority is never rebound by that path.

Pause/resume/fork retains the source checkpoint and original request. A compatible
target uses the accepting render's versions. Resume requires retirement of its
source; fork preserves the source and receives its own target session. Unsupported
compatibility remains a closed refusal before target acceptance.

Stop acknowledgement proves the durable cancellation fence. Physical retirement
and grant revocation are separate proofs. A terminal history record alone does not
permit a next turn. Missing or ambiguous stop/revoke evidence preserves UNKNOWN
and the next-turn barrier.

Historical cleanup must use immutable original ownership and request custody.
Legacy rows without enough nonsecret historical facts remain held. Escalate to the
release owner with exact source/run, issuance, allocation and original-render
references; retain those records. Do not backfill from current configuration,
accept caller-provided historical configuration, allocate another task, mint a
grant, restore a checkpoint or rerun the SDK to repair Stop. Any operator repair,
schema change or cloud action requires its separate authorization.

New historical custody covers the reviewed first-chat task override: `start` with
an empty environment. Other validated task commands keep their execution behavior
but receive no custody containing arbitrary command or environment values. Their
cross-render cleanup remains unqualified. Legacy later-run rows without custody
also remain held; a same-render legacy first-run fallback may use its original
strict pins. Neither fallback may reopen model credentials or prepare another turn.
For Objective runs, custody contains the exact already-issued request/context
needed to verify the immutable facts digest. It is bounded by the existing
Objective selection limit plus bounded capsule overhead; never log its content.

A FORECLOSED row proves no native allocation authority. A first attempt retains
its initial-admission expiry for the existing Stop receipt. A later foreclosed
attempt has no original allocation expiry: cleanup preserves that proof and
returns 503 rather than inventing the receipt's required expiry. This case needs
an owner-approved receipt/recovery decision; no task or grant effect is attempted.

A committed lifecycle receipt may be inspected without dispatching the command
again. An unobserved SDK message remains UNKNOWN; final text, timeout or task death
does not prove APPLIED. Operator escalation must preserve the unresolved control
barrier. Public receipt recovery and next-turn status depend on the coordinated
contracts/consumer handoff; internal journal methods alone are not a shipped UI.

Provider UNKNOWN liability retains reserved capacity and blocks purge. Inspect
only the canonical accounting outcome using exact original request, task, grant
and pricing custody. Do not infer no dispatch, refund automatically or issue a
second inference after a lost acknowledgement. The proxy/accounting owner supplies
the recovery composition and qualification.

Docker, native nonroot PostgreSQL 16 and AWS/deployed proofs are Fable-run. This
runbook grants no merge, deployment, database or cloud execution permission.

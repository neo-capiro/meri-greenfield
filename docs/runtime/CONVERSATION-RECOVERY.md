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

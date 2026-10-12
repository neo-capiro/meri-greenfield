# Preserve the existing administrator approval exception

Date: 12 October 2026. Status: **policy choice approved by Neo**, relayed explicitly
in the integration owner's author task. Source implementation and runtime
qualification remain separate decisions. This supersedes the unresolved policy
choice in the preserved memory review report, without changing that historical
report or its evidence.

Retain the existing Institutional Memory administrator self-approval exception.
The exact administrator roles are `user_admin` and `capiro_admin`. This exception
does not create a broader administrator role, grant, wall bypass or automatic
promotion. Shared firm/client proposals still become pending; an authorized
administrator may subsequently approve their own proposal and need not be the
assigned reviewer. Canonical current authorization and the transaction-local
administrator decision capability remain required.

| Source case | Preserved policy description |
| --- | --- |
| Firm approval, administrator, own or other proposal | Existing administrator approval path; current authority and guards still required |
| Firm approval, standard actor with grants | Grants alone do not authorize firm approval |
| Client approval, administrator, own or other proposal | Existing administrator exception; no wall/client/tenant bypass |
| Client approval, standard actor | Existing current grant, assignment and different-proposer requirements |
| Shared reviewer rejection by the proposer | Refused by the action-specific service rule, including administrators; withdrawal is separate |
| Withdrawal | Proposer path; administrator approval exception does not allow withdrawing another person's proposal |
| Personal memory | Existing private-owner path, independent of the shared exception; administrators do not gain another owner's private memory |
| Automated personal proposals | Exact source kinds `model_extraction` and `learning_signal` retain their review path and other validation gates |
| Missing, expired or revoked grant | Cannot supply standard client-review authority; grant liveness is established by the canonical service |
| Impersonation or missing context | Canonical service must bind/normalize trusted effective role and current actor/tenant; pure-helper fallback behavior is not proof of valid context |

`packages/contracts/retrieval-0.2/memory-review-policy.mjs` is the canonical Meri
private description and wording source for this policy choice. It provides no
authorization evaluator, persistence, handler, approval receipt or capability.
Its strict selector accepts only `{ scope, action }`; it cannot consume an actor,
role, grant or proposal to decide permission. It has no public 0.1 export and does
not alter the proposal-read family, typed catalog or operation availability.

## Source-owner wording handoff (not implemented in capirov2)

All references are pinned to `neo-capiro/capirov2` commit
`fd8765ec01d292013758606204f2c9d886cd31c1`. Private source bodies are not included.
The rule reasons at `apps/api/src/memory/memory-candidate-rules.ts:56–78,108–125`
and save wrapper at `apps/api/src/meri/meri-tools.service.ts:2898–2954` currently
promise a different reviewer for shared proposals without expressing the existing
administrator exception. Their source owner must align those promises with this
approved choice, preserving the pending-proposal behavior.

Proposed shared wording: “This shared memory proposal is pending approval. An
authorized administrator may approve their own proposal; standard reviewers must
follow the existing separate-reviewer, grant and assignment rules. Tenant,
client-status, ethical-wall and current-authorization checks still apply.” Firm
wording must additionally make clear that a standard actor's grant does not
authorize firm approval. Shared rejection must direct a proposer to withdrawal
and must not describe the approval exception as permission to self-reject.

The authoritative producer locations are `memory-review-admin-policy.ts:3–17`,
`memory-authorization.helpers.ts:89–109`,
`memory-candidate.service.ts:614–630`, and the action-specific shared rejection
guard in `governed-memory-candidate.service.ts:386–397`, all under
`apps/api/src/memory/`. The authorization service's grant filters and current
context, the access-grant service, review assignment foundation, withdrawal
migration and `20260818050000_memory_admin_self_approval_policy` database guard
remain part of the actual enforcement boundary.

No capirov2 or frontend source was edited. This Meri repository has no live
governed save/review wrapper to connect to the wording API within the assigned
scope. A later qualified wrapper must consume this canonical description and
still invoke actual canonical authority. That integration is an explicit open
dependency, not a completed runtime behavior.

## Evidence and limits

All 14 original private references were hash/blob/size verified. Additional grant
and database references were pinned and checked at relevant guard locations.
Bounded pure-helper execution used synthetic facts and retained only outcomes
and hashes; no producer implementation was copied into Git or logs. The helper
matrix shows why input trust cannot be inferred from a positive result: it has
fallback behavior for null impersonation role/client status, while actual
service/database prerequisites remain separate.

The tests characterize source descriptions and selected existing pure-helper
semantics. They do not prove live membership, expiry/revocation propagation,
ethical-wall queries, assignment transactions, database guard installation,
immutable approval, replay handling, audit, source connectivity, G1 or release.
No operation is enabled by this decision.

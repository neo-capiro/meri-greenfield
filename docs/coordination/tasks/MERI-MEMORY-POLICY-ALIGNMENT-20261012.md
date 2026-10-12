# Memory policy description alignment

Author: gateway_author. Reviewer: separate gateway_reviewer. Integration: root.
Base: `7ba0e9d10ebf684e162dcc7c143915afdbf00f32` (PR10).
Branch: `task/meri-memory-policy-alignment-20261012`.

Neo approved retaining the existing Institutional Memory administrator
self-approval exception on 12 October 2026, as relayed explicitly by the parent.
This resolves the policy choice; it grants no runtime/source admission.

## Approved outline before implementation

Add one deeply frozen descriptive `memoryReviewPolicy` and
`memoryReviewPolicyText({ scope, action })` in private
`packages/contracts/retrieval-0.2/memory-review-policy.mjs`. The text function
selects wording from the descriptor using closed scope/action vocabularies. It
accepts no role, actor, proposal or grant facts and returns no allow/deny decision
or capability. Existing producer authorization, review workflow and database
guards remain canonical. No new authorization evaluator is introduced.

The description preserves shared pending proposals, the exact `user_admin` and
`capiro_admin` approval exception, distinct rejection/withdrawal semantics,
personal/automated flows and current actor/tenant/wall/client/grant constraints.
The existing Meri proposal-read family remains separate; no live save/review
wrapper currently exists here. Record exact private source-owner locations for
the contradictory rule/wrapper wording without publishing their bodies.

Owned paths: this task, the new module and
`packages/contracts/test/retrieval-memory-review-policy.test.mjs`,
`docs/decisions/MEMORY-ADMIN-SELF-APPROVAL-20261012.md`,
`docs/coordination/reports/MERI-MEMORY-POLICY-AUTHOR-20261012.md`, and
`docs/qualification/candidates/memory-policy-alignment-20261012/author/**`.
No family/catalog/resolver/validator/public-export/lock/ledger/gateway changes.

Verification: exact 14-reference hashes; bounded isolated execution of existing
pure producer helpers with synthetic facts (no implementation copied to Git and
no live dependency imports); descriptive-contract scope/action/role/requirement
tests; full existing contracts/public generated/type tests. Record limitations
of static source characterization and unexercised database/workflow paths.
Retain all failures and close owned processes. No delegation, publication,
paid/provider/cloud/customer/native/Hermes actions; capture belongs elsewhere.

# Correct stale memory-policy status in PR24

There is **no new administrator self-approval decision** in this successor.
PR24's closeout, priorities and PR description mistakenly carried forward an
older unresolved-policy statement despite a later approved decision already
present in their ancestry. Preserve those frozen source/evidence commits, and
use this correction and the existing canonical decision for current status.

The controlling decision is
[`MEMORY-ADMIN-SELF-APPROVAL-20261012.md`](../../decisions/MEMORY-ADMIN-SELF-APPROVAL-20261012.md).
The reviewed descriptive private contract is
`packages/contracts/retrieval-0.2/memory-review-policy.mjs`, introduced by
`81be4eb` and already present in PR24. It permits authorized `user_admin` and
`capiro_admin` actors to approve their own pending shared firm/client proposals,
without a required reviewer assignment. Current tenant, actor, membership,
client status, ethical walls and canonical transaction/decision guards still
apply. Ordinary client reviewers retain applicable grants, assignment and
different-proposer requirements. Firm approval still requires an authorized
administrator. Private-owner, automated-review, rejection and withdrawal
semantics remain distinct and unchanged.

Live read-only GitHub inspection confirms Capiro
[PR2397](https://github.com/neo-capiro/capirov2/pull/2397) is an open draft at
`4915f3fa5c938182b2624377375674654baa5337`, with reviewed source
`539f62e7f2a3f87d9f56f1281e6fff717aed0958`, based on
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Its two runtime-file changes align
rule reasons and pending response wording with the existing exception; they
do not change permission or approval authority. No deployment is inferred.

Exact remaining distinction: greenfield's existing module is explanatory data,
not a live approval authorizer. There is no live standalone Meri approval wrapper
requiring another person universally. Approval-bearing integration and actual
source/runtime qualification remain unimplemented/unqualified, but they must
carry the existing approved exception rather than reopen it. The historical
producer-versus-prose mismatch does not establish a new policy conflict.

This correction changes documentation only. No runtime, producer, role, grant,
scope, source connection, review mutation or approval behavior changes. The
Clio-versus-portfolio research-evidence scope issue is separate and unaffected.

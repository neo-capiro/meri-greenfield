# Independent memory wording handoff review — 12 October 2026

**ACCEPT_HANDOFF** for `docs/coordination/reports/CAPIRO-MEMORY-WORDING-HANDOFF-20261012.md` at SHA256 `de5ef566d45b74b0468e597ab991414b1730a0ccdc769edbf78e230201e2439f`.

Reviewer: Codex `/root/memory_reviewer`, independent of the handoff author. Review branch: `review/meri-memory-read-binding-20261012`; prior review commits remain preserved. This sign-off accepts the document for the existing capirov2 owner. The proposed changes are not implemented and this grants no source or runtime acceptance.

## Findings and resolution

The initial handoff at SHA256 `d8bd24a27e947a18d2ec501afdd1cd2e317b71c8cb145243a9ec2a04352decd2` named only part of the contradictory comment block. The reviewer identified remaining universal independent-review wording at `memory-candidate-rules.ts:57–58` and the categorical self-ratification prohibition at `:75–77`. The handoff author expanded the instruction to reconcile the whole `:56–79` block while preserving the prohibition on automatic promotion in one request. The revised document resolves that finding. No remaining handoff defect was found.

## Policy and wording review

The reason/message replacements accurately describe Neo's approved existing administrator self-approval exception. Firm approval remains restricted to authorized administrators. Ordinary client reviewers retain current grant, assignment and different-proposer requirements; administrators retain their existing assignment exception. The administrator roles remain `user_admin` and `capiro_admin`, with current tenant/client/wall authorization still required.

All new shared proposals, including administrators' own proposals, still start pending, and both shared rules retain `WARN`. A subsequent authorized approval is distinct from automatic promotion at creation. The wording neither grants authority nor changes the payload shape, IDs, statuses, endpoints or Meri public 0.1 contracts. The personal-memory alternative stays an offer requiring a separate user request.

The administrator approval exception does not authorize shared self-rejection or withdrawal of another person's proposal. Private-owner behavior and review of automated `model_extraction`/`learning_signal` candidates remain intact. The handoff correctly identifies Meri's PR11 descriptive policy as non-authoritative and leaves enforcement with capirov2.

## Evidence and limits

Compared exact Git objects at private policy pin `fd8765ec01d292013758606204f2c9d886cd31c1` and observed capirov2 head `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`: both affected files and three relevant policy/enforcement files are byte-identical (5/5). Seven focused presence checks passed for the corrected block and retained boundaries. The accompanying [receipt](../../qualification/candidates/memory-read-binding-20261012/independent/wording-handoff-review.json) records paths, sizes, hashes and the original finding, without private producer bodies.

No source or shared file was edited by this reviewer. No producer test or runtime check was run because the task was document review only and implementation remains with the existing owner. That owner must recheck its current head, make the reason/message/comment edits, update relevant text assertions, and retain the behavioral controls named in the handoff. No external action or background process was started; none requires teardown.

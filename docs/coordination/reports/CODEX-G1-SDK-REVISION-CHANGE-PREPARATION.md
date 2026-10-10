# SDK revision change source preparation

10 October2026 UTC. Codex author preparation, dedicated `task/g1-sdk-revision-change`,
base `92c5a9d430aa4e8d022b4b6697ff8ecd75662ce3`. Outcome: **SOURCE PREPARATION HOLD**.
Only this report is tracked. No AWS/CLI, provider, lifecycle helper, upload, freeze,
reservation, publication or Start ran. Browser worktree/report/SOURCE2 are untouched.

The recommended next investigation is the official initial-revision publication CAS,
under a separate narrow source allocation and independent review. A generated Comment
candidate is preserved as an alternative; it is not operationally ready or adopted.
The integration owner independently confirmed the documented alternative and selected
that direction for subsequent investigation. This report grants no action authority.

## Retained failure

Owner `1110ec68b234df9e667238e111f4bfb6976ba16a` sealed33086B/SHA256
`fe23a4573bc9506d2f1a993e8195c0c83660ab6e74099530d7358c71bc0de29d`.
All114 payloads were copied and their raw sizes/hashes verified, without importing any
owner helper. A separate DATA-only read corroborates the sole update's60B ACK:
`updateDate=2026-10-10T16:11:05.417000-04:00`, no revisionId. Before and reconciled
machine responses are byte-equal158589B/SHA256
`b1f726e40594d12b44341f20e7ba32aaabf91821a7b8a35e2573e46b6a269040`.
The graph remains145649B/SHA256
`1858d43c75d44b133271ee181da3748df7c22e174500120047f324839f342a39`.
The reservation stays **CONSUMED / UNKNOWN / NO RETRY**. No publication/Start occurred.
A same-definition no-op explains these observations plausibly, but remains inference.

## Supported alternative and remaining service assumption

Primary AWS documentation, checked2026-10-10 around21:04–21:06UTC, documents `INITIAL`
as the `revisionId` input for a machine with no assigned revision. The same parameter
provides a comparison against the current revision, with conflict on a mismatch.
This is a documented sentinel input, not a measured UUID, invented response field,
or permission to omit CAS. [PublishStateMachineVersion API](https://docs.aws.amazon.com/step-functions/latest/apireference/API_PublishStateMachineVersion.html),
[AWS CLI publication reference](https://docs.aws.amazon.com/cli/latest/reference/stepfunctions/publish-state-machine-version.html),
[Boto3 publication reference](https://docs.aws.amazon.com/boto3/latest/reference/services/stepfunctions/client/publish_state_machine_version.html).

Separately allocate a NEW immutable lifecycle subject, not edits to SOURCE2/3. Its
focused publication/binding boundary should distinguish an explicitly owner-reviewed
initial-revision mode from a measured ordinary revision. Require fresh complete exact
machine/stack/template/role/configuration readback proving the retained graph and absent
assigned revision, fresh caller immediately before a new publication reservation, and
an explicit `--revision-id INITIAL` argument. Refuse unknown mode, empty strings,
arbitrary sentinels, observed revision changes and unreviewed response/configuration
drift. Preserve ordinary nonempty-revision behavior. Current `sdk-publish.py` compares
the observed field directly to `reviewedRevisionId` before dispatch and again on version
readback: it cannot simply substitute INITIAL into that field. A sentinel input is not
necessarily an echoed version response value. The exact immutable version response
shape and successful CAS remain **UNRUN**; validate the returned version ARN, complete
graph/role/configuration and actual revision evidence before any later Start decision.

This alternative needs separately reviewed source/closure/freeze/supervisor records
and meaningful fake controls, including initial-mode freshness, wrong/failing caller,
no reservation on rejection, ordinary revisions, one dispatch, conflict and ambiguous
ACK. No new revision update is implied. The already-consumed update is never retried.
The existing requirement for a measured nonempty revision remains unmet unless the
owner explicitly adopts this documented initial-CAS path with its own bounded gates.

## Generated metadata alternative

Discovery found `infra/native-enforcement/lib/workflow.mjs` hardcodes the top-level
Comment in private `buildStateMachine`; neither native nor canary export accepts a
description option. The shared eleven-source closure, public preparation tool and
accepted canary/browser sources were preserved byte-exact. No shared generator was
edited. Canonical `buildNativeEnforcementAdmission` and
`buildNativeEnforcementStateMachine` regenerate the retained inert graph. The original
SDK proposal producer applies exactly two guard substitutions: false→true and the
native SDK/Office disjunction→SDK. Those prior substitutions were reproduced, and the
result was required to equal the deployed145649B graph before constructing metadata.

The ignored, pure proposed `sdk-revision-definition.mjs` owns only that fixed SDK
regeneration and one fixed description. It accepts only the exact staticPins option,
requires the original run/machine/role/binding and old graph hash, has no arbitrary
Comment option or external-effect interface, and refuses missing/foreign inputs.
It is a **new proposed generator seam**, not an existing supported canonical option.
If selected later, centrally allocate a focused
`scripts/qualification/sdk_revision_definition.mjs` and a focused test, with fixed
relative canonical imports and their reviewed raw closure. Do not hand-edit live JSON
or repin the old public inert tool to authorize this new producer.

| Generated product | Bytes | SHA256 |
| --- | ---: | --- |
| Original SDK graph |145649|`1858d43c75d44b133271ee181da3748df7c22e174500120047f324839f342a39`|
| Proposed Comment graph |145724|`0e2b2285b35ec7ed52281055ebeeccdf10d69834ceebf17e1af9e8ada09f19f5`|
| All94 States, unchanged |145501|`b56863283626788ca37ce0522a8579fbaf74dbf39cc7e68067723cf2030213fc`|

The sole semantic path difference is `/Comment`. QueryLanguage, StartAt, all states,
expressions, resources, requests, error routes, D720/C900, one RunTask and no Retry
are byte-equal. StaticBindingId remains
`cb9bb93266c2314d2e69380d40318a73add385ee09eacd336194135149fa45f1`;
final definition hashes stay external to that noncircular binding. The original
3808B template remains SHA256
`9b4d3c91099a154bc81d8561d94bfae6f3f1095dd497fb13629e20ec8f2b0f0d`.

AWS defines Comment as descriptive metadata; its update API describes revision output
and its guide describes revisions as definition/configuration snapshots. These support
the candidate rationale, but do not prove a Comment-only update yields a nonempty
revision for this machine. [ASL structure](https://docs.aws.amazon.com/step-functions/latest/dg/statemachine-structure.html),
[UpdateStateMachine](https://docs.aws.amazon.com/step-functions/latest/apireference/API_UpdateStateMachine.html),
[revision lifecycle](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-cd-aliasing-versioning.html).

## Integration hold for any Comment change

A direct UpdateStateMachine would change the actual definition while the existing
versioned-S3 CloudFormation definition source still identifies the original graph.
That is configuration drift; do not silently normalize it in a comparator. The current
lifecycle binding hardcodes the old graph/hash/size, original template hash, S3 version,
CREATE_COMPLETE status and stack parameter. Publication, immutable-version comparison
and renewed launch authority all rely on those exact records and will correctly refuse
the candidate. A local metadata diff does not advance them.

Prefer a separately reviewed immutable S3 object/version plus generated CFN input path
if the metadata option is ever selected: preserve old object/version, use a new exact
digest key, review actual change set for only the machine's DefinitionS3Location change
with no replacement/IAM/configuration change, and bind UPDATE_COMPLETE/new parameter,
complete template, actual graph and unchanged role/logging/tracing/encryption before
publication. CFN documents no-interruption update for DefinitionS3Location; actual
change-set/readback remains required. [CloudFormation StateMachine](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-stepfunctions-statemachine.html).
No candidate upload/template/version was made here. A direct API route would instead
need explicit owner-reviewed temporary drift and a complete CFN reconciliation plan
before acceptance; none exists. New definition producer, binding, closure, readback
comparator, action freeze and each mutation reservation must be allocated separately.
Only a genuinely observed acceptable revision can satisfy ordinary publication CAS.

## Local checks and limits

One fresh Node24.19.0 child ran10 focused groups, exit0/empty stderr,0.781s whole
supervisor: exact original regeneration, exact inert binding/graph/template, Comment-only
diff,94 unchanged states, one launch/deadlines/no Retry, default/forged-option refusal,
foreign run/machine/role refusal, input preservation and determinism. The child installed
network/process denial hooks before dynamic imports; no denied operation was attempted.
Canonical source, inputs, generator, check entry, supervisor and Node binary were stable
before/after. No unchanged broad suites ran and no failed test was retried.

The stdlib supervisor bounds only the direct child60s; it does not prove descendant
termination. Binary captures are checked against2MiB after completion, not live-limited.
Trusted local fixed-source/read-only setup and pre/post hashes are not a hostile
filesystem or OS sandbox. Three mistaken local source lookups during discovery produced
read diagnostics only; no operation/helper was invoked. No actual JSONata/service
evaluation, deployment, revision creation, CAS publication, task/runtime, cleanup,
security disposition or G1 qualification follows from these local checks.

Evidence is `.task-inputs/CODEX-G1-sdk-revision-change-1/`: OUTLINE,157-payload
PREPARATION,114 preserved owner files,11 raw Git/source comparisons, original inputs and
producer, proposed generator, local binary receipts, generated products/results,
DATA-only history check and final finite manifest. Original failure/evidence is intact.
All49 worker findings plus five older vendor-open findings and G1 stay OPEN;
provider spend remains$0/$10. Current Meri/Capiro is untouched.

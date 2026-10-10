# Browser managed teardown: inert source preparation

This is a browser-specific **Standard Step Functions DATA compiler**, not a
launcher. It imports no CDK/AWS client and starts no process. It never calls
CloudFormation, RunInstances, ECS or a model. Application/control placement remains
Fargate; the already-authorized new isolated browser host is the only host scope.

`binding.mjs` validates exactly runUUID/stackId/t0Ms/templateSha256 and owns the
fixed account, region, host logical ID, network, AMI and bounds. Accessors,
unknown keys, deadline overrides and admission flags are refused. Those DATA
values are externally reviewed owner inputs, not self-authenticating authority.
`workflow.mjs` composes finite JSONata ASL. `template.mjs` assembles proposed
CloudFormation/IAM DATA. There is no CLI/execute switch, shared controller import,
local daemon, generic workflow framework, source resolver or dependency addition.

`compileWatchdog()` with no argument emits **one refusal state only**.
`compileTemplate()` emits an inert Standard definition and role with no resource
policy. A validated per-run binding emits an inspection graph behind a literal
false `AdmissionGuard`: execution input cannot enable it. This is intentionally
not launchable. A future owner source allocation, exact version/name/input
admission and independent review must replace that guard after the open wire and
cleanup gates. There is no exported caller admission toggle.

The inspection graph fixes original t0, containment trigger t0+720s and absolute
C=t0+900s. Each call is clipped to at most15s and remaining C; each wait at most5s.
No ASL Retry, redrive or new deadline is created. The watchdog must be armed and
its exact managed execution verified **before a separately reviewed CREATE can
boot any instance**, including lost CREATE responses. The graph itself launches
nothing. No local process needs to stay alive in the simulated workflow; actual
managed survival has not been measured.

Discovery filters the immutable CFN stack ARN, with explicit opaque pagination,
20 pages/20 instances per complete scan, owner account and exact stack/name/
logical/run tags plus launch window. Positive ownership is separate from AMI/
network/root security qualification. Positively owned instance IDs and first
root IDs persist within the20-record cap; additional observed root IDs/drift
persist without erasing the first. Direct singleton DescribeInstances rebinds
ownership before termination.
The ledger retains at most20 owned IDs; overflow stays UNKNOWN and requires
owner reconciliation from the complete history. This is a single-host scope,
not authority to operate arbitrary fleets. Security-failing owned instances can
still be contained. Missing/conflicting
identity is not broad termination authority. Scan failures retain the known
ledger and continue its containment. One attempted termination is recorded before
dispatch; an ambiguous response cannot cause another explicit termination task
for that ID. An ACK never means terminated.

Fresh exact-ID terminated state is required before reading the retained root
volume. Root mappings may disappear after termination without erasing the
retained ID. **Positive root absence is deliberately unimplemented:** the exact
Step Functions EC2 error serialization for native `InvalidVolume.NotFound` is not
established by the current primary reference. All volume errors, empty successful
responses, access denied and retained ambiguity yield UNKNOWN. `absent` never
becomes true, so the inspection graph cannot manufacture cleanup success. This
is a concrete remaining implementation/wire gate, not completed enforcement.

Proposed IAM has only region-bound EC2 DescribeInstances/DescribeVolumes on `*`
(those list/read actions require an unscoped resource) and TerminateInstances on
this account/region's instance ARN pattern with exact resource tags for run,
immutable stack ARN and logical host. Role trust pins states.amazonaws.com,
SourceAccount and exact state-machine SourceArn. It grants no launch, pass-role,
tag edit, volume deletion or CloudFormation authority. Actual role/trust/API
behavior has not been deployed or qualified.

Offline checks use the already-retained JSONata2.0.6 evaluator only:

```text
MERI_TEST_JSONATA=<absolute retained jsonata.js>
node --test infra/browser-enforcement/browser-enforcement.test.mjs
```

The test refuses an evaluator whose raw SHA256 differs from
`8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`.
It evaluates actual compiled expressions and four composed synthetic traces
starting explicitly after the production refusal guard. These are not AWS tests
or proof of physical survival, IAM, cloud deadlines or guest behavior. The source
assumes the explicitly unqualified `ec2-sdk-pascal-iso-v1` response profile with
valid SDK ISO timestamps. Malformed timestamps/terminal States.Runtime or data
limit failures are not a universal finally path. Service outages or transition
latency can defeat physical cleanup; UNKNOWN must block further admission.

Next smallest step: independently review this source, then owner-controlled
read-only TestState wire qualification of DescribeInstances and exact retained/
known-absent DescribeVolumes results/errors. Pin that actual error representation
before adding a positive absence decoder and its negative fixtures. The owner
must separately adopt the new delegated role/guard/source binding, verify fresh
authority, consume one exact reservation, arm the reviewed managed watchdog,
execute only the reviewed browser CREATE, and independently prove instance
termination/root-volume absence by original C. Native nonroot browser AND renderer
sandbox, tool binding, complete export reconstruction and security residual-risk
disposition remain open. Guest poweroff/finally does not substitute for them.

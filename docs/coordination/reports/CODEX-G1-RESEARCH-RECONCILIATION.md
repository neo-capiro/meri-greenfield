# Research input reconciled with the accepted plan

11 October 2026, 00:34 UTC. The human asked whether the newly pasted research
helps. It does, especially its committed session-and-workspace checkpoint and
Linux-first qualification recommendations. The attachment is research input;
its embedded recommendations do not authorize architecture, scope, component or
placement changes. G0 remains accepted, G1 OPEN and G2–G7 unentered.

Input: the user's attachment `2eb6c04a-ef99-4d0e-abdb-3589447415f6/Pasted text.txt`,
SHA256 `7060e3dd68165c96d65cb6c998106255de9b17c48213671878bb1479d9060234`.
Root read it completely, checked the accepted deployment plan and existing
checkpoint contracts, and rechecked primary SDK/ECS documentation. No plan or
shared contract was changed by this comparison.

The useful recovery proposal is to stop accepting work, interrupt the actual
SDK, establish quiescence, preserve native session and workspace state together,
verify immutable uploaded objects, then publish one trusted recovery manifest.
Anthropic documents [moving native session files between hosts](https://code.claude.com/docs/en/agent-sdk/sessions).
That supports an additional bounded recovery spike. It does not alone prove
subagent/sidecar/compaction completeness, workspace consistency, current
authorization, stale-writer rejection or recovery after a hard kill. Those
properties still need native evidence. Hard loss can require the last committed
checkpoint and reconciliation of later uncertain actions.

W05 explicitly names SDK SessionStore and file checkpoints. A native-file spike
can provide incremental evidence; replacing or deferring the planned SessionStore
work is not approved. The [reference-store preparation](CODEX-G1-SDK-REFERENCE-STORE-PREPARATION.md)
confirms the installed SDK internally awaits mirror flush at result/cleanup.
The missing guarantee is successful complete durability: failed batches can be
dropped while execution continues. A public durable-success receipt was not
found in the inspected Query interface. [Official storage documentation](https://code.claude.com/docs/en/agent-sdk/session-storage)
also requires opaque ordered entries and subkey discovery for subagent restore.
Reuse native APIs and the existing Checkpoint/Workspace/ObjectReference owners;
do not build a second agent loop or reconstruct context from displayed messages.

The discovery advice is correct for the proposed separate fixture. The accepted
loopback fixture deliberately sets CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1;
it never qualified discovery. A new reviewed fixture must enable tool search,
remove that disabling setting and inspect the actual SDK/proxy/provider protocol.
[SDK documentation](https://code.claude.com/docs/en/agent-sdk/tool-search) confirms
custom base URLs disable the default and ENABLE_TOOL_SEARCH=true requires a
proxy supporting reference blocks. Preserve the consumed accepted run. A direct
Bedrock gateway fallback or a dependency-version change remains a concrete
proposal requiring the human's prior approval if it departs from the plan.

Linux-first packaging is already the active path. The SYSTEMROOT acquisition
repair has now succeeded, followed by the [actual offline inventory](CODEX-G1-PROXY-OCI-INVENTORY-OWNER.md).
The Windows Q3 freeze remains a genuine128MiB-bound failure on a162MB Polars
binary; it is not proof of Linux incompatibility. No limit was raised or binary
excluded. Native Linux import, generated-engine compatibility, disposable
PostgreSQL authentication, revocation, accounting and Fargate tests remain.

The dedicated isolated browser host is already expressly approved. The new
[fixture execution preparation](CODEX-G1-BROWSER-FIXTURE-EXECUTION-PREPARATION.md)
identifies a separate implementation gap: no independently armed cleanup owner
for the unattached qualification volume. Existing host enforcement is inert and
cannot DeleteVolume. Complete the managed cleanup design/implementation and
fresh authority before allocating the fixture; a local finally is insufficient.
Actual nonroot browser AND renderer sandbox, egress and physical teardown remain.

Remediating the actual dependency paths is consistent with the plan. A separate
Office image changes deployment packaging/placement and remains a proposal to
review before implementation. It cannot clear Office/security gates merely by
moving dependencies. All49 current plus five older findings remain OPEN;
Office is DEFERRED. [ECS documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
confirms stopTimeout defaults30s/maximum120s; a controlled checkpoint should
begin before task termination, rather than rely on that final window alone.

The75 approved real requests and traces still await the promised location/owner.
Synthetic qualification can continue but cannot substitute for measured retrieval
quality/cohort budgets. Sources remain disabled, current Meri/Capiro untouched,
model spending$0/$10, no cutover. The full planned SDK capability scope is retained.

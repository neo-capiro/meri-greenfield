# Retired first-chat rehearsals

Item 0 replaces the model proxy, captured launch descriptor and custom child
supervisor with the Claude Agent SDK's full harness and direct Bedrock path.
The two composed rehearsals and their exclusive descriptor, provider stand-in,
trust and receipt helpers were removed with that change. They must not be
recreated to satisfy historical commands or receipts. See the current
[standing requirements](../../../docs/handover/20261022/STANDING-REQUIREMENTS.md).

Historical qualification receipts remain evidence of their recorded source and
environment only. They are not acceptance of the current composition.

## Current source gates

Run the relevant existing suites through the
[local baseline runner](../local-baseline/README.md). PostgreSQL tests require
an isolated database; the orchestrator allocates native gates and resources.

| Behavior retained from the old rehearsals | Existing coverage | Limit |
| --- | --- | --- |
| First session, ordered delivery, completion after persistence and terminal usage | `apps/runtime/test/first-session.test.mjs` | Assembled runner/service/store; SDK iterator is scripted. Accounting failure does not erase the completed answer. |
| Exact session replay, conflicting session refusal, current run and grant revocation, idempotent usage | `apps/control/qualified-application/run-owner-pg.test.mjs`; runtime `prepared-runtime-pg.test.mjs` | Real PostgreSQL/HTTP ownership; synthetic Core/task facts. |
| Reconstructed controller cannot launch a completed execution again | Runtime `prepared-kickoff-pg.test.mjs` and `recovered-controller-pg.test.mjs` | Real persisted run/allocation state; synthetic ECS effects. |
| Successor exclusion and retirement, fork coexistence, concurrent admission | Runtime `allocation-exclusion-pg.test.mjs` | Retained non-model allocation guards; not native SDK continuity. |
| Existing continuation readback and immutable restored files | Runtime `native-restorer-pg.test.mjs` | Retained custom-checkpoint path only, pending Step 5 replacement. |
| One query, foreign binding refusal, cancellation and cleanup uncertainty | `apps/runtime/test/remote-conversation-runner.test.mjs` and `broker-cleanup.test.mjs` | Scripted query/ECS; no claim of physical Fargate stop. |
| TLS trust, timeout, abort, late responses and redaction | `apps/runtime/test/pinned-native-transport.test.mjs` | Real loopback transport with synthetic peers. |

The runtime PG tests above live under `apps/runtime/native-authority/test/`. The isolated native
gate on 2026-10-23 passed **98 tests, no skips**, at tested tree
`94156a34de4a04490ccc5538f41266b8cd18294e` (run-owner PG 1, runtime PG 13,
assembled runner/Linux filesystem 84). Checkpoint `b791b57a` differs from that
tested tree only in README prose and one blank EOF line. The six
`broker-cleanup.test.mjs` cases passed separately and are not part of the 98.
This records that bounded result; it is not a new exact-head execution.

The removed files contained eight static test declarations: three manually
invoked composed cases and five glob-collected helper cases. Their launch
descriptor, fake Messages endpoint and child-supervisor assertions no longer
apply. The source gates above preserve the meaningful owner, transport and
cleanup behavior; remaining acceptance is explicit below.

## Acceptance still required

- A real pinned SDK/CLI first turn through the current product, Core and direct
  Bedrock path, including final delivery and native usage accounting.
- Real product follow-up, native SessionStore resume/fork and separate native
  task-file persistence, with reload/reconnect. The SDK spike's resume/fork
  result does not qualify product persistence; Step 5 remains required.
- Actual SDK/CLI/Fargate Stop, expiry, revocation and crash cleanup at the current
  image. Synthetic ECS and scripted query cleanup do not prove physical stop.
- Core tenant/member/client/wall negatives and tool parity, including foreign
  tenant/conversation and revoked access. Both the retired rehearsals and the
  bounded gate used synthetic Core facts.

The orchestrator's current image and preview acceptance own these checks. No
replacement harness, descriptor receipt or custom continuity protocol is added
by this cleanup.

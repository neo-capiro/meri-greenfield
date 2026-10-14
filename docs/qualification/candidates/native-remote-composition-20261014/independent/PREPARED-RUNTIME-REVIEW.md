# Independent prepared-runtime / capture-close flag review

Read-only working-source review2026-10-14, no root production edits or live calls. Scope is source correlation/order; launcher reviewer separately owns placement/final source review.

`compileNativePreparationIntent` pins image/runner/executable/sdk-option hashes and launch template before allocation. `matchPreparedDescriptor` requires exact args/command/all fixed env fields; only SDK-generated CLAUDE_CONFIG_DIR may vary within the configured parent. This addresses the remote HTTP descriptor-policy composition requirement. Prepared runtime joins existing ADMITTED allocation resource/current task proof and task authority, latches descriptor/config hashes in the canonical allocation journal, consumes dispatch before broker start, and records UNKNOWN on start failure. Later prepared/start requests retain exact original identity. No new durable owner or alternate SDK Query is introduced by this module. Root's concrete composition and actual task proof/runner need separate qualification; these are positive source observations, not end-to-end acceptance.

The default-false captureOwnsClose flag preserves existing interrupt+Query close. When true, command apply interrupts and closes input while leaving Query closure to capture. Activity final cleanup still closes Query; source failure is not a held-run success. Actual commands-adapter ordering control passes in `test/task-checkpoint-source.test.mjs`; existing activity/lifecycle51controls pass.

Initial entrypoint finding sent to root: conversation runner reads configuration.captureOwnsClose, but config.validateConfiguration optional runner fields currently allow only bootstrap. A standard JSON runner configuration cannot carry the true flag until root binds it through canonical validation or a concrete trusted internal entrypoint. Remote composition must not silently run the false default, which exits Query before required source snapshot.

Reviewed working-source hashes (may change after root corrections):

- `apps/runtime/native-authority/prepared-runtime.mjs`: `6f1193451c62ebcae30cd7d9d26277965f9dd98dca175556c01e696a2fd39663`
- `apps/runtime/native-authority/preparation-intent.mjs`: `dff7deaeb35b2a8a25be9342ebdafba8152ef7f6a3ed3b5dc8db6b68e5445996`
- `apps/worker/conversation/continuation/commands.mjs`: `0e3c63bc9fd59ead03f94a1aba08018f20fb92b6a98feaa13347ed2b5faaa760`
- `apps/worker/conversation/continuation/activity-lifecycle.mjs`: `a8ae019ac5a2d7119e01869e17f5981a6698df1472f9350ec5305ac8fe2d08a5`
- `apps/runtime/conversation-runner.mjs`: `78ac862431b005885a868d213a78d5729e672bb445c15290d7dea0e300b6f84d`
- `apps/runtime/config.mjs`: `574a7531af705e8c057acdfef14813b89b8ec0f0334d2a6b06d418f1b76b226d`

Correction readback: root now adds closed remoteTask/captureOwnsClose validation and pre-listen owned nonroot workspace guard, dynamic helper selection with query-provided inner call. The initial runner JSON flag finding is resolved at source. Concrete helper plus same-mirror wrapper controls (including actual HTTP receiver/cancellation) passed; deployment/native SDK qualification still pending.

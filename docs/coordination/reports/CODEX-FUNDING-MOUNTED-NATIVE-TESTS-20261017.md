# Funding mounted and native RPC tests — 2026-10-17

The two owned test files pass **44/44**, exit **0**, under Node v24.19.0 with serial tests and a 256 MiB heap. The archived [final console output](funding-completion-20261017/funding-mounted-native-final.txt) and [exact final command metadata](funding-completion-20261017/funding-mounted-native-final.json) are portable evidence.

All five funding operations succeed through the actual MCP mount with current client authority, a synthetic private-observation-consuming source, unchanged raw requests, and exact result-byte settlement. Separate native RPC tests use the actual reads owner and task verifier with overclaimed installation/discovery inventories; personal tasks cannot acquire client eligibility. Their eligibility-only gateway is explicitly separate from source/settlement evidence.

Negative coverage retains missing installation/discovery/source/current context, personal/foreign client and invisible current grants, durable task and native principal/role revocation, expiry and identity/membership drift, closed-wire/request substitution, whole-result client/asOf substitution, transport uncertainty, cancellation, and UNKNOWN holds without retry or completion. Static native credentials cannot bypass per-call observation.

The initial run was **36/44 passed, 8 failed, exit 1**. Test-only corrections addressed one fixture that was not actually personal, five discovery assertions placed at raw CONTROL execution instead of native RPC/MCP availability, and two already-aborted lifetime expectations (canonical DEADLINE, distinct from in-flight CANCELLED). No production implementation was weakened.

**Initial evidence limit:** compaction retained counts, status, tool chunk IDs and diagnosis, but removed all initial raw assertions/stacks. Local session logs did not contain those chunks. The [initial metadata](funding-completion-20261017/funding-mounted-native-initial.json) marks `captureIncomplete: true` and `rawOutputUnavailable: true`; exact initial argv and timing are unknown. No old failure state was rerun or reconstructed.

Frozen owned file SHA256 values:

- `apps/runtime/test/funding-source-integration.test.mjs`: `bb7a606dc01012261a53bf1ea8923b33392c0a128ac53398f65f743ecd460274`
- `apps/runtime/native-authority/test/funding-runtime.test.mjs`: `7425250f7a968906fbc6cf84613c411ae8d0b75dc4766dca4528ea63b9f6cf6a`

Core strict-canonical successor verification and independent acceptance remain parent-owned. These results do not qualify a deployed Core bridge or a live installation. No live calls, Core edits, dependency installs, commits or staging were performed.

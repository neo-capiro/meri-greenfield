# Command preparation and retained compatibility

Production effects belong to Core's native approval receivers and the governed filing source. The former generic executor, durable budget wrapper, approval guard and fixed-route `source-http.mjs` had no production composition or package export. They have been retired; no fixture-only substitute transport is provided.

## Consumer map

- `tool-interface.mjs` is prepare-only. `intents/command-preparer.mjs` is used by native task/mail preparers, governed memory command options and attachment filing services. They retain the exact canonical normalization, immutable proposal, current metadata policy and bounded lifetime. They no longer accept an unused executor or execution-output shape.
- `source-projection.mjs` retains `commandSourceBody` and `commandSourceTool`, used by `runtime/native-authority/execution-capability.mjs` to bind source hashes. Its unused legacy result translator is removed.
- `approval-metadata/`, `postgres-command-journal.mjs`, `protocol.mjs`, all migrations and public command contracts remain. Historical journal CLAIMED/UNKNOWN/OUTCOME records and retention decoders are unchanged; no record is erased, reinterpreted or redispatched. The old executor's unavailable observer was never a served recovery route. Native execution readback continues through the current receiver.
- `apps/control/test/commands-fixture.mjs` now supplies inert data for metadata/proposal-reader/public-contract tests. It has no executor, HTTP source, fake effect counters or budget ledger. The independent journal harness remains unchanged.
- Production task/memory effects: `runtime/native-authority/approval-forwarder.mjs`, mounted by `runtime/product-ports/intents.mjs`. Filing: `runtime/artifacts/core-filing-client.mjs` and `selected-filing.mjs`. Source-side atomic effect/idempotency ownership remains Core's.

## Coverage ledger

| Retired assertion family | Current coverage / disposition |
| --- | --- |
| Raw input normalization, authority injection, immutable proposal and metadata correlation | Retained `control/test/commands-tool-interface.test.mjs` now uses production `commandToolValidators`; active metadata owner suites, intent mount/task-update and SDK intent tests retain preparation behavior. Added explicit metadata substitution, cancellation and parked-input mutation controls. |
| Current approval, tenant/actor/client isolation, changed hash/content, expiry, revocation and result release | `control/intents/test/native-tasks.test.mjs`, `native-mail.test.mjs`, `native-memory-execution.test.mjs`, `runtime/native-authority/test/native-task-forwarder.test.mjs`, `native-task-initial-binding.test.mjs` and `execution-capability.test.mjs`. |
| Duplicate delivery, lost claim/settle/metadata ACK, restart/readback, absent-not-retry and unknown delivery | Active intent mount/approval suites, retained independent command-journal tests, current native task/forwarder suites and governed filing composition. A missing historical outcome is not converted into permission to execute. |
| Malformed/oversized/non-JSON/compressed/wrong-length/invalid-UTF8 source responses | Six new tests on actual native task forwarder retain unknown effect and recover the original outcome by readback with exactly one execute request. Existing seven post-send HTTP failure controls remain. |
| Immutable attachment version/hash/bytes/destination, source scopes, partial/pending result, registration recovery | Current filing-custody and filing-composition suites; retained public artifact compatibility tests. Pending filing stays pending and cannot be relabeled success. |
| One-use legacy broker tokens, legacy route choices, generic sourceEnabled flag and old reserve/settle accounting acknowledgements | Removed with the unreachable stack. These are not current production contracts and have no invented replacement. Current SDK run accounting and source-side receiver authority retain their independent owners. |
| Legacy personal-memory refusal | Removed as obsolete: native General memory produces a pending personal candidate; current native-memory tests cover that valid path. |

Deleted suites: `commands-execution`, `commands-durable-budget`, `commands-independent-durable`, `commands-independent-transport-budget`, `commands-independent-pipeline`, `commands-tool-interface-independent`. Removed their exclusive independent fixture. Retained the preparation portion of `commands-tool-interface`, all independent journal and artifact compatibility tests, and metadata/reader tests. Mixed preparation/execution tests now exercise their real preparation or retained-reader owner; execution expectations live with native receivers. No fake adapter makes old tests appear migrated.

At the unchanged base, those six deleted suites plus the original tool-interface suite registered 136 tests (91 passed, 45 failed through the obsolete stack). The retained tool-interface suite registers 13 tests; six native-transport tests are added. Four mixed-path execution-only tests are retired from intent mount/task-update/SDK suites. This is 121 fewer registered tests across the affected suites, not a claim that every old protocol assertion has a modern equivalent. Historical qualification packets remain evidence of their original source, not current run instructions.

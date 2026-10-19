# Request cancellation and reusable sessions — 2026-10-19

Original source base: `a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040`.
Branch: `codex/meri-session-cancellation-20261019`.
This packet records the isolated cancellation repair before integration with the separately frozen load repair `546782fb28f0e496004f6fca790734409ff96969`.

## Implementation and ownership

The existing action-session owner remains responsible for the session registry, expiry, receipts and fresh authorization. Its request lifetime privately records the exact error it creates for caller cancellation. Ordinary authentication/current-state failure cleanup preserves a session only when that exact cancellation won, the caller signal is aborted, the lifetime reason matches, and the record still passes validity checks. A membership recheck forwards only that exact cancellation error. Every request still rejects; no late authority facts are released.

Unknown errors, authority refusals, owner deadlines, invalid clocks, expiry, revocation and authority changes remain invalidating. A later caller abort cannot turn an earlier refusal/deadline into confirmed cancellation. Reconnection performs fresh identity, context and membership checks. Session revision and original expiry are unchanged. No public error/status, lifetime budget, shared lifetime helper, frontend or load algorithm changes are included.

The private classifier and cleanup helper stay within the canonical owner rather than creating another authority service. Independent Astra ultra review approved the final source after finding and fixing the invalid-clock cleanup edge case. The reviewer inspected source/tests and did not execute tests; implementation and coordinating agents ran the checks below.

## Reproduction and verification

Node `v24.19.0`, npm `11.9.0`. Dependencies were installed from existing root, window-resolution and ui-stream lockfiles with `npm ci --ignore-scripts`; no dependency or lock changes were made. All authority/store inputs are synthetic and local. The stream regression uses the actual conversation service and event source, including a real 100 ms subscription timer. It does not launch a browser or access a live service.

| Evidence | Result |
| --- | --- |
| `baseline-initial-41.tap` | Unchanged owner: 34 passed, 7 failed (six ordinary cancellation cases and request-abort reconnect). |
| `baseline.tap` | Expanded unchanged owner: 34 passed, 8 failed; actual subscription timer reconnect added. Owner diff was empty before execution. |
| `review-clock-failure.tap` | First repair plus invalid-clock regressions: 42 passed, 2 failed. |
| `repaired.tap` | Final cancellation regressions: 44 passed, 0 failed. |
| `existing-focused-final.tap` | Existing independent owner and transition suites: 88 passed. |
| `focused.tap` | All session suites plus conversation stream: 160 passed, 2 failed. |
| `unmodified-graph-failures.tap` | Both broader graph-query failures reproduced on exact unchanged a16 source. Each returns 502 where 200 is expected after successful session issuance. |

Commands:

```sh
node --test --test-reporter=tap apps/control/action-host/session/cancellation.test.mjs
node --test --test-reporter=tap apps/control/action-host/session/owner-independent.test.mjs apps/control/action-host/session/transition-owner.test.mjs
MERI_REVIEW_SOURCE_ROOT=/workspace/meri-session-cancel-repair node --test --test-reporter=tap apps/control/action-host/session/*.test.mjs apps/control/conversations/test/stream.test.mjs
MERI_REVIEW_SOURCE_ROOT=/workspace/meri-session-cancel-baseline node --test --test-reporter=tap --test-name-pattern='actual HTTP' apps/control/action-host/session/http-independent.test.mjs apps/control/action-host/session/session.test.mjs
node --check apps/control/action-host/session/owner.mjs
node --check apps/control/action-host/session/cancellation.test.mjs
git diff --check
```

Syntax and whitespace checks passed. Stored console evidence has trailing whitespace normalized; original output remains in the local temporary evidence directory. Setup failures remain visible: `baseline-setup-failure.tap` records missing window-resolution dependencies before tests ran; `focused-source-root-setup-failure.txt` records the omitted fixture-required source root (138 passes and two test-file import failures). Dependencies and invocation were corrected before the reported runs. No assertions were removed or weakened.

The 44 cases cover six method/port cancellation paths, actual service/event-source request and timer reconnect with the same credential/cursor, unchanged revision/expiry, concurrent readers, late completion refusal, fresh authority changes, expiry/revocation/invalid clocks, spoofed public error names/codes, owner-only deadlines, and winning failure/deadline versus subsequent abort races. The race matrix injects authority-port refusals; it does not claim to reproduce every possible internal mismatch ordering.

## Limits and combined integration

The incident's actual 403 error code and session timestamps were unavailable. This locally reproduces a source defect and a plausible recurring reconnect failure; it does not establish that defect as the live incident's sole cause. Errors outside the exact proven cancellation path remain conservatively invalidating. HTTP refusal status is unchanged. No live browser, AWS operation, build, deployment, paid provider call or main merge was performed.

The load repair refactors authentication into `authenticate(value, includeCurrent)` and reuses a fresh resolution for correlated receipts. Its two owner catches overlap this repair, and its combined-reader cancellation test expects baseline deletion. The combined owner must preserve the new load reader/call counts while applying this classifier to its renamed catch and standalone current-state catch. Keep owner-deadline deletion; change only confirmed caller-cancellation expectations and require fresh same-credential authorization. Review the combined source before any build.

Original production file SHA-256: `709d21e41ff9baf3c86b1de0122be8d493fa6e0f2ac3961a5b7c377107db0776`.
Cancellation test SHA-256: `bf3793e81069ca52dd54ff09c3d53eb5b645a04b0905093c105629a52e234575`.

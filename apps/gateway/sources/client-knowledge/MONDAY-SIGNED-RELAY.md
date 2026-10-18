# Monday retained read relay outline

`read_monday_client_boards@0.2.0` uses a Monday-only signed handler and HTTP adapter. The existing client-knowledge request context remains the canonical input, current authority and output validator; `monday-mapping.mjs` remains the current mapping receipt check. The memory adapter and eligibility callback are unchanged.

The handler requires a trusted post-reservation invocation ID. The adapter emits exact `JSON.stringify({input,metadata})` bytes to `POST /api/clio/tools/read_monday_client_boards`, asks the existing credential broker for a single-use `CapiroMeriRead` token bound to that target and the canonical four-field correlation, and verifies the echoed receipt before Fetch. The gateway still owns reservation, current policy checks, deadlines, output bytes and release. Core owns the same-read managed mapping and canonical Monday result. A missing signed token, mapping receipt, current authority or deadline closes the call.

Focused verification uses synthetic signed wire and refusal cases, the unchanged memory adapter checks, and the general-read family composition once shared dispatch propagates the trusted invocation ID. Production enablement requires a configured Core endpoint, composed credential broker, Core listener, deployed source/image/config pins and live readback by the shipping owner.

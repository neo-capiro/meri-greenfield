# Data-access application contract

`urn:meri:data-access-application:0.1.0` is the browser boundary for the data-access center read owned by
`apps/control/data-access/reader.mjs` and mounted by `apps/runtime/product-ports/data-access.mjs`. It is derived from that
reader's actual answer. It grants no read authority and is not deployment, membership or installation evidence.

- `POST /api/data-access/read` `{clientId: uuid|null}` returns `{schemaVersion:'meri.data-access/1', checkedAt, clientId,
  generalReads, families, relations}` for the admitted member and the named client (or General when null). The client must be
  one the current Core admission holds (`DATA_ACCESS_CLIENT_REFUSED` otherwise).
- `families`: one row per read family the worker can construct (`reads/families.mjs`, the same registry
  `scripts/retrieval-audit.mjs` reconciles), sorted: `{family, covers, freshness, structured, clientScope, state, requires}`. `covers` and `freshness` are the family guidance's `covers` and `returns` texts (null for a family without
  guidance). `state` is `not_installed`, `policy_off`, `client_required` or `available`, composed from the control's installed
  read operations and the member's resolved capability policy (platform ∧ tenant ∧ role, the same resolver every run uses).
  `requires` is `mailbox` for the mail family and null otherwise; whether a mailbox is connected is the member's own
  connections, read by the caller, never a claim of this contract.
- `relations`: the relation names the describe path publishes (`public` defaults and `client_records`), each with the state of
  the SQL families; `client_records` relations are `client_required` without a selected client.
- Errors are `{error:{code, outcome?, field?}}` in the product-access vocabulary plus `DATA_ACCESS_REQUEST_INVALID`,
  `DATA_ACCESS_CLIENT_REFUSED` and `DATA_ACCESS_POLICY_UNAVAILABLE`.

`receiveDataAccessRequest(jsonText)` and `receiveDataAccessResponse(httpStatus, jsonText, request)` are synchronous; results are
recursively frozen. The captured request is mandatory. The receiver refuses with `DataAccessResponseError.code`: `DATA_ACCESS_JSON`,
`DATA_ACCESS_LIMIT`, `DATA_ACCESS_SHAPE`, `DATA_ACCESS_STATUS`, and `DATA_ACCESS_CORRELATION` for an answer that describes another
client, repeats or misorders a family, repeats a relation, or marks something available while general reads are off.

A row's state is a description of what a run for this member would list right now; every gate (installation, policy, client scope,
current authority, the source itself) still runs on each read. The page is read-only and carries no control that changes policy.
Generation uses the canonical esbuild/json-schema-to-typescript backend (`node generate-data-access.mjs`, `--check`).

# Attended action follow-through

The existing POST query, draft, prepare and execute routes are mounted through the runtime task family and current opaque session owner. Query uses Core's typed `actions.query` source and the existing PostgreSQL lookup journal. The lookup transaction reserves its two event slots under the run lock; it creates no conversation turn or model execution.

Draft validates a selected retained recommendation and explicit title/due-date edits. Prepare requires `{requestId,draft}` and reuses the intent preparation journal. An exact retained proposal can be recovered under a fresh session in the same conversation/scopes. An absent preparation whose original draft belongs to an older run returns `COMMAND_PREPARATION_REFUSED / NOT_DISPATCHED` with HTTP409 and requires a fresh query and review. Uncertain preparations never redispatch.

Execute represents explicit reviewed user approval. It reads canonical execution history first, then records the existing native decision and calls Core's native task receiver. Current access and retention cover serving; proposal expiry still blocks a fresh effect. Unknown or withheld results remain uncertain. Public schemas and receivers are generated from these owners.

The bounded Node HTTP bridge is also retained for document fixtures. Current action HTTP and hostile-input tests use native owners; retired grant/issuance demos were removed.

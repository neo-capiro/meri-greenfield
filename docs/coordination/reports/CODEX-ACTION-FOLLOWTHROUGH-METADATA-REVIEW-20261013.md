# Independent task-create approval metadata review

**ACCEPT_SOURCE** for `924979b527b1b8c7f3f7883ceddd2cf78eebd63f`, based on `158fa00828cd46864c20f481a998c9d3e9cc236a`. Exact repaired source passed **76/76** focused controls: **51 independent and 25 author**, without skips, cancellation or timeout. All **10,184** original tracked entries are byte-identical; seven new production/migration/test files match the reviewed source. Author packet verification is a separate closeout step recorded below when available.

Criteria were frozen before source inspection at `1e257dbf`. Independent tests were written against the approved API before initial source `e56c4bca`. Reviewer changed no production files, existing tests, schema, registry, lock or native fixture. The author retains the initial source and narrow repair; original author tests are intact with three appended regressions and one separately preserved fixture-name correction.

## Concrete behavior reviewed

The existing command tool interface calls the new task-create metadata owner. It reuses canonical task argument normalization, public command/proposal integrity, immutable command hashing, inert data admission and the shared operation lifetime. The owner cannot accept another action, caller-provided normalized substitutions, binding changes or model-provided IDs/scopes/approver/expiry. Server-generated command, proposal and idempotency IDs become one immutable payload. Each explicit prepare allocates new identity; it does not promise implicit deduplication or automatic resubmission.

The trusted preparation-policy callback supplies existing scopes, required approver and proposal expiry and binds its receipt to the exact selection/hash and original binding. The initial decision is retained; later prepare-release/read phases must affirm those exact immutable values with a fresh lease. A changed scope, approver, expiry or denied receipt refuses rather than rewriting the proposal. This callback is an unqualified current-policy integration seam, not a newly implemented permission rule. Before-read policy must independently resolve the required facts for the selected proposal/hash; possession of that identity is not authority.

Preparation returns approval-required metadata, not an approval decision or task effect. Re-reading checks the full original command context/binding, selected proposal, command digest and current policy. Missing storage is a read refusal. Revoking access between preparation and execution prevents the actual command interface from reaching its existing executor. The unchanged approval guard/executor continues to own actual approval and mutation authority; no ordinary task permissions, approver choices or recovery semantics were added here.

The concrete PostgreSQL store uses one parameterized autocommit INSERT or SELECT, canonical payload/hash validation and tenant/actor/proposal selection. Its source-only migration supplies immutable identity uniqueness; no migration was applied. There is no transaction framework, retry, update, delete, fallback approval or pool ownership takeover. The pool remains borrowed; acquired clients are released or evicted. Pre-query refusal is distinguished at the store boundary; submitted insert errors, corrupt/late acknowledgments and release errors remain UNKNOWN. The owner conservatively treats an attempted insert without a valid acknowledgment as UNKNOWN; a known stored record followed by failed release authorization is STORED_NOT_RELEASED. Neither state grants safe retry, rollback, approval or task creation.

## Evidence and corrections

| Check | Result | Classification |
| --- | --- | --- |
| Initial independent replay | 33 pass / 13 fail | Reviewer direct-call fixtures omitted required `signal:undefined`; composed interface positive already passed |
| Corrected original suite | 46/46 pass | Same initial production; fixture keys only corrected |
| Expanded immutable initial source | 45 pass / 3 fail | Three real source boundary failures |
| Exact repaired combined replay | 76/76 pass | 51 independent plus 25 author |

The three real failures were rejection of the existing admitted native pool's query timeout 6000, overriding a shorter caller query timeout with 5000, and executing a hostile rejection's `message` getter during sanitization. Root identified the first two against its existing native boundary; the author separately identified the getter issue. Independent controls reproduced all three. The repair admits the existing 6000 configuration, uses `min(configured query timeout,5000)` for each statement, preserves the 5000 connection bound, and reads error codes only through inert own data descriptors. No native admission file changed.

The earlier reviewer fixture and timeout-expectation preimages are retained alongside raw results and exact hashes. The timeout threshold/expected statement-value corrections follow the explicit root-approved compatibility repair, not weaker failure checking. Author's initial 21/22 fixture failure is separately preserved: it referenced nonexistent `TaskCreateToolOutput` instead of `TaskCreateToolResult`. No product defect is claimed for either fixture issue.

Independent composed controls invoke the actual command interface, metadata owner and concrete store through a small inert query boundary. Other controls cover policy expiry published while a callback is parked, cancelled insertion, late connection with zero SQL, late insert acknowledgment, release failure, no retry/pool close, immutable record substitution, tenant/actor query parameters and absence/error distinction. These are source observations, not proof of real PostgreSQL behavior or current deployed policy.

## Remaining boundaries

Real PostgreSQL execution, migration installation, native concurrency/durability and actual current preparation-policy/approval brokers remain **UNRUN/HOLD**. Pool/query timeouts bound supported calls; shared lifetime bounds waiting and suppresses late output without proving physical SQL cancellation. Source remains unavailable in production. The root owns the workflow join, official inert pg constructor compatibility and the final integrated replay; no redundant original694 suite was run here. No database, customer, provider, model, cloud or native execution occurred in this review.

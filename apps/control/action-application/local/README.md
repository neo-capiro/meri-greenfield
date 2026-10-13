# Explicit local Request/Response demonstration

Run from a checkout with the existing minimal contract dependencies available:

```sh
node scripts/local-followthrough/run.mjs --help
node scripts/local-followthrough/run.mjs --run
```

There is no listener, install, migration, SQL connection or network request. `--run` uses the actual Fetch application boundary and real Meri control/gateway/store/executor modules with the repository's explicit inert SQL and synthetic HTTP fixtures. It prints one JSON document with synthetic request/result examples, `nativeDatabase:false`, `productionActivated:false`, final counts and closed-session cleanup. It never prints opaque session, tool or command credentials. Exit0 means the declared local flow passed; exit1 means a content-free refusal; exit2 means invalid CLI arguments. Help/invalid arguments load no local graph.

`createLocalActionDemo({mode:'synthetic-local',ttlMs=10000})` from `demo.mjs` requires `MERI_REVIEW_SOURCE_ROOT` to equal this checkout's absolute root. That guard belongs to the unchanged imported invocation harness; the CLI sets/restores it only after valid `--run` admission. Construction is asynchronous. The return value has `{app,credential,approve,revoke,revokeApproval,denyPreparation,denyClient,stats,close}`. `close()` is synchronous and idempotent. Never expose these fixture controls as production services. The application entry does not import this graph.

Use `demo.app.handle(new Request(...))` and `Authorization: Bearer <demo.credential>`. No client/tenant/actor/capability/approval hints from request bodies establish authority. Routes are the application author's fixed API:

| POST path suffix | Body | Result |
| --- | --- | --- |
| `/api/action-followthrough/query` | `{request:{limit:20}}` | Exact current-authorized retained lookup/read, including `observation`, events and `acceptedTasks:false` |
| `/api/action-followthrough/draft` | `{selection:{resultReference,resultSha256,actionId},edits?:{title,dueDate}}` | Explicit editable task draft with supporting recommendation reference |
| `/api/action-followthrough/prepare` | `{draft}` | `approval_required`, immutable proposal and original draft |
| `/api/action-followthrough/execute` | `{proposal}` | Standard command execution result, only after separate current approval |

`runLocalActionFlow(demo)` calls all four using actual Requests. It first proves execution is refused with an empty approval map and no task effect. Only then does the local driver explicitly call `demo.approve(proposal)`, which validates the exact retained metadata/hash/binding/times/approver under current session state and installs a separate synthetic reviewer decision. There is no approve route. The standard command guard still validates that decision. Repeating execute reads the retained journal outcome and observes one synthetic task effect. Recommendations are never relabeled accepted tasks by query/draft/prepare.

The process-local bearer is random and retained as a digest; each demo owns separate credential, metadata/result/journal Maps and fresh random proposal/result/invocation/event IDs. Synthetic canonical binding values are reused templates, not real tenant identities. No store is shared between instances. The clock advances monotonically from the existing fixture epoch, so current authority and deadlines progress; this is not a live wall-clock/current-policy claim. Current client, preparation, session and approval denial controls test distinct owners. Fresh trusted event slots are local-only allocations; no global deployed event owner is asserted.

The real lookup uses `createLocalActionGateway` and concrete durable budget/invocation owners over the existing scripted SQL harness. The command executor uses its existing inert budget fixture, concrete journal/approval guard and synthetic HTTP source. These observations do not prove PostgreSQL durability, live provider behavior or exactly-once external effects. No production catalog flag or deployment gate changes. The accepted application boundary is a separate source dependency, not authored here.

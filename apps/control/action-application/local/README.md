# Explicit local Request/Response demonstration

Use Node24 (`>=24 <25`, as pinned by the repository manifests) and a complete checkout including the committed fixture files under `docs/qualification/candidates/durable-invocation-20261012/review/` and `task-slice-20261012/action-source-author/`. No private author path or preexisting symlink is required. The actual entry filename is `scripts/local-followthrough/run.mjs`.

The runtime closure is seven packages: ajv8.20.0, ajv-formats3.0.1, canonicalize5.1.0, fast-uri3.1.8, fast-deep-equal3.1.3, json-schema-traverse1.0.0 and require-from-string2.0.2. Root and contracts lockfiles pin identical versions/integrities for all seven. A normally provisioned root `npm ci --ignore-scripts` already supplies these. For a clean checkout without root dependencies, an operator may provision only the existing contracts production dependency lock and copy its seven packages into the root resolution location:

```sh
npm ci --prefix packages/contracts --omit=dev --ignore-scripts
mkdir node_modules
for package in ajv ajv-formats canonicalize fast-uri fast-deep-equal json-schema-traverse require-from-string; do
  cp -R "packages/contracts/node_modules/$package" "node_modules/$package"
done
```

Those are clean-checkout setup instructions, not commands executed in this author task. They require package access or an already populated authorized npm cache. They do not change lockfiles, run install scripts, require the pg driver or install/run a database. Do not overwrite an existing dependency tree; use its normal lock-based setup instead. This author's bounded checks used owned copies of that exact previously installed seven-package closure, then removed only those copies.

Run from the repository root:

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

`runLocalActionFlow(demo)` calls all four using actual Requests. It first proves execution is refused with an empty approval map and no task effect. Frontend integration must stop at the pending proposal until existing trusted approval truth is available; no UI action may call a fixture approval control. Only then does the local driver explicitly call `demo.approve(proposal)`, which validates the exact retained metadata/hash/binding/times/approver under current session state and installs a separate synthetic reviewer decision. There is no approve route. The standard command guard still validates that decision. Repeating execute reads the retained journal outcome and observes one synthetic task effect. Recommendations are never relabeled accepted tasks by query/draft/prepare.

The process-local bearer is random and retained as a digest; each demo owns separate credential, metadata/result/journal Maps and fresh random proposal/result/invocation/event IDs. Synthetic canonical binding values are reused templates, not real tenant identities. No store is shared between instances. The clock advances monotonically from the existing fixture epoch, so current authority and deadlines progress; this is not a live wall-clock/current-policy claim. Current client, preparation, session and approval denial controls test distinct owners. Fresh trusted event slots are local-only allocations; no global deployed event owner is asserted.

The real lookup uses `createLocalActionGateway` and concrete durable budget/invocation owners over the existing scripted SQL harness. The command executor uses its existing inert budget fixture, concrete journal/approval guard and synthetic HTTP source. These observations do not prove PostgreSQL durability, live provider behavior or exactly-once external effects. No production catalog flag or deployment gate changes. The accepted application boundary is a separate source dependency, not authored here.

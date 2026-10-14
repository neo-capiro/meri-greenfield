# Native allocation and verified checkpoint preparation

[Draft PR78](https://github.com/neo-capiro/meri-greenfield/pull/78) is stacked on unchanged PR77 `eed08ddecde9974b689235cbd9084e0c4e15ee2e`. Reviewed production source is `a5b1f4a8ab917342b06777cc4b61891c7aedffaa`, retaining exact PR73 ancestry `104df6f09b000b8376bb4a5ff7b5a76fe1242b68`. Evidence/report commits do not change production source. Engineering remained OpenAI/Codex; the product remains Claude SDK0.3.295/CLI2.1.295.

## Implemented owners and ordering

- Canonical conversation store now owns allocation and restoration metadata through centrally allocated migration0007. Closed intents, scopes/fence/version/expiry, transitions, resource identity and terminal proof are validated in code and SQL. No parallel storage owner or credential storage.
- Allocation commits a consumed original intent before borrowed RunTask. Actual qualified ARN, original preconfigured grant IDs/hashes/expiry/policy and canonical budget lock install admission together. ACTIVE readback precedes broker release. Unknown dispatch never repeats RunTask; bounded original discovery includes stopped inventory. Original grant revocation and physical terminal proof are required for retirement; uncertain/malformed revocation cannot mint RETIRED.
- Preallocation joins the existing Capiro identity/context contracts to the queued canonical run before worker grants exist. Shared inert runtime/launch/access compilation rejects invalid configuration before allocation. One original plan binds allocator and broker; cleanup owns only factory-created native resources, while pool/ECS/object clients remain borrowed.
- Restoration verifies immutable object bytes and the supported SDK SessionStore snapshot array, commits a durable claim before exclusive file writes, and persists only correlated receipt metadata. UNKNOWN is nonretryable; replay and snapshot readback verify actual existing bytes. The adopted SDK verifier loads lazily. Native JSONL bundles are not decoded or represented as supported snapshot arrays.
- Private snapshot receiving/client/relay bootstrap source reads without pre-registering a target. First actual target append waits for genuine independent process registration, then seeds retained main/subkeys through the canonical session owner. Task bootstrap waits for admitted original runtime before SDK/tool work. No worker JSON witness is trusted.

## Checks actually run

| Check | Result and scope |
| --- | --- |
| Complete frozen 27-file aggregate | **278/278 PASS**, exit0/diff0/owned process group absent at `a5b1...`; includes actual owned PostgreSQL, real owned filesystem and independent process/HTTP composition. ECS/authority/object fixtures remain synthetic. |
| Focused admission/journal | **17/17 PASS**, including six actual PostgreSQL controls: concurrent consumed claim, actual commit ACK loss/readback, exact revocation, SQL identity/expiry/terminal proof and corrupt resource refusal. |
| Concrete composition and restoration | One real SQL/process/HTTP allocation→admission→native registration→runtime→revoke/retire control; three real PostgreSQL/filesystem resume/fork/replay/UNKNOWN controls; five shared-plan/receiver composition controls. All PASS. |
| Continuation/bootstrap/restore | 47 focused composition/join/restore/bootstrap controls and 18 affected lazy-import/restore controls PASS. These overlap the aggregate; counts are not added as unique tests. |
| Independent review | 21/21 at `5c199845...`; final `a5b1...` delta accepted with actual inert import observation and two restoration controls. 73-file independent manifest verified. No independent AWS/PG/provider calls. |
| Runtime regression | 141/147 PASS; failed original process fixtures and managed SWC bundle remain visible. Same bundle subsequently **1/1 PASS** with actual filesystem ownership and task-owned cache, retaining native trust checks. Runtime typecheck PASS. |
| Original process fixtures | Isolated rerun remains failed: one PASS, four FAIL, one cancelled/timed out. The original10s guard remains unchanged. Exact PR77 baseline with its own contracts aliases became ready after19.656s here; candidate diagnostic became ready after11.992s. These are environment/setup observations, not startup-performance acceptance. |
| Actual SDK qualification | Two reviewed bounded attempts failed. Corrected source `/status` had actual independent witness, success, zero turns/cost and no sink requests; target CLI never launched because immutable launch request differed. Both source/target groups were physically contained. |
| Descriptor diagnosis | Three effect-free SDK plans, zero actual children/PG/provider calls: identical resume inputs still create different `CLAUDE_CONFIG_DIR` values per Query. No stable namespace option was established. |

All failed migration/setup/fixture, instrumentation, capture timeout and SDK outcomes are retained. The initial aggregate timed out at300s with241 passing cases/no case failures; the complete rerun above used a sufficient bounded600s capture. A prior unbounded process-fixture failure was terminated after its own native child exited; one exited descendant zombie awaiting PID1 reaping is recorded separately in cleanup, never as an active process or proven absent group.

## Remaining implementation, separate from resource configuration

1. Retain **one** supported SDK Query preparation and its private resume directory through genuine native admission/spawn. Planning one Query and executing another cannot satisfy the immutable launcher. Do not weaken argv/config binding or invent a process/witness. Actual resume/fork remains unaccepted.
2. Implement trusted control-to-separate-Fargate task filesystem transfer and task-resident native process transport/discovery. Current restored bytes live in the service-process compiled workspace. Local SQL/filesystem/process evidence does not establish the separate deployed task's filesystem or isolation.
3. Wire canonical checkpoint capture/lifecycle/immutable object providers to the supported snapshot producer and mount the borrowed runtime/native adapters in actual service entrypoints. Existing native-file bundles are not silently interchangeable with SDK snapshot arrays.
4. Resolve the existing process-fixture startup/cleanup gate in the selected environment without hiding failures; no deployment startup performance is qualified.

Configuration/qualification still requires approved task definition/image/network/IAM, product database and migration status, current original allocations/capabilities, object provider, proxy/model/pricing/isolation and Temporal endpoint/namespace/queue/TLS. No AWS mutations, new credentials, security settings, paid provider/model turn or live document generation occurred. The task-owned PostgreSQL/container/cache/dependencies and baseline worktree cleanup are recorded in candidate CLEANUP.json; original resources/worktrees are preserved.

## Concrete parent/backend binding needs

Keep private backend PR6 `1f2655fe964cb2a01343d3bcb560de60fa5f69be` and `/api/clio/application-authority/identity` + `/context` unchanged. Parent should supply the approved serving HTTPS origin, serving image/source/entrypoint binding, existing native bearer/principal/original expiry, actual authorized conversation/client resolution and current policy/fence/scopes. New preallocation uses these same contracts; it does not duplicate the two handlers or four backend service methods. Frontend0.1.3 consumer compatibility remains unchanged; approved host/proxy origin/image and opaque-session/current-conversation binding are still needed.

Use the [single convergence checklist](CODEX-FIRST-RUN-CONVERGENCE-20261014.md). Local source acceptance does not close the authenticated first conversation, editable DOCX, isolation, wider parity or whole-project gates.

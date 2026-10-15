# Disposable Linux / PostgreSQL 16 qualification plan

Status: source-only preparation, 2026-10-14. None of the resource, installation, migration, test or rehearsal commands below were executed while preparing this document. This plan does not authorize their execution, a shared database migration, publication, an image build, a provider call or acceptance of two-turn conversations.

## Exact source and current blockers

Use the exact new public HEAD/tree supplied by the source owner and the current source subtree pins below. [The transition candidate](../dot-transition-authority-20261014/README.md) supersedes the prior source prerequisites and records local results, Windows limitations, the migration amendment and required Linux rerun. Earlier logs remain historical evidence. The former composed source-session stale refusal now has bounded transition authority; this remains source-only until independently qualified. No external issuer or live target-authority dependency is automatically constructed.

## Required environment supplied by its owner

The execution owner must provide an **already isolated, disposable Linux sandbox** with a private mount namespace and fresh private `/tmp`, a private PID namespace/reaping supervisor, and a private network namespace with loopback available and no external interface/default route. The qualification user must be non-root and must already exist. Do not create accounts or credentials. PostgreSQL trust authentication is acceptable only inside this namespace, with no TCP listener and no other tenants/processes sharing it.

Use these exact in-sandbox paths: source `/work/meri`, writable evidence `/evidence/dot-next-turn-source-20261014`, and preloaded offline npm cache `/opt/meri-npm-cache`. Those paths are an execution contract for a future supplied sandbox, not claims that a Linux environment is currently connected. The source copy must be task-owned and writable for ignored dependency links; its tracked files remain unchanged. Evidence must survive sandbox teardown. The task user's home must be disposable and contain no AWS, Anthropic, npm, Git credential helpers or other real credentials. Do not mount host credential directories, Docker sockets, cloud metadata sockets, other source worktrees or private scan files.

Preinstalled tools: Linux Node **24.21.0** and npm, PostgreSQL **16.x** binaries under `/usr/lib/postgresql/16/bin`, Bash, Git, Python 3, `sha256sum`, `timeout`, `ip` and a subreaper-capable environment. SDK `0.3.295` and CLI `2.1.295` must come from the existing package locks and cached Linux artifacts. Record the exact PG minor version, libc, architecture and native CLI hash. If any tool/cache artifact is missing, stop and request an approved environment supply step; do not install Docker, WSL, PostgreSQL, packages from the network or new credentials from this plan.

Preparation authority covers this document only. Future local cluster execution needs the execution owner's explicit isolated-environment authorization. Migration 0009 remains centrally unallocated product source: applying its bytes to a new disposable qualification database is a source experiment only, never allocation or deployment approval.

## Why `--data` is insufficient isolation

`scripts/qualification/local-baseline/provision-postgres.sh` correctly orders conversation migrations 0001 through 0009, then budget 0001 and artifact 0001. It provisions:

| Cluster | Fixed socket in the private namespace | Databases initialized |
| --- | --- | --- |
| broker | `/tmp/meri-broker-pg-socket-20261014` | `postgres`, `meri_prepared_launch` |
| kickoff | `/tmp/meri-prepared-kickoff-pg-20261014/socket` | `meri_inspection_final` |

Its `--data` changes data directories but **does not change those sockets**. It can reuse an existing `PG_VERSION`, an already running cluster, or existing databases. Its `apply()` shortcut checks only `native_allocations`, `meri_product_budget.budget` and `meri_artifacts.versions`; it does not establish that 0008, 0009, completion tables or range triggers exist. Therefore do not run it on an ordinary shared host, even with a random data directory. Private `/tmp` plus absence assertions are mandatory. Never restart, stop, inspect through SQL, truncate or reuse Fable's protected fixtures or any other task's databases.

The script uses `fsync=off`: passing tests establish transaction/lock/trigger behavior during the running process, not power-loss durability or crash-recovery guarantees. The outer cluster stop helper suppresses some `pg_ctl` errors; independently verify stopped PIDs/data roots and absent sockets before closing the sandbox.

## Static preflight and offline dependency closure

Run only inside the supplied sandbox. Start from a clean process environment with no ambient `AWS_*`, `ANTHROPIC_*`, `CLAUDE_*`, `MERI_*` credentials, `DATABASE_URL`, proxy variables, `NODE_OPTIONS`, `NODE_PATH`, extra certificate variables or credential helpers. Preserve only the approved tool path, locale and task-user identity. Do not print ambient environment values to evidence. All commands below assume Bash, `/work/meri`, no spaces in supplied paths, and no production connection string.

```bash
set -euo pipefail
cd /work/meri
test "$(id -u)" -ne 0
test "$(node --version)" = v24.21.0
test "$(git rev-parse HEAD)" = "${QUAL_EXPECTED_HEAD:?source owner must supply published full head}"
test "$(git rev-parse 'HEAD^{tree}')" = "${QUAL_EXPECTED_TREE:?source owner must supply published full tree}"
test "$(git rev-parse HEAD:apps)" = 4620ec508526635dd8da488ee37a752d5bf930b2
test "$(git rev-parse HEAD:packages)" = 3d9f128f3197a4e267812f6b40bb64bd9a47bf58
test "$(git rev-parse HEAD:scripts)" = 561906992b75f484cd74785f94dd0a73f228d262
git diff --exit-code
git diff --cached --exit-code
test -z "$(git ls-files --others --exclude-standard)"
test ! -e /tmp/meri-broker-pg-socket-20261014
test ! -e /tmp/meri-prepared-kickoff-pg-20261014
test ! -e /tmp/meri-local-baseline-pg
test ! -e /evidence/dot-next-turn-source-20261014
mkdir /evidence/dot-next-turn-source-20261014
QUAL_OUT=/evidence/dot-next-turn-source-20261014
PGBIN=/usr/lib/postgresql/16/bin
export PGBIN
test -x "$PGBIN/initdb"
test -x "$PGBIN/pg_ctl"
test -x "$PGBIN/psql"
"$PGBIN/postgres" --version | tee "$QUAL_OUT/postgres-version.txt"
"$PGBIN/postgres" --version | grep -E '^postgres \(PostgreSQL\) 16\.'
uname -a > "$QUAL_OUT/linux.txt"
id > "$QUAL_OUT/user.txt"
readlink /proc/self/ns/mnt /proc/self/ns/net /proc/self/ns/pid > "$QUAL_OUT/namespaces.txt"
ip -brief address > "$QUAL_OUT/interfaces.txt"
ip route > "$QUAL_OUT/routes.txt"
test -z "$(ip route)"
test -z "$(ip -o link show | awk -F': ' '$2 != "lo" {print}')"
git show -s --format='%H%n%T%n%P' HEAD > "$QUAL_OUT/source-pin.txt"
git show -s --format='%H%n%T%n%P' "$QUAL_EXPECTED_HEAD" > "$QUAL_OUT/qualification-source-pin.txt"
git ls-files --eol apps/control/conversations/postgres-store.mjs > "$QUAL_OUT/source-eol.txt"
```

The owner must independently attest private namespaces; recording namespace inode numbers alone does not establish isolation. The network checks above require loopback-only interfaces, while the owner must also confirm loopback is UP before HTTP/CLI tests. A failed preflight stops all resource work.

Read-only committed-byte proof audit, independent of working-tree line endings:

```bash
python3 - <<'PY' | tee "$QUAL_OUT/committed-proof-audit.txt"
import hashlib, json, subprocess
pin = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
manifest = json.loads(subprocess.check_output([
    'git', 'show', pin + ':scripts/qualification/assembled-image/candidate-manifest-dot-20261014.json']))
bad = []
for row in manifest['files']:
    actual = hashlib.sha256(subprocess.check_output(['git', 'show', pin + ':' + row['path']])).hexdigest()
    if actual != row['sha256']:
        bad.append({'path': row['path'], 'declared': row['sha256'], 'committed': actual})
print(json.dumps({'pin': pin, 'rows': len(manifest['files']), 'mismatches': bad}, indent=2))
PY
```

This diagnostic intentionally reports all mismatches without erasing them. At the corrected default pin zero mismatches are required; verify that independently rather than inferring it from the parent's local report. A failed source-proof gate must remain visible and keeps source acceptance on HOLD, even if separately authorized diagnostic local SQL experiments continue.

For a fresh offline checkout, cached Linux package tarballs must already exist. These commands change ignored dependency trees only and must fail on a cache miss:

```bash
for pkg in . packages/contracts packages/window-resolution packages/ui-stream \
  apps/control/conversations apps/runtime apps/worker/conversation \
  apps/worker/qualification apps/artifacts/storage; do
  npm ci --prefix "$pkg" --cache /opt/meri-npm-cache --offline \
    --ignore-scripts --no-audit --no-fund
done
bash scripts/qualification/local-baseline/link-dependencies.sh --repo /work/meri \
  > "$QUAL_OUT/dependency-links.txt"
node --input-type=module -e \
  "import pg from 'pg'; import {query} from '@anthropic-ai/claude-agent-sdk'; console.log(JSON.stringify({pg:typeof pg.Pool,sdkQuery:typeof query}));" \
  > "$QUAL_OUT/dependency-imports.json"
git diff --exit-code
git diff --cached --exit-code
```

The link script needs `jszip` from the worker qualification lock even though this narrow matrix does not run artifact generation. It also links root `pg` from the runtime lock, S3 from artifact storage, the SDK from the worker, and the public contracts package. Do not use `NODE_PATH` as a substitute or change package locks. The SDK lock includes Linux platform-specific optional CLI artifacts; their presence must be verified offline before the optional real-CLI lane. No image build or Docker image-closure test belongs in this matrix.

## Fresh cluster startup, schema assertions and cleanup

Only after explicit execution authorization and successful isolation preflight:

```bash
QUAL_DATA=$(mktemp -d /tmp/meri-dot-next-turn-pg16.XXXXXXXX)
printf '%s\n' "$QUAL_DATA" > "$QUAL_OUT/data-root.txt"
test ! -e "$QUAL_DATA/broker/PG_VERSION"
test ! -e "$QUAL_DATA/kickoff/PG_VERSION"
cleanup_pg() {
  local result=0
  bash /work/meri/scripts/qualification/local-baseline/provision-postgres.sh \
    stop --repo /work/meri --data "$QUAL_DATA" \
    > "$QUAL_OUT/postgres-stop.txt" 2>&1 || result=1
  for cluster in broker kickoff; do
    if "$PGBIN/pg_ctl" -D "$QUAL_DATA/$cluster" status \
      >> "$QUAL_OUT/postgres-stop-status.txt" 2>&1; then result=1; fi
  done
  test ! -S /tmp/meri-broker-pg-socket-20261014/.s.PGSQL.5432 || result=1
  test ! -S /tmp/meri-prepared-kickoff-pg-20261014/socket/.s.PGSQL.5432 || result=1
  return "$result"
}
trap 'cleanup_pg' EXIT
bash scripts/qualification/local-baseline/provision-postgres.sh start \
  --repo /work/meri --data "$QUAL_DATA" > "$QUAL_OUT/postgres-start.txt" 2>&1
export MERI_REVIEW_SOURCE_ROOT=/work/meri
export MERI_INSPECTION_TEST_SOCKET=/tmp/meri-prepared-kickoff-pg-20261014/socket
export MERI_INSPECTION_TEST_DATABASE=meri_inspection_final
export MERI_SEQUENCE_MIGRATION_TEST_ISOLATED=1
export MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY="$QUAL_DATA/kickoff"
export MERI_PREPARED_LAUNCH_DATABASE=meri_prepared_launch
export MERI_BROKER_TEST_SOCKET=/tmp/meri-broker-pg-socket-20261014
export MERI_BROKER_TEST_DATABASE=postgres

for spec in broker:postgres broker:meri_prepared_launch kickoff:meri_inspection_final; do
  case "$spec" in
    broker:*) sock=$MERI_BROKER_TEST_SOCKET; expected="$QUAL_DATA/broker" ;;
    kickoff:*) sock=$MERI_INSPECTION_TEST_SOCKET; expected="$QUAL_DATA/kickoff" ;;
  esac
  db=${spec#*:}
  actual=$("$PGBIN/psql" -X -At -h "$sock" -U postgres -d "$db" -c 'SHOW data_directory')
  test "$(realpath "$actual")" = "$(realpath "$expected")"
  test "$("$PGBIN/psql" -X -At -h "$sock" -U postgres -d "$db" -c 'SHOW listen_addresses')" = ''
  "$PGBIN/psql" -X -v ON_ERROR_STOP=1 -h "$sock" -U postgres -d "$db" <<'SQL' \
    > "$QUAL_OUT/schema-${spec//:/-}.txt"
SELECT current_database(), version(), current_setting('data_directory'), current_setting('fsync');
DO $$ BEGIN
 IF to_regclass('meri_conversations.completion_checkpoints') IS NULL
 OR to_regclass('meri_conversations.next_runs') IS NULL
 OR to_regclass('meri_conversations.native_allocations') IS NULL
 OR to_regclass('meri_product_budget.tool_grant_bindings') IS NULL
 OR to_regclass('meri_artifacts.versions') IS NULL THEN RAISE EXCEPTION 'missing qualification schema'; END IF;
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='meri_conversations'
     AND table_name='runs' AND column_name IN ('sequence_base','sequence_end','hold_completion_id')) <> 3
 THEN RAISE EXCEPTION 'missing 0009 columns'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
    ('preserve_completion_identity','preserve_run_range','reject_closed_range_event','preserve_next_run_identity')) <> 4
 THEN RAISE EXCEPTION 'missing 0009 triggers'; END IF;
END $$;
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname;
SQL
done
```

Do not source the provisioner's printed output as a shell program. Save logs and original data-directory/PID bindings. If startup partially fails, the EXIT cleanup still stops only the two data directories owned by this invocation. Do not use `pkill postgres`, arbitrary socket deletion or a broad recursive delete. If cleanup reports failure, retain the sandbox and escalate to its owner rather than silently ending it. Call `cleanup_pg` explicitly and verify success at the end, then `trap - EXIT`; copy receipts out before the owner tears down the private namespace.

## Execution matrix and exact commands

Run all database files serially. `native-preparation.test.mjs` and the broker fixture truncate their own synthetic schemas in broker `postgres`; file names without `-pg` are not a guarantee of no database access. Do not run the general all-suite runner: its runtime suite includes an image-closure build outside this task, and other suites require unrelated Office/image tooling.

Use a receipt wrapper that retains failures and continues independent diagnostics without pretending they passed:

```bash
run_check() {
  local name=$1 code=0
  shift
  printf '%q ' "$@" > "$QUAL_OUT/$name.command.txt"
  printf '\n' >> "$QUAL_OUT/$name.command.txt"
  "$@" > "$QUAL_OUT/$name.stdout.txt" 2> "$QUAL_OUT/$name.stderr.txt" || code=$?
  printf '%s\n' "$code" > "$QUAL_OUT/$name.exit.txt"
}
run_check source-proof node --test scripts/qualification/assembled-image/source-proof.test.mjs
run_check control-local node --test --test-concurrency=1 \
  apps/control/conversations/test/application.test.mjs \
  apps/control/conversations/test/store.test.mjs \
  apps/control/conversations/test/stream.test.mjs \
  apps/control/conversations/test/lifecycle.test.mjs \
  apps/control/conversations/test/lifecycle-inspection.test.mjs \
  apps/control/conversations/test/lifecycle-workflow.test.mjs \
  apps/control/conversations/test/native-prepared-launch.test.mjs \
  apps/control/conversations/test/completion.test.mjs \
  apps/control/conversations/test/next-run-owner.test.mjs
run_check control-pg node --test --test-concurrency=1 \
  apps/control/conversations/test/store-pg.test.mjs \
  apps/control/conversations/test/read-optional-pg.test.mjs \
  apps/control/conversations/test/prepared-execution-claim-pg.test.mjs \
  apps/control/conversations/test/native-preparation.test.mjs \
  apps/control/conversations/test/native-prepared-launch-pg.test.mjs \
  apps/control/conversations/test/next-run-pg.test.mjs
run_check runtime-next-turn node --test --test-concurrency=1 \
  apps/runtime/native-authority/test/completion-capture.test.mjs \
  apps/runtime/native-authority/test/next-turn-restore.test.mjs \
  apps/runtime/native-authority/test/continuation-runtime.test.mjs \
  apps/runtime/native-authority/test/sdk-continuation-bootstrap.test.mjs \
  apps/runtime/native-authority/test/checkpoint-capture.test.mjs \
  apps/runtime/native-authority/test/task-checkpoint-source.test.mjs \
  apps/runtime/test/prepared-run-issuance.test.mjs \
  apps/runtime/test/prepared-run-registry.test.mjs \
  apps/runtime/test/next-turn-wiring.test.mjs
run_check worker node --test --test-concurrency=1 \
  apps/worker/conversation/test/activity.test.mjs \
  apps/worker/conversation/test/completion-activity.test.mjs \
  apps/worker/conversation/test/control-application.test.mjs \
  apps/worker/conversation/test/lifecycle-activity.test.mjs \
  apps/worker/conversation/skills/test/mcp.test.mjs \
  apps/worker/conversation/skills/test/selected-runtime.test.mjs \
  apps/worker/conversation/continuation/test/continuation.test.mjs
run_check context node --test --test-concurrency=1 \
  apps/control/action-host/application-adapters/adapters.test.mjs \
  apps/control/action-host/application-adapters/context-independent.test.mjs \
  apps/runtime/native-authority/test/identity-context.test.mjs
run_check candidate-linux node --test --test-concurrency=1 --experimental-test-module-mocks \
  apps/runtime/test/prepared-candidate.test.mjs \
  apps/runtime/test/prepared-candidate-bootstrap.test.mjs \
  apps/runtime/test/prepared-candidate-control-lifetime.test.mjs \
  apps/runtime/selected/test/selected.test.mjs
run_check conversations-types node apps/control/conversations/node_modules/typescript/bin/tsc \
  --noEmit -p apps/control/conversations/tsconfig.json
run_check runtime-types node apps/runtime/node_modules/typescript/bin/tsc \
  --noEmit -p apps/runtime/tsconfig.json
```

| Lane | What it can establish | What it cannot establish |
| --- | --- | --- |
| Static proof | Exact declared proof paths against clean committed/working bytes | Full image contents, image scan/admission, deployment |
| Local control | Journal protocol, deterministic claim/replay, proof validation, cancellation and known resume refusal | PostgreSQL triggers or task/credential durability |
| Control PG | Real transactions, conversation locks, unique/FK/trigger checks, original budget owner admit/revoke | Snapshot object readback, physical native retirement, issuer binding |
| Runtime next-turn / worker | Actual temporary workspace bytes and SDK snapshot format; option/lineage wiring and injected owner behavior | A two-query CLI conversation over real PG and actual issuance |
| Candidate/context Linux | Previously Windows-blocked POSIX/module behavior and trusted selection guards | Real backend identity, live Meri authorization or source access |
| Typechecks | Their existing tsconfig scopes | Full JS module type coverage; runtime tsconfig checks `test/types.ts` only |

The corrected default source still requires fresh Linux proof and PG execution; the parent's 25 local checks are not substitutes. Record exact failing names/codes without rerunning altered assertions or presenting an all-green summary. Every further accepted source fix needs a new full head/tree and affected checks rerun; preserve the historical audit and previous failures.

## Audit of existing transaction and lost-ACK mechanisms

The canonical conversation store uses BEGIN, bounded statement/lock timeouts, one conversation advisory transaction lock, row locks, COMMIT and explicit connection release. A throw after `committing=true` maps to `STORE_COMMIT_UNKNOWN`; it does not roll back a possibly committed transaction. The PG lost-ACK wrappers await `client.query('COMMIT')` first, then throw, discard the client through release(error), and reconcile through another owner/pool connection. The next-run test injects that loss into the **first reservation**, verifies one saved mapping, replays the exact immutable facts and confirms no second dispatcher start. This is actual application acknowledgment loss after a successful PG commit, not a network fault, backend crash or fsync guarantee.

The new PG fixture uses genuine canonical completion rows and `createNativeAllocationAdmission.admit/revoke`; its revocation port rereads the saved grant state and requires the exact original grant ID to be REVOKED. The deliberately forged receipt in the changed-facts negative test is refusal input, not positive revocation evidence. Synthetic ECS ARNs, stop proof, object references and read receipt UUIDs remain fixture inputs. The local runtime tests verify object bytes separately, but no single existing PG test composes those real byte operations with the entire two-prompt path.

Additional actual-PG controls are required before persistence acceptance: completion `begin` and `publish` lost-ACK wrappers, unique identity collision and immutable proof mutation/deletion checks; a deliberately invalid second completion event proving transaction rollback leaves neither event nor completed state; concurrent completion versus authenticated cancellation/failed transition; before-COMMIT failures proving rollback; UNKNOWN capture replay proving no second physical capture; two independent connections serializing selection versus acceptance, including three accepted turns; stale lifecycle resume competing with a next-run reservation/fork; and original allocation ADMITTED/STARTED plus unrevoked/rejected grants refusing new issuance. Where interfaces only have scripted controls today, report them as such.

## Migration 0009 backfill matrix still to implement

The provisioner applies 0009 to empty new schemas; that does **not** exercise backfill. A separate reviewed test module must create a fresh task-owned database per case in the same isolated cluster, apply conversation migrations 0001–0008, seed synthetic retained rows/events with canonical hashes, apply the unmodified 0009 file with `psql -X -v ON_ERROR_STOP=1 -f`, and verify success or full transaction rollback through a second connection. Never use an existing fixture database for those destructive cases. No such module is added by this plan, and the cases below are not already passed.

| Required case | Assertions / present source concern |
| --- | --- |
| Empty / one run / two tenants | Migration succeeds, first base zero, latest end NULL, no cross-tenant/conversation sums |
| Historical pause→resume→next | Retained counts e.g. 5,6,1 yield bases 0,5,11 and ends 5,11,NULL; per-run event IDs/sequences/request/context/proof hashes unchanged |
| Duplicate writer fences | Unique index aborts all of 0009; no partial columns/tables/triggers persist; do not guess order |
| Negative / zero / missing / malformed fence | Runtime binding validation rejects these. SQL currently casts and sorts fence JSON and does not explicitly enforce positive fences; test and retain any unwanted SQL acceptance as a migration HOLD |
| Negative last sequence / missing events / count mismatch | Existing SQL check rejects negatives, but backfill trusts `last_sequence` rather than proving actual contiguous event rows. Test 0/no rows, gaps, extra rows and declared count mismatch; retain any unsafe acceptance |
| JS integer boundary | Test totals at `2^53-1` and `2^53` separately. SQL bigint can accept values unsafe for JS while runtime refuses them. Do not assume migration rejects the unsafe value |
| PostgreSQL bigint overflow | Seed individually representable counts whose sum exceeds `2^63-1`; expect full rollback, not rounded or partial ranges |
| Late control / cancellation | Closed historical last_sequence/projection/base/end mutation and new event insertion refuse; latest open range still appends normally; exact existing receipt replay never renumbers ranges |
| Concurrent direct event / closure | Use two real connections and explicit barriers; the event trigger's EXISTS query does not lock the run row. Test insertion starting before closure and committing after it, plus supported API paths. Direct-SQL safety is not established by the current sequential test |
| Resume/fork and competing successor | Same-conversation resume closes exactly once, fork starts at zero in its new conversation, duplicate successor fences refuse; cancellation before insertion prevents a successor |
| Unknown proof / migration retry | Published completion identity and proof stay immutable; a failed migration reruns only on a new case database; a successful migration is not silently reapplied |

Review positive fence constraints, retained-event integrity policy and JS-safe range limits before migration allocation. This document records gaps; it does not modify SQL, weaken guards or allocate 0009.

## Optional real CLI lane and two-turn acceptance boundary

`scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs` is an existing **first-chat `/status`** rehearsal. It uses real PG, the pinned CLI and controller/task/supervisor composition, local HTTP listeners, synthetic identity/authority/ECS/proxy facts and zero intended model turns. It is not a two-prompt completion→retirement→fresh issuance→restore rehearsal. Its `/v1/runner/load` fixture returns only `{run,request}` and does not compose the new next-turn or completion-capture ports. Its existing success assertions expect the old four status events. A pass cannot establish two-turn acceptance; any newly exposed incompatibility remains a failed first-chat control until reviewed.

Only an execution owner who separately approves this zero-provider process lane may run it after verifying the cached actual Linux CLI version/hash and network isolation. A provider credential is never supplied and the synthetic proxy hostname is never replaced with a reachable provider. Do not switch `/status` to a model prompt, renew the expired synthetic budget, or enable source access to make it pass.

```bash
export MERI_REHEARSAL_RECEIPT="$QUAL_OUT/composed-first-chat.json"
run_check composed-first-chat timeout --signal=TERM --kill-after=10s 180s \
  node --test --test-concurrency=1 scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs
```

A timeout must trigger owned child/process-group cleanup and stop verification; do not assume Node termination reaped the CLI. Run through the supplied subreaper-capable sandbox supervisor. Do not launch this lane if that capability is absent.

Before claiming new-prompt acceptance, add a separately owned composed PG/Linux test that captures a genuine first-turn SDK snapshot and real workspace bytes, reads back immutable objects, atomically completes, proves source task retirement and original grant revocation, obtains fresh target-bound issuance through the approved injected owner, accepts a different prompt, loads persisted `nextTurn`, restores the old snapshot/workspace exactly once, and verifies the new prompt reaches the target query. Add lost-ACK, cancellation, competing prompt, expired original deadline, current authority before/after restore and UNKNOWN-no-redispatch variants. Use an injected offline query for the two-prompt control unless a separate model-call budget is explicitly granted. Keep lifecycle resume's known source-session transition HOLD separate; the bounded transition API and public cursor proposals remain unfrozen and unimplemented.

## Evidence and final stop conditions

Retain full source head/tree, the committed-byte mismatch report, source/manifests/migrations and lock hashes, versions/platform/libc/UID, isolation attestation, exact argv, exit statuses, separate stdout/stderr, PG schema/trigger definitions, test counts, all failures, task-local data/PID ownership and cleanup verification. Never write credentials, raw private scan content or private source payloads into receipts. Evidence stays local until the parent completes publication review.

At completion, verify tracked source is unchanged, call and verify `cleanup_pg`, disable its trap only after successful stop, hash the evidence files, and let the environment owner dispose of the already verified private sandbox. Do not publish/push from this task. Acceptance remains HOLD if any known source proof/fixture defect, PG/migration gap, composed resume authority issue, real issuer binding, cursor contract, image/security gate or live milestone is unresolved. Report source/local/PG/CLI evidence levels separately; never sum overlapping test groups as independent coverage.

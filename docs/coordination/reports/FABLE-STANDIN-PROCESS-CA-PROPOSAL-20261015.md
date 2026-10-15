# Qualification-only process-scoped extra-CA proposal (prepared, not executed; revised after dot's review of f0befe1)

Author: Fable, 15 October 2026. Status: PROPOSAL, BOTH EXECUTION ROUTES ON HOLD. Nothing below was executed; the denied operation (C1b rerun with a per-process extra CA) was not retried; no CA was installed, no hosts entry written, no TLS verification disabled, no fixture invoked, no cluster started. This revision answers the five trust findings of dot's review of `f0befe1` with source that is now in the tree (`scripts/qualification/first-chat-rehearsal/qualification-trust.mjs`, its test, the trust route of `composed-next-turn-rehearsal.mjs` and the `ownedCluster` guards of `broker-pg-fixture.mjs`) and with a corrected, fail-closed script text. Root must review the exact executable script, the environment/descriptor/template assertions, the non-destructive preflight, the isolated fixture and the cleanup controls before any later, specific action-time approval question is put; this document does not ask one yet.

## 1. What the route is and why it is still a trust change

The pinned CLI 2.1.295 honors `NODE_EXTRA_CA_CERTS` (probe C1b reached TLS, `GET /api/hello` and `POST /v1/messages?beta=true`). A qualification harness can therefore trust the stand-in's private CA **for the stand-in's own process tree only** by adding that one variable to the process that launches the CLI, while the container's system store and `/etc/hosts` stay untouched. That is a trust change for that process and its descendants and needs the exact action-time approval; it does not establish product parity, because the product launch environment is exactly five variables and the configured proxy host is a DNS name. The proposal therefore binds the extra variable at the **harness's SDK option layer** and keeps the product descriptor bytes, template, hash and matching gates unchanged: the qualification run records a separate `qualificationEnv` that is hashed and compared independently, never merged into the product template.

## 2. Exact source shape (in the tree; reviewed before any approval)

- `scripts/qualification/first-chat-rehearsal/qualification-trust.mjs` holds the one qualification contract. `parseQualificationTrust(process.env)` is all-or-nothing: `MERI_QUALIFICATION_CA`, `MERI_QUALIFICATION_CERT`, `MERI_QUALIFICATION_KEY`, `MERI_REHEARSAL_RUN_ID`, `MERI_REHEARSAL_PG_SOCKET`, `MERI_REHEARSAL_PG_DATABASE`, `MERI_REHEARSAL_SOURCE_IDENTITY`; a partial contract or a stray `NODE_EXTRA_CA_CERTS` without it refuses before anything runs. The harness's own `NODE_EXTRA_CA_CERTS` must name the same CA file (Node fetch trust for the preflight), the key must be owner-only (0600), the CA and leaf owner-owned and not writable by others, and the CA signing key, serial, request and extension files must be absent from the material directory (`QUALIFICATION_SIGNER_MATERIAL_PRESENT` otherwise).
- One launch change, applied identically to the three places that must agree: `withQualificationEnvironment(env, trust)` adds `NODE_EXTRA_CA_CERTS=<caFile>` to the fixture's launch plan (`broker-pg-fixture.mjs` option `launchEnvironment`), to the SDK option probe that produces the captured descriptor, and to the runner query the product runner issues (`worker.query` wrapper in `composeRun`). The launch plan hashed by the supervisor (`launch-configuration.mjs` hashes the full environment) and the descriptor the SDK produces therefore carry the same environment; no separate receipt hash stands in for the template. `ANTHROPIC_BASE_URL` is not a new key: the stand-in origin arrives through the existing `proxyUrl` (fixture option `proxyUrl`), exactly as the product sets it. The receipt records `envKeys`, `productEnvKeys` (the same keys minus the qualification variable), `envSha256` and `qualificationTrust.caSha256`; the harness asserts that the template carries exactly the qualification CA on the trust route and no extra CA on the product route.
- `preflightStandIn` runs before any fixture, cluster or launch and classifies the failure: `REHEARSAL_PROVIDER_STANDIN_TLS_UNTRUSTED` (verification failed), `REHEARSAL_PROVIDER_STANDIN_UNREACHABLE` (no listener), `REHEARSAL_PROVIDER_STANDIN_REQUIRED` (wrong reply or not https). On the trust route the stand-in (`provider-standin.mjs`, unchanged) is started inside the harness process on `127.0.0.1` with an ephemeral port and the run-owned IP-SAN leaf, closed in the harness's own `finally`, and its absence is read back (`providerStandIn.closedVerified`) before the receipt is written; a port that still answers fails the run.
- `broker-pg-fixture.mjs`: `ownedCluster:{socket,database}` replaces the shared task-owned clusters, is accepted only for a `meri_rehearsal_*` database, and is held with `pg_try_advisory_lock` for the fixture's lifetime (`REHEARSAL_NOT_EXCLUSIVE` otherwise); the shared default path is unchanged for the existing tests. `ownedClusterIdentity` refuses the two shared sockets, requires the marker file `meri-rehearsal-owned` in the socket directory to name the run id, and requires the database `meri_rehearsal_<run id without dashes>`.
- Identity pinning: `environmentIdentity` records hostname, PID, parent PID, uid/gid, boot id, PID 1, the Node binary path and hash, the harness file hash, the CLI path and hash (from the captured descriptor) and the reviewed source identity (`MERI_REHEARSAL_SOURCE_IDENTITY`: a JSON file with exact head, tree and an empty porcelain list, written by the run script as the checkout owner with git; a dirty tree refuses).
- `cliNegativeControl` is the separate real-CLI negative: a child started without the CA against the stand-in origin must exit non-zero with a TLS refusal in its output while the stand-in records zero requests.
- No change to `apps/runtime`, to the admitted CLI configuration or to the product option builder (`apps/worker/conversation/options.mjs`).

## 3. Target identity, signer separation and scrubbed environment

| Item | Value |
|---|---|
| Container | the ephemeral cloud session container (hostname, PID 1, boot id and the per-session block device are recorded in the receipt's `environment`); no shared host |
| Source | the run script records `git rev-parse HEAD`, `HEAD^{tree}` and `git status --porcelain` as the checkout owner (root), into `MERI_REHEARSAL_SOURCE_IDENTITY`; the harness refuses a dirty tree and binds head and tree into the receipt |
| Signer | key material is generated by a separate identity: a root-owned 0700 signer directory that uid 30033 cannot read; only `ca.crt`, `server.crt` (0644) and `server.key` (0600) are copied into the harness's own fresh 0700 directory; the CA signing key, serial, request and extension files are deleted in the signer directory before the harness starts, and the harness refuses if any of them is present next to the CA it is given |
| Process identity | one `node` process started by `runuser -u meri` with `env -i` and only `HOME`, `PATH`, `TMPDIR`, `MERI_REVIEW_SOURCE_ROOT`, `MERI_REHEARSAL_RECEIPT` and the seven contract variables plus `NODE_EXTRA_CA_CERTS`; the CLI child receives the product five plus `NODE_EXTRA_CA_CERTS` and nothing else |
| Cluster | a run-owned disposable PostgreSQL 16 cluster provisioned into the run directory with its own socket directory, marker file and `meri_rehearsal_<run>` database; held exclusively by the harness; stopped and deleted by the script's cleanup |
| Lifetime | CA and leaf valid 1 day; the run is bounded by `timeout --kill-after=10s 900s`; the stand-in lives inside the harness process |
| Readbacks before and after | `sha256sum /etc/ssl/certs/ca-certificates.crt`, `ls /usr/local/share/ca-certificates`, `/etc/hosts` bytes, the stand-in port (parsed from `ss -ltn`, must be absent), `ps -u meri` (must be empty), the run directory (must be absent); every comparison is an assertion that fails the run |

## 4. Exact commands (not executed; fail closed)

```sh
#!/bin/bash
# Every failure is a failure: no `|| echo`, no swallowed step. Expected negatives are asserted with `!` and their outputs are inspected.
set -euo pipefail
R=/home/user/meri-fable-complete; RUN=$(cat /proc/sys/kernel/random/uuid); DB=meri_rehearsal_${RUN//-/}
S=/root/standin-signer-$RUN; D=/home/meri/standin-trust-$RUN; OUT=/home/meri/complete-out/standin-trust-$RUN; PGD=/home/meri/standin-pg-$RUN
mkdir -m 0700 "$S"; mkdir -m 0700 "$D"; mkdir "$OUT"; mkdir -m 0700 "$PGD"; chown meri:meri "$D" "$OUT"; chown postgres:postgres "$PGD"
PGBIN=/usr/lib/postgresql/16/bin; SOCK=$PGD/socket; mkdir -m 0755 "$SOCK"; chown postgres:postgres "$SOCK"
# Source identity as the checkout owner; the harness refuses a dirty tree.
( cd "$R"; printf '{"head":"%s","tree":"%s","porcelain":%s,"root":"%s","recordedAt":"%s"}\n' "$(git rev-parse HEAD)" "$(git rev-parse 'HEAD^{tree}')" "$(git status --porcelain | python3 -c 'import json,sys;print(json.dumps([l for l in sys.stdin.read().split("\n") if l]))')" "$R" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" ) > "$OUT/source-identity.json"; chown meri:meri "$OUT/source-identity.json"
# Baseline readbacks of the untouched container trust (asserted identical after the run).
sha256sum /etc/ssl/certs/ca-certificates.crt > "$OUT/bundle-before.sha256"; ls /usr/local/share/ca-certificates > "$OUT/ca-dir-before.txt"; cp /etc/hosts "$OUT/hosts-before"
cleanup(){ set +e; status=0
  pkill -u meri -TERM; sleep 2; pkill -u meri -KILL
  runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGD/data" -m fast stop; rm -rf "$PGD"
  rm -rf "$S" "$D"
  sha256sum /etc/ssl/certs/ca-certificates.crt > "$OUT/bundle-after.sha256"; ls /usr/local/share/ca-certificates > "$OUT/ca-dir-after.txt"; cp /etc/hosts "$OUT/hosts-after"
  cmp -s "$OUT/bundle-before.sha256" "$OUT/bundle-after.sha256" || status=1; cmp -s "$OUT/ca-dir-before.txt" "$OUT/ca-dir-after.txt" || status=1; cmp -s "$OUT/hosts-before" "$OUT/hosts-after" || status=1
  ss -ltn > "$OUT/listeners-after.txt"; ps -u meri -o pid=,comm= > "$OUT/meri-processes-after.txt"
  [ -s "$OUT/meri-processes-after.txt" ] && status=1; [ -e "$D" ] && status=1; [ -e "$S" ] && status=1; [ -e "$PGD" ] && status=1
  if [ -s "$OUT/standin-port" ] && grep -q ":$(cat "$OUT/standin-port") " "$OUT/listeners-after.txt"; then status=1; fi
  echo "cleanup status=$status" > "$OUT/cleanup-readback"; exit $status; }
trap cleanup EXIT
# Signer separation: key material generated as root in the signer directory; only the CA certificate and the leaf pair reach the harness directory; signing material is deleted before the harness starts.
( cd "$S" && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=meri-qualification-ca-$RUN" -keyout ca.key -out ca.crt -addext 'basicConstraints=critical,CA:TRUE' \
  && openssl req -newkey rsa:2048 -nodes -subj '/CN=127.0.0.1' -keyout server.key -out server.csr && printf 'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n' > ext.cnf \
  && openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 1 -extfile ext.cnf -out server.crt )
install -o meri -g meri -m 0644 "$S/ca.crt" "$D/ca.crt"; install -o meri -g meri -m 0644 "$S/server.crt" "$D/server.crt"; install -o meri -g meri -m 0600 "$S/server.key" "$D/server.key"
shred -u "$S/ca.key" "$S/server.key"; rm -f "$S/ca.srl" "$S/server.csr" "$S/ext.cnf"; rmdir "$S" 2>/dev/null || { rm -rf "$S"; }
! [ -e "$D/ca.key" ]; stat -c '%U %a %n' "$D"/* > "$OUT/material-modes.txt"
# Run-owned disposable cluster with the canonical migrations, marker and database.
runuser -u postgres -- "$PGBIN/initdb" -D "$PGD/data" -U postgres --auth=trust -E UTF8 > "$OUT/initdb.log"
runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGD/data" -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -c fsync=off" -l "$PGD/log" start > "$OUT/pg-start.log"
runuser -u postgres -- "$PGBIN/psql" -h "$SOCK" -U postgres -qc "CREATE DATABASE $DB"
for m in $(sed -n '/^MIGRATIONS=(/,/^)/p' "$R/scripts/qualification/local-baseline/provision-postgres.sh" | grep -o 'apps/[^ ]*\.sql'); do runuser -u postgres -- "$PGBIN/psql" -h "$SOCK" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$R/$m"; done
echo "$RUN" > "$SOCK/meri-rehearsal-owned"
ENV="env -i HOME=/home/meri PATH=/opt/nvm/versions/node/v24.21.0/bin:/usr/bin:/bin TMPDIR=/home/meri/resume-tmp MERI_REVIEW_SOURCE_ROOT=$R MERI_REHEARSAL_RUN_ID=$RUN MERI_REHEARSAL_PG_SOCKET=$SOCK MERI_REHEARSAL_PG_DATABASE=$DB MERI_REHEARSAL_SOURCE_IDENTITY=$OUT/source-identity.json MERI_QUALIFICATION_CERT=$D/server.crt MERI_QUALIFICATION_KEY=$D/server.key"
# Negative control N (harness without the CA): must fail closed at the preflight with the TLS-specific code and no listener request; the contract is complete, only the trust is absent.
! runuser -u meri -- $ENV MERI_QUALIFICATION_CA=$D/ca.crt MERI_REHEARSAL_RECEIPT=$OUT/negative.json bash -c "cd '$R' && timeout --kill-after=10s 300s node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs" > "$OUT/negative.log" 2>&1
grep -q '"code": "QUALIFICATION_TRUST_INCONSISTENT"' "$OUT/negative.json"   # NODE_EXTRA_CA_CERTS absent while the contract names a CA: refused before any request
# Negative control N2 (real CLI without the CA): the pinned CLI against a throwaway stand-in must fail at TLS and reach no listener; cliNegativeControl records it.
runuser -u meri -- $ENV MERI_QUALIFICATION_CA=$D/ca.crt NODE_EXTRA_CA_CERTS=$D/ca.crt bash -c "cd '$R' && node --test scripts/qualification/first-chat-rehearsal/qualification-trust.test.mjs" > "$OUT/trust-controls.log" 2>&1
# Positive run P (the approval item): the same process-scoped CA for the harness and its CLI child only; the stand-in starts inside the harness and its port is recorded for the final readback.
runuser -u meri -- $ENV MERI_QUALIFICATION_CA=$D/ca.crt NODE_EXTRA_CA_CERTS=$D/ca.crt MERI_REHEARSAL_RECEIPT=$OUT/positive.json bash -c "cd '$R' && timeout --kill-after=10s 900s node --test scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs" > "$OUT/positive.log" 2>&1
python3 - "$OUT/positive.json" > "$OUT/standin-port" <<'PY'
import json,sys;r=json.load(open(sys.argv[1]));assert r['outcome']=='PASSED' and r['providerStandIn']['closedVerified'] is True;print(next(s['port'] for s in r['steps'] if s['name']=='stand-in-started'))
PY
```

The trap's exit status is the run's status: any changed trust readback, leftover process, directory, cluster or listener fails the run even when the positive receipt says PASSED.

## 5. Controls the run must produce before it counts

Negative N: `QUALIFICATION_TRUST_INCONSISTENT` before any request (no stand-in started, no cluster touched). Negative N2 (in the trust test, against a throwaway stand-in): the client without the CA exits non-zero with a TLS refusal and the stand-in logs zero requests; the harness without the CA is classified `REHEARSAL_PROVIDER_STANDIN_TLS_UNTRUSTED`, a closed port `REHEARSAL_PROVIDER_STANDIN_UNREACHABLE`. Positive P: the two-turn rehearsal through the real CLI and control plane with the receipts the rehearsal already writes (issuance, next-run selection, kickoff, checkpoint capture and readback, retirement, revocation), the descriptor assertions of section 2 (template carries exactly the qualification CA; `productEnvKeys` equal the product template), the stand-in call log (both turns' `POST /v1/messages` with no provider credential), `closedVerified`, the environment and source identity, zero cost, and the trust readbacks of section 3 unchanged. A positive run is qualification evidence for the harness route only, not product parity and not live acceptance.

## 6. The container-wide packet is unchanged (correction of the earlier claim)

The previous revision of this document said the container-wide packet's script text had been corrected in the same commit. That was not true: the held container-wide packet was not edited then and is not edited now. Its defects listed by dot (C2 and the `--use-system-ca` probe as explicit steps, the effective bundle hash before and after, `update-ca-certificates --fresh` exit code, exclusive output directory, listener and process readbacks) remain open in that packet. Both routes stay on HOLD; this document proposes only the process-scoped route of sections 2 to 5.

## 7. Approval requested

None yet. After root reviews the source of section 2, the script of section 4 and the controls of section 5, one action-time approval question for the positive run P in this disposable container can be put; until then the multi-turn rehearsal with the real CLI stays UNRUN on both routes.

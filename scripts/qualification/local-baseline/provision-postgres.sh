#!/usr/bin/env bash
# Local-only PostgreSQL 16 clusters for the existing Unix-socket test fixtures.
# Creates nothing durable outside the data root; never touches a product database.
# Usage: provision-postgres.sh <start|stop|status> [--repo DIR] [--data DIR]
# Exit: 0 ok; 2 usage/configuration; 3 cluster/migration failure.
set -euo pipefail
ACTION="${1:-}"; shift || true
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DATA="/tmp/meri-local-baseline-pg"
while [ $# -gt 0 ]; do case "$1" in --repo) REPO="$2"; shift 2;; --data) DATA="$2"; shift 2;; *) echo "unknown argument: $1" >&2; exit 2;; esac; done
case "$ACTION" in start|stop|status) ;; *) echo "usage: $0 <start|stop|status> [--repo DIR] [--data DIR]" >&2; exit 2;; esac
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
[ -x "$PGBIN/initdb" ] && [ -x "$PGBIN/pg_ctl" ] && [ -x "$PGBIN/psql" ] || { echo "PostgreSQL 16 binaries not found under $PGBIN (set PGBIN)" >&2; exit 2; }
# The existing fixtures pin these socket directories and database names.
BROKER_SOCKET="/tmp/meri-broker-pg-socket-20261014"
KICKOFF_SOCKET="/tmp/meri-prepared-kickoff-pg-20261014/socket"
MIGRATIONS=(
 apps/control/conversations/migrations/0001_conversations.sql
 apps/control/conversations/migrations/0002_lifecycle.sql
 apps/control/conversations/migrations/0003_selected_outputs.sql
 apps/control/conversations/migrations/0004_sdk_sessions.sql
 apps/control/conversations/migrations/0005_selected_reads.sql
 apps/control/conversations/migrations/0006_native_executions.sql
 apps/control/conversations/migrations/0007_native_preparation.sql
 apps/control/conversations/migrations/0008_native_prepared_launch.sql
 apps/gateway/budget/migrations/0001_product_budget.sql
 apps/artifacts/migrations/0001_versions.sql
)
for m in "${MIGRATIONS[@]}"; do [ -f "$REPO/$m" ] || { echo "missing migration source: $REPO/$m" >&2; exit 2; }; done
# PostgreSQL refuses to run as root; delegate to the postgres account when invoked by root.
if [ "$(id -u)" = "0" ]; then id postgres >/dev/null 2>&1 || { echo "root invocation requires a postgres account" >&2; exit 2; }; RUN=(su postgres -c); as_pg(){ su postgres -c "$*"; }; else as_pg(){ bash -c "$*"; }; fi
cluster(){ # name socket
 local name="$1" sock="$2" dir="$DATA/$1"
 mkdir -p "$dir" "$sock"; chmod 755 "$sock"; if [ "$(id -u)" = "0" ]; then chown postgres:postgres "$dir" "$sock"; fi; chmod 700 "$dir"
 if [ ! -f "$dir/PG_VERSION" ]; then as_pg "$PGBIN/initdb -D '$dir' -U postgres --auth=trust -E UTF8 >/dev/null" || return 3; fi
 if ! as_pg "$PGBIN/pg_ctl -D '$dir' status >/dev/null 2>&1"; then
  # Unix-socket only; fsync off is acceptable for disposable local evidence only.
  as_pg "$PGBIN/pg_ctl -D '$dir' -o \"-c listen_addresses='' -c unix_socket_directories='$sock' -c fsync=off -c max_connections=100\" -l '$dir/log' start >/dev/null" || return 3
 fi
 as_pg "$PGBIN/pg_isready -h '$sock' -q" || return 3
}
ensure_db(){ local sock="$1" db="$2"; as_pg "$PGBIN/psql -h '$sock' -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\"" | grep -q 1 || as_pg "$PGBIN/psql -h '$sock' -U postgres -qc 'CREATE DATABASE $db'"; }
apply(){ local sock="$1" db="$2"
 if as_pg "$PGBIN/psql -h '$sock' -U postgres -d '$db' -tAc \"SELECT to_regclass('meri_conversations.native_allocations') IS NOT NULL AND to_regclass('meri_product_budget.budget') IS NOT NULL AND to_regclass('meri_artifacts.versions') IS NOT NULL\"" | grep -q '^t$'; then echo "schema present: $db"; return 0; fi
 for m in "${MIGRATIONS[@]}"; do as_pg "$PGBIN/psql -h '$sock' -U postgres -d '$db' -v ON_ERROR_STOP=1 -q -f '$REPO/$m'" || { echo "migration failed: $m -> $db" >&2; return 3; }; done; echo "applied canonical migrations: $db"
}
case "$ACTION" in
 start)
  cluster broker "$BROKER_SOCKET" || exit 3
  cluster kickoff "$KICKOFF_SOCKET" || exit 3
  ensure_db "$BROKER_SOCKET" meri_prepared_launch; ensure_db "$KICKOFF_SOCKET" meri_inspection_final
  apply "$BROKER_SOCKET" postgres || exit 3; apply "$BROKER_SOCKET" meri_prepared_launch || exit 3; apply "$KICKOFF_SOCKET" meri_inspection_final || exit 3
  as_pg "$PGBIN/psql -h '$BROKER_SOCKET' -U postgres -tAc \"SELECT version()\""
  echo "export MERI_INSPECTION_TEST_SOCKET=$KICKOFF_SOCKET MERI_INSPECTION_TEST_DATABASE=meri_inspection_final MERI_PREPARED_LAUNCH_DATABASE=meri_prepared_launch";;
 stop)
  for name in broker kickoff; do dir="$DATA/$name"; [ -f "$dir/PG_VERSION" ] || continue; as_pg "$PGBIN/pg_ctl -D '$dir' -m fast stop >/dev/null 2>&1" || true; done
  for sock in "$BROKER_SOCKET" "$KICKOFF_SOCKET"; do [ -S "$sock/.s.PGSQL.5432" ] && { echo "socket still present: $sock" >&2; exit 3; }; done; echo "stopped";;
 status)
  for name in broker kickoff; do dir="$DATA/$name"; if [ -f "$dir/PG_VERSION" ] && as_pg "$PGBIN/pg_ctl -D '$dir' status >/dev/null 2>&1"; then echo "$name: running"; else echo "$name: stopped"; fi; done;;
esac

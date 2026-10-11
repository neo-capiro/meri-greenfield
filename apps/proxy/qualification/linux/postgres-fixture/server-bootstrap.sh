#!/bin/sh
# Fixed UID999 fixture only. Never xtrace or publish private init diagnostics.
set -eu
test "$(id -u)" = 999
test "$(id -g)" = 999
umask 077
fail() { printf '%s\n' 'PG_FIXTURE_BOOTSTRAP_FAILED'; exit 1; }
trap fail HUP INT TERM
initdb -D /var/lib/postgresql/data --username=meri_fixture_admin \
  --pwfile=/run/meri-pg/admin-password --auth-local=trust --auth-host=scram-sha-256 \
  > /tmp/bootstrap-private.log 2>&1 || fail
pg_ctl -D /var/lib/postgresql/data -o "-c listen_addresses='' -c unix_socket_directories=/var/run/postgresql" \
  -w start >> /tmp/bootstrap-private.log 2>&1 || fail
psql -X -q -v ON_ERROR_STOP=1 -h /var/run/postgresql -U meri_fixture_admin \
  -d postgres -f /run/meri-pg/bootstrap.sql >> /tmp/bootstrap-private.log 2>&1 || fail
pg_ctl -D /var/lib/postgresql/data -m fast -w stop >> /tmp/bootstrap-private.log 2>&1 || fail
printf '%s\n' 'PG_FIXTURE_SCRAM_READY'
exec postgres -D /var/lib/postgresql/data -c config_file=/run/meri-pg/postgresql.conf

#!/usr/bin/env bash
# Applies the migrations the local-baseline provisioner does not (conversations 0013+, gateway budget 0002+, artifacts 0003+) to its three
# databases, in order, exactly as it applies its own (psql, ON_ERROR_STOP). Run as root inside the pgvector container after
# `provision-postgres.sh start`.
set -uo pipefail
PSQL=/usr/lib/postgresql/16/bin/psql
R=/opt/meri
FILES="$(ls $R/apps/control/conversations/migrations/0*.sql | sort | grep -v -e '/000' -e '/0010_' -e '/0011_')
$(ls $R/apps/gateway/budget/migrations/0*.sql | sort | grep -v '/0001_')
$(ls $R/apps/artifacts/migrations/0*.sql | sort | grep -v -e '/0001_' -e '/0002_')"
for m in $FILES; do
  n=$(basename "$(dirname "$(dirname "$m")")")/$(basename "$m")
  for target in "/tmp/meri-broker-pg-socket-20261014 postgres" "/tmp/meri-broker-pg-socket-20261014 meri_prepared_launch" "/tmp/meri-prepared-kickoff-pg-20261014/socket meri_inspection_final"; do
    set -- $target
    if su postgres -c "$PSQL -h '$1' -U postgres -d '$2' -v ON_ERROR_STOP=1 -q -f '$m'" >/dev/null 2>/tmp/mig.err; then echo "applied $n -> $2"; else echo "FAILED $n -> $2: $(head -c 300 /tmp/mig.err)"; fi
  done
done

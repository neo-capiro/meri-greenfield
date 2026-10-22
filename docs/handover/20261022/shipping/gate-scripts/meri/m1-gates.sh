#!/usr/bin/env bash
# Meri gate runner: head vs base, image + in-image groups + rehearsals + native PostgreSQL (originally for #204). One container at a time; no AWS, no network for tests.
#   setup: git checkouts of $HEAD_SHA and $BASE_SHA under $GATE_WORKDIR (fetched from GitHub), P0 harness @43b705c8 at $GATE_WORKDIR/h.
#   1+3 runtime: verify.py runtime (image build meri-p0-runtime:<sha12>, image gate, groups, first-turn + D3 rehearsals).
#   4 combined: the 32-file M1 selection in the head image (spec reporter, concurrency 1, module mocks, 900 s cap), uid 1000.
#   2 pg: native PostgreSQL 16 suites in pgvector/pgvector:pg16 with the side's image node + node_modules.
# Usage: m1-gates.sh STEP... (setup head-runtime base-runtime combined targeted pg-head pg-base)
set -uo pipefail
W=${GATE_WORKDIR:-/opt/m1}; O=$W/out; H=$W/h; mkdir -p $O
HERE=$(cd "$(dirname "$0")" && pwd)
MERI_SOURCE_URL=${MERI_SOURCE_URL:-https://github.com/neo-capiro/meri-greenfield.git}
HEAD_SHA=${HEAD_SHA:?set HEAD_SHA (full sha)}; BASE_SHA=${BASE_SHA:?set BASE_SHA (full sha, normally the PR parent)}
log(){ echo "$(date -u +%FT%TZ) $*" | tee -a $O/steps.txt; }
sha12(){ git -C $W/$1 rev-parse --short=12 HEAD; }
COMBINED="${COMBINED:-$(cat "${COMBINED_FILE:-$HERE/combined-m1.txt}")}"
TARGETED="${TARGETED:-apps/runtime/product-ports/test/lifecycle-continuation.test.mjs
apps/worker/conversation/continuation/test/continuation.test.mjs
apps/worker/conversation/test/lifecycle-activity.test.mjs}"

# Runs node --test in a container of IMAGE with the side's committed source overlaid (as in-image.sh), uid 1000, spec reporter.
in_image(){ # NAME SIDE LIMIT FILES...
  local name=$1 side=$2 limit=$3; shift 3
  local image=meri-p0-runtime:$(sha12 $side) c=m1-node
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network none --memory 3g --user 0 --entrypoint sh $image -c "sleep $((limit + 300))" >/dev/null
  git -C $W/$side -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $c sh -c 'cd /opt/meri && tar -xf -'
  docker exec --user 0 $c sh -c 'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +'
  docker exec --user 1000 $c sh -c 'node --version; id -u' > $O/$name.env 2>&1
  local s=$(date +%s%3N)
  docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri $c \
    timeout $limit node --experimental-test-module-mocks --test --test-reporter=spec --test-concurrency=1 "$@" > $O/$name.log 2>&1
  local rc=$?
  log "$name side=$side image=$image rc=$rc ms=$(( $(date +%s%3N) - s )) $(grep -E '^ℹ (tests|pass|fail|skipped|cancelled|todo|duration_ms)' $O/$name.log | tr '\n' ' ')"
  docker rm -f $c >/dev/null 2>&1
}

pg_suites(){ # SIDE
  local side=$1 image=meri-p0-runtime:$(sha12 $1) c=m1-pg R=$W/pg-$1
  rm -rf $R $W/node-$1 && mkdir -p $R $W/node-$1
  docker rm -f m1-x >/dev/null 2>&1; docker create --name m1-x $image >/dev/null
  docker cp m1-x:/opt/meri/. $R/
  docker cp m1-x:$(docker run --rm --entrypoint sh $image -c 'readlink -f "$(command -v node)"') $W/node-$1/node
  docker rm m1-x >/dev/null
  rm -rf $R/apps/*/test $R/docs && git -C $W/$side -c tar.umask=0022 archive HEAD | tar -xf - -C $R && chmod -R a+rwX $R
  local SET=$(cd $R && ls apps/control/conversations/test/*-pg.test.mjs apps/runtime/test/*-pg.test.mjs apps/runtime/native-authority/test/*-pg.test.mjs \
    apps/control/retention/test/*-pg.test.mjs 2>/dev/null | sort -u | tr '\n' ' ')
  echo "$SET" | tr ' ' '\n' | grep . > $O/pg-$side.files
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network=none -m 3g -v $R:/opt/meri -v $W/node-$1:/n --entrypoint sh pgvector/pgvector:pg16 -c 'sleep 14400' >/dev/null
  docker exec $c sh -c 'bash /opt/meri/scripts/qualification/local-baseline/provision-postgres.sh start --repo /opt/meri' > $O/pg-$side-provision.log 2>&1
  log "pg-$side provision rc=$? $(tail -1 $O/pg-$side-provision.log)"
  cp $HERE/extra-migrations.sh $R/extra-migrations.sh && docker exec $c bash /opt/meri/extra-migrations.sh > $O/pg-$side-mig.log 2>&1
  log "pg-$side extra migrations applied=$(grep -c '^applied' $O/pg-$side-mig.log) failed=$(grep -c '^FAILED' $O/pg-$side-mig.log); server $(docker exec $c sh -c '/usr/lib/postgresql/16/bin/postgres --version'); node $(docker exec $c /n/node --version); files=$(wc -l < $O/pg-$side.files)"
  local s=$(date +%s%3N)
  docker exec -u postgres -w /opt/meri -e HOME=/tmp -e MERI_REVIEW_SOURCE_ROOT=/opt/meri \
    -e MERI_INSPECTION_TEST_SOCKET=/tmp/meri-prepared-kickoff-pg-20261014/socket -e MERI_INSPECTION_TEST_DATABASE=meri_inspection_final \
    -e MERI_PREPARED_LAUNCH_DATABASE=meri_prepared_launch $c \
    sh -c "timeout 5400 /n/node --experimental-test-module-mocks --test --test-reporter=spec --test-concurrency=1 $SET" > $O/pg-$side.log 2>&1
  log "pg-$side rc=$? ms=$(( $(date +%s%3N) - s )) $(grep -E '^ℹ (tests|pass|fail|skipped|cancelled|todo)' $O/pg-$side.log | tr '\n' ' ')"
  docker rm -f $c >/dev/null
}

for step in "$@"; do case $step in
  setup)
    for side in head base; do
      rm -rf $W/$side && git init -q $W/$side && git -C $W/$side config core.autocrlf false
      git -C $W/$side fetch -q $MERI_SOURCE_URL $([ $side = head ] && echo $HEAD_SHA || echo $BASE_SHA) && git -C $W/$side -c advice.detachedHead=false checkout -q $([ $side = head ] && echo $HEAD_SHA || echo $BASE_SHA)
      log "setup $side $(git -C $W/$side rev-parse HEAD) tree $(git -C $W/$side rev-parse HEAD^{tree})"
    done
    rm -rf $H && mkdir -p $H
    for f in verify.py evidence.py in-image.sh; do git -C $W/head show 43b705c8:scripts/qualification/p0-telemetry/$f > $H/$f; done
    log "harness 43b705c8 $(cd $H && sha256sum verify.py evidence.py in-image.sh | cut -c1-16 | tr '\n' ' ')";;
  head-runtime|base-runtime)
    side=${step%-runtime}; vside=$side
    P0_CHANGED_NODE_TESTS="${CHANGED_TESTS_JSON:-[]}" python3 $H/verify.py runtime --source $W/$side --output $O/$side-runtime --side $vside > $O/$side-runtime.console 2>&1
    log "$side runtime exit=$?"
    python3 -c "
import json;r=json.load(open('$O/$side-runtime/result.json'))
print('  image',r.get('image'),r.get('imageId'),'commit',r.get('commit'))
for c in r['checks']: print('  ',c['name'],c['status'],'exit',c.get('exitCode'),'tests',c.get('tests'),'pass',c.get('passed'),'fail',c.get('failed'),'clockSteps',c.get('clockSteps'),'s',c.get('elapsedSeconds'))" | tee -a $O/steps.txt
    [ $side = head ] && docker tag meri-p0-runtime:$(sha12 head) meri-p0-runtime:${HEAD_SHA:0:8} && log "tagged meri-p0-runtime:${HEAD_SHA:0:8}";;
  combined) in_image combined-head head 900 $COMBINED;;
  targeted) in_image targeted-head head 180 $TARGETED;;
  pg-head) pg_suites head;;
  pg-base) pg_suites base;;
esac; done
log "STEPS DONE: $*"

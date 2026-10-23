#!/usr/bin/env bash
# Follow-up runs for #204 (not for commit), one container at a time. Initial failures stay in /opt/m1/out/*.log untouched.
#   backoff: the real-clock nonanswer backoff test x10 in each side's image (head: all kinds; base: its single original test).
#   n21: historical-stop-facts.test.mjs (N21 needs python3 for pki.py) with each side's image node + node_modules + source, in node:24
#        (python3 + openssl present), uid 1000.
#   pgcanon: the repository's documented procedure: provision-postgres.sh start (canonical migrations only, no extras), then
#        run-suites.mjs --only conversations-tests,native-authority,control-retention as the non-root postgres user.
#   nextrun: next-run-pg.test.mjs x5 per side on a freshly provisioned canonical cluster.
set -uo pipefail
W=/opt/m1; O=$W/out/repro; mkdir -p $O
log(){ echo "$(date -u +%FT%TZ) $*" | tee -a $O/steps.txt; }
PROXY=967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:a838846f08a12419496eccc6811ab343ce568beeb7ca8853611d842b04f64041
img(){ case $1 in head) echo meri-p0-runtime:31f7b40e58b3;; head2) echo meri-p0-runtime:f3bcf4a66463;; *) echo meri-p0-runtime:d3cf54962a95;; esac; }
sha(){ git -C $W/$1 rev-parse HEAD; }
counts(){ grep -E '^ℹ (tests|pass|fail|skipped)' $1 | tr '\n' ' '; }

backoff(){ local side=$1 c=m1-bo pat
  [ $side = base ] && pat='never fatal by count' || pat='nonanswers are never fatal by count'
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network none --memory 3g --user 0 --entrypoint sh $(img $side) -c 'sleep 3600' >/dev/null
  git -C $W/$side -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $c sh -c 'cd /opt/meri && tar -xf -'
  docker exec --user 0 $c sh -c 'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +'
  local ok=0 bad=0
  for i in $(seq 1 10); do
    docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri $c timeout 300 node --experimental-test-module-mocks --test \
      --test-reporter=spec --test-concurrency=1 "--test-name-pattern=$pat" apps/worker/conversation/test/lifecycle-activity.test.mjs > $O/backoff-$side-$i.log 2>&1
    if [ $? = 0 ]; then ok=$((ok+1)); else bad=$((bad+1)); fi
    echo "  $side run $i: $(counts $O/backoff-$side-$i.log) $(grep -oE '\[[0-9]+,[0-9]+,[0-9]+\]' $O/backoff-$side-$i.log | head -2 | tr '\n' ' ')" >> $O/steps.txt
  done
  log "backoff $side ($(img $side), pattern '$pat') x10: $ok runs pass / $bad runs fail"
  docker rm -f $c >/dev/null
}

n21(){ local side=$1 c=m1-n21
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network none --memory 3g --user 0 -v $W/pg-$side:/src:ro -v $W/node-$side:/n:ro --entrypoint sh $PROXY -c 'sleep 3600' >/dev/null
  docker exec --user 0 $c sh -c 'mkdir -p /opt/meri && cp -a /src/. /opt/meri/ && rm -f /opt/meri/extra-migrations.sh && chown -R 1000:1000 /opt/meri'
  log "n21 $side tools: $(docker exec $c /opt/meri-proxy-venv/bin/python -c 'import cryptography,sys;print(sys.version.split()[0],cryptography.__version__)') node $(docker exec $c /n/node --version) image $PROXY"
  docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri --env HOME=/tmp --env MERI_TEST_PYTHON=/opt/meri-proxy-venv/bin/python $c timeout 600 /n/node --experimental-test-module-mocks --test \
    --test-reporter=spec --test-concurrency=1 apps/runtime/native-authority/test/historical-stop-facts.test.mjs > $O/n21-$side.log 2>&1
  log "n21 $side rc=$? $(counts $O/n21-$side.log) N21: $(grep -E '^(✔|✖) N21' $O/n21-$side.log | cut -c1-90)"
  docker rm -f $c >/dev/null
}

pgcanon(){ local side=$1; local c=m1-pgc R=$W/pgc-$1
  rm -rf $R && cp -a $W/pg-$side $R && rm -f $R/extra-migrations.sh && chmod -R a+rwX $R
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network=none -m 3g -v $R:/opt/meri -v $W/node-$side:/n -v $O:/out --entrypoint sh pgvector/pgvector:pg16 -c 'sleep 14400' >/dev/null
  docker exec $c sh -c 'ln -sf /n/node /usr/local/bin/node; bash /opt/meri/scripts/qualification/local-baseline/provision-postgres.sh start --repo /opt/meri' > $O/pgcanon-$side-provision.log 2>&1
  log "pgcanon $side provision rc=$? ($(grep -c 'applied canonical migrations' $O/pgcanon-$side-provision.log) databases migrated)"
  docker exec $c sh -c "rm -rf /out/pgcanon-$side && mkdir -p /out/pgcanon-$side && chown postgres /out/pgcanon-$side"
  local s=$(date +%s)
  docker exec -u postgres -w /opt/meri -e HOME=/tmp -e PATH=/n:/usr/local/bin:/usr/bin:/bin $c timeout 7200 /n/node scripts/qualification/local-baseline/run-suites.mjs \
    --repo /opt/meri --out /out/pgcanon-$side --only conversations-tests,native-authority,control-retention --source-commit $(sha $side) > $O/pgcanon-$side.console 2>&1
  log "pgcanon $side run-suites rc=$? $(( $(date +%s)-s ))s"
  python3 - $O/pgcanon-$side <<'PY' | tee -a $O/steps.txt
import json,sys,glob
for f in sorted(glob.glob(sys.argv[1]+'/receipts/*.json')):
    r=json.load(open(f)); o=r.get('outcome',r)
    print(' ',r.get('suite',{}).get('name',f.split('/')[-1]),json.dumps({k:o.get(k) for k in ('exitCode','signal','timedOut','durationMs','counts')})[:400])
PY
  docker rm -f $c >/dev/null
}

nextrun(){ local side=$1; local c=m1-nr R=$W/pgc-$1
  docker rm -f $c >/dev/null 2>&1
  docker run -d --name $c --network=none -m 3g -v $R:/opt/meri -v $W/node-$side:/n --entrypoint sh pgvector/pgvector:pg16 -c 'sleep 7200' >/dev/null
  docker exec $c sh -c 'bash /opt/meri/scripts/qualification/local-baseline/provision-postgres.sh start --repo /opt/meri' > /dev/null 2>&1
  if [ "${EXTRAS:-0}" = 1 ]; then cp $W/extra-migrations.sh $R/extra-migrations.sh; docker exec $c bash /opt/meri/extra-migrations.sh > $O/nextrunx-$side-mig.log 2>&1; rm -f $R/extra-migrations.sh
    log "  extras for $side: applied=$(grep -c '^applied' $O/nextrunx-$side-mig.log) failed=$(grep -c '^FAILED' $O/nextrunx-$side-mig.log)"; fi
  local ok=0 bad=0
  for i in 1 2 3 4 5; do
    docker exec -u postgres -w /opt/meri -e HOME=/tmp -e MERI_REVIEW_SOURCE_ROOT=/opt/meri \
      -e MERI_INSPECTION_TEST_SOCKET=/tmp/meri-prepared-kickoff-pg-20261014/socket -e MERI_INSPECTION_TEST_DATABASE=meri_inspection_final \
      -e MERI_PREPARED_LAUNCH_DATABASE=meri_prepared_launch $c timeout 900 /n/node --test --test-reporter=spec --test-concurrency=1 \
      apps/control/conversations/test/next-run-pg.test.mjs > $O/nextrun${EXTRAS:+x}-$side-$i.log 2>&1
    if [ $? = 0 ]; then ok=$((ok+1)); else bad=$((bad+1)); fi
    echo "  $side run $i: $(counts $O/nextrun-$side-$i.log) $(grep -E '^✖ ' $O/nextrun-$side-$i.log | grep -v 'failing tests' | sort -u | cut -c1-70 | tr '\n' '|')" >> $O/steps.txt
  done
  log "next-run-pg $side x5 (extras=${EXTRAS:-0}): $ok pass / $bad fail"
  docker rm -f $c >/dev/null
}

backoff_alt(){ # 20 alternating head/base runs; one container per side kept idle while the other runs
  for side in head base; do local c=m1-bo-$side; docker rm -f $c >/dev/null 2>&1
    docker run -d --name $c --network none --memory 3g --user 0 --entrypoint sh $(img $side) -c 'sleep 7200' >/dev/null
    git -C $W/$side -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $c sh -c 'cd /opt/meri && tar -xf -'
    docker exec --user 0 $c sh -c 'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +'; done
  local hk=0 hb=0 bk=0 bb=0
  for i in $(seq 1 20); do for side in head base; do
    [ $side = head ] && pat='marked control nonanswers are never fatal by count' || pat='never fatal by count'
    docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri m1-bo-$side timeout 300 node --experimental-test-module-mocks --test       --test-reporter=spec --test-concurrency=1 "--test-name-pattern=$pat" apps/worker/conversation/test/lifecycle-activity.test.mjs > $O/boalt-$side-$i.log 2>&1
    rc=$?; if [ $side = head ]; then [ $rc = 0 ] && hk=$((hk+1)) || hb=$((hb+1)); else [ $rc = 0 ] && bk=$((bk+1)) || bb=$((bb+1)); fi
    echo "  alt $i $side rc=$rc $(counts $O/boalt-$side-$i.log) $(grep -oE '\[[0-9]+,[0-9]+,[0-9]+\]' $O/boalt-$side-$i.log | head -1)" >> $O/steps.txt
  done; done
  log "backoff alternating x20: head (marked kind only) $hk pass / $hb fail; base $bk pass / $bb fail"
  docker rm -f m1-bo-head m1-bo-base >/dev/null
}

for step in "$@"; do case $step in
  backoff-alt) backoff_alt;;
  backoff) backoff head; backoff base;;
  n21) n21 head; n21 base;;
  pgcanon) pgcanon head; pgcanon base;;
  nextrun) nextrun head; nextrun base;;
  nextrun2) nextrun head2;;
  pgcanon2) pgcanon head2;;
  backoff2) backoff head2;;
esac; done
log "REPRO DONE: $*"

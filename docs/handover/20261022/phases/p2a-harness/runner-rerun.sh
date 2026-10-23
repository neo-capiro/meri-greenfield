#!/usr/bin/env bash
# Review run (not for commit): the P0 runner-diagnostics group, twice per side, one container at a time.
set -uo pipefail
files="apps/runtime/test/runner-runtime-diagnostics.test.mjs apps/runtime/test/runner-first-failure.test.mjs apps/runtime/test/pinned-native-transport.test.mjs apps/runtime/test/activity-runtime-diagnostics.test.mjs apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs apps/runtime/native-authority/test/native-start-router-budget.test.mjs"
for round in 1 2; do
  for side in base head; do
    image=meri-p0-runtime:$([ $side = base ] && echo 3c56c3e981ba || echo f9a7dc6cfbe7)
    log=/opt/p2a/out/runner-rerun-$side-$round.log
    bash /opt/p2a/h/in-image.sh $image /opt/p2a/$side 1500 $files > $log 2>&1
    echo "== $side round $round exit=$? $(grep -E '^# (pass|fail) ' $log | tr '\n' ' ')"
    grep -E '^not ok ' $log | sed 's/^/   /'
  done
done
echo RUNNERDONE

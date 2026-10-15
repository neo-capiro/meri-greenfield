#!/bin/bash
# Lane 5 commands (dot's review of f0befe1: evidence corrections). Runs as uid 30033 (meri) with env -i. Every step is recorded;
# the identity capture must succeed or the script stops before any test (no blank head/tree is ever written). npm ci is not rerun:
# node_modules are the retained install of the earlier verified lanes and the marker file says so explicitly.
set -euo pipefail
R=/home/user/meri-fable-complete; O=/home/meri/complete-out/lane5-commands; cd "$R"
head=$(git -c safe.directory="$R" rev-parse HEAD); tree=$(git -c safe.directory="$R" rev-parse 'HEAD^{tree}'); branch=$(git -c safe.directory="$R" rev-parse --abbrev-ref HEAD)
[ ${#head} -eq 40 ] && [ ${#tree} -eq 40 ] || { echo "identity capture failed" >&2; exit 3; }
porcelain=$(git -c safe.directory="$R" status --porcelain)
{ echo "head=$head"; echo "tree=$tree"; echo "branch=$branch"; echo "uid=$(id -u) user=$(id -un)"; echo "porcelain_lines=$(printf '%s' "$porcelain" | grep -c . || true)"; printf '%s\n' "$porcelain" | sed 's/^/porcelain: /' | grep . || echo "porcelain: (clean)"; node --version; npm --version; python3 --version; } > "$O/env.txt" 2>&1
echo "npm ci: NOT RERUN in lane 5; node_modules retained from the earlier verified install of this worktree; no npm ci log exists for this lane (marker written deliberately, not an omission)" > "$O/npm-ci.txt"
run(){ n=$1; shift; set +e; "$@" > "$O/$n.stdout" 2> "$O/$n.stderr"; e=$?; set -e
 echo "$n exit=$e stdout_sha=$(sha256sum < "$O/$n.stdout" | cut -c1-16) stderr_sha=$(sha256sum < "$O/$n.stderr" | cut -c1-16) tests=$(grep -E '^ℹ tests' "$O/$n.stdout" | awk '{print $3}' | tr '\n' ' ') pass=$(grep -E '^ℹ pass' "$O/$n.stdout" | awk '{print $3}' | tr '\n' ' ') fail=$(grep -E '^ℹ fail' "$O/$n.stdout" | awk '{print $3}' | tr '\n' ' ')" >> "$O/summary.txt"; }
run qualification-trust node --test --test-concurrency=1 scripts/qualification/first-chat-rehearsal/qualification-trust.test.mjs scripts/qualification/first-chat-rehearsal/provider-standin.test.mjs scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.test.mjs
run rehearsal-syntax node --check scripts/qualification/first-chat-rehearsal/composed-next-turn-rehearsal.mjs
run broker-fixture-consumers-1 node --test --experimental-test-module-mocks --test-concurrency=1 apps/runtime/native-authority/test/execution-broker.test.mjs apps/runtime/native-authority/test/prepared-kickoff-pg.test.mjs
run broker-fixture-consumers-2 node --test --experimental-test-module-mocks --test-concurrency=1 apps/runtime/native-authority/test/execution-broker.test.mjs apps/runtime/native-authority/test/prepared-kickoff-pg.test.mjs
run retention-pg-and-serving node --test --test-concurrency=1 apps/control/retention/test/postgres-journal-pg.test.mjs apps/control/conversations/test/retention-serving-pg.test.mjs apps/runtime/test/prepared-run-issuance-postgres-pg.test.mjs
run contracts-check npm --prefix packages/contracts run check
run worker-source-pins-check python3 -B scripts/qualification/worker_source_pins.py --check
run worker-pins-unittest python3 -B -m unittest scripts.qualification.worker_source_pins_test scripts.qualification.worker_context_test
cat "$O/summary.txt"

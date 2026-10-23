#!/usr/bin/env bash
# Review run (not for commit): owner-channel/outcome-cancel baseline and the O1 mutation, on the host scratch tree, with the
# explicit source root those tests require.
set -uo pipefail
export PATH=/opt/adj-b-transport/node/bin:$PATH MERI_REVIEW_SOURCE_ROOT=/opt/p2a/mut-node
cd /opt/p2a/mut-node
t="apps/proxy/product/owner-channel.test.mjs apps/proxy/product/owner-outcome-cancel.test.mjs apps/proxy/product/owner-request-work.test.mjs"
run() { timeout 600 node --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap $t 2>&1 | grep -E "^(not ok|# (tests|pass|fail))|^\s+not ok" ; }
echo "== baseline"; run
f=apps/proxy/product/owner-request-work.mjs
cp $f $f.orig
python3 - "$f" <<'PY'
import sys
p=sys.argv[1]; L=open(p).read().split("\n")
old="if(outstanding.some(record=>record.dirty||record.mutating))onUnresolvedMutation();"
assert L[44].count(old)==1, L[44]
L[44]=L[44].replace(old,"if(false)onUnresolvedMutation();"); open(p,"w").write("\n".join(L))
PY
echo "== O1 mutated"; run
mv $f.orig $f
echo "== restored"; run
echo O1DONE

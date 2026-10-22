#!/bin/bash
# Meri first-chat render + Temporal infra gate (no AWS, no database). Runs render-gate-inner.sh in Docker node:24
# against a fresh GitHub clone at HEAD_SHA. Example: HEAD_SHA=<sha> GATE_OUT=/tmp/rg bash render-gate.sh
set -u
HEAD_SHA=${HEAD_SHA:?full sha to test}; OUT=${GATE_OUT:?log dir}; c=${GATE_WORKDIR:-/opt/render-gate}
HERE=$(cd "$(dirname "$0")" && pwd); mkdir -p "$OUT"; rm -rf "$c"
# Full clone from GitHub (a clone of a partial local repo can miss blobs).
git clone -q https://github.com/neo-capiro/meri-greenfield.git "$c" && git -C "$c" fetch -q origin "$HEAD_SHA" && git -C "$c" checkout -q "$HEAD_SHA"
{ echo "head $(git -C "$c" rev-parse HEAD)"; git -C "$c" status --short | head -3; } > "$OUT/render-tests.log"
# Install: root plus every packages/* and apps/** lockfile, and link packages/* under node_modules/@capiro (no npm workspaces).
docker run --rm -v "$c:/w" -w /w node:24 bash -c '
  npm ci --ignore-scripts >/dev/null 2>&1 || exit 2
  mkdir -p node_modules/@capiro
  for pj in packages/*/package.json; do d=$(dirname $pj); n=$(node -p "require(\"./$pj\").name"); ln -sfn /w/$d node_modules/$n; [ -f $d/package-lock.json ] && (cd $d && npm ci --ignore-scripts >/dev/null 2>&1); done
  for lk in $(find apps infra -name package-lock.json -not -path "*/node_modules/*"); do (cd $(dirname $lk) && npm ci --ignore-scripts >/dev/null 2>&1); done' >> "$OUT/render-tests.log" 2>&1
docker run --rm -e MERI_REVIEW_SOURCE_ROOT=/w -v "$c:/w" -v "$HERE/render-gate-inner.sh:/inner.sh" -w /w node:24 \
  bash -c 'git config --global --add safe.directory "*"; bash /inner.sh' >> "$OUT/render-tests.log" 2>&1
awk '/^=== /{m=$2} /^ℹ (tests|pass|fail|skipped) /{printf "%s %s %s\n", m, $2, $3} /^✖ [a-z]/{print m" FAIL: "$0}' "$OUT/render-tests.log" | sort -u

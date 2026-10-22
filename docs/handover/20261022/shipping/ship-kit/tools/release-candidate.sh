#!/usr/bin/env bash
# Builds and stages one Meri release candidate up to the three change sets (no stack is executed).
# Usage (Git Bash): bash release-candidate.sh <greenfield sha on main> [--reuse-proxy-kit <ship-proxy-dir>]
#   1. fast-forward fable/meri-first-chat-candidate-20261020 to the sha (make-ship-kit requires it on that branch)
#   2. proxy image: new proxy kit + build + scan gate, unless --reuse-proxy-kit is given and apps/proxy is unchanged
#   3. Meri kit: feed proxy, 01-04 image, node-only measurement (O47), 06-10, 11 private core, 12-15
# Every step's exit code is checked directly (never through a pipe). Execution (16-19; 16 stops and restarts the owner/proxy
# pair together, O94) and the live check are separate, deliberate steps.
set -uo pipefail
SHA="${1:?usage: release-candidate.sh <sha> [--reuse-proxy-kit DIR]}"; shift
REUSE=""; [ "${1:-}" = "--reuse-proxy-kit" ] && REUSE="$2"
CLIENT=d1b0cb55-fd3a-49ef-847a-7bbe9175dc44
TOOLS="$(cd "$(dirname "$0")" && pwd)"
LOG=C:/dev/fable/release-logs; mkdir -p "$LOG"
step() { local name="$1"; shift; echo "== $name $(date -u +%H:%M:%SZ)"; "$@" > "$LOG/$SHA8-$name.log" 2>&1; local rc=$?
  grep -h "OUTCOME\|STATUS\|PROXY_KIT_READY\|SHIP_KIT_READY\|SCAN_GATE\|RECEIPT_OK\|REFUSED" "$LOG/$SHA8-$name.log" | tail -2 | cut -c1-220
  [ $rc -eq 0 ] || { echo "STOPPED at $name (rc=$rc), log $LOG/$SHA8-$name.log"; tail -5 "$LOG/$SHA8-$name.log"; exit 2; }; }

FULL=$(git -C C:/dev/fable/meri-greenfield rev-parse "$SHA^{commit}") || exit 2; SHA8=${FULL:0:8}
cd C:/dev/fable/wt-candidate && git fetch -q origin && git merge --ff-only -q "$FULL" && git push -q origin fable/meri-first-chat-candidate-20261020 || { echo "candidate branch fast-forward refused"; exit 2; }
echo "candidate branch at $SHA8"

if [ -n "$REUSE" ]; then PROXY_KIT="$REUSE"; echo "reusing proxy kit $PROXY_KIT"
else
  step proxy-kit bash C:/dev/fable/ship-proxy-kit/make-proxy-kit.sh "$FULL"
  PROXY_KIT=C:/dev/fable/ship-proxy-$SHA8
  for s in 01-start-build 02-wait-receipt 03-scan-gate; do step proxy-$s bash "$PROXY_KIT/$s.sh"; done
fi

step meri-kit node C:/dev/fable/ship-kit/make-ship-kit.mjs "$FULL"
K=C:/dev/fable/ship-$SHA8
step proxy-feed bash "$PROXY_KIT/04-feed-meri-kit.sh" "$K"
cd "$K" || exit 2
for s in 01-source-put 02-build-request 03-image-build 04-image-readback; do step $s bash ./$s.sh; done
step 05-measurement-node-only node "$TOOLS/measurement-prepare-node-only.mjs" "$K"
for s in 06-measurement-payload-put 07-measurement-finalize 08-measurement-build 09-measurement-readback 10-stage3-input; do step $s bash ./$s.sh; done
step 11-private-core node kit.mjs 11-private-core --client-id "$CLIENT"
for s in 12-private-render 13-secret-upload 14-bindings 15-changesets; do step $s bash ./$s.sh; done
grep -h ": Modify\|: Add\|: Remove" "$LOG/$SHA8-15-changesets.log"
grep -n -A4 "^## Migrations" ship-packet/SHIP-PACKET.md
echo "STAGED $SHA8 $(date -u +%H:%M:%SZ): next 16-19, then the live check"

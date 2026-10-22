#!/usr/bin/env bash
# Shipping gate run (not for commit): P0 harness runtime mode, then the pinned proxy image and every proxy Python
# module in it (one process per module, uid 10001), for each named checkout under /opt/p2a. One container at a time.
# Usage: ship-gates.sh NAME...
set -uo pipefail
cd /opt/p2a/h
for n in "$@"; do
  side=head; [ "$n" = base ] && side=base
  python3 verify.py runtime --source /opt/p2a/$n --output /opt/p2a/out/$n-runtime --side $side > /opt/p2a/out/$n-runtime.console 2>&1
  echo "== $n runtime exit=$?"
  python3 -c "
import json;r=json.load(open('/opt/p2a/out/$n-runtime/result.json'))
for c in r['checks']: print(' ',c['name'],c['status'],c.get('passed'),c.get('failed'),c.get('tests'))
"
  python3 verify.py proxy --source /opt/p2a/$n --output /opt/p2a/out/$n-proxy --side $side > /opt/p2a/out/$n-proxy.console 2>&1
  img=meri-p0-proxy:$(git -C /opt/p2a/$n rev-parse --short=12 HEAD)
  docker image inspect $img >/dev/null 2>&1 || { echo "== $n proxy image missing"; continue; }
  echo "== $n proxy modules ($img)"
  python3 /opt/p2a/h/proxy-modules.py $img /opt/p2a/$n /opt/p2a/out/proxymod-$n.json
done
echo GATESDONE
